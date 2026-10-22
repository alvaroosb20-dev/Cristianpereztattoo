// Acceso a ajustes, catálogo y la lógica de confirmación de pagos (compartida por webhook y páginas de estado).
const core = require('./core');
const { DEFAULT_SETTINGS, PRODUCTS, PORTFOLIO } = require('../../assets/js/seed.js');
const { fmtMin } = require('../../assets/js/availability.js');

const clone = (o) => JSON.parse(JSON.stringify(o));

function mergeSettings(saved) {
  const base = clone(DEFAULT_SETTINGS);
  if (!saved || typeof saved !== 'object') return base;
  for (const [k, v] of Object.entries(saved)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
      base[k] = { ...base[k], ...v };
    } else if (v !== undefined && v !== null) base[k] = v;
  }
  return base;
}

async function getSettings() {
  if (!core.hasDb()) return clone(DEFAULT_SETTINGS);
  const rows = await core.db('settings?id=eq.1&select=data');
  return mergeSettings(rows && rows[0] && rows[0].data);
}

// Lo que se puede enseñar en la web pública
function publicSettings(s) {
  return {
    studio: s.studio, about: s.about, announcement: s.announcement,
    deposit_cents: s.deposit_cents, deposit_deducted: s.deposit_deducted,
    sizes: s.sizes, styles: s.styles, body_zones: s.body_zones,
    schedule: s.schedule, shipping: s.shipping, texts: s.texts,
  };
}

async function getProducts({ includeInactive = false } = {}) {
  if (!core.hasDb()) return clone(PRODUCTS);
  return core.db(`products?select=*${includeInactive ? '' : '&active=is.true'}&order=sort.asc,created_at.desc`);
}

async function getPortfolio() {
  if (!core.hasDb()) return clone(PORTFOLIO);
  return core.db('portfolio?select=*&visible=is.true&order=sort.asc,created_at.desc');
}

async function getReviews() {
  if (!core.hasDb()) return [];
  return core.db('reviews?select=id,author,text,rating&visible=is.true&order=sort.asc,created_at.desc');
}

const dateEs = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

function emailShell(title, inner, studio) {
  return `<!doctype html><html><body style="margin:0;background:#0d0c0b;padding:24px;font-family:Helvetica,Arial,sans-serif;color:#ece6da">
  <div style="max-width:560px;margin:0 auto;background:#171513;border:1px solid #2a2622;padding:28px">
    <div style="font-family:Georgia,serif;font-size:22px;letter-spacing:.04em">${core.esc(studio.name)}</div>
    <div style="height:1px;background:#b8975a;margin:16px 0 22px"></div>
    <h1 style="font-family:Georgia,serif;font-weight:normal;font-size:26px;margin:0 0 16px">${title}</h1>
    ${inner}
    <p style="color:#8f877b;font-size:12px;margin-top:28px">${core.esc(studio.name)} · ${core.esc(studio.address || studio.city)}${studio.phone ? ' · ' + core.esc(studio.phone) : ''}${studio.instagram ? ' · @' + core.esc(studio.instagram) : ''}</p>
  </div></body></html>`;
}
const row = (k, v) => `<tr><td style="padding:6px 0;color:#8f877b;font-size:14px;width:44%">${k}</td><td style="padding:6px 0;font-size:14px">${v}</td></tr>`;

// Marca la cita como pagada (idempotente) y envía los correos. Devuelve la cita actualizada.
async function finalizeBookingPayment(bookingId, session) {
  const nowIso = new Date().toISOString();
  const patch = {
    status: 'pending', deposit_paid: true, payment_status: 'paid', paid_at: nowIso,
    stripe_payment_intent: session.payment_intent || null, hold_expires_at: null,
  };
  let updated = [];
  try {
    updated = await core.db(`bookings?id=eq.${bookingId}&status=in.(pending_payment,expired)`, { method: 'PATCH', body: patch, prefer: 'return=representation' });
  } catch (e) {
    if (e.code === '23P01') {
      // La reserva había caducado y otra persona ocupó la hora: queda pagada pero sin hueco. Avisamos al estudio.
      updated = await core.db(`bookings?id=eq.${bookingId}&status=in.(pending_payment,expired)`, {
        method: 'PATCH', prefer: 'return=representation',
        body: { ...patch, status: 'needs_attention', admin_notes: 'Pago recibido tras caducar la reserva y la hora ya estaba ocupada. Contactar con el cliente para nueva fecha.' },
      });
    } else throw e;
  }
  const rows = await core.db(`bookings?id=eq.${bookingId}&select=*`);
  const booking = rows[0];
  if (updated && updated.length) await sendBookingEmails(booking).catch((e) => console.error(e));
  return booking;
}

