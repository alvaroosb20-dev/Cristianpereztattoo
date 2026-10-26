// Prueba de extremo a extremo de los flujos (reservas, pagos, tienda, panel) contra un Postgres local
// con el esquema real, simulando la API REST de Supabase, Stripe y Resend. No se publica en Vercel.
// Uso: PGHOST=/var/tmp/pgtest PGPORT=5499 node scripts/test-flows.js
const { execFileSync } = require('child_process');
const assert = require('assert');

Object.assign(process.env, {
  SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'service', STRIPE_SECRET_KEY: 'sk_test_x',
  RESEND_API_KEY: 're_x', EMAIL_FROM: 'Estudio <r@test.com>', OWNER_EMAIL: 'owner@test.com',
  ADMIN_PASSWORD: 'secreto-largo', CALLMEBOT_APIKEY: 'k123', ADMIN_SESSION_SECRET: 'x'.repeat(40), SITE_URL: 'https://web.test',
});

// ---------- Postgres vía psql ----------
const lit = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
function sql(q) {
  try {
    const out = execFileSync('psql', ['-h', process.env.PGHOST, '-p', process.env.PGPORT, '-U', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-c', q], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return out.trim();
  } catch (e) {
    const m = String(e.stderr).match(/ERROR:\s+([0-9A-Z]{5}):/);
    const err = new Error(e.stderr); err.code = m && m[1]; throw err;
  }
}
function where(params) {
  const c = [];
  for (const [k, v] of params) {
    if (['select', 'order', 'limit'].includes(k)) continue;
    const [op, ...rest] = v.split('.'); const val = rest.join('.');
    const col = `"${k}"`;
    if (op === 'eq') c.push(`${col} = ${lit(val)}`);
    else if (op === 'neq') c.push(`${col} <> ${lit(val)}`);
    else if (op === 'gte') c.push(`${col} >= ${lit(val)}`);
    else if (op === 'lte') c.push(`${col} <= ${lit(val)}`);
    else if (op === 'lt') c.push(`${col} < ${lit(val)}`);
    else if (op === 'gt') c.push(`${col} > ${lit(val)}`);
    else if (op === 'is') c.push(`${col} is ${val}`);
    else if (op === 'in') c.push(`${col}::text in (${val.replace(/^\(|\)$/g, '').split(',').map(lit).join(',')})`);
    else throw new Error('op ' + op);
  }
  return c.length ? 'where ' + c.join(' and ') : '';
}
function postgrest(method, path, body) {
  const u = new URL('http://x/' + path);
  const table = u.pathname.slice(1);
  const p = [...u.searchParams.entries()];
  if (table.startsWith('rpc/')) {
    const fn = table.slice(4);
    const args = Object.entries(body || {}).map(([k, v]) => `${k} => ${lit(v)}`).join(', ');
    const out = sql(`select to_json(${fn}(${args}))`);
    return out ? JSON.parse(out) : null;
  }
  const w = where(p);
  if (method === 'GET') {
    const sel = u.searchParams.get('select') || '*';
    const order = u.searchParams.get('order');
    const ord = order ? 'order by ' + order.split(',').map((o) => { const [c, d] = o.split('.'); return `"${c}" ${d === 'desc' ? 'desc' : 'asc'}`; }).join(', ') : '';
    const lim = u.searchParams.get('limit') ? `limit ${Number(u.searchParams.get('limit'))}` : '';
    const cols = sel === '*' ? '*' : sel.split(',').map((c) => `"${c}"`).join(',');
    return JSON.parse(sql(`select coalesce(json_agg(t), '[]') from (select ${cols} from public.${table} ${w} ${ord} ${lim}) t`));
  }
  if (method === 'POST') {
    const j = lit(JSON.stringify(body));
    const cols = Object.keys(body).map((c) => `"${c}"`).join(',');
    if (table === 'settings') {
      sql(`insert into public.settings select * from json_populate_record(null::public.settings, ${j}) on conflict (id) do update set data = excluded.data, updated_at = excluded.updated_at`);
      return null;
    }
    return JSON.parse(sql(`with r as (insert into public.${table} (${cols}) select ${cols} from json_populate_record(null::public.${table}, ${j}) returning *) select coalesce(json_agg(r), '[]') from r`));
  }
  if (method === 'PATCH') {
    const j = lit(JSON.stringify(body));
    const sets = Object.keys(body).map((c) => `"${c}" = (json_populate_record(null::public.${table}, ${j}))."${c}"`).join(', ');
    return JSON.parse(sql(`with r as (update public.${table} set ${sets} ${w} returning *) select coalesce(json_agg(r), '[]') from r`));
  }
  if (method === 'DELETE') { sql(`delete from public.${table} ${w}`); return null; }
}

// ---------- Mocks de red ----------
const stripe = { sessions: {}, refunds: [], n: 0 };
const emails = [];
const whatsapps = [];
const storage = {};
const parseForm = (s) => Object.fromEntries(new URLSearchParams(s));
global.fetch = async (url, opts = {}) => {
  const method = opts.method || 'GET';
  const json = (status, data) => ({ ok: status < 400, status, json: async () => data, text: async () => JSON.stringify(data) });
  if (url.startsWith('https://db.test/rest/v1/')) {
    try { return json(200, postgrest(method, url.slice('https://db.test/rest/v1/'.length), opts.body ? JSON.parse(opts.body) : undefined)); }
    catch (e) { return json(409, { code: e.code, message: e.message }); }
  }
  if (url.startsWith('https://db.test/storage/v1/object/sign/')) return json(200, { signedURL: '/object/sign/' + url.split('/sign/')[1] + '?token=t' });
  if (url.startsWith('https://db.test/storage/v1/object/')) { storage[url] = opts.body; return json(200, { Key: url }); }
  if (url.startsWith('https://api.stripe.com/v1/checkout/sessions')) {
    if (method === 'POST') {
      const f = parseForm(opts.body);
      const id = 'cs_test_' + (++stripe.n);
      const meta = {}; for (const [k, v] of Object.entries(f)) { const m = k.match(/^metadata\[(.+)\]$/); if (m) meta[m[1]] = v; }
      stripe.sessions[id] = { id, url: 'https://checkout.stripe.test/' + id, payment_status: 'unpaid', metadata: meta, payment_intent: 'pi_' + id, form: f };
      return json(200, stripe.sessions[id]);
    }
    const id = url.split('/').pop();
    return stripe.sessions[id] ? json(200, stripe.sessions[id]) : json(404, { error: {} });
  }
  if (url.startsWith('https://api.stripe.com/v1/events/')) {
    const id = url.split('/').pop(); const [, type, sid] = id.match(/^evt_(\w+?)__(cs_test_\d+)$/);
    return json(200, { id, type: 'checkout.session.' + type, data: { object: stripe.sessions[sid] } });
  }
  if (url.startsWith('https://api.stripe.com/v1/refunds')) { stripe.refunds.push(parseForm(opts.body)); return json(200, { id: 're_1' }); }
  if (url.startsWith('https://api.callmebot.com/')) { whatsapps.push(new URL(url)); return json(200, {}); }
  if (url.startsWith('https://api.resend.com/emails')) { emails.push(JSON.parse(opts.body)); return json(200, { id: 'e' }); }
  throw new Error('Unexpected fetch ' + url);
};

// ---------- Llamar a una función como lo haría Vercel ----------
let cookie = '';
async function call(fnPath, { method = 'GET', query = '', body, headers = {} } = {}) {
  const fn = require('../api/' + fnPath);
  const req = { method, url: `/api/${fnPath}${query ? '?' + query : ''}`, headers: { host: 'web.test', cookie, ...headers }, body };
  return new Promise((resolve) => {
    const res = {
      statusCode: 200, headers: {}, headersSent: false,
      setHeader(k, v) { this.headers[k.toLowerCase()] = v; if (k.toLowerCase() === 'set-cookie') cookie = String(v).split(';')[0]; },
      end(data) { this.headersSent = true; resolve({ status: this.statusCode, data: data ? JSON.parse(data) : null }); },
    };
    fn(req, res);
  });
}

const tiny = 'data:image/png;base64,' + Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]).toString('base64');
let passed = 0;
const ok = (name) => { passed++; console.log('  ✓', name); };

