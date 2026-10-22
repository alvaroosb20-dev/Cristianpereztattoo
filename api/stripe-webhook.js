// POST /api/stripe-webhook → Stripe avisa de pagos completados o sesiones caducadas.
// Seguridad: si STRIPE_WEBHOOK_SECRET está configurado se valida la firma; además, el evento
// SIEMPRE se vuelve a pedir a la API de Stripe con la clave secreta, así que no se puede falsificar.
const core = require('./_lib/core');
const data = require('./_lib/data');

async function rawBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return Buffer.from(req.body);
  if (req.body && typeof req.body === 'object') return null; // ya parseado por Vercel
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}

function verifySignature(raw, header, secret) {
  if (!raw || !header) return false;
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=')));
  const t = parts.t, v1 = header.split(',').filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
  if (!t || !v1.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 600) return false;
  const expected = core.crypto.createHmac('sha256', secret).update(`${t}.${raw.toString('utf8')}`).digest('hex');
  return v1.some((sig) => sig.length === expected.length && core.crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)));
}

module.exports = core.wrap(async (req, res) => {
  if (req.method !== 'POST') return core.fail(res, 405, 'Método no permitido');
  const raw = await rawBody(req);
  let body;
  try { body = raw ? JSON.parse(raw.toString('utf8')) : req.body; } catch { return core.fail(res, 400, 'JSON no válido'); }

  if (core.env.STRIPE_WEBHOOK_SECRET && raw) {
    if (!verifySignature(raw, req.headers['stripe-signature'], core.env.STRIPE_WEBHOOK_SECRET)) return core.fail(res, 400, 'Firma no válida');
  }
  if (!body || !/^evt_/.test(body.id || '')) return core.fail(res, 400, 'Evento no válido');

  // Fuente de verdad: el evento tal como lo tiene Stripe
  const event = await core.stripe(`events/${body.id}`);
  const session = event.data && event.data.object;
  const meta = (session && session.metadata) || {};

  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    if (session.payment_status === 'paid') {
      if (meta.type === 'booking' && core.isUuid(meta.booking_id)) await data.finalizeBookingPayment(meta.booking_id, session);
      if (meta.type === 'order' && core.isUuid(meta.order_id)) await data.finalizeOrderPayment(meta.order_id, session);
    }
  } else if (event.type === 'checkout.session.expired') {
    if (meta.type === 'booking' && core.isUuid(meta.booking_id)) {
      await core.db(`bookings?id=eq.${meta.booking_id}&status=eq.pending_payment`, { method: 'PATCH', body: { status: 'expired', hold_expires_at: null } });
    }
    if (meta.type === 'order' && core.isUuid(meta.order_id)) {
      await core.db(`orders?id=eq.${meta.order_id}&status=eq.pending_payment`, { method: 'PATCH', body: { status: 'expired' } });
    }
  }
  core.ok(res, { received: true });
});
