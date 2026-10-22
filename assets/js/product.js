CP.ready((site) => {
  const slug = new URLSearchParams(location.search).get('p');
  const p = site.products.find((x) => x.slug === slug);
  const el = CP.$('#product');
  if (!p) {
    el.innerHTML = '<div><h1 class="display h2">Producto no encontrado</h1><p class="muted" style="margin:1rem 0 2rem">Puede que se haya agotado o retirado.</p><a class="btn" href="tienda.html">Volver a la tienda</a></div>';
    return;
  }
  document.title = `${p.name} · ${site.settings.studio.name}`;
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.setAttribute('content', p.description.slice(0, 155));

  const chosen = {};
  (p.variants || []).forEach((v) => { if ((v.options || []).length === 1) chosen[v.name] = v.options[0].label; });
  const out = p.stock <= 0;
  const imgs = (p.images || []).length ? p.images : [''];
  const ship = site.settings.shipping;

  el.innerHTML = `
    <div class="p-gallery">
      <div class="p-img" id="main-img"><img src="${CP.asset(imgs[0])}" alt="${CP.esc(p.name)}"></div>
      ${imgs.length > 1 ? `<div class="p-thumbs">${imgs.map((src, i) => `<button type="button" data-img="${i}" aria-pressed="${i === 0}" aria-label="Imagen ${i + 1}"><img src="${CP.asset(src)}" alt=""></button>`).join('')}</div>` : ''}
    </div>
    <div class="p-info">
      <div>
        <span class="label gold">${CP.esc((window.CPSeed.CATEGORIES.find((c) => c.id === p.category) || { label: p.category }).label)}</span>
        <h1 class="display h2" style="margin:.6rem 0 .8rem">${CP.esc(p.name)}</h1>
        <div class="price" id="price">${CP.euros(CP.priceFor(p, chosen))}</div>
      </div>
      ${(p.variants || []).map((v) => `<fieldset class="opt-group"><legend class="label">${CP.esc(v.name)}</legend><div class="opts">${(v.options || []).map((o) => `<button type="button" class="opt" data-var="${CP.esc(v.name)}" data-opt="${CP.esc(o.label)}" aria-pressed="${chosen[v.name] === o.label}">${CP.esc(o.label)}</button>`).join('')}</div></fieldset>`).join('')}
      <div class="buy-row">
        <div class="qty"><button type="button" data-q="-1" aria-label="Menos">−</button><input id="qty" type="number" min="1" max="20" value="1" aria-label="Cantidad"><button type="button" data-q="1" aria-label="Más">+</button></div>
        <button class="btn" id="add" type="button" ${out ? 'disabled' : ''}>${out ? 'Agotado' : 'Añadir al carrito'}</button>
      </div>
      <p class="mono muted" id="stock-note">${out ? 'Sin stock ahora mismo.' : p.stock <= 5 ? `Últimas ${p.stock} unidades` : 'En stock · sale en 24–72 h'}</p>
      <div class="notes">
        <details open><summary class="label">Descripción</summary><p>${CP.esc(p.description)}</p></details>
        <details><summary class="label">Envíos</summary><p>${ship.zones.filter((z) => z.price_cents).map((z) => `${CP.esc(z.label)}: ${CP.euros(z.price_cents)}`).join(' · ')}${ship.free_over_cents ? `. Gratis a partir de ${CP.euros(ship.free_over_cents)}.` : '.'} También puedes recogerlo en el estudio.</p></details>
        <details><summary class="label">Devoluciones</summary><p>Consulta la <a class="link" href="legal.html?doc=envios-devoluciones">política de envíos y devoluciones</a>.</p></details>
      </div>
    </div>`;

  const qty = CP.$('#qty');
  el.addEventListener('click', (e) => {
    const o = e.target.closest('[data-opt]');
    if (o) {
      chosen[o.dataset.var] = o.dataset.opt;
      CP.$$(`[data-var="${CSS.escape(o.dataset.var)}"]`).forEach((b) => b.setAttribute('aria-pressed', b === o));
      CP.$('#price').textContent = CP.euros(CP.priceFor(p, chosen));
    }
    const q = e.target.closest('[data-q]');
    if (q) qty.value = Math.max(1, Math.min(20, (parseInt(qty.value, 10) || 1) + Number(q.dataset.q)));
    const t = e.target.closest('[data-img]');
    if (t) { CP.$('#main-img img').src = CP.asset(imgs[Number(t.dataset.img)]); CP.$$('[data-img]').forEach((b) => b.setAttribute('aria-pressed', b === t)); }
  });
  CP.$('#add').addEventListener('click', () => {
    const missing = (p.variants || []).find((v) => !chosen[v.name]);
    if (missing) { CP.toast(`Elige ${missing.name.toLowerCase()}`); return; }
    const n = Math.max(1, Math.min(20, parseInt(qty.value, 10) || 1));
    const optLabel = Object.entries(chosen).map(([k, v]) => `${k}: ${v}`).join(' · ');
    CP.cart.add({ id: p.id, slug: p.slug, name: p.name, image: imgs[0], options: { ...chosen }, options_label: optLabel, price_cents: CP.priceFor(p, chosen), qty: n });
    CP.toast(`${p.name} añadido`, 'carrito.html', 'Ver carrito');
  });

  const related = site.products.filter((x) => x.id !== p.id && (x.category === p.category || x.featured)).slice(0, 4);
  CP.$('#related').innerHTML = related.map(CP.productCard).join('');
});
