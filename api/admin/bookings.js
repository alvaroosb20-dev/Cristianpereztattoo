// /api/admin/bookings
//  GET  ?status=pending|confirmed|...&from=YYYY-MM-DD&to=YYYY-MM-DD → listado
//  GET  ?id=uuid → detalle con enlace privado al diseño
//  POST {…} → crear cita manual (p. ej. reservada por WhatsApp)
//  PATCH {id, action, …} → aprobar, rechazar, completar, cancelar, reprogramar, editar
const core = require('../_lib/core');
const auth = require('../_lib/auth');
const data = require('../_lib/data');
const { fmtMin } = require('../../assets/js/availability.js');

const STATUSES = ['pending_payment', 'pending', 'confirmed', 'completed', 'cancelled', 'rejected', 'expired', 'needs_attention'];

async function notify(b, kind, extra) {
  const s = await data.getSettings();
  const when = `${data.dateEs(b.appt_date)} a las ${fmtMin(b.start_min)} h`;
  const price = b.final_price_cents;
  const msgs = {
    approve: ['Tu cita está confirmada', `Cristhian ha revisado tu idea y confirma tu cita el <strong>${when}</strong>.${price ? `<br>Presupuesto: <strong>${core.euros(price)}</strong> · Señal pagada: ${core.euros(b.deposit_paid ? b.deposit_cents : 0)} · Restante: ${core.euros(Math.max(0, price - (b.deposit_paid ? b.deposit_cents : 0)))}` : ''}`],
    reject: ['Sobre tu solicitud de cita', `Lo sentimos, no podemos realizar esta cita tal y como está planteada.${extra ? `<br><br>${core.esc(extra)}` : ''}<br><br>Responde a este correo y te ayudamos a encontrar una alternativa.`],
    reschedule: ['Tu cita ha cambiado de fecha', `Tu nueva cita es el <strong>${when}</strong>.`],
    cancel: ['Tu cita ha sido cancelada', `Tu cita del ${when} ha sido cancelada.${extra ? `<br><br>${core.esc(extra)}` : ''}`],
  };
  const m = msgs[kind];
  if (!m) return;
  const html = `<!doctype html><html><body style="margin:0;background:#f4f4f2;padding:24px;font-family:Helvetica,Arial,sans-serif;color:#111111"><div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e2df;padding:28px"><div style="font-family:Helvetica,Arial,sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:-.02em;font-size:22px">${core.esc(s.studio.name)}</div><div style="height:1px;background:#111111;margin:16px 0 22px"></div><h1 style="font-family:Helvetica,Arial,sans-serif;font-weight:600;text-transform:uppercase;letter-spacing:-.02em;font-size:24px">${m[0]}</h1><p style="font-size:15px;line-height:1.6">Hola ${core.esc(b.name.split(' ')[0])},<br><br>${m[1]}</p><p style="color:#6f6f6c;font-size:12px">Referencia ${core.esc(b.ref)}</p></div></body></html>`;
  await core.sendEmail({ to: b.email, subject: `${m[0]} · ${b.ref}`, html, replyTo: core.env.OWNER_EMAIL || s.studio.email || undefined });
}