(async () => {
  sql("truncate bookings, orders, blocked_dates, reviews; delete from products where slug = 'pegatinas-estudio'; update settings set data = '{}'::jsonb where id = 1; update products set stock = 5 where slug = 'print-proporcion-aurea';");

  const site = await call('site.js');
  assert.equal(site.status, 200); assert.equal(site.data.mode, 'live'); assert.equal(site.data.products.length, 12);
  ok('GET /api/site devuelve productos desde la base de datos');

  // Elegir un día con huecos el mes que viene
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const month = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`;
  const av = await call('availability.js', { query: `month=${month}&size=mediano` });
  assert.equal(av.status, 200);
  const day = Object.keys(av.data.days)[0];
  const slot = av.data.days[day][0];
  assert.ok(day && slot === 660, 'primer hueco a las 11:00');
  ok(`Disponibilidad: ${Object.keys(av.data.days).length} días con huecos en ${month}, mediano dura ${av.data.duration} min`);

  const bk = { name: 'Laura Gómez', email: 'laura@test.com', phone: '+34 600 111 222', style: 'Fine line', body_zone: 'Antebrazo', size: 'mediano', description: 'Una golondrina fina con fecha', date: day, start_min: slot, adult: true, terms: true, image: tiny };
  const bad = await call('bookings.js', { method: 'POST', body: { ...bk, terms: false } });
  assert.equal(bad.status, 400); ok('Sin aceptar condiciones → 400');

  const r1 = await call('bookings.js', { method: 'POST', body: bk });
  assert.equal(r1.status, 200, JSON.stringify(r1.data)); assert.ok(r1.data.url.includes('checkout.stripe.test'));
  const sid1 = Object.keys(stripe.sessions).pop();
  const s1 = stripe.sessions[sid1];
  assert.equal(s1.form['line_items[0][price_data][unit_amount]'], '5000');
  const row1 = JSON.parse(sql(`select row_to_json(b) from bookings b where ref = '${r1.data.ref}'`));
  assert.equal(row1.status, 'pending_payment'); assert.ok(row1.design_path.endsWith('.png')); assert.ok(row1.terms_accepted_at && row1.terms_snapshot.length > 50);
  assert.equal(row1.estimated_price_cents, 18000); assert.equal(row1.end_min - row1.start_min, 180);
  ok('Reserva crea hora bloqueada (pending_payment), guarda diseño, condiciones aceptadas y abre Stripe con señal de 50 €');

  const av2 = await call('availability.js', { query: `month=${month}&size=mini` });
  assert.ok(!(av2.data.days[day] || []).some((t) => t >= 600 && t < 840), 'horas ocupadas no aparecen');
  ok('La hora bloqueada desaparece de la disponibilidad (también para otros tamaños)');

  const r2 = await call('bookings.js', { method: 'POST', body: { ...bk, email: 'otro@test.com', start_min: slot + 60, size: 'mini' } });
  assert.equal(r2.status, 409); ok('Otra persona no puede reservar una hora solapada → 409');

  const st0 = await call('status.js', { query: `session_id=${sid1}` });
  assert.equal(st0.data.paid, false); assert.equal(st0.data.status, 'pending_payment');
  ok('Sin pago, la página de confirmación NO da la cita por reservada');

  stripe.sessions[sid1].payment_status = 'paid';
  const st1 = await call('status.js', { query: `session_id=${sid1}` });
  assert.equal(st1.data.paid, true); assert.equal(st1.data.status, 'pending');
  assert.equal(st1.data.booking.estimated_price_cents, undefined); assert.ok(st1.data.booking.design_url);
  assert.ok(!emails.find((e) => e.to[0] === 'laura@test.com').html.includes('180'), 'el cliente no ve precio');
  assert.equal(emails.length, 2); assert.ok(emails.find((e) => e.to[0] === 'owner@test.com' && e.html.includes('Ver diseño adjunto')));
  ok('Tras pagar: estado pendiente de aprobación, sin precio para el cliente, correos al cliente y al estudio (con enlace al diseño)');

  assert.equal(whatsapps.length, 1);
  assert.equal(whatsapps[0].searchParams.get('phone'), '34646623706');
  assert.ok(whatsapps[0].searchParams.get('text').includes(r1.data.ref) && whatsapps[0].searchParams.get('text').includes('Laura Gómez'));
  ok('Aviso de la reserva por WhatsApp al +34 646 62 37 06 con los datos del cliente');

  const gifts = site.data.products.filter((p) => p.category === 'regalo').map((p) => p.price_cents);
  assert.deepEqual(gifts, [10000, 15000, 20000, 25000, 37000]);
  ok('Tarjetas regalo por separado: 100, 150, 200, 250 € y sesión de brazo 370 €');

  const wh = await call('stripe-webhook.js', { method: 'POST', body: { id: `evt_completed__${sid1}` } });
  assert.equal(wh.status, 200); assert.equal(emails.length, 2); assert.equal(whatsapps.length, 1);
  ok('Webhook repetido es idempotente (no duplica correos)');

  // Reserva sin pagar caducada libera la hora
  const r3 = await call('bookings.js', { method: 'POST', body: { ...bk, email: 'c@test.com', image: null, start_min: slot + 240, size: 'mini' } });
  assert.equal(r3.status, 200);
  sql(`update bookings set hold_expires_at = now() - interval '1 minute' where ref = '${r3.data.ref}'`);
  const r4 = await call('bookings.js', { method: 'POST', body: { ...bk, email: 'd@test.com', image: null, start_min: slot + 240, size: 'mini' } });
  assert.equal(r4.status, 200, JSON.stringify(r4.data));
  assert.equal(JSON.parse(sql(`select to_json(status) from bookings where ref = '${r3.data.ref}'`)), 'expired');
  ok('Una reserva sin pagar caduca y libera la hora para otra persona');

  const sid4 = Object.keys(stripe.sessions).pop();
  await call('stripe-webhook.js', { method: 'POST', body: { id: `evt_expired__${sid4}` } });
  assert.equal(JSON.parse(sql(`select to_json(status) from bookings where ref = '${r4.data.ref}'`)), 'expired');
  ok('Webhook checkout.session.expired libera la hora');

  // ---------- Panel ----------
  cookie = '';
  assert.equal((await call('admin/bookings.js')).status, 401); ok('Panel sin sesión → 401');
  assert.equal((await call('admin/auth.js', { method: 'POST', body: { password: 'mal' } })).status, 401); ok('Contraseña incorrecta → 401');
  assert.equal((await call('admin/auth.js', { method: 'POST', body: { password: 'secreto-largo' } })).status, 200); ok('Login correcto crea cookie de sesión');

  const list = await call('admin/bookings.js', { query: 'status=pending,needs_attention' });
  assert.equal(list.data.bookings.length, 1); assert.equal(list.data.counts.pending, 1);
  const id1 = list.data.bookings[0].id;
  const det = await call('admin/bookings.js', { query: `id=${id1}` });
  assert.ok(det.data.design_url.includes('/object/sign/designs/')); ok('Detalle de cita con enlace privado firmado al diseño');

  const ap = await call('admin/bookings.js', { method: 'PATCH', body: { id: id1, action: 'approve', final_price_cents: 20000 } });
  assert.equal(ap.data.status, 'confirmed'); assert.equal(emails.length, 3); assert.ok(emails[2].html.includes('200'));
  ok('Aprobar con presupuesto final → confirmada y correo al cliente');

  const man = await call('admin/bookings.js', { method: 'POST', body: { name: 'Walk-in', appt_date: day, start_min: slot + 300, duration_min: 60, size_id: 'mini' } });
  assert.equal(man.status, 200);
  const clash = await call('admin/bookings.js', { method: 'PATCH', body: { id: id1, action: 'reschedule', appt_date: day, start_min: slot + 150, duration_min: 180 } });
  assert.equal(clash.status, 409); ok('Reprogramar encima de otra cita → 409');

  const cancel = await call('admin/bookings.js', { method: 'PATCH', body: { id: id1, action: 'cancel', refund: true, message: 'Enfermedad' } });
  assert.equal(cancel.data.status, 'cancelled'); assert.equal(cancel.data.payment_status, 'refunded'); assert.equal(stripe.refunds[0].payment_intent, `pi_${sid1}`);
  ok('Cancelar con devolución → reembolso en Stripe');

  const set = await call('admin/settings.js', { method: 'PUT', body: { deposit_cents: 7000 } });
  assert.equal(set.data.deposit_cents, 7000);
  const site2 = await call('site.js'); assert.equal(site2.data.settings.deposit_cents, 7000);
  assert.equal((await call('admin/settings.js', { method: 'PUT', body: { deposit_cents: 0 } })).status, 400);
  ok('Cambiar la señal desde el panel (y no permite 0 €)');

  await call('admin/collection.js', { method: 'POST', query: 'type=blocked', body: { date_from: day, reason: 'Convención' } });
  const av3 = await call('availability.js', { query: `month=${month}&size=mini` });
  assert.ok(!av3.data.days[day]); ok('Bloquear un día lo quita del calendario');

  // ---------- Tienda ----------
  const products = site.data.products;
  const print = products.find((p) => p.slug === 'print-proporcion-aurea');
  const tee = products.find((p) => p.slug === 'camiseta-estatua');
  const cust = { customer: { name: 'Pablo Ruiz', email: 'pablo@test.com', phone: '600123123' }, shipping: { line1: 'C/ Castillo 1', postal_code: '38001', city: 'Santa Cruz', province: 'S/C de Tenerife' }, zone: 'canarias' };
  const noVar = await call('checkout.js', { method: 'POST', body: { ...cust, items: [{ id: tee.id, qty: 1, options: {} }] } });
  assert.equal(noVar.status, 400); ok('Sin elegir talla → 400');
  const tooMany = await call('checkout.js', { method: 'POST', body: { ...cust, items: [{ id: print.id, qty: 6, options: { Formato: 'A4' } }] } });
  assert.equal(tooMany.status, 409); ok('Más unidades que stock → 409');
  const co = await call('checkout.js', { method: 'POST', body: { ...cust, items: [{ id: print.id, qty: 2, options: { Formato: 'A4' } }, { id: tee.id, qty: 1, options: { Talla: 'M' } }] } });
  assert.equal(co.status, 200, JSON.stringify(co.data));
  const sidO = Object.keys(stripe.sessions).pop();
  const f = stripe.sessions[sidO].form;
  assert.equal(f['line_items[0][price_data][unit_amount]'], '2800'); assert.equal(f['line_items[1][price_data][unit_amount]'], '3500');
  assert.ok(!f['line_items[2][price_data][unit_amount]'], 'envío gratis > 60 €');
  const ord = JSON.parse(sql(`select row_to_json(o) from orders o where ref = '${co.data.ref}'`));
  assert.equal(ord.total_cents, 9100); assert.equal(ord.shipping_cents, 0);
  ok('Checkout recalcula precios del servidor (variante A4 = 28 €), envío gratis desde 60 €, total 91 €');
  stripe.sessions[sidO].payment_status = 'paid';
  await call('stripe-webhook.js', { method: 'POST', body: { id: `evt_completed__${sidO}` } });
  assert.equal(JSON.parse(sql(`select to_json(stock) from products where id = '${print.id}'`)), 3);
  const stO = await call('status.js', { query: `session_id=${sidO}` });
  assert.equal(stO.data.order.total_cents, 9100); assert.ok(emails.some((e) => e.subject.includes(co.data.ref)));
  ok('Pago del pedido: estado pagado, stock descontado (5 → 3) y correo de confirmación');

  const orders = await call('admin/collection.js', { query: 'type=orders&status=paid' });
  assert.equal(orders.data.length, 1);
  const shipped = await call('admin/collection.js', { method: 'PATCH', query: 'type=orders', body: { id: orders.data[0].id, status: 'shipped', tracking: 'CORREOS123' } });
  assert.equal(shipped.data.status, 'shipped'); ok('Gestionar pedido desde el panel (enviado + seguimiento)');

  const np = await call('admin/collection.js', { method: 'POST', query: 'type=products', body: { name: 'Pegatinas Estudio', price_cents: 500, stock: 100, category: 'regalo', variants: [], images: [], active: true } });
  assert.equal(np.data.slug, 'pegatinas-estudio'); ok('Crear producto desde el panel');

  console.log(`\n${passed} comprobaciones superadas`);
})().catch((e) => { console.error('\n✗ FALLO:', e); process.exit(1); });
