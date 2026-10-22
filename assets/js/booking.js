/* Reserva de cita en 5 pasos. El precio, la señal y la disponibilidad se vuelven a comprobar en el servidor. */
CP.ready((site) => {
  const S = site.settings;
  const A = window.CPAvail;
  const form = CP.$('#booking-form');
  const params = new URLSearchParams(location.search);
  const STEPS = [['Tus datos', 'e idea'], ['Diseño', ''], ['Fecha', 'y hora'], ['Precio', 'y señal'], ['Confirmación', '']];

  const today = A.canaryNow().date;
  const state = Object.assign({
    step: 1, name: '', email: '', phone: '', style: params.get('estilo') || '', body_zone: '', size: '', description: '', adult: false,
    image: null, imageName: '', date: '', start_min: null, terms: false, month: today.slice(0, 7),
  }, CP.session.get('cp_booking_draft', {}));
  if (state.step > 4) state.step = 1;

  if (params.get('cancelada')) {
    CP.$('#flow-notice').innerHTML = '<div class="notice" style="margin-bottom:1.4rem">Has cancelado el pago, así que la cita no se ha reservado. Tus datos siguen aquí: puedes intentarlo de nuevo.</div>';
    state.step = Math.min(state.step, 4);
  }
  if (!site.payments) {
    CP.$('#flow-notice').insertAdjacentHTML('beforeend', '<div class="notice" style="margin-bottom:1.4rem">Vista previa: puedes recorrer todos los pasos, pero el pago de la señal se activa cuando el estudio conecta Stripe.</div>');
  }

  const save = () => { const { image, ...rest } = state; CP.session.set('cp_booking_draft', image && image.length < 2_500_000 ? state : rest); };
  const size = () => S.sizes.find((z) => z.id === state.size);
  const hours = (min) => { const h = min / 60; return `${String(h).replace('.', ',')} h`; };

  // ---------- Pasos ----------
  function renderSteps() {
    CP.$('#steps').innerHTML = STEPS.map(([a, b], i) => {
      const n = i + 1;
      const cls = n < state.step ? 'is-done' : n === state.step ? 'is-current' : '';
      return `<li class="${cls}"${n === state.step ? ' aria-current="step"' : ''}><span class="mono muted">0${n}</span><span class="label">${a}${b ? `<span class="long"> ${b}</span>` : ''}</span></li>`;
    }).join('');
  }

  const opt = (list, val, ph) => `<option value="">${ph}</option>` + list.map((x) => `<option${x === val ? ' selected' : ''}>${CP.esc(x)}</option>`).join('');

  function step1() {
    return `<div class="step-panel">
      <div><h2 class="display h3">Cuéntanos quién eres y qué quieres tatuarte</h2></div>
      <div class="form-grid">
        <label class="field full"><span class="label">Nombre y apellidos</span><input class="input" id="f-name" autocomplete="name" value="${CP.esc(state.name)}" required></label>
        <label class="field"><span class="label">Correo electrónico</span><input class="input" id="f-email" type="email" autocomplete="email" value="${CP.esc(state.email)}" required></label>
        <label class="field"><span class="label">Teléfono</span><input class="input" id="f-phone" type="tel" autocomplete="tel" value="${CP.esc(state.phone)}" required></label>
        <label class="field"><span class="label">Estilo</span><select class="select" id="f-style">${opt(S.styles, state.style, 'Elige un estilo')}</select></label>
        <label class="field"><span class="label">Zona del cuerpo</span><select class="select" id="f-zone">${opt(S.body_zones, state.body_zone, 'Elige la zona')}</select></label>
      </div>
      <fieldset class="opt-group"><legend class="label">Tamaño aproximado</legend>
        <div class="choice-grid">${S.sizes.map((z) => `<button type="button" class="choice" data-size="${CP.esc(z.id)}" aria-pressed="${z.id === state.size}">
          <span class="c-title">${CP.esc(z.label)}</span><span class="c-meta">${CP.esc(z.detail)}</span><span class="c-meta">Sesión aprox. ${hours(z.duration_min)}</span></button>`).join('')}</div>
      </fieldset>
      <label class="field"><span class="label">Describe tu idea</span><textarea class="textarea" id="f-desc" placeholder="Qué quieres, referencias, si es en negro o con sombras, si cubre otro tatuaje…">${CP.esc(state.description)}</textarea></label>
      <label class="check"><input type="checkbox" id="f-adult" ${state.adult ? 'checked' : ''}><span>Confirmo que soy mayor de edad y traeré mi documento de identidad el día de la cita.</span></label>
      <div id="err"></div>
      <div class="step-nav"><span></span><button class="btn" type="button" data-next>Continuar</button></div>
    </div>`;
  }

  function step2() {
    return `<div class="step-panel">
      <div><h2 class="display h3">Adjunta tu diseño o una referencia</h2><p class="muted" style="margin-top:.6rem">JPG, PNG o WEBP. Si aún no tienes diseño, puedes seguir sin adjuntarlo y Cristhian te propondrá uno.</p></div>
      <div id="drop-area">${state.image ? previewHtml() : dropHtml()}</div>
      <input type="file" id="f-file" accept="image/jpeg,image/png,image/webp" hidden>
      <div id="err"></div>
      <div class="step-nav"><button class="btn btn-ghost" type="button" data-prev>Atrás</button><button class="btn" type="button" data-next>${state.image ? 'Continuar' : 'Continuar sin diseño'}</button></div>
    </div>`;
  }
  const dropHtml = () => `<div class="drop" id="drop">${CP.icon.upload}<p style="margin:0">Arrastra la imagen aquí o</p><button class="btn btn-ghost" type="button" data-pick>Adjuntar imagen del diseño</button><span class="mono muted">Máx. 15 MB · se optimiza antes de enviarla</span></div>`;
  const previewHtml = () => `<div class="preview"><img src="${state.image}" alt="Vista previa del diseño"><div style="min-width:0"><div class="label">Diseño adjuntado</div><div class="mono muted" style="overflow-wrap:anywhere">${CP.esc(state.imageName)}</div><div class="preview-actions"><button class="link" type="button" data-pick>Cambiar imagen</button><button class="link" type="button" data-remove>Eliminar</button></div></div></div>`;

  function step3() {
    return `<div class="step-panel">
      <div><h2 class="display h3">Elige día y hora</h2><p class="muted" style="margin-top:.6rem">Sesión estimada para un tatuaje ${CP.esc((size() || {}).label || '').toLowerCase()}: <strong style="color:var(--fg)">${hours((size() || {}).duration_min || 60)}</strong>. Solo ves las horas en las que cabe completa.</p></div>
      <div class="cal" id="cal"><p class="muted">Cargando disponibilidad…</p></div>
      <div id="slots-wrap"></div>
      <div id="err"></div>
      <div class="step-nav"><button class="btn btn-ghost" type="button" data-prev>Atrás</button><button class="btn" type="button" data-next>Continuar</button></div>
    </div>`;
  }

  function step4() {
    const z = size();
    const dep = S.deposit_cents;
    const [y, m, d] = state.date.split('-').map(Number);
    const dateLabel = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
    return `<div class="step-panel">
      <div><h2 class="display h3">Señal de reserva</h2></div>
      <div class="price-block">
        <div class="sum-row big"><span>Señal para reservar tu cita</span><span class="mono gold">${CP.euros(dep)}</span></div>
        <p class="muted" style="margin:.4rem 0 0;font-size:.88rem">Con la señal bloqueas tu fecha. Cristhian revisa tu idea y te confirma el presupuesto del tatuaje.${S.deposit_deducted ? ' La señal es un pago a cuenta: se descuenta del precio final, no es un cargo extra.' : ''}</p>
      </div>
      <dl class="ticket" style="position:static">
        <div><dt>Cita</dt><dd>${CP.esc(CP.cap(dateLabel))} · ${A.fmtMin(state.start_min)} h</dd></div>
        <div><dt>Tatuaje</dt><dd>${CP.esc(state.style)} · ${CP.esc(state.body_zone)} · ${CP.esc(z.label)}</dd></div>
        <div><dt>A nombre de</dt><dd>${CP.esc(state.name)}</dd></div>
        <div><dt>Diseño</dt><dd>${state.image ? 'Adjuntado' : 'Sin adjuntar'}</dd></div>
      </dl>
      <div>
        <h3 class="label" style="margin:0 0 .6rem">Condiciones de reserva</h3>
        <div class="terms-box" tabindex="0">${CP.md(S.texts['condiciones-reserva'] || '').replace(/<h2>/g, '<h4>').replace(/<\/h2>/g, '</h4>')}</div>
        <a class="link mono" href="legal.html?doc=condiciones-reserva" target="_blank" rel="noopener" style="display:inline-block;margin-top:.6rem;font-size:.78rem">Abrir condiciones en otra pestaña</a>
      </div>
      <label class="check"><input type="checkbox" id="f-terms" ${state.terms ? 'checked' : ''}><span>He leído y acepto las condiciones de reserva y la <a class="link" href="legal.html?doc=privacidad" target="_blank" rel="noopener">política de privacidad</a>, incluido el uso de la imagen que adjunto.</span></label>
      <div id="err"></div>
      <div class="step-nav"><button class="btn btn-ghost" type="button" data-prev>Atrás</button><button class="btn btn-gold" type="button" data-pay>Pagar señal de ${CP.euros(dep)}</button></div>
      <p class="mono muted" style="margin:0;font-size:.75rem">Pago seguro con Stripe. Tu hora queda bloqueada mientras pagas (30 min). La cita solo se reserva cuando Stripe confirma el pago.</p>
    </div>`;
  }

  function renderTicket() {
    const z = size();
    const row = (k, v) => `<div><dt>${k}</dt><dd>${v || '<span class="muted">—</span>'}</dd></div>`;
    let when = '';
    if (state.date && state.start_min != null) {
      const [y, m, d] = state.date.split('-').map(Number);
      when = `${new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })} · ${A.fmtMin(state.start_min)} h`;
    }
    CP.$('#ticket').innerHTML = `
      <span class="label gold">Tu reserva</span>
      <dl>
        ${row('Estilo', CP.esc(state.style))}
        ${row('Zona', CP.esc(state.body_zone))}
        ${row('Tamaño', z ? `${CP.esc(z.label)} · ${CP.esc(z.detail)}` : '')}
        ${row('Diseño', state.image ? 'Adjuntado' : state.step > 2 ? 'Sin adjuntar' : '')}
        ${row('Día y hora', when)}
        ${row('Duración', z ? hours(z.duration_min) : '')}
      </dl>
      <div class="price-block">
        <div class="sum-row big"><span>Señal de reserva</span><span class="mono gold">${CP.euros(S.deposit_cents)}</span></div>
      </div>
      <p class="mono muted" style="margin:0;font-size:.72rem">El presupuesto del tatuaje te lo confirma Cristhian.${S.deposit_deducted ? ' La señal se descuenta del total.' : ''}</p>`;
  }

  function render() {
    if (state.step >= 2 && valid1()) state.step = 1;
    if (state.step === 4 && (!state.date || state.start_min == null)) state.step = 3;
    renderSteps();
    form.innerHTML = [null, step1, step2, step3, step4][state.step]();
    renderTicket();
    save();
    if (state.step === 2) wireUpload();
    if (state.step === 3) loadMonth();
  }
  const go = (n) => { state.step = n; render(); window.scrollTo({ top: CP.$('#steps').getBoundingClientRect().top + window.scrollY - 100, behavior: 'smooth' }); };
  const err = (msg) => { const e = CP.$('#err'); e.innerHTML = msg ? `<div class="notice error" role="alert">${CP.esc(msg)}</div>` : ''; };

  // ---------- Paso 1: lectura y validación ----------
  function read1() {
    state.name = CP.$('#f-name').value.trim();
    state.email = CP.$('#f-email').value.trim();
    state.phone = CP.$('#f-phone').value.trim();
    state.style = CP.$('#f-style').value;
    state.body_zone = CP.$('#f-zone').value;
    state.description = CP.$('#f-desc').value.trim();
    state.adult = CP.$('#f-adult').checked;
    save(); renderTicket();
  }
  function valid1() {
    if (state.name.length < 3) return 'Escribe tu nombre y apellidos.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(state.email)) return 'Revisa tu correo electrónico.';
    if (!/^[+\d][\d\s-]{7,}$/.test(state.phone)) return 'Revisa tu número de teléfono.';
    if (!state.style) return 'Elige un estilo.';
    if (!state.body_zone) return 'Elige la zona del cuerpo.';
    if (!state.size) return 'Elige el tamaño aproximado.';
    if (state.description.length < 10) return 'Cuéntanos un poco más sobre tu idea.';
    if (!state.adult) return 'Para reservar tienes que ser mayor de edad.';
    return '';
  }

  // ---------- Paso 2: imagen ----------
  function wireUpload() {
    const input = CP.$('#f-file');
    const area = CP.$('#drop-area');
    area.addEventListener('click', (e) => {
      if (e.target.closest('[data-pick]')) input.click();
      if (e.target.closest('[data-remove]')) { state.image = null; state.imageName = ''; render(); }
    });
    input.addEventListener('change', () => input.files[0] && handleFile(input.files[0]));
    const drop = CP.$('#drop');
    if (drop) {
      ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
      ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('is-over'); }));
      drop.addEventListener('drop', (e) => e.dataTransfer.files[0] && handleFile(e.dataTransfer.files[0]));
    }
  }
  async function handleFile(file) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return err('Formato no válido. Usa JPG, PNG o WEBP.');
    if (file.size > 15 * 1024 * 1024) return err('La imagen pesa más de 15 MB. Prueba con otra o hazle una captura.');
    err('');
    try {
      state.image = await compress(file);
      state.imageName = file.name;
      render();
    } catch { err('No hemos podido leer esa imagen. Prueba con otra.'); }
  }
  function compress(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const max = 2000;
        const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        let q = 0.86, out = c.toDataURL('image/jpeg', q);
        while (out.length > 4_000_000 && q > 0.4) { q -= 0.12; out = c.toDataURL('image/jpeg', q); }
        resolve(out);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(); };
      img.src = url;
    });
  }

  // ---------- Paso 3: calendario ----------
  let avail = null;
  async function loadMonth() {
    const cal = CP.$('#cal');
    cal.innerHTML = '<p class="muted">Cargando disponibilidad…</p>';
    try {
      if (site.mode === 'live') avail = await CP.api(`availability?month=${state.month}&size=${encodeURIComponent(state.size)}`);
      else avail = A.computeAvailability({ settings: S, sizeId: state.size, month: state.month, bookings: [], blocked: [] });
    } catch (e) { cal.innerHTML = `<div class="notice error">No se pudo cargar la disponibilidad. ${CP.esc(e.message)}</div>`; return; }
    if (state.date && !(avail.days[state.date] || []).includes(state.start_min) && state.date.startsWith(state.month)) { state.start_min = null; }
    drawCal();
  }
  function drawCal() {
    const [y, m] = state.month.split('-').map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1));
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const offset = (first.getUTCDay() + 6) % 7; // lunes primero
    const monthName = CP.cap(first.toLocaleDateString('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' }).replace(' de ', ' '));
    const minMonth = avail.today.slice(0, 7), maxMonth = avail.lastDate.slice(0, 7);
    let cells = ['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => `<div class="cal-dow label">${d}</div>`).join('');
    cells += '<div></div>'.repeat(offset);
    for (let d = 1; d <= days; d++) {
      const date = `${state.month}-${String(d).padStart(2, '0')}`;
      const open = Boolean(avail.days[date]);
      cells += `<button type="button" class="cal-day${open ? ' is-open' : ''}" data-date="${date}" ${open ? '' : 'disabled'} aria-pressed="${date === state.date}" aria-label="${d} ${monthName}${open ? `, ${avail.days[date].length} horas libres` : ', no disponible'}">${d}</button>`;
    }
    const anyOpen = Object.keys(avail.days).length > 0;
    CP.$('#cal').innerHTML = `
      <div class="cal-head">
        <button class="icon-btn" type="button" data-month="-1" aria-label="Mes anterior" ${state.month <= minMonth ? 'disabled' : ''}>‹</button>
        <h3>${monthName}</h3>
        <button class="icon-btn" type="button" data-month="1" aria-label="Mes siguiente" ${state.month >= maxMonth ? 'disabled' : ''}>›</button>
      </div>
      <div class="cal-grid">${cells}</div>
      <div class="cal-legend mono"><span>Con huecos</span><span class="off">Completo o cerrado</span></div>
      ${anyOpen ? '' : '<p class="muted" style="margin:.8rem 0 0">No quedan huecos este mes. Prueba el siguiente.</p>'}`;
    drawSlots();
  }
  function drawSlots() {
    const wrap = CP.$('#slots-wrap');
    const slots = state.date ? avail.days[state.date] : null;
    if (!slots) { wrap.innerHTML = state.date ? '' : '<p class="muted">Elige un día marcado para ver las horas libres.</p>'; return; }
    const [y, m, d] = state.date.split('-').map(Number);
    const label = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
    wrap.innerHTML = `<h3 class="label" style="margin:0 0 .8rem">Horas libres · ${CP.esc(CP.cap(label))}</h3>
      <div class="slots">${slots.map((t) => `<button type="button" class="slot" data-slot="${t}" aria-pressed="${t === state.start_min}">${A.fmtMin(t)}</button>`).join('')}</div>`;
  }

  // ---------- Eventos ----------
  form.addEventListener('input', () => { if (state.step === 1) read1(); });
  form.addEventListener('change', (e) => {
    if (state.step === 1) read1();
    if (e.target.id === 'f-terms') { state.terms = e.target.checked; save(); }
  });
  form.addEventListener('click', async (e) => {
    const t = e.target;
    const sz = t.closest('[data-size]');
    if (sz) {
      state.size = sz.dataset.size; state.start_min = null;
      CP.$$('[data-size]').forEach((b) => b.setAttribute('aria-pressed', b === sz));
      read1(); return;
    }
    if (t.closest('[data-month]')) {
      const [y, m] = state.month.split('-').map(Number);
      const nd = new Date(Date.UTC(y, m - 1 + Number(t.closest('[data-month]').dataset.month), 1));
      state.month = `${nd.getUTCFullYear()}-${String(nd.getUTCMonth() + 1).padStart(2, '0')}`;
      loadMonth(); save(); return;
    }
    const day = t.closest('[data-date]');
    if (day && !day.disabled) {
      state.date = day.dataset.date; state.start_min = null;
      CP.$$('[data-date]').forEach((b) => b.setAttribute('aria-pressed', b === day));
      drawSlots(); renderTicket(); save(); return;
    }
    const slot = t.closest('[data-slot]');
    if (slot) {
      state.start_min = Number(slot.dataset.slot);
      CP.$$('[data-slot]').forEach((b) => b.setAttribute('aria-pressed', b === slot));
      renderTicket(); save(); err(''); return;
    }
    if (t.closest('[data-prev]')) return go(state.step - 1);
    if (t.closest('[data-next]')) {
      if (state.step === 1) { read1(); const m = valid1(); if (m) return err(m); }
      if (state.step === 3 && (!state.date || state.start_min == null)) return err('Elige un día y una hora.');
      return go(state.step + 1);
    }
    if (t.closest('[data-pay]')) pay(t.closest('[data-pay]'));
  });

  async function pay(btn) {
    state.terms = CP.$('#f-terms').checked;
    if (!state.terms) return err('Para continuar tienes que aceptar las condiciones de reserva.');
    const m = valid1(); if (m) { go(1); setTimeout(() => err(m), 50); return; }
    if (!site.payments) return err('El pago de la señal todavía no está activado. Cuando el estudio conecte Stripe podrás reservar aquí mismo.');
    btn.classList.add('is-loading'); btn.textContent = 'Bloqueando tu hora…';
    try {
      const r = await CP.api('bookings', { method: 'POST', body: {
        name: state.name, email: state.email, phone: state.phone, style: state.style, body_zone: state.body_zone,
        size: state.size, description: state.description, date: state.date, start_min: state.start_min,
        adult: state.adult, terms: true, image: state.image || null,
      } });
      save();
      location.href = r.url;
    } catch (e) {
      btn.classList.remove('is-loading'); btn.textContent = `Pagar señal de ${CP.euros(S.deposit_cents)}`;
      if (e.data && e.data.code === 'slot_taken') { state.start_min = null; save(); go(3); setTimeout(() => err(e.message), 60); return; }
      err(e.message);
    }
  }

  render();
});