async function sendBookingEmails(b) {
  const s = await getSettings();
  const studio = s.studio;
  const price = b.final_price_cents || b.estimated_price_cents;
  const when = `${dateEs(b.appt_date)} · ${fmtMin(b.start_min)} h`;
  const base = `
    ${row('Referencia', `<strong>${core.esc(b.ref)}</strong>`)}
    ${row('Fecha y hora', core.esc(when))}
    ${row('Duración estimada', `${Math.round((b.end_min - b.start_min) / 6) / 10} h`)}
    ${row('Estilo', core.esc(b.style))}
    ${row('Zona · tamaño', `${core.esc(b.body_zone)} · ${core.esc(b.size_label)}`)}
    ${row('Señal pagada', core.euros(b.deposit_cents))}`;
  const table = `<table style="width:100%;border-collapse:collapse">${base}</table>`;
  const ownerTable = `<table style="width:100%;border-collapse:collapse">${base}${price ? row('Precio orientativo del tamaño (interno)', core.euros(price)) : ''}</table>`;

  const clientHtml = emailShell('Señal recibida. Tu fecha está bloqueada.',
    `<p style="font-size:15px;line-height:1.6">Hola ${core.esc(b.name.split(' ')[0])}, hemos recibido el pago de tu señal. Cristhian revisará tu idea y te confirmará la cita y el presupuesto del tatuaje.</p>${table}
     <p style="font-size:13px;color:#8f877b;line-height:1.6">Este correo sirve como justificante del pago de la señal (${core.euros(b.deposit_cents)}). Stripe te enviará además su propio recibo.${s.deposit_deducted ? ' La señal se descuenta del precio final del tatuaje.' : ''}</p>`, studio);
  await core.sendEmail({ to: b.email, subject: `Reserva ${b.ref} · señal recibida`, html: clientHtml, replyTo: core.env.OWNER_EMAIL || studio.email || undefined });

  const owner = core.env.OWNER_EMAIL || studio.email;
  if (owner) {
    const designUrl = b.design_path ? await core.storageSignedUrl('designs', b.design_path, 60 * 60 * 24 * 7) : null;
    const site = core.env.SITE_URL || '';
    const ownerHtml = emailShell(`Nueva reserva · ${core.esc(b.name)}`,
      `${ownerTable}<table style="width:100%;border-collapse:collapse;margin-top:10px">
        ${row('Cliente', core.esc(b.name))}${row('Email', core.esc(b.email))}${row('Teléfono', core.esc(b.phone))}
      </table>
      <p style="font-size:14px;line-height:1.6;margin-top:14px"><strong>Idea:</strong><br>${core.esc(b.description).replace(/\n/g, '<br>')}</p>
      ${designUrl ? `<p><a href="${designUrl}" style="color:#b8975a">Ver diseño adjunto</a> <span style="color:#8f877b;font-size:12px">(enlace privado, caduca en 7 días)</span></p>` : '<p style="color:#8f877b">Sin diseño adjunto.</p>'}
      ${site ? `<p><a href="${site}/admin" style="color:#b8975a">Abrir el panel para aprobarla</a></p>` : ''}`, studio);
    await core.sendEmail({ to: owner, subject: `Nueva reserva ${b.ref} · ${when}`, html: ownerHtml, replyTo: b.email });
  }
}

async function finalizeOrderPayment(orderId, session) {
  const nowIso = new Date().toISOString();
  const updated = await core.db(`orders?id=eq.${orderId}&status=eq.pending_payment`, {
    method: 'PATCH', prefer: 'return=representation',
    body: { status: 'paid', paid_at: nowIso, stripe_payment_intent: session.payment_intent || null },
  });
  const rows = await core.db(`orders?id=eq.${orderId}&select=*`);
  const order = rows[0];
  if (updated && updated.length) {
    for (const it of order.items || []) {
      try { await core.db('rpc/decrement_stock', { method: 'POST', body: { p_id: it.product_id, p_qty: it.qty } }); }
      catch (e) { console.error('stock', e); }
    }
    await sendOrderEmails(order).catch((e) => console.error(e));
  }
  return order;
}

async function sendOrderEmails(o) {
  const s = await getSettings();
  const studio = s.studio;
  const items = (o.items || []).map((it) => row(`${core.esc(it.name)}${it.options_label ? ' · ' + core.esc(it.options_label) : ''} × ${it.qty}`, core.euros(it.unit_cents * it.qty))).join('');
  const table = `<table style="width:100%;border-collapse:collapse">${items}
    ${row('Subtotal', core.euros(o.subtotal_cents))}${row(`Envío (${core.esc(o.shipping_label || '')})`, core.euros(o.shipping_cents))}
    ${row('<strong>Total</strong>', `<strong>${core.euros(o.total_cents)}</strong>`)}</table>`;
  const a = o.shipping_address || {};
  const addr = o.shipping_zone === 'recogida' ? 'Recogida en el estudio' : `${core.esc(a.line1)} ${core.esc(a.line2 || '')}, ${core.esc(a.postal_code)} ${core.esc(a.city)} (${core.esc(a.province)})`;
  const html = emailShell('Gracias por tu pedido',
    `<p style="font-size:15px;line-height:1.6">Pedido <strong>${core.esc(o.ref)}</strong> confirmado. Te avisaremos cuando salga.</p>${table}<p style="font-size:14px;color:#8f877b">Entrega: ${addr}</p>`, studio);
  await core.sendEmail({ to: o.customer.email, subject: `Pedido ${o.ref} confirmado`, html });
  const owner = core.env.OWNER_EMAIL || studio.email;
  if (owner) await core.sendEmail({ to: owner, subject: `Nuevo pedido ${o.ref} · ${core.euros(o.total_cents)}`, html: emailShell(`Nuevo pedido · ${core.esc(o.customer.name)}`, `${table}<p style="font-size:14px">Cliente: ${core.esc(o.customer.name)} · ${core.esc(o.customer.email)} · ${core.esc(o.customer.phone)}</p><p style="font-size:14px">Entrega: ${addr}</p>`, studio) });
}

module.exports = { getSettings, mergeSettings, publicSettings, getProducts, getPortfolio, getReviews, finalizeBookingPayment, finalizeOrderPayment, dateEs, clone };
