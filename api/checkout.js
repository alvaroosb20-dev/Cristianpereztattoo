// POST /api/checkout → recalcula el carrito con los precios reales de la base de datos,
// crea el pedido y abre Stripe Checkout. El navegador nunca decide el precio.
const core = require('./_lib/core');
const data = require('./_lib/data');

function priceFor(product, options) {
  let price = product.price_cents;
  const labels = [];
  for (const v of product.variants || []) {
    const chosen = options && options[v.name];
    const opt = (v.options || []).find((o) => o.label === chosen);
    if (!opt) throw new core.HttpError(400, `Elige ${v.name.toLowerCase()} para «${product.name}».`);
    if (opt.price_cents) price = opt.price_cents;
    labels.push(`${v.name}: ${opt.label}`);
  }
  return { price, label: labels.join(' · ') };
}

module.exports = core.wrap(async (req, res) => {
  if (req.method !== 'POST') return core.fail(res, 405, 'Método no permitido');
  if (!core.hasDb() || !core.hasStripe()) return core.fail(res, 503, 'La tienda todavía no tiene los pagos activados.');
  const b = await core.readJson(req);
  const settings = await data.getSettings();

  const items = Array.isArray(b.items) ? b.items.slice(0, 50) : [];
  if (!items.length) return core.fail(res, 400, 'Tu carrito está vacío.');
  const zone = settings.shipping.zones.find((z) => z.id === b.zone);
  if (!zone) return core.fail(res, 400, 'Elige la zona de envío.');

  const c = b.customer || {};
  const customer = { name: core.str(c.name, 120), email: core.str(c.email, 160).toLowerCase(), phone: core.str(c.phone, 40) };
  if (customer.name.length < 3) return core.fail(res, 400, 'Escribe tu nombre y apellidos.');
  if (!core.isEmail(customer.email)) return core.fail(res, 400, 'El correo no es válido.');
  if (!/^[+\d][\d\s-]{7,}$/.test(customer.phone)) return core.fail(res, 400, 'El teléfono no es válido.');

  const s = b.shipping || {};
  const shipping = { line1: core.str(s.line1, 200), line2: core.str(s.line2, 200), postal_code: core.str(s.postal_code, 10), city: core.str(s.city, 100), province: core.str(s.province, 100) };
  if (zone.id !== 'recogida') {
    if (!shipping.line1 || !shipping.city || !shipping.province) return core.fail(res, 400, 'Completa la dirección de envío.');
    if (!/^\d{5}$/.test(shipping.postal_code)) return core.fail(res, 400, 'El código postal debe tener 5 cifras.');
  }
  const bi = b.billing || {};
  const billing = bi.same !== false ? { same: true } : {
    same: false, name: core.str(bi.name, 120), nif: core.str(bi.nif, 20), line1: core.str(bi.line1, 200),
    postal_code: core.str(bi.postal_code, 10), city: core.str(bi.city, 100), province: core.str(bi.province, 100),
  };
  if (!billing.same && (!billing.name || !billing.line1 || !billing.city)) return core.fail(res, 400, 'Completa los datos de facturación.');

  // Productos reales
  const ids = [...new Set(items.map((i) => i.id).filter(core.isUuid))];
  if (!ids.length) return core.fail(res, 400, 'Hay productos no válidos en el carrito.');
  const products = await core.db(`products?select=*&active=is.true&id=in.(${ids.join(',')})`);
  const byId = Object.fromEntries(products.map((p) => [p.id, p]));

  const lines = [];
  const qtyById = {};
  for (const it of items) {
    const p = byId[it.id];
    if (!p) return core.fail(res, 400, 'Algún producto del carrito ya no está disponible. Revísalo.');
    const qty = Math.min(20, Math.max(1, parseInt(it.qty, 10) || 1));
    qtyById[p.id] = (qtyById[p.id] || 0) + qty;
    if (qtyById[p.id] > p.stock) return core.fail(res, 409, `Solo quedan ${p.stock} unidades de «${p.name}».`);
    const { price, label } = priceFor(p, it.options);
    lines.push({ product_id: p.id, slug: p.slug, name: p.name, options_label: label, qty, unit_cents: price, image: (p.images || [])[0] || null });
  }
  const subtotal = lines.reduce((a, l) => a + l.unit_cents * l.qty, 0);
  const free = settings.shipping.free_over_cents && subtotal >= settings.shipping.free_over_cents;
  const shippingCents = free ? 0 : zone.price_cents;

  const ref = core.makeRef('PD');
  const [order] = await core.db('orders', {
    method: 'POST', prefer: 'return=representation',
    body: {
      ref, status: 'pending_payment', customer, shipping_address: shipping, billing, items: lines,
      notes: core.str(b.notes, 1000), shipping_zone: zone.id, shipping_label: zone.label,
      subtotal_cents: subtotal, shipping_cents: shippingCents, total_cents: subtotal + shippingCents,
    },
  });

  const base = core.origin(req);
  const lineItems = lines.map((l) => ({
    quantity: l.qty,
    price_data: {
      currency: 'eur', unit_amount: l.unit_cents,
      product_data: { name: l.name, ...(l.options_label ? { description: l.options_label } : {}), ...(l.image && /^https:/.test(l.image) ? { images: [l.image] } : {}) },
    },
  }));
  if (shippingCents > 0) lineItems.push({ quantity: 1, price_data: { currency: 'eur', unit_amount: shippingCents, product_data: { name: `Envío · ${zone.label}` } } });

  const session = await core.stripe('checkout/sessions', {
    method: 'POST', idempotencyKey: `order-${order.id}`,
    params: {
      mode: 'payment', locale: 'es', customer_email: customer.email, client_reference_id: order.id,
      success_url: `${base}/pedido-confirmado?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/carrito?cancelado=1`,
      metadata: { type: 'order', order_id: order.id, ref },
      payment_intent_data: { metadata: { type: 'order', order_id: order.id, ref }, description: `Pedido ${ref}` },
      line_items: lineItems,
    },
  });
  await core.db(`orders?id=eq.${order.id}`, { method: 'PATCH', body: { stripe_session_id: session.id } });
  core.ok(res, { url: session.url, ref });
});
