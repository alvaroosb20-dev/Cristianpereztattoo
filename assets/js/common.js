/* Común a todas las páginas: datos del sitio, cabecera, pie, carrito, utilidades. */
(function () {
  const CP = (window.CP = window.CP || {});

  // ---------- Utilidades ----------
  CP.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  CP.euros = (cents) => (Number(cents || 0) / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: cents % 100 ? 2 : 0 });
  CP.cap = (s) => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);
  CP.$ = (sel, el) => (el || document).querySelector(sel);
  CP.$$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));
  CP.store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };
  CP.session = {
    get(k, d) { try { const v = sessionStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch {} },
    del(k) { try { sessionStorage.removeItem(k); } catch {} },
  };
  // ruta de un recurso: absoluta (http) o relativa a la raíz del sitio
  CP.root = document.documentElement.dataset.root || '';
  CP.asset = (src) => (!src ? '' : /^(https?:|data:|blob:)/.test(src) ? src : CP.root + String(src).replace(/^\//, ''));

  // Markdown mínimo: "## Título", "- lista", párrafos
  CP.md = (text) => {
    const lines = String(text || '').split('\n');
    let html = '', inList = false;
    const close = () => { if (inList) { html += '</ul>'; inList = false; } };
    for (const raw of lines) {
      const line = raw.trimEnd();
      if (/^##\s+/.test(line)) { close(); html += `<h2>${CP.esc(line.replace(/^##\s+/, ''))}</h2>`; }
      else if (/^-\s+/.test(line)) { if (!inList) { html += '<ul>'; inList = true; } html += `<li>${CP.esc(line.replace(/^-\s+/, ''))}</li>`; }
      else if (!line.trim()) close();
      else { close(); html += `<p>${CP.esc(line)}</p>`; }
    }
    close();
    return html;
  };

  CP.toast = (msg, linkHref, linkText) => {
    let t = CP.$('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.innerHTML = `<span>${CP.esc(msg)}</span>${linkHref ? `<a href="${linkHref}">${CP.esc(linkText)}</a>` : ''}`;
    t.classList.add('is-on');
    clearTimeout(CP._tt);
    CP._tt = setTimeout(() => t.classList.remove('is-on'), 3800);
  };

  CP.api = async (path, opts = {}) => {
    const ctrl = 'AbortController' in window ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), opts.timeout || 15000) : null;
    let r;
    try {
      r = await fetch(CP.root + 'api/' + path, {
        method: opts.method || 'GET',
        headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        credentials: 'same-origin',
        cache: 'no-store',
        signal: ctrl ? ctrl.signal : undefined,
      });
    } catch (e) {
      throw Object.assign(new Error(e.name === 'AbortError' ? 'El servidor tarda demasiado en responder.' : 'Sin conexión con el servidor.'), { status: 0 });
    } finally { if (timer) clearTimeout(timer); }
    let data = null;
    try { data = await r.json(); } catch {}
    if (!r.ok) { const e = new Error((data && data.error) || `Error ${r.status}`); e.status = r.status; e.data = data; throw e; }
    return data;
  };

  // ---------- Datos del sitio (con modo demostración si la API no responde) ----------
  CP.site = null;
  CP.loadSite = () => {
    if (CP._sitePromise) return CP._sitePromise;
    CP._sitePromise = CP.api('site')
      .then((d) => { if (!d || !d.settings) throw new Error('sin api'); return d; })
      .catch(() => {
        // Vista previa sin servidor: datos de ejemplo, o lo que se haya cambiado en el panel en modo demostración
        const S = window.CPSeed;
        const demo = CP.store.get('cp_admin_demo_v1', null);
        if (demo) {
          const merged = JSON.parse(JSON.stringify(S.DEFAULT_SETTINGS));
          Object.entries(demo.settings || {}).forEach(([k, v]) => { merged[k] = v && typeof v === 'object' && !Array.isArray(v) && merged[k] && typeof merged[k] === 'object' ? { ...merged[k], ...v } : v; });
          return { mode: 'preview', payments: false, viewer_is_admin: Boolean(CP.session.get('cp_admin_demo_login', false)), settings: merged,
            products: (demo.products || S.PRODUCTS).filter((p) => p.active !== false).sort((a, b) => (a.sort || 0) - (b.sort || 0)),
            portfolio: (demo.portfolio || S.PORTFOLIO).filter((p) => p.visible !== false).sort((a, b) => (a.sort || 0) - (b.sort || 0)),
            reviews: (demo.reviews || []).filter((r) => r.visible !== false) };
        }
        return { mode: 'preview', payments: false, settings: S.DEFAULT_SETTINGS, products: S.PRODUCTS, portfolio: S.PORTFOLIO, reviews: [] };
      })
      .then((d) => { CP.site = d; return d; });
    return CP._sitePromise;
  };

  // ---------- Carrito ----------
  const CART_KEY = 'cp_cart_v1';
  CP.cart = {
    items() { return CP.store.get(CART_KEY, []); },
    save(items) { CP.store.set(CART_KEY, items); CP.cart.render(); document.dispatchEvent(new CustomEvent('cart:change')); },
    count() { return CP.cart.items().reduce((a, i) => a + i.qty, 0); },
    add(item) {
      const items = CP.cart.items();
      const key = item.id + '|' + JSON.stringify(item.options || {});
      const found = items.find((i) => i.key === key);
      if (found) found.qty = Math.min(20, found.qty + item.qty);
      else items.push({ ...item, key });
      CP.cart.save(items);
    },
    setQty(key, qty) { const items = CP.cart.items(); const it = items.find((i) => i.key === key); if (it) it.qty = Math.max(1, Math.min(20, qty)); CP.cart.save(items); },
    remove(key) { CP.cart.save(CP.cart.items().filter((i) => i.key !== key)); },
    clear() { CP.cart.save([]); },
    subtotal() { return CP.cart.items().reduce((a, i) => a + i.price_cents * i.qty, 0); },
    render() { CP.$$('.cart-count').forEach((el) => { const n = CP.cart.count(); el.textContent = n || ''; el.dataset.n = n; }); },
  };

  CP.priceFor = (product, options) => {
    let price = product.price_cents;
    for (const v of product.variants || []) {
      const o = (v.options || []).find((x) => x.label === (options || {})[v.name]);
      if (o && o.price_cents) price = o.price_cents;
    }
    return price;
  };
  CP.minPrice = (p) => {
    let min = p.price_cents, has = false;
    for (const v of p.variants || []) for (const o of v.options || []) if (o.price_cents) { has = true; min = Math.min(min, o.price_cents); }
    return { min, from: has };
  };

  // ---------- Iconos ----------
  CP.icon = {
    bag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
    menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8h18M3 16h18"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4l13 8-13 8z"/></svg>',
    sound: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 8.5a5 5 0 0 1 0 7" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
    mute: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9l5 6M21 9l-5 6" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
    upload: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v4h16v-4"/></svg>',
    ig: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1"/></svg>',
  };

  // ---------- Cabecera y pie ----------
  const NAV = [
    ['index.html', 'Inicio', 'home'],
    ['portafolio.html', 'Portafolio', 'portfolio'],
    ['tienda.html', 'Tienda', 'shop'],
    ['reservar.html', 'Reservar cita', 'book'],
  ];

  function header(site) {
    const page = document.body.dataset.page;
    const s = site.settings;
    const ann = (s.announcement || '').split('·').map((x) => x.trim()).filter(Boolean);
    const annHtml = ann.length ? `<div class="announce" aria-label="Avisos"><div class="announce-track">${[...ann, ...ann, ...ann, ...ann].map((a) => `<span>${CP.esc(a)}</span>`).join('')}</div></div>` : '';
    const demo = site.mode !== 'live' ? `<div class="demo-flag mono">Vista previa · ${site.mode === 'demo' ? 'base de datos sin conectar' : 'datos de ejemplo'}: los pagos están desactivados</div>` : '';
    return `${demo}${annHtml}
    <header class="site-header">
      <div class="wrap header-row">
        <div class="header-left">
          <button class="icon-btn menu-btn" type="button" aria-label="Abrir menú" data-menu-open>${CP.icon.menu}</button>
          <nav class="nav" aria-label="Principal">${NAV.slice(0, 3).map(([h, t, k]) => `<a href="${CP.root}${h}"${k === page ? ' aria-current="page"' : ''}>${t}</a>`).join('')}</nav>
        </div>
        <a class="brand" href="${CP.root}index.html" aria-label="${CP.esc(s.studio.name)}, inicio">
          <span class="brand-name">${CP.esc(s.studio.artist || 'Cristhian Pérez')}</span>
          <span class="brand-sub">Tattoo</span>
        </a>
        <div class="header-actions">
          <a class="btn btn-ghost header-book" href="${CP.root}reservar.html" style="min-height:40px;padding:0 1.1em;font-size:.72rem">Reservar</a>
          <a class="icon-btn" href="${CP.root}carrito.html" aria-label="Carrito">${CP.icon.bag}<span class="cart-count" aria-live="polite"></span></a>
        </div>
      </div>
    </header>
    <div class="mobile-nav" hidden id="mobile-nav" role="dialog" aria-modal="true" aria-label="Menú">
      <div class="mobile-nav-top">
        <span class="brand-name">${CP.esc(s.studio.artist)}</span>
        <button class="icon-btn" type="button" aria-label="Cerrar menú" data-menu-close>${CP.icon.close}</button>
      </div>
      <nav>${NAV.map(([h, t], i) => `<a href="${CP.root}${h}">${t}<small>0${i + 1}</small></a>`).join('')}<a href="${CP.root}carrito.html">Carrito<small class="cart-count"></small></a></nav>
      ${s.studio.instagram ? `<a class="btn btn-ghost" href="https://instagram.com/${CP.esc(s.studio.instagram)}" target="_blank" rel="noopener">@${CP.esc(s.studio.instagram)}</a>` : ''}
    </div>`;
  }

  function footer(site) {
    const st = site.settings.studio;
    const year = new Date().getFullYear();
    return `<footer class="site-footer"><div class="wrap">
      <p class="footer-word" aria-hidden="true">Cristhian Pérez</p>
      <div class="footer-cols">
        <div>
          <h4 class="label">Estudio</h4>
          <p class="muted" style="max-width:40ch">${CP.esc(st.tagline)}</p>
          <p>${CP.esc(st.address || st.city)}<br><span class="muted">${CP.esc(st.hours_text || '')}</span></p>
          ${st.instagram ? `<a class="chip-btn" href="https://instagram.com/${CP.esc(st.instagram)}" target="_blank" rel="noopener" style="width:max-content">${CP.icon.ig.replace('<svg', '<svg style="fill:none;stroke:currentColor;stroke-width:1.6"')} @${CP.esc(st.instagram)}</a>` : ''}
        </div>
        <div>
          <h4 class="label">Info</h4>
          <ul>
            <li><a href="${CP.root}reservar.html">Reservar cita</a></li>
            <li><a href="${CP.root}tienda.html">Tienda</a></li>
            <li><a href="${CP.root}portafolio.html">Portafolio</a></li>
            <li><a href="${CP.root}index.html#contacto">Contacto</a></li>
          </ul>
        </div>
        <div>
          <h4 class="label">Legal</h4>
          <ul>
            <li><a href="${CP.root}legal.html?doc=condiciones-reserva">Condiciones de reserva</a></li>
            <li><a href="${CP.root}legal.html?doc=envios-devoluciones">Envíos y devoluciones</a></li>
            <li><a href="${CP.root}legal.html?doc=privacidad">Privacidad</a></li>
            <li><a href="${CP.root}legal.html?doc=aviso-legal">Aviso legal</a></li>
            <li><a href="${CP.root}legal.html?doc=cookies">Cookies</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-base mono"><span>© ${year} ${CP.esc(st.name)}</span><span><button class="link mono" type="button" data-cookie-settings>Configurar cookies</button> · <a class="link mono" href="${CP.root}admin/index.html" rel="nofollow">Acceso estudio</a></span></div>
    </div></footer>`;
  }

  function wireMenu() {
    const nav = CP.$('#mobile-nav');
    CP.$$('[data-menu-open]').forEach((b) => b.addEventListener('click', () => { nav.hidden = false; document.body.style.overflow = 'hidden'; }));
    CP.$$('[data-menu-close]').forEach((b) => b.addEventListener('click', () => { nav.hidden = true; document.body.style.overflow = ''; }));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && nav && !nav.hidden) { nav.hidden = true; document.body.style.overflow = ''; } });
  }

  // ---------- Lightbox ----------
  CP.lightbox = (item) => {
    const box = document.createElement('div');
    box.className = 'lightbox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    const media = item.kind === 'video'
      ? `<video src="${CP.asset(item.src)}" poster="${CP.asset(item.poster)}" controls playsinline autoplay></video>`
      : `<img src="${CP.asset(item.src)}" alt="${CP.esc(item.title)}">`;
    box.innerHTML = `<div class="lightbox-inner">${media}</div>
      <button class="icon-btn lightbox-close" type="button" aria-label="Cerrar">${CP.icon.close}</button>
      <div class="lightbox-cap"><div class="label gold">${CP.esc(item.style || '')}</div><div class="display h3" style="font-size:1.3rem">${CP.esc(item.title || '')}</div></div>`;
    const close = () => { const v = box.querySelector('video'); if (v) v.pause(); box.remove(); document.body.style.overflow = ''; document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    box.addEventListener('click', (e) => { if (e.target === box || e.target.classList.contains('lightbox-inner')) close(); });
    box.querySelector('.lightbox-close').addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    document.body.appendChild(box);
    document.body.style.overflow = 'hidden';
    const v = box.querySelector('video');
    if (v) { v.muted = false; v.play().catch(() => {}); }
    box.querySelector('.lightbox-close').focus();
  };

  // ---------- Vídeos: reproducción automática + música ----------
  // Todos los vídeos arrancan solos (en silencio, es lo que permiten los navegadores) y se pausan fuera de pantalla.
  // Con el primer toque en cualquier parte de la web se activa la música: suena el vídeo que más se ve
  // y va cambiando al hacer scroll. El botón flotante «Sonido» la apaga o enciende.
  CP.videoCard = (item) => `
    <div class="tile video-card" data-video>
      <video src="${CP.asset(item.src)}" poster="${CP.asset(item.poster)}" autoplay muted loop playsinline preload="metadata" aria-label="${CP.esc(item.title || 'Vídeo del estudio')}"></video>
    </div>`;
  CP.sound = (() => {
    const KEY = 'cp_sound_on';
    let want = CP.store.get(KEY, true);
    let unlocked = false, pinned = null, btn = null, io = null;
    const ratios = new Map();
    const videos = () => CP.$$('[data-video] video');
    function pick() {
      if (pinned && document.contains(pinned) && (ratios.get(pinned) || 0) > 0.2) return pinned;
      let best = null, max = 0;
      ratios.forEach((r, v) => { if (r > max && document.contains(v)) { max = r; best = v; } });
      return max >= 0.45 ? best : null;
    }
    function render() {
      if (!btn) return;
      btn.setAttribute('aria-pressed', String(want && unlocked));
      btn.innerHTML = `${want ? CP.icon.sound : CP.icon.mute}<span>${!want ? 'Sonido off' : unlocked ? 'Sonido on' : 'Toca para oír'}</span>`;
    }
    function apply() {
      const active = unlocked && want ? pick() : null;
      videos().forEach((v) => {
        const shouldMute = v !== active;
        if (v.muted !== shouldMute) v.muted = shouldMute;
      });
      if (active) {
        active.volume = 1;
        if (active.paused) active.play().catch(() => { active.muted = true; active.play().catch(() => {}); });
      }
      render();
    }
    function unlock() {
      if (unlocked) return;
      unlocked = true;
      // "Bendecir" todos los vídeos dentro del gesto para que Safari permita el sonido después
      videos().forEach((v) => { if ((ratios.get(v) || 0) > 0) { v.muted = false; v.play().catch(() => {}); } });
      apply();
    }
    ['pointerdown', 'touchend', 'keydown'].forEach((ev) => document.addEventListener(ev, unlock, { capture: true, passive: true }));
    function ensureButton() {
      if (btn) return;
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sound-toggle';
      btn.setAttribute('aria-label', 'Activar o quitar la música de los vídeos');
      btn.addEventListener('click', () => {
        if (!unlocked) { unlock(); want = true; } else want = !want;
        pinned = null;
        CP.store.set(KEY, want);
        apply();
      });
      document.body.appendChild(btn);
      render();
    }
    function register(root) {
      if (!io) {
        io = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
          entries.forEach((e) => {
            ratios.set(e.target, e.isIntersecting ? e.intersectionRatio : 0);
            if (e.isIntersecting) e.target.play().catch(() => {}); else e.target.pause();
          });
          apply();
        }, { threshold: [0, 0.25, 0.45, 0.6, 0.8, 1] }) : null;
      }
      CP.$$('[data-video] video', root).forEach((v) => {
        if (v.dataset.wired) return;
        v.dataset.wired = '1';
        v.muted = true; v.loop = true; v.playsInline = true;
        if (io) io.observe(v); else v.play().catch(() => {});
        v.closest('[data-video]').addEventListener('click', () => {
          unlock();
          if (!v.muted && want) { want = false; pinned = null; }
          else { want = true; pinned = v; }
          CP.store.set(KEY, want);
          apply();
        });
      });
      if (CP.$$('[data-video] video').length) ensureButton();
    }
    return { register, apply };
  })();
  CP.wireVideoCards = (root) => CP.sound.register(root || document);

  CP.productCard = (p) => {
    const { min, from } = CP.minPrice(p);
    const out = p.stock <= 0;
    return `<a class="p-card" href="${CP.root}producto.html?p=${encodeURIComponent(p.slug)}">
      <div class="p-img">${p.images && p.images[0] ? `<img src="${CP.asset(p.images[0])}" alt="${CP.esc(p.name)}" loading="lazy">` : ''}
        ${out ? '<span class="p-tag out label">Agotado</span>' : p.featured ? '<span class="p-tag label">Nuevo</span>' : ''}</div>
      <div class="p-meta"><span class="p-name">${CP.esc(p.name)}</span><span class="p-price">${from ? 'desde ' : ''}${CP.euros(min)}</span></div>
    </a>`;
  };

  // ---------- Cookies: consentimiento (LSSI art. 22.2 / guía AEPD) ----------
  CP.consent = (() => {
    const KEY = 'cp_cookie_consent', VERSION = 1, DAYS = 365;
    const hasGA = () => Boolean(window.CP_CONFIG && window.CP_CONFIG.GA_ID);
    function get() {
      const c = CP.store.get(KEY, null);
      if (!c || c.v !== VERSION || Date.now() - c.ts > DAYS * 864e5) return null;
      return c;
    }
    function set(choice) {
      const c = { v: VERSION, ts: Date.now(), maps: Boolean(choice.maps), analytics: Boolean(choice.analytics) };
      CP.store.set(KEY, c);
      if (c.analytics && window.CP_loadGA) window.CP_loadGA();
      document.dispatchEvent(new CustomEvent('consent:change', { detail: c }));
      close();
      return c;
    }
    const allowed = (k) => { const c = get(); return Boolean(c && c[k]); };
    let box = null;
    function close() { if (box) { box.remove(); box = null; } }
    function open(configure) {
      close();
      const c = get() || { maps: false, analytics: false };
      box = document.createElement('div');
      box.className = 'cookie-box';
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-label', 'Aviso de cookies');
      box.innerHTML = `
        <div class="cookie-inner">
          <div class="cookie-text">
            <span class="label">[ Cookies ]</span>
            <p>Usamos almacenamiento técnico para que la web funcione (carrito, sonido, tu elección). Con tu permiso, cargamos el mapa de Google${hasGA() ? ' y medimos visitas con Google Analytics' : ''}, que instalan cookies de terceros. <a class="link" href="${CP.root}legal.html?doc=cookies">Política de cookies</a></p>
          </div>
          <div class="cookie-prefs" ${configure ? '' : 'hidden'}>
            <label class="check"><input type="checkbox" checked disabled><span><strong>Técnicas</strong> · necesarias, siempre activas</span></label>
            <label class="check"><input type="checkbox" id="ck-maps" ${c.maps ? 'checked' : ''}><span><strong>Mapa de Google</strong> · muestra la ubicación del estudio</span></label>
            ${hasGA() ? `<label class="check"><input type="checkbox" id="ck-an" ${c.analytics ? 'checked' : ''}><span><strong>Analítica</strong> · Google Analytics, visitas anónimas</span></label>` : ''}
          </div>
          <div class="cookie-actions">
            <button class="btn btn-ghost" type="button" data-ck="reject">Rechazar</button>
            <button class="btn btn-ghost" type="button" data-ck="config" ${configure ? 'hidden' : ''}>Configurar</button>
            <button class="btn btn-ghost" type="button" data-ck="save" ${configure ? '' : 'hidden'}>Guardar selección</button>
            <button class="btn" type="button" data-ck="accept">Aceptar todo</button>
          </div>
        </div>`;
      box.addEventListener('click', (e) => {
        const b = e.target.closest('[data-ck]');
        if (!b) return;
        const a = b.dataset.ck;
        if (a === 'accept') set({ maps: true, analytics: true });
        if (a === 'reject') set({ maps: false, analytics: false });
        if (a === 'save') set({ maps: CP.$('#ck-maps', box).checked, analytics: Boolean(CP.$('#ck-an', box) && CP.$('#ck-an', box).checked) });
        if (a === 'config') { CP.$('.cookie-prefs', box).hidden = false; b.hidden = true; CP.$('[data-ck="save"]', box).hidden = false; }
      });
      document.body.appendChild(box);
    }
    function init() {
      const c = get();
      if (!c) open(false);
      else if (c.analytics && window.CP_loadGA) window.CP_loadGA();
      document.addEventListener('click', (e) => { if (e.target.closest('[data-cookie-settings]')) { e.preventDefault(); open(true); } });
    }
    return { get, set, allowed, open, init };
  })();

  // ---------- Pantalla «Preparando web» ----------
  function maintenanceScreen(site) {
    const s = site.settings, st = s.studio, m = s.maintenance || {};
    const wa = (st.whatsapp || '').replace(/\D/g, '');
    document.title = `${m.title || 'Preparando web'} · ${st.name}`;
    document.body.classList.add('is-maintenance');
    document.body.innerHTML = `
      <main class="mnt">
        <div class="mnt-top label"><span>${CP.esc(st.name)}</span><span>${CP.esc(st.city || '')}</span></div>
        <div class="mnt-center">
          <span class="label">[ ${CP.esc(st.artist || 'Cristhian Pérez')} · Tattoo ]</span>
          <h1 class="display mnt-title">${CP.esc(m.title || 'Preparando web')}</h1>
          <div class="mnt-bar" aria-hidden="true"><span></span></div>
          <p class="mnt-msg">${CP.esc(m.message || '')}</p>
          <div class="mnt-actions">
            ${wa ? `<a class="btn" href="https://wa.me/${wa}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
            ${st.instagram ? `<a class="btn btn-ghost" href="https://instagram.com/${CP.esc(st.instagram)}" target="_blank" rel="noopener">@${CP.esc(st.instagram)}</a>` : ''}
          </div>
        </div>
        <div class="mnt-foot label"><span>[ ${CP.esc(st.address || st.city || '')} ]</span><span>${CP.esc(st.phone || '')}</span></div>
      </main>`;
  }

  CP.ready = (fn) => {
    CP.loadSite().then((site) => {
      const m = site.settings.maintenance;
      if (m && m.on && !site.viewer_is_admin) { maintenanceScreen(site); return; }
      if (m && m.on && site.viewer_is_admin) document.body.insertAdjacentHTML('afterbegin', `<div class="demo-flag mono">Modo «Preparando web» activo: los visitantes ven la pantalla de espera. Tú ves la web porque has entrado al panel. <a href="${CP.root}admin/index.html#preparando" style="color:inherit">Cambiar</a></div>`);
      const h = CP.$('#site-header'), f = CP.$('#site-footer');
      if (h) h.outerHTML = header(site);
      if (f) f.outerHTML = footer(site);
      wireMenu();
      CP.cart.render();
      CP.wireVideoCards(document);
      CP.consent.init();
      try { fn(site); } catch (e) { console.error(e); }
    });
  };
})();
