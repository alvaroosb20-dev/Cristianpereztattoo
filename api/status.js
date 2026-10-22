// GET /api/status?session_id=cs_... → verifica el pago directamente con Stripe y devuelve el resumen
// de la cita o del pedido. Nunca muestra algo como confirmado sin que Stripe diga "paid".
const core = require('./_lib/core');
const data = require('./_lib/data');
const { fmtMin } = require('../assets/js/availability.js');

module.exports = core.wrap(async (req, res) => {
  const sid = new URL(req.url, 'http://x').searchParams.get('session_id') || '';
  if (!/^cs_[A-Za-z0-9_]+$/.test(sid)) return core.fail(res, 400, 'Enlace no válido.');
  const session = await core.stripe(`checkout/sessions/${sid}`);
  const meta = session.metadata || {};
  const paid = session.payment_status === 'paid';
  const settings = await data.getSettings();
  const studio = settings.studio;

  if (meta.type === 'booking' && core.isUuid(meta.booking_id)) {
    let b = paid
      ? await data.finalizeBookingPayment(meta.booking_id, session)
      : (await core.db(`bookings?id=eq.${meta.booking_id}&select=*`))[0];
    if (!b) return core.fail(res, 404, 'No encontramos la reserva.');
    return core.ok(res, {
      type: 'booking', paid, status: b.status,
      booking: {
        ref: b.ref, name: b.name, date: b.appt_date, date_label: data.dateEs(b.appt_date), time: fmtMin(b.start_min),
        duration_min: b.end_min - b.start_min, style: b.style, body_zone: b.body_zone, size_label: b.size_label,
        deposit_cents: b.deposit_cents, deposit_paid: b.deposit_paid,
        design_url: b.design_path ? await core.storageSignedUrl('designs', b.design_path, 600) : null,
      },
      studio,
    });
  }

  if (meta.type === 'order' && core.isUuid(meta.order_id)) {
    const o = paid
      ? await data.finalizeOrderPayment(meta.order_id, session)
      : (await core.db(`orders?id=eq.${meta.order_id}&select=*`))[0];
    if (!o) return core.fail(res, 404, 'No encontramos el pedido.');
    return core.ok(res, {
      type: 'order', paid, status: o.status,
      order: {
        ref: o.ref, name: o.customer.name, email: o.customer.email, items: o.items,
        subtotal_cents: o.subtotal_cents, shipping_cents: o.shipping_cents, total_cents: o.total_cents,
        shipping_label: o.shipping_label,
      },
      studio,
    });
  }
  core.fail(res, 404, 'Pago no reconocido.');
});
