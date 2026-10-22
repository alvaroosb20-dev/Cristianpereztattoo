// POST /api/bookings → valida la solicitud, guarda el diseño, bloquea la hora y abre el pago de la señal en Stripe.
// La cita NO se da por reservada hasta que Stripe confirma el pago (webhook o /api/status).
const core = require('./_lib/core');
const data = require('./_lib/data');
const { computeAvailability } = require('../assets/js/availability.js');
const { loadBusy } = require('./availability');

module.exports = core.wrap(async (req, res) => {
  if (req.method !== 'POST') return core.fail(res, 405, 'Método no permitido');
  if (!core.hasDb()) return core.fail(res, 503, 'Las reservas online todavía no están activadas. Escríbenos por Instagram o WhatsApp.');
  if (!core.hasStripe()) return core.fail(res, 503, 'El pago de la señal todavía no está activado. Escríbenos por Instagram o WhatsApp para reservar.');

  const b = await core.readJson(req);
  const settings = await data.getSettings();

  // ---- Validación en servidor ----
  const name = core.str(b.name, 120);
  const email = core.str(b.email, 160).toLowerCase();
  const phone = core.str(b.phone, 40);
  const style = core.str(b.style, 80);
  const bodyZone = core.str(b.body_zone, 80);
  const description = core.str(b.description, 3000);
  const date = core.str(b.date, 10);
  const startMin = Number(b.start_min);
  const size = settings.sizes.find((s) => s.id === b.size);
  const errors = [];
  if (name.length < 3) errors.push('Escribe tu nombre y apellidos.');
  if (!core.isEmail(email)) errors.push('El correo no es válido.');
  if (!/^[+\d][\d\s-]{7,}$/.test(phone)) errors.push('El teléfono no es válido.');
  if (!style) errors.push('Elige un estilo.');
  if (!bodyZone) errors.push('Indica la zona del cuerpo.');
  if (!size) errors.push('Elige un tamaño.');
  if (description.length < 10) errors.push('Cuéntanos un poco más sobre tu idea (mínimo 10 caracteres).');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(startMin)) errors.push('Elige día y hora.');
  if (b.adult !== true) errors.push('Debes confirmar que eres mayor de edad.');
  if (b.terms !== true) errors.push('Debes aceptar las condiciones de reserva.');
  if (errors.length) return core.fail(res, 400, errors[0], { errors });

  // ---- Comprobar que el hueco sigue libre ----
  const month = date.slice(0, 7);
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  // liberar reservas sin pagar que ya caducaron
  await core.db(`bookings?status=eq.pending_payment&hold_expires_at=lt.${new Date().toISOString()}`, { method: 'PATCH', body: { status: 'expired' } });
  const busy = await loadBusy(`${month}-01`, `${month}-${String(last).padStart(2, '0')}`);
  const avail = computeAvailability({ settings, sizeId: size.id, month, ...busy });
  if (!(avail.days[date] || []).includes(startMin)) {
    return core.fail(res, 409, 'Esa hora ya no está disponible. Elige otra, por favor.', { code: 'slot_taken' });
  }

  // ---- Diseño adjunto (opcional) ----
  let designPath = null;
  if (b.image) {
    const img = core.decodeImage(b.image);
    designPath = `${date}/${core.crypto.randomUUID()}.${img.ext}`;
    await core.storageUpload('designs', designPath, img.buffer, img.type);
  }

  // ---- Crear la reserva provisional (bloquea la hora) ----
  const deposit = Math.max(0, Number(settings.deposit_cents) || 0);
  const ref = core.makeRef('CP');
  const holdMin = Number(settings.schedule.hold_minutes) || 35;
  const termsText = settings.texts['condiciones-reserva'] || '';
  let booking;
  try {
    const rows = await core.db('bookings', {
      method: 'POST', prefer: 'return=representation',
      body: {
        ref, status: 'pending_payment', name, email, phone, style, body_zone: bodyZone,
        size_id: size.id, size_label: `${size.label} (${size.detail})`, description, design_path: designPath,
        appt_date: date, start_min: startMin, end_min: startMin + Number(size.duration_min),
        estimated_price_cents: size.price_cents, deposit_cents: deposit, deposit_paid: false, payment_status: 'unpaid',
        adult_confirmed: true, terms_accepted_at: new Date().toISOString(),
        terms_hash: core.crypto.createHash('sha256').update(termsText).digest('hex').slice(0, 16),
        terms_snapshot: termsText,
        hold_expires_at: new Date(Date.now() + holdMin * 60000).toISOString(),
      },
    });
    booking = rows[0];
  } catch (e) {
    if (designPath) await core.storageDelete('designs', designPath);
    if (e.code === '23P01' || e.code === '23505') return core.fail(res, 409, 'Alguien acaba de reservar esa hora. Elige otra, por favor.', { code: 'slot_taken' });
    throw e;
  }

  // ---- Sesión de pago de Stripe ----
  const base = core.origin(req);
  let session;
  try {
    session = await core.stripe('checkout/sessions', {
      method: 'POST',
      idempotencyKey: `booking-${booking.id}`,
      params: {
        mode: 'payment',
        locale: 'es',
        customer_email: email,
        client_reference_id: booking.id,
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60 + 30,
        success_url: `${base}/reserva-confirmada?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${base}/reservar?cancelada=1`,
        metadata: { type: 'booking', booking_id: booking.id, ref },
        payment_intent_data: { metadata: { type: 'booking', booking_id: booking.id, ref }, description: `Señal reserva ${ref}` },
        line_items: [{
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: deposit,
            product_data: { name: `Señal de reserva · ${settings.studio.name}`, description: `${data.dateEs(date)} · ${String(Math.floor(startMin / 60)).padStart(2, '0')}:${String(startMin % 60).padStart(2, '0')} h · Ref. ${ref}` },
          },
        }],
      },
    });
  } catch (e) {
    await core.db(`bookings?id=eq.${booking.id}`, { method: 'PATCH', body: { status: 'expired' } });
    throw e;
  }
  await core.db(`bookings?id=eq.${booking.id}`, { method: 'PATCH', body: { stripe_session_id: session.id } });
  core.ok(res, { url: session.url, ref });
});
