/* Panel de administración. Todo pasa por /api/admin/* con sesión de cookie HttpOnly. */
(function () {
  const { $, $$, esc, euros, toast } = CP;
  let demo = false;
  const api = (path, opts) => (demo ? Demo.handle(path, opts || {}) : CP.api(path, opts));
  const A = window.CPAvail;
  const app = $('#app');
  const toCents = (v) => Math.round(parseFloat(String(v).replace(',', '.')) * 100) || 0;
  const fromCents = (c) => (c == null ? '' : (c / 100).toFixed(2).replace('.00', '').replace('.', ','));
  const STATUS_ES = { pending_payment: 'Sin pagar', pending: 'Pendiente', confirmed: 'Confirmada', completed: 'Completada', cancelled: 'Cancelada', rejected: 'Rechazada', expired: 'Caducada', needs_attention: 'Revisar' };
  const ORDER_ES = { pending_payment: 'Sin pagar', paid: 'Pagado', shipped: 'Enviado', completed: 'Entregado', cancelled: 'Cancelado', refunded: 'Reembolsado', expired: 'Caducado' };
  const dLabel = (d) => { const [y, m, dd] = d.split('-').map(Number); return new Date(Date.UTC(y, m - 1, dd)).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }); };
  const pill = (s, map) => `<span class="pill ${esc(s)}">${esc((map || STATUS_ES)[s] || s)}</span>`;
  let settings = null, health = {};


  // ---------- Modo demostración (vista previa sin servidor) ----------
  // Si la web se abre sin las funciones de Vercel, el panel funciona igual con los datos guardados en este dispositivo.
  // Lo que cambies aquí se ve en la vista previa de la web. Con Supabase conectado, todo se guarda de verdad.
  const Demo = (() => {
    const KEY = 'cp_admin_demo_v1';
    const S = window.CPSeed;
    const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2) + Date.now());
    const clone = (o) => JSON.parse(JSON.stringify(o));
    function initial() {
      const today = A.canaryNow().date;
      const day = (n) => A.addDays(today, n);
      const settings = clone(S.DEFAULT_SETTINGS);
      return {
        settings,
        products: clone(S.PRODUCTS).map((p) => ({ ...p, id: uid(), created_at: new Date().toISOString() })),
        portfolio: clone(S.PORTFOLIO).map((p) => ({ ...p, id: uid() })),
        reviews: [], blocked: [], orders: [],
        bookings: [
          { id: uid(), ref: 'CP-EJEMPLO1', status: 'pending', name: 'Cliente de ejemplo', email: 'cliente@ejemplo.com', phone: '+34 600 000 000', style: 'Fine line', body_zone: 'Antebrazo', size_id: 'mediano', size_label: 'Mediano (10 – 15 cm)', description: 'Cita de ejemplo para ver cómo funciona el panel.', design_path: null, appt_date: day(3), start_min: 660, end_min: 840, estimated_price_cents: 18000, final_price_cents: null, deposit_cents: 5000, deposit_paid: true, payment_status: 'paid', paid_at: new Date().toISOString(), terms_accepted_at: new Date().toISOString(), terms_hash: 'ejemplo', created_at: new Date().toISOString() },
          { id: uid(), ref: 'CP-EJEMPLO2', status: 'confirmed', name: 'Otro cliente de ejemplo', email: 'otro@ejemplo.com', phone: '+34 600 000 001', style: 'Blackwork', body_zone: 'Pierna', size_id: 'grande', size_label: 'Grande (15 – 25 cm)', description: 'Cita confirmada de ejemplo.', design_path: null, appt_date: day(6), start_min: 720, end_min: 1020, estimated_price_cents: 30000, final_price_cents: 32000, deposit_cents: 5000, deposit_paid: true, payment_status: 'paid', paid_at: new Date().toISOString(), terms_accepted_at: new Date().toISOString(), terms_hash: 'ejemplo', created_at: new Date().toISOString() },
        ],
      };
    }
    let db = CP.store.get(KEY, null) || initial();
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { throw Object.assign(new Error('No queda espacio en este dispositivo para más fotos de demostración. Usa fotos más pequeñas o borra alguna.'), { status: 413 }); } };
    save();
    const err = (status, message) => Promise.reject(Object.assign(new Error(message), { status }));
    const TABLE = { products: 'products', portfolio: 'portfolio', reviews: 'reviews', blocked: 'blocked', orders: 'orders' };
    function handle(path, opts) {
      const u = new URL(path, 'http://x/');
      const route = u.pathname.slice(1);
      const q = u.searchParams;
      const method = opts.method || 'GET';
      const body = opts.body || {};
      try {
        if (route === 'admin/auth') { if (method !== 'DELETE') CP.session.set('cp_admin_demo_login', true); else CP.session.del('cp_admin_demo_login'); return Promise.resolve({ ok: true, demo: true, db: false, stripe: false, email: false }); }
        if (route === 'admin/settings') {
          if (method === 'PUT') { Object.assign(db.settings, clone(body)); save(); }
          return Promise.resolve(clone(db.settings));
        }
        if (route === 'admin/upload') return Promise.resolve({ url: body.image });
        if (route === 'admin/bookings') {
          if (method === 'GET') {
            if (q.get('id')) { const b = db.bookings.find((x) => x.id === q.get('id')); return b ? Promise.resolve({ ...clone(b), design_url: null }) : err(404, 'No existe'); }
            let list = db.bookings.slice();
            if (q.get('status')) { const st = q.get('status').split(','); list = list.filter((b) => st.includes(b.status)); }
            if (q.get('from')) list = list.filter((b) => b.appt_date >= q.get('from'));
            if (q.get('to')) list = list.filter((b) => b.appt_date <= q.get('to'));
            list.sort((a, b) => (a.appt_date + a.start_min).localeCompare(b.appt_date + b.start_min));
            const counts = {}; db.bookings.forEach((b) => { counts[b.status] = (counts[b.status] || 0) + 1; });
            return Promise.resolve({ bookings: clone(list), counts });
          }
          const overlaps = (date, s1, e1, ignore) => db.bookings.some((b) => b.id !== ignore && b.appt_date === date && ['pending_payment', 'pending', 'confirmed'].includes(b.status) && s1 < b.end_min && e1 > b.start_min);
          if (method === 'POST') {
            const size = db.settings.sizes.find((z) => z.id === body.size_id) || db.settings.sizes[0];
            const dur = Number(body.duration_min) || size.duration_min;
            if (!body.name || !body.appt_date) return err(400, 'Faltan nombre, día u hora.');
            if (overlaps(body.appt_date, body.start_min, body.start_min + dur)) return err(409, 'Esa franja se solapa con otra cita.');
            const row = { id: uid(), ref: 'CP-' + Math.random().toString(36).slice(2, 8).toUpperCase(), status: 'confirmed', ...body, size_label: `${size.label} (${size.detail})`, end_min: body.start_min + dur, deposit_cents: 0, deposit_paid: false, payment_status: 'manual', created_at: new Date().toISOString() };
            db.bookings.push(row); save(); return Promise.resolve(row);
          }
          if (method === 'PATCH') {
            const b = db.bookings.find((x) => x.id === body.id);
            if (!b) return err(404, 'No existe');
            const map = { approve: 'confirmed', reject: 'rejected', complete: 'completed', cancel: 'cancelled' };
            if (body.action === 'reschedule') {
              const dur = Number(body.duration_min) || (b.end_min - b.start_min);
              if (overlaps(body.appt_date, body.start_min, body.start_min + dur, b.id)) return err(409, 'Esa franja se solapa con otra cita.');
              Object.assign(b, { appt_date: body.appt_date, start_min: body.start_min, end_min: body.start_min + dur });
            } else if (map[body.action]) b.status = map[body.action];
            if (body.final_price_cents !== undefined) b.final_price_cents = body.final_price_cents;
            if (body.admin_notes !== undefined) b.admin_notes = body.admin_notes;
            if (body.refund) b.payment_status = 'refunded';
            save(); return Promise.resolve(clone(b));
          }
        }
        if (route === 'admin/collection') {
          const t = TABLE[q.get('type')];
          if (!t) return err(400, 'Tipo no válido');
          if (method === 'GET') {
            let list = db[t].slice();
            if (q.get('status')) { const st = q.get('status').split(','); list = list.filter((o) => st.includes(o.status)); }
            list.sort((a, b) => (a.sort || 0) - (b.sort || 0));
            return Promise.resolve(clone(list));
          }
          if (method === 'POST') {
            const row = { id: uid(), created_at: new Date().toISOString(), ...clone(body) };
            if (t === 'products' && !row.slug) row.slug = String(row.name || 'producto').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + row.id.slice(0, 4);
            if (t === 'blocked' && !row.date_to) row.date_to = row.date_from;
            db[t].push(row); save(); return Promise.resolve(row);
          }
          if (method === 'PATCH') { const r = db[t].find((x) => x.id === body.id); if (!r) return err(404, 'No existe'); Object.assign(r, clone(body)); save(); return Promise.resolve(clone(r)); }
          if (method === 'DELETE') { db[t] = db[t].filter((x) => x.id !== q.get('id')); save(); return Promise.resolve({ ok: true }); }
        }
        return err(404, 'Ruta no disponible en demostración');
      } catch (e) { return Promise.reject(e); }
    }
    function reset() { db = initial(); save(); }
    return { handle, reset };
  })();

  // ---------- Login ----------
  async function boot() {
    let r = null;
    try { r = await CP.api('admin/auth'); } catch (e) { r = null; }
    if (!r || typeof r !== 'object') { demo = true; return login({ demoOnly: true }); }       // vista previa sin servidor
    if (r.ok && !r.db) { demo = true; health = { demo: true, noDb: true }; return start(); }   // contraseña OK pero sin Supabase
    if (r.ok) { health = r; return start(); }
    if (r.reason === 'no_password') return setupScreen(r.setup);
    login({});
  }

  // Pantalla de configuración cuando aún faltan claves en Vercel
  function setupScreen(st) {
    const row = (ok, name, help) => `<li class="setup-row ${ok ? 'ok' : ''}"><span class="setup-dot" aria-hidden="true">${ok ? '✓' : ''}</span><div><strong>${name}</strong><span class="muted">${help}</span></div></li>`;
    app.innerHTML = `<div class="login"><div class="setup">
      <span class="brand" style="justify-self:start;text-align:left"><span class="brand-name">Cristhian Pérez</span><span class="brand-sub" style="padding-left:0">Panel del estudio</span></span>
      <h1 class="display h3" style="margin:.4rem 0 0">Activa el panel</h1>
      <p class="muted" style="margin:0">Falta poner en Vercel la contraseña del panel. Se hace una sola vez.</p>
      <ol class="setup-steps">
        <li>En Vercel, abre el proyecto → <strong>Settings → Environment Variables</strong>.</li>
        <li>Añade <code>ADMIN_PASSWORD</code> con la contraseña que quieras.</li>
        <li>Para guardar fotos y precios, añade también <code>SUPABASE_URL</code> y <code>SUPABASE_SERVICE_ROLE_KEY</code>.</li>
        <li>Ve a <strong>Deployments</strong> → ⋯ en la última → <strong>Redeploy</strong>, y recarga esta página.</li>
      </ol>
      <ul class="setup-list">
        ${row(st.password, 'Contraseña del panel', 'ADMIN_PASSWORD')}
        ${row(st.db, 'Base de datos (Supabase)', 'Guarda fotos, precios, citas y pedidos')}
        ${row(st.stripe, 'Pagos (Stripe)', 'Señal de 50 € y compras de la tienda')}
        ${row(st.email, 'Correos (Resend)', 'Confirmaciones al cliente y avisos al estudio')}
      </ul>
      <button class="btn btn-ghost" type="button" id="try-demo">Mientras tanto, probar el panel en modo demostración</button>
      <a class="link mono" href="../index.html">← Volver a la web</a>
    </div></div>`;
    $('#try-demo').addEventListener('click', () => { demo = true; health = { demo: true }; CP.session.set('cp_admin_demo_login', true); start(); });
  }

  function login(opts) {
    opts = opts || {};
    const msg = opts.msg || '';
    app.innerHTML = `<div class="login"><form id="login-form" novalidate>
      <span class="brand" style="justify-self:start;text-align:left"><span class="brand-name">Cristhian Pérez</span><span class="brand-sub" style="padding-left:0">Panel del estudio</span></span>
      <h1 class="display h3" style="margin:.6rem 0 0">Entrar</h1>
      ${opts.demoOnly ? '<div class="notice">Vista previa sin servidor: el panel funciona en modo demostración y guarda los cambios solo en este dispositivo. Entra con cualquier contraseña.</div>' : ''}
      ${msg ? `<div class="notice error">${esc(msg)}</div>` : ''}
      <label class="field"><span class="label">Contraseña</span>
        <span class="pw-wrap"><input class="input" id="pw" type="password" autocomplete="current-password" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go" required><button class="pw-eye" type="button" id="pw-eye" aria-label="Mostrar contraseña">Ver</button></span>
      </label>
      <div id="login-err"></div>
      <button class="btn btn-gold" type="submit">Entrar</button>
      <span class="mono muted" style="font-size:.72rem">La sesión se mantiene abierta 30 días en este dispositivo.</span>
      <a class="link mono" href="../index.html">← Volver a la web</a>
    </form></div>`;
    $('#pw-eye').addEventListener('click', () => { const i = $('#pw'); const show = i.type === 'password'; i.type = show ? 'text' : 'password'; $('#pw-eye').textContent = show ? 'Ocultar' : 'Ver'; i.focus(); });
    $('#login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const b = $('#login-form button[type=submit]');
      const pw = $('#pw').value;
      if (!pw) { $('#login-err').innerHTML = '<div class="notice error">Escribe la contraseña.</div>'; return; }
      b.classList.add('is-loading'); b.textContent = 'Entrando…';
      try {
        const r = await api('admin/auth', { method: 'POST', body: { password: pw } });
        if (demo) { health = { demo: true }; return start(); }
        if (r && r.ok && !r.db) { demo = true; health = { demo: true, noDb: true }; return start(); }
        health = r || {}; start();
      } catch (err) {
        $('#login-err').innerHTML = `<div class="notice error">${esc(err.message)}</div>`;
        b.classList.remove('is-loading'); b.textContent = 'Entrar';
        $('#pw').select();
      }
    });
    setTimeout(() => $('#pw') && $('#pw').focus(), 50);
  }

  // ---------- Estructura ----------
  const TABS = [
    ['citas', 'Citas'], ['preparando', 'Preparando web'], ['calendario', 'Calendario'], ['horario', 'Horario y bloqueos'], ['precios', 'Precios y señal'],
    ['productos', 'Productos'], ['pedidos', 'Pedidos'], ['portafolio', 'Portafolio'], ['opiniones', 'Opiniones'], ['estudio', 'Estudio y textos'],
  ];
  let tab = (location.hash || '#citas').slice(1);

  async function start() {
    settings = await api('admin/settings');
    app.innerHTML = `<div class="adm">
      <header class="adm-top">
        <span class="brand-name">Panel</span>
        <span class="label" id="top-title"></span>
        <button class="btn btn-ghost" type="button" id="menu-toggle" aria-expanded="false" aria-controls="adm-side" style="min-height:40px;padding:0 1em">Menú</button>
      </header>
      <aside class="adm-side" id="adm-side">
        <a class="brand" href="../index.html" target="_blank" rel="noopener"><span class="brand-name">Cristhian Pérez</span><span class="brand-sub" style="padding-left:0">Panel</span></a>
        ${TABS.map(([k, t]) => `<button class="adm-tab" type="button" data-tab="${k}">${t}<span class="badge" data-badge="${k}" hidden></span></button>`).join('')}
        <div class="side-foot mono">
          ${health.demo ? '<span class="mono">Modo demostración</span>' : ''}
          <span class="status-dot ${health.db ? 'on' : ''}">Base de datos</span>
          <span class="status-dot ${health.stripe ? 'on' : ''}">Stripe</span>
          <span class="status-dot ${health.email ? 'on' : ''}">Correo</span>
          <button class="link" type="button" id="logout" style="text-align:left;margin-top:.6rem">Cerrar sesión</button>
        </div>
      </aside>
      <main class="adm-main" id="view"></main>
    </div>`;
    $$('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; history.replaceState(null, '', '#' + tab); app.classList.remove('menu-open'); show(); window.scrollTo(0, 0); }));
    renderWebState();
    $('#logout').addEventListener('click', async () => { try { await api('admin/auth', { method: 'DELETE' }); } catch {} CP.session.del('cp_admin_demo_login'); demo = false; health = {}; boot(); });
    // Menú en el móvil
    $('#menu-toggle').addEventListener('click', () => { const open = !app.classList.contains('menu-open'); app.classList.toggle('menu-open', open); $('#menu-toggle').setAttribute('aria-expanded', String(open)); });
    show();
    refreshBadge();
  }
  async function refreshBadge() {
    try {
      const r = await api('admin/bookings?status=pending,needs_attention');
      const b = $('[data-badge="citas"]');
      b.textContent = r.bookings.length; b.hidden = !r.bookings.length;
    } catch {}
  }
  function renderWebState() {
    const b = $('[data-badge="preparando"]');
    if (!b) return;
    const on = settings && settings.maintenance && settings.maintenance.on;
    b.textContent = on ? 'ON' : ''; b.hidden = !on;
  }
  function show() {
    if (!TABS.some(([k]) => k === tab)) tab = 'citas';
    $$('[data-tab]').forEach((b) => b.setAttribute('aria-current', b.dataset.tab === tab));
    const tt = $('#top-title'); if (tt) tt.textContent = (TABS.find(([k]) => k === tab) || [])[1] || '';
    const v = $('#view');
    v.innerHTML = '<p class="muted">Cargando…</p>';

    const views = { citas, preparando, calendario, horario, precios, productos, pedidos, portafolio, opiniones, estudio };
    (views[tab] || citas)(v).then(() => { if (health.demo && tab !== 'preparando' && !v.querySelector('[data-demo-reset]')) v.insertAdjacentHTML('afterbegin', demoNotice()); }).catch((e) => { v.innerHTML = `<div class="notice error">${esc(e.message)}</div>`; if (e.status === 401) login({ msg: 'Tu sesión ha caducado. Vuelve a entrar.' }); });
  }
  async function saveSettings(patch, btn) {
    if (btn) btn.classList.add('is-loading');
    try { settings = await api('admin/settings', { method: 'PUT', body: patch }); toast('Guardado'); }
    catch (e) { toast(e.message); }
    finally { if (btn) btn.classList.remove('is-loading'); }
  }
  function drawer(html) {
    closeDrawer();
    const bg = document.createElement('div'); bg.className = 'drawer-bg';
    const d = document.createElement('aside'); d.className = 'drawer'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true');
    d.innerHTML = html;
    bg.addEventListener('click', closeDrawer);
    document.body.append(bg, d);
    document.body.style.overflow = 'hidden';
    d.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeDrawer));
    return d;
  }
  function closeDrawer() { $$('.drawer, .drawer-bg').forEach((e) => e.remove()); document.body.style.overflow = ''; }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });


  // ---------- PREPARANDO WEB ----------
  async function preparando(v) {
    const m = settings.maintenance || { on: false, title: 'Preparando web', message: '' };
    v.innerHTML = `
      ${health.demo ? demoNotice() : ''}
      <div class="adm-head"><h1>Preparando web</h1></div>
      <div class="box" style="margin-bottom:1.4rem">
        <div class="web-state ${m.on ? 'on' : ''}">
          <span class="label">[ Estado de la web ]</span>
          <strong>${m.on ? 'Pantalla «Preparando web» activada' : 'Web abierta al público'}</strong>
          <span class="muted">${m.on ? 'Los visitantes solo ven la pantalla de espera. Tú puedes ver la web completa porque has entrado al panel.' : 'Todo el mundo ve la web completa: tienda, reservas y portafolio.'}</span>
        </div>
        <label class="switch"><input type="checkbox" id="mt-on" ${m.on ? 'checked' : ''}><span class="switch-ui" aria-hidden="true"></span><span>Activar pantalla «Preparando web»</span></label>
      </div>
      <div class="box" style="margin-bottom:1.4rem">
        <span class="label">Texto de la pantalla</span>
        <label class="field"><span class="label muted">Título</span><input class="input" id="mt-title" value="${esc(m.title || 'Preparando web')}"></label>
        <label class="field"><span class="label muted">Mensaje</span><textarea class="textarea" id="mt-msg" style="min-height:90px">${esc(m.message || '')}</textarea></label>
        <span class="mono muted" style="font-size:.72rem">Debajo salen automáticamente los botones de WhatsApp e Instagram y la dirección del estudio.</span>
      </div>
      <div class="box">
        <span class="label">Así la verán los visitantes</span>
        <div class="mnt-preview">
          <span class="label muted">[ ${esc(settings.studio.artist)} · Tattoo ]</span>
          <div class="display" id="mt-prev-title" style="font-size:clamp(2.2rem,7vw,4.4rem)">${esc(m.title || 'Preparando web')}</div>
          <div class="mnt-bar" aria-hidden="true"><span></span></div>
          <p id="mt-prev-msg" style="margin:0;max-width:46ch">${esc(m.message || '')}</p>
          <div class="row-actions"><span class="btn" style="pointer-events:none">WhatsApp</span><span class="btn btn-ghost" style="pointer-events:none">@${esc(settings.studio.instagram || '')}</span></div>
        </div>
      </div>
      <div class="save-bar"><button class="btn btn-gold" type="button" id="mt-save">Guardar</button><a class="link mono" href="../index.html" target="_blank" rel="noopener">Ver la web</a></div>`;
    $('#mt-title').addEventListener('input', (e) => { $('#mt-prev-title').textContent = e.target.value || 'Preparando web'; });
    $('#mt-msg').addEventListener('input', (e) => { $('#mt-prev-msg').textContent = e.target.value; });
    $('#mt-save').addEventListener('click', async (e) => {
      await saveSettings({ maintenance: { on: $('#mt-on').checked, title: $('#mt-title').value.trim() || 'Preparando web', message: $('#mt-msg').value.trim() } }, e.target);
      renderWebState(); preparando(v);
    });
    $('#mt-on').addEventListener('change', async (e) => {
      await saveSettings({ maintenance: { on: e.target.checked, title: $('#mt-title').value.trim() || 'Preparando web', message: $('#mt-msg').value.trim() } });
      renderWebState(); preparando(v);
    });
  }
  function demoNotice() {
    if (health.noDb) return `<div class="notice error" style="margin-bottom:1.2rem"><strong>Falta conectar Supabase en Vercel.</strong> Puedes usar el panel, pero los cambios se guardan solo en este dispositivo y los visitantes no los verán. Añade <code>SUPABASE_URL</code> y <code>SUPABASE_SERVICE_ROLE_KEY</code> en Vercel y vuelve a publicar. <button class="link" type="button" data-demo-reset>Restablecer datos de ejemplo</button></div>`;
    return `<div class="notice" style="margin-bottom:1.2rem">Modo demostración: los cambios se guardan solo en este dispositivo y se ven en la vista previa. Cuando la web esté publicada con Supabase, se guardarán para todos. <button class="link" type="button" data-demo-reset>Restablecer datos de ejemplo</button></div>`;
  }
  document.addEventListener('click', (e) => { if (e.target.closest('[data-demo-reset]')) { Demo.reset(); location.reload(); } });

  // ---------- CITAS ----------
  const GROUPS = [
    ['pending,needs_attention', 'Pendientes de aprobar'], ['confirmed', 'Confirmadas'], ['completed', 'Completadas'],
    ['cancelled,rejected', 'Canceladas'], ['pending_payment,expired', 'Sin pagar / caducadas'],
  ];
  let group = GROUPS[0][0];
  async function citas(v) {
    const r = await api(`admin/bookings?status=${group}`);
    const c = r.counts || {};
    const n = (keys) => keys.split(',').reduce((a, k) => a + (c[k] || 0), 0);
    const list = group === 'confirmed' || group.startsWith('pending,') ? r.bookings : r.bookings.slice().reverse();
    v.innerHTML = `
      <div class="adm-head"><h1>Citas</h1><button class="btn" type="button" id="new-booking">Nueva cita manual</button></div>
      <div class="filters" style="margin-bottom:1.2rem">${GROUPS.map(([k, t]) => `<button class="filter" type="button" data-group="${k}" aria-pressed="${k === group}">${t} · ${n(k)}</button>`).join('')}</div>
      ${list.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Fecha</th><th>Cliente</th><th>Tatuaje</th><th>Diseño</th><th>Precio</th><th>Señal</th><th>Estado</th></tr></thead><tbody>
        ${list.map((b) => `<tr data-open="${b.id}">
          <td class="num">${esc(dLabel(b.appt_date))}<br><span class="muted">${A.fmtMin(b.start_min)}–${A.fmtMin(b.end_min)}</span></td>
          <td><strong>${esc(b.name)}</strong><br><span class="muted mono">${esc(b.ref)}</span></td>
          <td>${esc(b.style || '')}<br><span class="muted">${esc(b.body_zone || '')} · ${esc((b.size_label || '').split(' (')[0])}</span></td>
          <td>${b.design_path ? '<span class="pill confirmed">Sí</span>' : '<span class="muted">—</span>'}</td>
          <td class="num">${euros(b.final_price_cents || b.estimated_price_cents || 0)}${b.final_price_cents ? '' : '<span class="muted">*</span>'}</td>
          <td class="num">${b.deposit_paid ? euros(b.deposit_cents) : '<span class="muted">—</span>'}</td>
          <td>${pill(b.status)}</td></tr>`).join('')}
      </tbody></table></div><p class="mono muted" style="margin-top:.6rem;font-size:.75rem">* precio estimado, sin confirmar</p>` : '<p class="muted">No hay citas en este grupo.</p>'}`;
    $$('[data-group]', v).forEach((b) => b.addEventListener('click', () => { group = b.dataset.group; citas(v); }));
    $$('[data-open]', v).forEach((tr) => tr.addEventListener('click', () => openBooking(tr.dataset.open)));
    $('#new-booking').addEventListener('click', () => manualBooking());
  }

  async function openBooking(id) {
    const b = await api(`admin/bookings?id=${id}`);
    const price = b.final_price_cents || b.estimated_price_cents;
    const d = drawer(`
      <div class="drawer-top"><div><span class="mono muted">${esc(b.ref)}</span><h2 class="display h3" style="margin:.3rem 0">${esc(b.name)}</h2>${pill(b.status)}</div><button class="icon-btn" data-close aria-label="Cerrar">${CP.icon.close}</button></div>
      <dl class="kv">
        <dt>Fecha</dt><dd>${esc(CP.cap(dLabel(b.appt_date)))} · ${A.fmtMin(b.start_min)}–${A.fmtMin(b.end_min)} h</dd>
        <dt>Email</dt><dd>${b.email ? `<a class="link" href="mailto:${esc(b.email)}">${esc(b.email)}</a>` : '—'}</dd>
        <dt>Teléfono</dt><dd>${b.phone ? `<a class="link" href="tel:${esc(b.phone.replace(/\s/g, ''))}">${esc(b.phone)}</a> · <a class="link" href="https://wa.me/${esc(b.phone.replace(/\D/g, ''))}" target="_blank" rel="noopener">WhatsApp</a>` : '—'}</dd>
        <dt>Estilo</dt><dd>${esc(b.style || '—')}</dd>
        <dt>Zona · tamaño</dt><dd>${esc(b.body_zone || '—')} · ${esc(b.size_label || '—')}</dd>
        <dt>Precio estimado</dt><dd class="num">${euros(b.estimated_price_cents || 0)}</dd>
        <dt>Señal</dt><dd class="num">${euros(b.deposit_cents)} · ${b.payment_status === 'refunded' ? 'devuelta' : b.deposit_paid ? 'pagada' : b.payment_status === 'manual' ? 'cita manual' : 'sin pagar'}${b.paid_at ? ` <span class="muted">(${new Date(b.paid_at).toLocaleString('es-ES')})</span>` : ''}</dd>
        <dt>Restante</dt><dd class="num">${price ? euros(Math.max(0, price - (b.deposit_paid ? b.deposit_cents : 0))) : '—'}</dd>
        <dt>Condiciones</dt><dd>${b.terms_accepted_at ? `Aceptadas el ${new Date(b.terms_accepted_at).toLocaleString('es-ES')} <span class="muted mono">#${esc(b.terms_hash || '')}</span>` : '—'}</dd>
      </dl>
      <div class="box"><span class="label">Idea del cliente</span><p style="margin:0;white-space:pre-wrap">${esc(b.description)}</p>
        ${b.design_url ? `<a href="${esc(b.design_url)}" target="_blank" rel="noopener"><img class="design-big" src="${esc(b.design_url)}" alt="Diseño adjunto"></a><span class="mono muted" style="font-size:.72rem">Enlace privado válido 1 hora. Toca la imagen para abrirla.</span>` : '<span class="muted">Sin diseño adjunto.</span>'}</div>
      <div class="box">
        <span class="label">Presupuesto y notas</span>
        <label class="field"><span class="label muted">Precio final confirmado (€)</span><input class="input" id="b-final" inputmode="decimal" value="${fromCents(b.final_price_cents)}" placeholder="Ej. 180"></label>
        <label class="field"><span class="label muted">Notas internas</span><textarea class="textarea" id="b-notes" style="min-height:80px">${esc(b.admin_notes || '')}</textarea></label>
        <div class="row-actions"><button class="btn btn-ghost" type="button" data-act="update">Guardar presupuesto y notas</button></div>
      </div>
      <div class="box">
        <span class="label">Acciones</span>
        <label class="check"><input type="checkbox" id="b-notify" checked> Avisar al cliente por correo</label>
        <label class="field"><span class="label muted">Mensaje para el cliente (rechazo o cancelación, opcional)</span><textarea class="textarea" id="b-msg" style="min-height:70px"></textarea></label>
        <div class="row-actions">
          ${['pending', 'needs_attention'].includes(b.status) ? '<button class="btn btn-gold" type="button" data-act="approve">Aprobar cita</button><button class="btn btn-danger" type="button" data-act="reject">Rechazar</button>' : ''}
          ${b.status === 'confirmed' ? '<button class="btn" type="button" data-act="complete">Marcar completada</button>' : ''}
          ${['pending', 'confirmed', 'needs_attention', 'pending_payment'].includes(b.status) ? '<button class="btn btn-danger" type="button" data-act="cancel">Cancelar cita</button>' : ''}
        </div>
        ${b.deposit_paid && b.stripe_payment_intent && b.payment_status !== 'refunded' ? '<label class="check"><input type="checkbox" id="b-refund"> Devolver la señal al cancelar o rechazar (reembolso en Stripe)</label>' : ''}
      </div>
      <div class="box">
        <span class="label">Reprogramar</span>
        <div class="form-grid">
          <label class="field"><span class="label muted">Día</span><input class="input" id="r-date" type="date" value="${b.appt_date}"></label>
          <label class="field"><span class="label muted">Hora</span><input class="input" id="r-time" type="time" step="900" value="${A.fmtMin(b.start_min)}"></label>
          <label class="field"><span class="label muted">Duración (min)</span><input class="input" id="r-dur" type="number" min="15" step="15" value="${b.end_min - b.start_min}"></label>
        </div>
        <div class="row-actions"><button class="btn btn-ghost" type="button" data-act="reschedule">Cambiar fecha</button></div>
      </div>
      <div id="b-err"></div>`);
    d.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const action = btn.dataset.act;
      if ((action === 'cancel' || action === 'reject') && btn.dataset.sure !== '1') { btn.dataset.sure = '1'; btn.textContent = 'Pulsa otra vez para confirmar'; return; }
      const body = { id: b.id, action, notify: $('#b-notify').checked, message: $('#b-msg').value, admin_notes: $('#b-notes').value, final_price_cents: $('#b-final').value ? toCents($('#b-final').value) : null };
      if ($('#b-refund') && (action === 'cancel' || action === 'reject')) body.refund = $('#b-refund').checked;
      if (action === 'reschedule') { body.appt_date = $('#r-date').value; body.start_min = A.toMin($('#r-time').value); body.duration_min = Number($('#r-dur').value); }
      btn.classList.add('is-loading');
      try { await api('admin/bookings', { method: 'PATCH', body }); toast('Cita actualizada'); closeDrawer(); show(); refreshBadge(); }
      catch (err) { $('#b-err').innerHTML = `<div class="notice error">${esc(err.message)}</div>`; btn.classList.remove('is-loading'); }
    });
  }

  function manualBooking(date) {
    const d = drawer(`
      <div class="drawer-top"><h2 class="display h3" style="margin:0">Nueva cita manual</h2><button class="icon-btn" data-close aria-label="Cerrar">${CP.icon.close}</button></div>
      <p class="muted" style="margin:0">Para citas cerradas por WhatsApp o en persona. Bloquea la hora en el calendario online.</p>
      <div class="form-grid">
        <label class="field full"><span class="label muted">Nombre</span><input class="input" id="m-name"></label>
        <label class="field"><span class="label muted">Email</span><input class="input" id="m-email" type="email"></label>
        <label class="field"><span class="label muted">Teléfono</span><input class="input" id="m-phone" type="tel"></label>
        <label class="field"><span class="label muted">Estilo</span><select class="select" id="m-style">${settings.styles.map((s) => `<option>${esc(s)}</option>`).join('')}</select></label>
        <label class="field"><span class="label muted">Zona</span><select class="select" id="m-zone">${settings.body_zones.map((s) => `<option>${esc(s)}</option>`).join('')}</select></label>
        <label class="field"><span class="label muted">Tamaño</span><select class="select" id="m-size">${settings.sizes.map((s) => `<option value="${esc(s.id)}">${esc(s.label)} · ${s.duration_min} min</option>`).join('')}</select></label>
        <label class="field"><span class="label muted">Precio (€)</span><input class="input" id="m-price" inputmode="decimal"></label>
        <label class="field"><span class="label muted">Día</span><input class="input" id="m-date" type="date" value="${date || ''}"></label>
        <label class="field"><span class="label muted">Hora</span><input class="input" id="m-time" type="time" step="900" value="11:00"></label>
        <label class="field full"><span class="label muted">Descripción</span><textarea class="textarea" id="m-desc" style="min-height:80px"></textarea></label>
      </div>
      <div id="m-err"></div>
      <button class="btn btn-gold" type="button" id="m-save">Crear cita confirmada</button>`);
    $('#m-save', d).addEventListener('click', async (e) => {
      const size = settings.sizes.find((s) => s.id === $('#m-size').value);
      try {
        await api('admin/bookings', { method: 'POST', body: {
          name: $('#m-name').value, email: $('#m-email').value, phone: $('#m-phone').value, style: $('#m-style').value, body_zone: $('#m-zone').value,
          size_id: size.id, duration_min: size.duration_min, estimated_price_cents: $('#m-price').value ? toCents($('#m-price').value) : size.price_cents,
          appt_date: $('#m-date').value, start_min: A.toMin($('#m-time').value), description: $('#m-desc').value,
        } });
        toast('Cita creada'); closeDrawer(); show();
      } catch (err) { $('#m-err').innerHTML = `<div class="notice error">${esc(err.message)}</div>`; }
    });
  }

  // ---------- CALENDARIO ----------
  let calView = 'month', calCursor = A.canaryNow().date;
  async function calendario(v) {
    const [y, m, d] = calCursor.split('-').map(Number);
    let from, to;
    if (calView === 'month') { from = `${y}-${String(m).padStart(2, '0')}-01`; to = `${y}-${String(m).padStart(2, '0')}-${new Date(Date.UTC(y, m, 0)).getUTCDate()}`; }
    else if (calView === 'week') { const wd = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; from = A.addDays(calCursor, -wd); to = A.addDays(from, 6); }
    else { from = to = calCursor; }
    const [r, blocked] = await Promise.all([
      api(`admin/bookings?status=pending_payment,pending,confirmed,completed,needs_attention&from=${from}&to=${to}`),
      api('admin/collection?type=blocked'),
    ]);
    const now = A.canaryNow();
    const nowIso = new Date().toISOString();
    const list = r.bookings.filter((b) => b.status !== 'pending_payment' || A.isActiveBooking(b, nowIso));
    const byDay = {};
    list.forEach((b) => (byDay[b.appt_date] = byDay[b.appt_date] || []).push(b));
    const isBlocked = (date) => blocked.some((bl) => bl.date_from <= date && date <= bl.date_to && bl.start_min == null);
    const closed = (date) => ((settings.schedule.days || {})[A.weekday(date)] || {}).closed;
    const ev = (b) => `<button class="ev ${b.status}" type="button" data-open="${b.id}" title="${esc(b.name)}">${A.fmtMin(b.start_min)} ${esc(b.name)}${calView !== 'month' ? `<br><span class="muted">${esc(b.style || '')} · ${A.fmtMin(b.end_min)}</span>` : ''}</button>`;
    const title = calView === 'month' ? new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' })
      : calView === 'week' ? `${dLabel(from)} – ${dLabel(to)}` : dLabel(from);
    let body = '';
    if (calView === 'month') {
      const offset = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
      body = `<div class="mcal">${['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((x) => `<div class="dow label">${x}</div>`).join('')}${'<div></div>'.repeat(offset)}`;
      for (let i = 1; i <= new Date(Date.UTC(y, m, 0)).getUTCDate(); i++) {
        const date = `${y}-${String(m).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        body += `<div class="${date === now.date ? 'today' : ''} ${closed(date) || isBlocked(date) ? 'off' : ''}"><span class="dnum">${i}</span>${(byDay[date] || []).map(ev).join('')}</div>`;
      }
      body += '</div>';
    } else if (calView === 'week') {
      body = `<div class="wcal">${[0, 1, 2, 3, 4, 5, 6].map((k) => { const date = A.addDays(from, k); return `<div class="col ${closed(date) || isBlocked(date) ? 'off' : ''}"><span class="label ${date === now.date ? 'gold' : 'muted'}">${esc(dLabel(date))}</span>${(byDay[date] || []).map(ev).join('') || '<span class="muted mono" style="font-size:.75rem">—</span>'}</div>`; }).join('')}</div>`;
    } else {
      body = `<div class="dlist">${(byDay[from] || []).map(ev).join('') || `<p class="muted">${closed(from) ? 'Día cerrado.' : isBlocked(from) ? 'Día bloqueado.' : 'Sin citas.'}</p>`}</div>`;
    }
    v.innerHTML = `
      <div class="adm-head"><h1>${esc(CP.cap(title))}</h1>
        <div style="display:flex;gap:.6rem;align-items:center;flex-wrap:wrap">
          <div class="cal-views">${[['day', 'Día'], ['week', 'Semana'], ['month', 'Mes']].map(([k, t]) => `<button type="button" data-view="${k}" aria-pressed="${k === calView}">${t}</button>`).join('')}</div>
          <button class="icon-btn" type="button" data-move="-1" aria-label="Anterior">‹</button>
          <button class="btn btn-ghost" type="button" data-move="0" style="min-height:40px">Hoy</button>
          <button class="icon-btn" type="button" data-move="1" aria-label="Siguiente">›</button>
        </div></div>
      ${body}
      <div class="cal-legend mono" style="margin-top:1rem"><span style="--c:var(--warn)">Pendiente</span><span style="--c:var(--ok)">Confirmada</span><span class="off">Cerrado o bloqueado</span></div>`;
    $$('[data-view]', v).forEach((b) => b.addEventListener('click', () => { calView = b.dataset.view; calendario(v); }));
    $$('[data-move]', v).forEach((b) => b.addEventListener('click', () => {
      const k = Number(b.dataset.move);
      if (!k) calCursor = A.canaryNow().date;
      else if (calView === 'month') { const nd = new Date(Date.UTC(y, m - 1 + k, 1)); calCursor = `${nd.getUTCFullYear()}-${String(nd.getUTCMonth() + 1).padStart(2, '0')}-01`; }
      else calCursor = A.addDays(calCursor, k * (calView === 'week' ? 7 : 1));
      calendario(v);
    }));
    $$('[data-open]', v).forEach((b) => b.addEventListener('click', () => openBooking(b.dataset.open)));
  }

  // ---------- HORARIO ----------
  async function horario(v) {
    const s = settings.schedule;
    const blocked = await api('admin/collection?type=blocked');
    const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const idx = [1, 2, 3, 4, 5, 6, 0];
    v.innerHTML = `
      <div class="adm-head"><h1>Horario y bloqueos</h1></div>
      <div class="box" style="margin-bottom:1.6rem">
        <span class="label">Horario semanal</span>
        <div class="mono muted" style="font-size:.72rem">Descansos: escribe franjas separadas por comas, por ejemplo 14:00-16:00</div>
        ${idx.map((k, i) => { const d = s.days[k] || { closed: true }; return `<div class="sched-row" data-day="${k}">
          <strong>${DAYS[i]}</strong>
          <label class="check"><input type="checkbox" data-f="open" ${d.closed ? '' : 'checked'}> Abierto</label>
          <input class="input" type="time" data-f="from" value="${esc(d.open || '11:00')}" aria-label="Apertura ${DAYS[i]}">
          <input class="input" type="time" data-f="to" value="${esc(d.close || '20:00')}" aria-label="Cierre ${DAYS[i]}">
          <input class="input" data-f="breaks" placeholder="Descansos" value="${esc((d.breaks || []).map((b) => `${b.from}-${b.to}`).join(', '))}" aria-label="Descansos ${DAYS[i]}">
        </div>`; }).join('')}
        <div class="grid-form">
          <label class="field"><span class="label muted">Intervalo entre horas de inicio (min)</span><input class="input" id="s-step" type="number" min="15" step="15" value="${s.slot_step_min}"></label>
          <label class="field"><span class="label muted">Antelación mínima (horas)</span><input class="input" id="s-notice" type="number" min="0" value="${s.min_notice_hours}"></label>
          <label class="field"><span class="label muted">Reservas hasta (días vista)</span><input class="input" id="s-max" type="number" min="7" value="${s.max_days_ahead}"></label>
          <label class="field"><span class="label muted">Tiempo para pagar (min)</span><input class="input" id="s-hold" type="number" min="31" max="60" value="${s.hold_minutes}"></label>
        </div>
        <div class="row-actions"><button class="btn btn-gold" type="button" id="save-sched">Guardar horario</button></div>
      </div>
      <div class="box">
        <span class="label">Días y horas bloqueados</span>
        <p class="muted" style="margin:0">Vacaciones, convenciones o huecos concretos. Deja las horas vacías para bloquear el día entero.</p>
        <div class="grid-form">
          <label class="field"><span class="label muted">Desde</span><input class="input" type="date" id="bl-from"></label>
          <label class="field"><span class="label muted">Hasta</span><input class="input" type="date" id="bl-to"></label>
          <label class="field"><span class="label muted">Hora inicio (opcional)</span><input class="input" type="time" id="bl-s"></label>
          <label class="field"><span class="label muted">Hora fin (opcional)</span><input class="input" type="time" id="bl-e"></label>
          <label class="field"><span class="label muted">Motivo</span><input class="input" id="bl-r" placeholder="Vacaciones"></label>
        </div>
        <div class="row-actions"><button class="btn" type="button" id="bl-add">Bloquear</button></div>
        ${blocked.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Fechas</th><th>Horas</th><th>Motivo</th><th></th></tr></thead><tbody>${blocked.map((b) => `<tr><td class="num">${esc(dLabel(b.date_from))}${b.date_to !== b.date_from ? ' – ' + esc(dLabel(b.date_to)) : ''}</td><td class="num">${b.start_min == null ? 'Día completo' : `${A.fmtMin(b.start_min)}–${A.fmtMin(b.end_min)}`}</td><td>${esc(b.reason || '')}</td><td><button class="link" type="button" data-del="${b.id}">Quitar</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="muted" style="margin:0">No hay bloqueos.</p>'}
      </div>`;
    $('#save-sched').addEventListener('click', (e) => {
      const days = {};
      for (const row of $$('[data-day]', v)) {
        const k = row.dataset.day;
        const open = $('[data-f="open"]', row).checked;
        const breaks = $('[data-f="breaks"]', row).value.split(',').map((x) => x.trim()).filter(Boolean).map((x) => { const [f, t] = x.split('-').map((y) => y.trim()); return { from: f, to: t }; }).filter((b) => /^\d{1,2}:\d{2}$/.test(b.from) && /^\d{1,2}:\d{2}$/.test(b.to));
        days[k] = open ? { open: $('[data-f="from"]', row).value, close: $('[data-f="to"]', row).value, breaks } : { closed: true };
      }
      saveSettings({ schedule: { slot_step_min: Number($('#s-step').value), min_notice_hours: Number($('#s-notice').value), max_days_ahead: Number($('#s-max').value), hold_minutes: Math.max(31, Number($('#s-hold').value)), days } }, e.target);
    });
    $('#bl-add').addEventListener('click', async () => {
      const from = $('#bl-from').value;
      if (!from) return toast('Elige al menos el día de inicio');
      const s1 = $('#bl-s').value, e1 = $('#bl-e').value;
      try {
        await api('admin/collection?type=blocked', { method: 'POST', body: { date_from: from, date_to: $('#bl-to').value || from, start_min: s1 && e1 ? A.toMin(s1) : null, end_min: s1 && e1 ? A.toMin(e1) : null, reason: $('#bl-r').value } });
        toast('Bloqueado'); horario(v);
      } catch (err) { toast(err.message); }
    });
    $$('[data-del]', v).forEach((b) => b.addEventListener('click', async () => { await api(`admin/collection?type=blocked&id=${b.dataset.del}`, { method: 'DELETE' }); horario(v); }));
  }

  // ---------- PRECIOS ----------
  async function precios(v) {
    const s = settings;
    const sizeRow = (z) => `<div class="sizes-row" data-size-row data-id="${esc(z.id || '')}">
      <input class="input" data-f="label" value="${esc(z.label || '')}" placeholder="Nombre" aria-label="Nombre">
      <input class="input" data-f="detail" value="${esc(z.detail || '')}" placeholder="Medida" aria-label="Medida">
      <input class="input" data-f="price" inputmode="decimal" value="${fromCents(z.price_cents)}" placeholder="€" aria-label="Precio estimado en euros">
      <input class="input" data-f="dur" type="number" min="15" step="15" value="${z.duration_min || 60}" aria-label="Duración en minutos">
      <button class="icon-btn" type="button" data-rm-size aria-label="Quitar tamaño">${CP.icon.close}</button></div>`;
    v.innerHTML = `
      <div class="adm-head"><h1>Precios y señal</h1></div>
      <div class="box" style="margin-bottom:1.4rem">
        <span class="label">Señal de reserva</span>
        <div class="grid-form"><label class="field"><span class="label muted">Importe de la señal (€)</span><input class="input" id="p-dep" inputmode="decimal" value="${fromCents(s.deposit_cents)}"></label></div>
        <label class="check"><input type="checkbox" id="p-ded" ${s.deposit_deducted ? 'checked' : ''}> La señal se descuenta del precio final (a cuenta, no es un cargo extra)</label>
      </div>
      <div class="box" style="margin-bottom:1.4rem">
        <span class="label">Tamaños y duración de la sesión</span><span class="mono muted" style="font-size:.72rem">El precio por tamaño es solo de referencia interna: el cliente no lo ve al reservar.</span>
        <div class="sizes-row mono muted" style="font-size:.7rem"><span>Nombre</span><span>Medida</span><span>Precio €</span><span>Minutos</span><span></span></div>
        <div id="sizes">${s.sizes.map(sizeRow).join('')}</div>
        <div><button class="btn btn-ghost" type="button" id="add-size" style="min-height:40px">Añadir tamaño</button></div>
      </div>
      <div class="grid-form" style="margin-bottom:1rem">
        <label class="field"><span class="label muted">Estilos (uno por línea)</span><textarea class="textarea" id="p-styles" style="min-height:180px">${esc(s.styles.join('\n'))}</textarea></label>
        <label class="field"><span class="label muted">Zonas del cuerpo (una por línea)</span><textarea class="textarea" id="p-zones" style="min-height:180px">${esc(s.body_zones.join('\n'))}</textarea></label>
      </div>
      <div class="save-bar"><button class="btn btn-gold" type="button" id="save-prices">Guardar</button></div>`;
    $('#add-size').addEventListener('click', () => $('#sizes').insertAdjacentHTML('beforeend', sizeRow({ duration_min: 60 })));
    $('#sizes').addEventListener('click', (e) => { if (e.target.closest('[data-rm-size]')) e.target.closest('[data-size-row]').remove(); });
    $('#save-prices').addEventListener('click', (e) => {
      const sizes = $$('[data-size-row]', v).map((r) => {
        const label = $('[data-f="label"]', r).value.trim();
        const id = r.dataset.id || label.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-') || 'tam-' + Date.now();
        return { id, label, detail: $('[data-f="detail"]', r).value.trim(), price_cents: toCents($('[data-f="price"]', r).value), duration_min: Number($('[data-f="dur"]', r).value) };
      }).filter((z) => z.label);
      const lines = (id) => $(id).value.split('\n').map((x) => x.trim()).filter(Boolean);
      saveSettings({ deposit_cents: toCents($('#p-dep').value), deposit_deducted: $('#p-ded').checked, sizes, styles: lines('#p-styles'), body_zones: lines('#p-zones') }, e.target);
    });
  }

  // ---------- PRODUCTOS ----------
  const variantsToText = (vs) => (vs || []).map((x) => `${x.name}: ${(x.options || []).map((o) => o.price_cents ? `${o.label} (${fromCents(o.price_cents)})` : o.label).join(', ')}`).join('\n');
  const textToVariants = (t) => t.split('\n').map((l) => l.trim()).filter((l) => l.includes(':')).map((l) => {
    const [name, rest] = [l.slice(0, l.indexOf(':')).trim(), l.slice(l.indexOf(':') + 1)];
    return { name, options: rest.split(',').map((o) => o.trim()).filter(Boolean).map((o) => { const m = o.match(/^(.*?)\s*\(([\d.,]+)\)$/); return m ? { label: m[1].trim(), price_cents: toCents(m[2]) } : { label: o }; }) };
  }).filter((x) => x.name && x.options.length);

  async function productos(v) {
    const list = await api('admin/collection?type=products');
    v.innerHTML = `<div class="adm-head"><h1>Productos</h1><button class="btn" type="button" id="new-p">Nuevo producto</button></div>
      ${list.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th></th><th>Producto</th><th>Categoría</th><th>Precio</th><th>Stock</th><th>Estado</th></tr></thead><tbody>
      ${list.map((p) => `<tr data-open="${p.id}"><td><img class="thumb" src="${esc(CP.asset((p.images || [])[0] || ''))}" alt=""></td><td><strong>${esc(p.name)}</strong>${p.featured ? ' <span class="pill paid">Destacado</span>' : ''}</td><td>${esc(p.category)}</td><td class="num">${euros(p.price_cents)}</td><td class="num" style="color:${p.stock <= 3 ? 'var(--danger)' : 'inherit'}">${p.stock}</td><td>${p.active ? '<span class="pill confirmed">Visible</span>' : '<span class="pill expired">Oculto</span>'}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="muted">Aún no hay productos.</p>'}`;
    $('#new-p').addEventListener('click', () => editProduct({ active: true, stock: 10, images: [], variants: [], category: 'ropa', sort: list.length + 1 }));
    $$('[data-open]', v).forEach((tr) => tr.addEventListener('click', () => editProduct(list.find((p) => p.id === tr.dataset.open))));
  }
  function editProduct(p) {
    let images = [...(p.images || [])];
    const cats = window.CPSeed.CATEGORIES;
    const d = drawer(`
      <div class="drawer-top"><h2 class="display h3" style="margin:0">${p.id ? 'Editar producto' : 'Nuevo producto'}</h2><button class="icon-btn" data-close aria-label="Cerrar">${CP.icon.close}</button></div>
      <div class="form-grid">
        <label class="field full"><span class="label muted">Nombre</span><input class="input" id="e-name" value="${esc(p.name || '')}"></label>
        <label class="field"><span class="label muted">Precio (€)</span><input class="input" id="e-price" inputmode="decimal" value="${fromCents(p.price_cents)}"></label>
        <label class="field"><span class="label muted">Stock</span><input class="input" id="e-stock" type="number" min="0" value="${p.stock ?? 0}"></label>
        <label class="field"><span class="label muted">Categoría</span><select class="select" id="e-cat">${cats.map((c) => `<option value="${c.id}" ${c.id === p.category ? 'selected' : ''}>${esc(c.label)}</option>`).join('')}</select></label>
        <label class="field"><span class="label muted">Orden</span><input class="input" id="e-sort" type="number" value="${p.sort ?? 0}"></label>
        <label class="field full"><span class="label muted">Descripción</span><textarea class="textarea" id="e-desc">${esc(p.description || '')}</textarea></label>
        <label class="field full"><span class="label muted">Variantes (una por línea). Precio distinto entre paréntesis</span><textarea class="textarea" id="e-var" style="min-height:90px" placeholder="Talla: S, M, L, XL&#10;Formato: A3, A4 (28)">${esc(variantsToText(p.variants))}</textarea></label>
      </div>
      <div class="box"><span class="label">Fotos</span><div class="img-list" id="e-imgs"></div>
        <div class="row-actions"><label class="btn btn-ghost" style="min-height:40px">Subir foto<input type="file" accept="image/jpeg,image/png,image/webp" id="e-file" hidden></label></div>
        <span class="mono muted" style="font-size:.72rem">JPG, PNG o WEBP. Se optimiza automáticamente. Fotos cuadradas quedan mejor.</span></div>
      <label class="check"><input type="checkbox" id="e-active" ${p.active ? 'checked' : ''}> Visible en la tienda</label>
      <label class="check"><input type="checkbox" id="e-feat" ${p.featured ? 'checked' : ''}> Destacado en la portada</label>
      <div id="e-err"></div>
      <div class="row-actions"><button class="btn btn-gold" type="button" id="e-save">Guardar</button>${p.id ? '<button class="btn btn-danger" type="button" id="e-del">Eliminar</button>' : ''}</div>`);
    const drawImgs = () => { $('#e-imgs', d).innerHTML = images.map((src, i) => `<figure><img src="${esc(CP.asset(src))}" alt=""><button type="button" data-rmimg="${i}" aria-label="Quitar foto">✕</button></figure>`).join('') || '<span class="muted">Sin fotos</span>'; };
    drawImgs();
    $('#e-imgs', d).addEventListener('click', (e) => { const b = e.target.closest('[data-rmimg]'); if (b) { images.splice(Number(b.dataset.rmimg), 1); drawImgs(); } });
    $('#e-file', d).addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { toast('Subiendo…'); const data = await resize(f, 1600); const r = await api('admin/upload', { method: 'POST', body: { image: data, folder: 'products' } }); images.unshift(r.url); drawImgs(); toast("Foto subida: es la foto principal"); }
      catch (err) { toast(err.message); }
    });
    $('#e-save', d).addEventListener('click', async (e) => {
      const body = { name: $('#e-name').value, price_cents: toCents($('#e-price').value), stock: Number($('#e-stock').value), category: $('#e-cat').value, sort: Number($('#e-sort').value), description: $('#e-desc').value, variants: textToVariants($('#e-var').value), images, active: $('#e-active').checked, featured: $('#e-feat').checked };
      if (!body.name) return ($('#e-err').innerHTML = '<div class="notice error">Ponle nombre al producto.</div>');
      try {
        if (p.id) await api('admin/collection?type=products', { method: 'PATCH', body: { id: p.id, ...body } });
        else await api('admin/collection?type=products', { method: 'POST', body });
        toast('Producto guardado'); closeDrawer(); show();
      } catch (err) { $('#e-err').innerHTML = `<div class="notice error">${esc(err.message)}</div>`; }
    });
    const del = $('#e-del', d);
    if (del) del.addEventListener('click', async () => {
      if (del.dataset.sure !== '1') { del.dataset.sure = '1'; del.textContent = 'Pulsa otra vez para eliminar'; return; }
      await api(`admin/collection?type=products&id=${p.id}`, { method: 'DELETE' }); toast('Eliminado'); closeDrawer(); show();
    });
  }
  function resize(file, max) {
    return new Promise((res, rej) => {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return rej(new Error('Formato no válido. Usa JPG, PNG o WEBP.'));
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
        const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => rej(new Error('No se pudo leer la imagen.'));
      img.src = url;
    });
  }

  // ---------- PEDIDOS ----------
  let orderFilter = 'paid';
  async function pedidos(v) {
    const list = await api(`admin/collection?type=orders${orderFilter ? `&status=${orderFilter}` : ''}`);
    const F = [['paid', 'Por enviar'], ['shipped', 'Enviados'], ['completed', 'Entregados'], ['cancelled,refunded', 'Cancelados'], ['pending_payment,expired', 'Sin pagar'], ['', 'Todos']];
    v.innerHTML = `<div class="adm-head"><h1>Pedidos</h1></div>
      <div class="filters" style="margin-bottom:1.2rem">${F.map(([k, t]) => `<button class="filter" type="button" data-of="${k}" aria-pressed="${k === orderFilter}">${t}</button>`).join('')}</div>
      ${list.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Fecha</th><th>Pedido</th><th>Cliente</th><th>Artículos</th><th>Total</th><th>Estado</th></tr></thead><tbody>
      ${list.map((o) => `<tr data-open="${o.id}"><td class="num">${new Date(o.created_at).toLocaleDateString('es-ES')}</td><td class="mono">${esc(o.ref)}</td><td>${esc(o.customer.name)}<br><span class="muted">${esc(o.shipping_label || '')}</span></td><td>${o.items.reduce((a, i) => a + i.qty, 0)}</td><td class="num">${euros(o.total_cents)}</td><td>${pill(o.status, ORDER_ES)}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="muted">No hay pedidos aquí.</p>'}`;
    $$('[data-of]', v).forEach((b) => b.addEventListener('click', () => { orderFilter = b.dataset.of; pedidos(v); }));
    $$('[data-open]', v).forEach((tr) => tr.addEventListener('click', () => openOrder(list.find((o) => o.id === tr.dataset.open))));
  }
  function openOrder(o) {
    const a = o.shipping_address || {}, bi = o.billing || {};
    const d = drawer(`
      <div class="drawer-top"><div><span class="mono muted">${esc(o.ref)}</span><h2 class="display h3" style="margin:.3rem 0">${esc(o.customer.name)}</h2>${pill(o.status, ORDER_ES)}</div><button class="icon-btn" data-close aria-label="Cerrar">${CP.icon.close}</button></div>
      <div class="box">${o.items.map((i) => `<div class="sum-row"><span>${esc(i.name)}${i.options_label ? ` <span class="muted mono">${esc(i.options_label)}</span>` : ''} × ${i.qty}</span><span class="mono">${euros(i.unit_cents * i.qty)}</span></div>`).join('')}
        <div class="sum-row"><span>Envío · ${esc(o.shipping_label || '')}</span><span class="mono">${euros(o.shipping_cents)}</span></div>
        <div class="sum-row total"><span>Total</span><span class="mono">${euros(o.total_cents)}</span></div></div>
      <dl class="kv">
        <dt>Email</dt><dd><a class="link" href="mailto:${esc(o.customer.email)}">${esc(o.customer.email)}</a></dd>
        <dt>Teléfono</dt><dd>${esc(o.customer.phone)}</dd>
        <dt>Entrega</dt><dd>${o.shipping_zone === 'recogida' ? 'Recogida en el estudio' : `${esc(a.line1)} ${esc(a.line2 || '')}<br>${esc(a.postal_code)} ${esc(a.city)} (${esc(a.province)})`}</dd>
        <dt>Factura</dt><dd>${bi.same !== false ? 'Mismos datos' : `${esc(bi.name)} · ${esc(bi.nif)}<br>${esc(bi.line1)}, ${esc(bi.postal_code)} ${esc(bi.city)}`}</dd>
        ${o.notes ? `<dt>Notas</dt><dd>${esc(o.notes)}</dd>` : ''}
        <dt>Pago</dt><dd>${o.paid_at ? `Pagado el ${new Date(o.paid_at).toLocaleString('es-ES')}` : 'Sin pagar'}${o.stripe_payment_intent ? ` <span class="muted mono">${esc(o.stripe_payment_intent)}</span>` : ''}</dd>
      </dl>
      <div class="box">
        <label class="field"><span class="label muted">Estado</span><select class="select" id="o-status">${['paid', 'shipped', 'completed', 'cancelled', 'refunded'].map((s) => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${ORDER_ES[s]}</option>`).join('')}</select></label>
        <label class="field"><span class="label muted">Número de seguimiento</span><input class="input" id="o-track" value="${esc(o.tracking || '')}"></label>
        <label class="field"><span class="label muted">Notas internas</span><textarea class="textarea" id="o-notes" style="min-height:70px">${esc(o.admin_notes || '')}</textarea></label>
        <p class="mono muted" style="margin:0;font-size:.72rem">Los reembolsos de pedidos se hacen desde el panel de Stripe; aquí solo cambias el estado.</p>
        <button class="btn btn-gold" type="button" id="o-save">Guardar</button>
      </div>`);
    $('#o-save', d).addEventListener('click', async () => {
      try { await api('admin/collection?type=orders', { method: 'PATCH', body: { id: o.id, status: $('#o-status').value, tracking: $('#o-track').value, admin_notes: $('#o-notes').value } }); toast('Pedido actualizado'); closeDrawer(); show(); }
      catch (err) { toast(err.message); }
    });
  }

  // ---------- PORTAFOLIO ----------
  async function portafolio(v) {
    const list = await api('admin/collection?type=portfolio');
    v.innerHTML = `<div class="adm-head"><h1>Portafolio</h1></div>
      <div class="box" style="margin-bottom:1.4rem">
        <span class="label">Añadir trabajo</span>
        <div class="grid-form">
          <label class="field"><span class="label muted">Título</span><input class="input" id="pf-title"></label>
          <label class="field"><span class="label muted">Estilo</span><select class="select" id="pf-style">${settings.styles.map((s) => `<option>${esc(s)}</option>`).join('')}</select></label>
          <label class="field"><span class="label muted">Tipo</span><select class="select" id="pf-kind"><option value="photo">Foto</option><option value="video">Vídeo (por URL)</option></select></label>
          <label class="field" id="pf-url-wrap" hidden><span class="label muted">URL del vídeo .mp4</span><input class="input" id="pf-url" placeholder="https://… o media/video-3.mp4"></label>
        </div>
        <div class="row-actions"><label class="btn" id="pf-up" style="min-height:42px">Subir foto y añadir<input type="file" accept="image/jpeg,image/png,image/webp" id="pf-file" hidden></label><button class="btn" type="button" id="pf-addvid" hidden>Añadir vídeo</button></div>
        <span class="mono muted" style="font-size:.72rem">Los vídeos pesan mucho para subirlos desde aquí: súbelos a la carpeta /media del proyecto en GitHub y pega aquí su ruta (por ejemplo media/video-3.mp4).</span>
      </div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th></th><th>Título</th><th>Estilo</th><th>Orden</th><th>Visible</th><th></th></tr></thead><tbody>
      ${list.map((p) => `<tr><td><img class="thumb" src="${esc(CP.asset(p.kind === 'video' ? p.poster || '' : p.src))}" alt=""></td><td>${esc(p.title)}<br><span class="muted mono">${p.kind === 'video' ? 'Vídeo' : 'Foto'}</span></td><td>${esc(p.style)}</td>
        <td><input class="input" type="number" value="${p.sort}" data-sort="${p.id}" style="width:80px;min-height:38px" aria-label="Orden"></td>
        <td><input type="checkbox" data-vis="${p.id}" ${p.visible ? 'checked' : ''} aria-label="Visible" style="width:20px;height:20px;accent-color:var(--gold)"></td>
        <td><button class="link" type="button" data-del="${p.id}">Eliminar</button></td></tr>`).join('')}
      </tbody></table></div>`;
    const kind = $('#pf-kind');
    kind.addEventListener('change', () => { const vid = kind.value === 'video'; $('#pf-url-wrap').hidden = !vid; $('#pf-addvid').hidden = !vid; $('#pf-up').hidden = vid; });
    const base = () => ({ title: $('#pf-title').value, style: $('#pf-style').value, sort: list.length + 1, visible: true });
    $('#pf-file').addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { toast('Subiendo…'); const data = await resize(f, 1800); const r = await api('admin/upload', { method: 'POST', body: { image: data, folder: 'portfolio' } }); await api('admin/collection?type=portfolio', { method: 'POST', body: { ...base(), kind: 'photo', src: r.url } }); toast('Añadido'); portafolio(v); }
      catch (err) { toast(err.message); }
    });
    $('#pf-addvid').addEventListener('click', async () => {
      const url = $('#pf-url').value.trim(); if (!url) return toast('Pega la ruta del vídeo');
      await api('admin/collection?type=portfolio', { method: 'POST', body: { ...base(), kind: 'video', src: url, poster: '' } }); toast('Añadido'); portafolio(v);
    });
    $$('[data-sort]', v).forEach((i) => i.addEventListener('change', () => api('admin/collection?type=portfolio', { method: 'PATCH', body: { id: i.dataset.sort, sort: Number(i.value) } }).then(() => toast('Orden guardado'))));
    $$('[data-vis]', v).forEach((i) => i.addEventListener('change', () => api('admin/collection?type=portfolio', { method: 'PATCH', body: { id: i.dataset.vis, visible: i.checked } }).then(() => toast('Guardado'))));
    $$('[data-del]', v).forEach((b) => b.addEventListener('click', async () => {
      if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = '¿Seguro?'; return; }
      await api(`admin/collection?type=portfolio&id=${b.dataset.del}`, { method: 'DELETE' }); portafolio(v);
    }));
  }

  // ---------- OPINIONES ----------
  async function opiniones(v) {
    const list = await api('admin/collection?type=reviews');
    v.innerHTML = `<div class="adm-head"><h1>Opiniones</h1></div>
      <div class="notice" style="margin-bottom:1.2rem">Añade solo opiniones reales de clientes (por ejemplo, copiadas de Google o Instagram con su permiso). Si no hay ninguna visible, la sección no aparece en la web.</div>
      <div class="box" style="margin-bottom:1.4rem">
        <div class="grid-form"><label class="field"><span class="label muted">Nombre del cliente</span><input class="input" id="rv-a"></label><label class="field"><span class="label muted">Estrellas</span><select class="select" id="rv-r">${[5, 4, 3, 2, 1].map((n) => `<option>${n}</option>`).join('')}</select></label></div>
        <label class="field"><span class="label muted">Opinión</span><textarea class="textarea" id="rv-t" style="min-height:80px"></textarea></label>
        <div class="row-actions"><button class="btn" type="button" id="rv-add">Añadir opinión</button></div>
      </div>
      ${list.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Cliente</th><th>Opinión</th><th>★</th><th>Visible</th><th></th></tr></thead><tbody>${list.map((r) => `<tr><td>${esc(r.author)}</td><td>${esc(r.text)}</td><td class="num">${r.rating}</td><td><input type="checkbox" data-vis="${r.id}" ${r.visible ? 'checked' : ''} aria-label="Visible" style="width:20px;height:20px;accent-color:var(--gold)"></td><td><button class="link" type="button" data-del="${r.id}">Eliminar</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Todavía no hay opiniones.</p>'}`;
    $('#rv-add').addEventListener('click', async () => {
      if (!$('#rv-a').value.trim() || !$('#rv-t').value.trim()) return toast('Escribe nombre y opinión');
      await api('admin/collection?type=reviews', { method: 'POST', body: { author: $('#rv-a').value.trim(), text: $('#rv-t').value.trim(), rating: Number($('#rv-r').value), visible: true } });
      toast('Opinión añadida'); opiniones(v);
    });
    $$('[data-vis]', v).forEach((i) => i.addEventListener('change', () => api('admin/collection?type=reviews', { method: 'PATCH', body: { id: i.dataset.vis, visible: i.checked } }).then(() => toast('Guardado'))));
    $$('[data-del]', v).forEach((b) => b.addEventListener('click', async () => { await api(`admin/collection?type=reviews&id=${b.dataset.del}`, { method: 'DELETE' }); opiniones(v); }));
  }

  // ---------- ESTUDIO Y TEXTOS ----------
  async function estudio(v) {
    const s = settings, st = s.studio;
    const f = (id, label, val, ph) => `<label class="field"><span class="label muted">${label}</span><input class="input" id="${id}" value="${esc(val || '')}" placeholder="${esc(ph || '')}"></label>`;
    const TEXTS = [['condiciones-reserva', 'Condiciones de reserva'], ['envios-devoluciones', 'Envíos y devoluciones'], ['privacidad', 'Privacidad'], ['aviso-legal', 'Aviso legal'], ['cookies', 'Cookies']];
    v.innerHTML = `<div class="adm-head"><h1>Estudio y textos</h1></div>
      <div class="box" style="margin-bottom:1.4rem"><span class="label">Datos del estudio</span>
        <div class="grid-form">
          ${f('st-name', 'Nombre del estudio', st.name)}${f('st-artist', 'Nombre del artista', st.artist)}
          ${f('st-address', 'Dirección', st.address, 'Calle, número, municipio')}${f('st-city', 'Ciudad / isla', st.city)}
          ${f('st-maps', 'Búsqueda en Google Maps', st.maps_query, 'Nombre del estudio + dirección')}${f('st-hours', 'Horario (texto)', st.hours_text)}
          ${f('st-phone', 'Teléfono', st.phone)}${f('st-wa', 'WhatsApp (con prefijo 34)', st.whatsapp, '34600000000')}
          ${f('st-email', 'Email del estudio', st.email)}${f('st-ig', 'Instagram (sin @)', st.instagram)}
        </div>
        ${f('st-tag', 'Frase de portada', st.tagline)}
        <label class="field"><span class="label muted">Texto «El artista»</span><textarea class="textarea" id="st-about" style="min-height:160px">${esc(s.about)}</textarea></label>
        <label class="field"><span class="label muted">Barra de anuncios (separa los mensajes con ·)</span><input class="input" id="st-ann" value="${esc(s.announcement)}"></label>
      </div>
      <div class="box" style="margin-bottom:1.4rem"><span class="label">Envíos de la tienda</span>
        <div class="grid-form">${s.shipping.zones.map((z, i) => `<label class="field"><span class="label muted">${esc(z.label)} (€)</span><input class="input" data-zone="${i}" inputmode="decimal" value="${fromCents(z.price_cents)}"></label>`).join('')}
          <label class="field"><span class="label muted">Envío gratis desde (€, 0 = nunca)</span><input class="input" id="sh-free" inputmode="decimal" value="${fromCents(s.shipping.free_over_cents)}"></label></div>
      </div>
      <div class="box"><span class="label">Textos legales</span>
        <p class="mono muted" style="margin:0;font-size:.72rem">Formato: «## Título» para apartados y «- texto» para listas. Revisa los textos de ejemplo con tu asesor antes de publicar.</p>
        ${TEXTS.map(([k, t]) => `<label class="field"><span class="label muted">${t}</span><textarea class="textarea" data-text="${k}" style="min-height:200px">${esc(s.texts[k] || '')}</textarea></label>`).join('')}
      </div>
      <div class="save-bar"><button class="btn btn-gold" type="button" id="st-save">Guardar todo</button></div>`;
    $('#st-save').addEventListener('click', (e) => {
      const val = (id) => $('#' + id).value.trim();
      const texts = {}; $$('[data-text]', v).forEach((t) => { texts[t.dataset.text] = t.value; });
      const zones = s.shipping.zones.map((z, i) => ({ ...z, price_cents: toCents($(`[data-zone="${i}"]`).value) }));
      saveSettings({
        studio: { name: val('st-name'), artist: val('st-artist'), address: val('st-address'), city: val('st-city'), maps_query: val('st-maps'), hours_text: val('st-hours'), phone: val('st-phone'), whatsapp: val('st-wa'), email: val('st-email'), instagram: val('st-ig').replace(/^@/, ''), tagline: val('st-tag') },
        about: $('#st-about').value.trim(), announcement: val('st-ann'), texts,
        shipping: { zones, free_over_cents: toCents($('#sh-free').value) },
      }, e.target);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
