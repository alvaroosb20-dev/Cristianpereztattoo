CP.ready((site) => {
  const ship = site.settings.shipping;
  const zoneSel = CP.$('#c-zone');
  zoneSel.innerHTML = ship.zones.map((z) => `<option value="${CP.esc(z.id)}">${CP.esc(z.label)} · ${z.price_cents ? CP.euros(z.price_cents) : 'gratis'}</option>`).join('');
  const draft = CP.store.get('cp_checkout_draft', {});
  const fields = ['c-name', 'c-email', 'c-phone', 'c-zone', 'a-line1', 'a-line2', 'a-cp', 'a-city', 'a-prov'];
  fields.forEach((id) => { if (draft[id]) CP.$('#' + id).value = draft[id]; });
  CP.$('#checkout-form').addEventListener('input', () => { const d = {}; fields.forEach((id) => { d[id] = CP.$('#' + id).value; }); CP.store.set('cp_checkout_draft', d); });

  if (new URLSearchParams(location.search).get('cancelado')) CP.$('#cart-notice').innerHTML = '<div class="notice" style="margin-top:1.4rem">Has cancelado el pago. Tu carrito sigue aquí.</div>';

  // Precios y stock reales (por si han cambiado desde que se añadió al carrito)
  const items = CP.cart.items().filter((it) => site.products.some((p) => p.id === it.id));
  items.forEach((it) => { const p = site.products.find((x) => x.id === it.id); it.price_cents = CP.priceFor(p, it.options); });
  CP.cart.save(items);

  function render() {
    const list = CP.cart.items();
    if (!list.length) {
      CP.$('#cart-layout').innerHTML = '<div style="grid-column:1/-1;padding-block:2rem 5rem"><p class="lead muted">Tu carrito está vacío.</p><a class="btn" href="tienda.html" style="margin-top:1rem">Ir a la tienda</a></div>';
      return;
    }
    CP.$('#cart-lines').innerHTML = list.map((it) => `
      <div class="cart-line">
        <img src="${CP.asset(it.image)}" alt="">
        <div style="min-width:0">
          <a class="p-name" href="producto.html?p=${encodeURIComponent(it.slug)}" style="text-decoration:none">${CP.esc(it.name)}</a>
          ${it.options_label ? `<div class="mono muted">${CP.esc(it.options_label)}</div>` : ''}
          <div class="qty"><button type="button" data-k="${CP.esc(it.key)}" data-d="-1" aria-label="Menos">−</button><input value="${it.qty}" readonly aria-label="Cantidad"><button type="button" data-k="${CP.esc(it.key)}" data-d="1" aria-label="Más">+</button></div>
        </div>
        <div style="text-align:right"><div class="p-price">${CP.euros(it.price_cents * it.qty)}</div><button class="link mono" type="button" data-rm="${CP.esc(it.key)}" style="margin-top:.6rem;font-size:.75rem">Eliminar</button></div>
      </div>`).join('');
    const sub = CP.cart.subtotal();
    const zone = ship.zones.find((z) => z.id === zoneSel.value) || ship.zones[0];
    const free = ship.free_over_cents && sub >= ship.free_over_cents;
    const shipCents = free ? 0 : zone.price_cents;
    const missing = ship.free_over_cents && !free && zone.price_cents ? ship.free_over_cents - sub : 0;
    CP.$('#address-fields').hidden = zone.id === 'recogida';
    CP.$('#summary').innerHTML = `
      <h2 class="display h3">Resumen</h2>
      <div class="sum-row"><span>Subtotal</span><span class="mono">${CP.euros(sub)}</span></div>
      <div class="sum-row"><span>Envío · ${CP.esc(zone.label)}</span><span class="mono">${shipCents ? CP.euros(shipCents) : 'Gratis'}</span></div>
      ${missing > 0 ? `<p class="mono muted" style="margin:0">Te faltan ${CP.euros(missing)} para el envío gratis.</p>` : ''}
      <div class="sum-row total"><span>Total</span><span class="mono">${CP.euros(sub + shipCents)}</span></div>
      <p class="muted" style="font-size:.85rem;margin:0">Impuestos incluidos. Pago seguro con tarjeta, Apple Pay o Google Pay a través de Stripe.</p>
      <div id="pay-error"></div>
      <button class="btn btn-gold btn-block" type="button" id="pay">Pagar ${CP.euros(sub + shipCents)}</button>
      <a class="link mono" href="tienda.html" style="text-align:center">Seguir comprando</a>`;
    CP.$('#pay').addEventListener('click', pay);
  }

  CP.$('#cart-lines').addEventListener('click', (e) => {
    const d = e.target.closest('[data-d]');
    if (d) { const it = CP.cart.items().find((i) => i.key === d.dataset.k); if (it) CP.cart.setQty(it.key, it.qty + Number(d.dataset.d)); render(); }
    const rm = e.target.closest('[data-rm]');
    if (rm) { CP.cart.remove(rm.dataset.rm); render(); }
  });
  zoneSel.addEventListener('change', render);
  CP.$('#b-same').addEventListener('change', (e) => { CP.$('#billing-fields').hidden = e.target.checked; });

  async function pay() {
    const v = (id) => CP.$('#' + id).value.trim();
    const err = (m) => { CP.$('#pay-error').innerHTML = `<div class="notice error">${CP.esc(m)}</div>`; };
    const zone = v('c-zone');
    if (v('c-name').length < 3) return err('Escribe tu nombre y apellidos.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v('c-email'))) return err('Revisa tu correo.');
    if (!/^[+\d][\d\s-]{7,}$/.test(v('c-phone'))) return err('Revisa tu teléfono.');
    if (zone !== 'recogida' && (!v('a-line1') || !/^\d{5}$/.test(v('a-cp')) || !v('a-city') || !v('a-prov'))) return err('Completa la dirección de envío (el código postal tiene 5 cifras).');
    const same = CP.$('#b-same').checked;
    if (!site.payments) return err('Los pagos todavía no están activados en esta web. En cuanto se conecte Stripe podrás pagar aquí.');
    const btn = CP.$('#pay'); btn.classList.add('is-loading'); btn.textContent = 'Abriendo pago seguro…';
    try {
      const r = await CP.api('checkout', { method: 'POST', body: {
        items: CP.cart.items().map((i) => ({ id: i.id, qty: i.qty, options: i.options })),
        zone, notes: v('c-notes'),
        customer: { name: v('c-name'), email: v('c-email'), phone: v('c-phone') },
        shipping: { line1: v('a-line1'), line2: v('a-line2'), postal_code: v('a-cp'), city: v('a-city'), province: v('a-prov') },
        billing: same ? { same: true } : { same: false, name: v('b-name'), nif: v('b-nif'), line1: v('b-line1'), postal_code: v('b-cp'), city: v('b-city'), province: v('b-prov') },
      } });
      location.href = r.url;
    } catch (e) {
      err(e.message); btn.classList.remove('is-loading'); btn.textContent = 'Pagar';
    }
  }
  render();
});