module.exports = core.wrap(async (req, res) => {
  auth.requireAdmin(req);
  const url = new URL(req.url, 'http://x');

  if (req.method === 'GET') {
    const id = url.searchParams.get('id');
    if (id) {
      if (!core.isUuid(id)) return core.fail(res, 400, 'Id no válido');
      const rows = await core.db(`bookings?id=eq.${id}&select=*`);
      if (!rows[0]) return core.fail(res, 404, 'No existe');
      const b = rows[0];
      b.design_url = b.design_path ? await core.storageSignedUrl('designs', b.design_path, 3600) : null;
      return core.ok(res, b);
    }
    const q = ['select=id,ref,status,name,email,phone,style,body_zone,size_label,appt_date,start_min,end_min,estimated_price_cents,final_price_cents,deposit_cents,deposit_paid,payment_status,design_path,created_at,hold_expires_at'];
    const status = url.searchParams.get('status');
    if (status) {
      const list = status.split(',').filter((s) => STATUSES.includes(s));
      if (list.length) q.push(`status=in.(${list.join(',')})`);
    }
    const from = url.searchParams.get('from'), to = url.searchParams.get('to');
    if (/^\d{4}-\d{2}-\d{2}$/.test(from || '')) q.push(`appt_date=gte.${from}`);
    if (/^\d{4}-\d{2}-\d{2}$/.test(to || '')) q.push(`appt_date=lte.${to}`);
    q.push('order=appt_date.asc,start_min.asc', 'limit=500');
    const rows = await core.db(`bookings?${q.join('&')}`);
    const counts = await core.db('rpc/booking_counts', { method: 'POST', body: {} }).catch(() => null);
    return core.ok(res, { bookings: rows, counts });
  }

  if (req.method === 'POST') {
    const b = await core.readJson(req);
    const s = await data.getSettings();
    const size = s.sizes.find((z) => z.id === b.size_id) || s.sizes[0];
    const start = Number(b.start_min), dur = Number(b.duration_min) || size.duration_min;
    if (!core.str(b.name) || !/^\d{4}-\d{2}-\d{2}$/.test(b.appt_date || '') || !Number.isInteger(start)) return core.fail(res, 400, 'Faltan nombre, día u hora.');
    try {
      const [row] = await core.db('bookings', {
        method: 'POST', prefer: 'return=representation',
        body: {
          ref: core.makeRef('CP'), status: 'confirmed', name: core.str(b.name, 120), email: core.str(b.email, 160), phone: core.str(b.phone, 40),
          style: core.str(b.style, 80), body_zone: core.str(b.body_zone, 80), size_id: size.id, size_label: `${size.label} (${size.detail})`,
          description: core.str(b.description, 3000) || 'Cita creada desde el panel', appt_date: b.appt_date, start_min: start, end_min: start + dur,
          estimated_price_cents: Math.round(Number(b.estimated_price_cents) || size.price_cents), final_price_cents: b.final_price_cents ? Math.round(Number(b.final_price_cents)) : null,
          deposit_cents: 0, deposit_paid: false, payment_status: 'manual', adult_confirmed: true, admin_notes: core.str(b.admin_notes, 2000),
        },
      });
      return core.ok(res, row);
    } catch (e) {
      if (e.code === '23P01') return core.fail(res, 409, 'Esa franja se solapa con otra cita.');
      throw e;
    }
  }

  if (req.method === 'PATCH') {
    const b = await core.readJson(req);
    if (!core.isUuid(b.id)) return core.fail(res, 400, 'Id no válido');
    const [current] = await core.db(`bookings?id=eq.${b.id}&select=*`);
    if (!current) return core.fail(res, 404, 'No existe');
    const patch = { updated_at: new Date().toISOString() };
    let notifyKind = null;

    switch (b.action) {
      case 'approve': patch.status = 'confirmed'; notifyKind = 'approve'; break;
      case 'reject': patch.status = 'rejected'; notifyKind = 'reject'; break;
      case 'complete': patch.status = 'completed'; break;
      case 'cancel': patch.status = 'cancelled'; notifyKind = 'cancel'; break;
      case 'reschedule': {
        const start = Number(b.start_min);
        const dur = Number(b.duration_min) || (current.end_min - current.start_min);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(b.appt_date || '') || !Number.isInteger(start)) return core.fail(res, 400, 'Elige día y hora.');
        Object.assign(patch, { appt_date: b.appt_date, start_min: start, end_min: start + dur });
        notifyKind = 'reschedule';
        break;
      }
      case 'update': break;
      default: return core.fail(res, 400, 'Acción no válida');
    }
    if (b.final_price_cents !== undefined) patch.final_price_cents = b.final_price_cents === null || b.final_price_cents === '' ? null : Math.max(0, Math.round(Number(b.final_price_cents)));
    if (b.admin_notes !== undefined) patch.admin_notes = core.str(b.admin_notes, 2000);

    // Devolución de la señal (opcional, solo si el estudio lo marca)
    if (b.refund === true && current.deposit_paid && current.stripe_payment_intent && current.payment_status !== 'refunded') {
      await core.stripe('refunds', { method: 'POST', idempotencyKey: `refund-${current.id}`, params: { payment_intent: current.stripe_payment_intent } });
      patch.payment_status = 'refunded';
    }

    let updated;
    try {
      [updated] = await core.db(`bookings?id=eq.${b.id}`, { method: 'PATCH', body: patch, prefer: 'return=representation' });
    } catch (e) {
      if (e.code === '23P01') return core.fail(res, 409, 'Esa franja se solapa con otra cita.');
      throw e;
    }
    if (notifyKind && b.notify !== false && updated.email) await notify(updated, notifyKind, core.str(b.message, 1000)).catch((e) => console.error(e));
    return core.ok(res, updated);
  }
  core.fail(res, 405, 'Método no permitido');
});
