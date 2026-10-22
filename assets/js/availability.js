/* Cálculo de huecos libres para citas. Compartido por el servidor (fuente de verdad)
   y el navegador (solo para pintar el calendario en modo demostración).
   Todas las horas son de la zona Atlantic/Canary. */
(function (root) {
  const TZ = 'Atlantic/Canary';
  const ACTIVE = ['pending_payment', 'pending', 'confirmed'];

  const toMin = (hhmm) => { const [h, m] = String(hhmm || '0:0').split(':').map(Number); return h * 60 + (m || 0); };
  const fmtMin = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
  const pad = (n) => String(n).padStart(2, '0');

  function canaryNow(date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(date || new Date());
    const g = (t) => parts.find((p) => p.type === t).value;
    return { date: `${g('year')}-${g('month')}-${g('day')}`, minutes: Number(g('hour')) * 60 + Number(g('minute')) };
  }

  // minutos absolutos de "hora de pared" para comparar fechas locales
  const abs = (dateStr, minutes) => { const [y, m, d] = dateStr.split('-').map(Number); return Date.UTC(y, m - 1, d) / 60000 + minutes; };
  const addDays = (dateStr, n) => { const [y, m, d] = dateStr.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d + n)); return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`; };
  const weekday = (dateStr) => { const [y, m, d] = dateStr.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };

  function isActiveBooking(b, nowIso) {
    if (!ACTIVE.includes(b.status)) return false;
    if (b.status === 'pending_payment' && b.hold_expires_at && new Date(b.hold_expires_at).toISOString() < nowIso) return false;
    return true;
  }

  /**
   * @param {object} o
   *  settings   ajustes completos (schedule, sizes)
   *  sizeId     tamaño elegido (define la duración)
   *  month      'YYYY-MM'
   *  bookings   [{appt_date, start_min, end_min, status, hold_expires_at, id}]
   *  blocked    [{date_from, date_to, start_min, end_min}]
   *  now        Date (opcional)
   *  ignoreId   id de cita a ignorar (reprogramar)
   */
  function computeAvailability(o) {
    const s = o.settings.schedule;
    const size = (o.settings.sizes || []).find((z) => z.id === o.sizeId) || o.settings.sizes[0];
    const duration = Number(o.durationOverride || size.duration_min);
    const step = Math.max(15, Number(s.slot_step_min) || 30);
    const nowDate = o.now || new Date();
    const nowIso = nowDate.toISOString();
    const now = canaryNow(nowDate);
    const earliest = abs(now.date, now.minutes) + (Number(s.min_notice_hours) || 0) * 60;
    const lastDate = addDays(now.date, Number(s.max_days_ahead) || 90);

    const bookings = (o.bookings || []).filter((b) => b.id !== o.ignoreId && isActiveBooking(b, nowIso));
    const blocked = o.blocked || [];

    const [y, m] = o.month.split('-').map(Number);
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const days = {};
    const closedDays = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${y}-${pad(m)}-${pad(d)}`;
      if (date < now.date || date > lastDate) continue;
      const cfg = (s.days || {})[weekday(date)] || { closed: true };
      if (cfg.closed) { closedDays.push(date); continue; }

      const busy = [];
      let wholeDay = false;
      for (const bl of blocked) {
        if (bl.date_from <= date && date <= (bl.date_to || bl.date_from)) {
          if (bl.start_min == null || bl.end_min == null) wholeDay = true;
          else busy.push([Number(bl.start_min), Number(bl.end_min)]);
        }
      }
      if (wholeDay) { closedDays.push(date); continue; }
      for (const br of cfg.breaks || []) busy.push([toMin(br.from), toMin(br.to)]);
      for (const b of bookings) if (b.appt_date === date) busy.push([Number(b.start_min), Number(b.end_min)]);

      const open = toMin(cfg.open), close = toMin(cfg.close);
      const slots = [];
      for (let t = open; t + duration <= close; t += step) {
        if (abs(date, t) < earliest) continue;
        if (busy.some(([a, b]) => t < b && t + duration > a)) continue;
        slots.push(t);
      }
      if (slots.length) days[date] = slots;
    }
    return { duration, step, days, closedDays, today: now.date, lastDate };
  }

  const api = { computeAvailability, canaryNow, toMin, fmtMin, addDays, weekday, ACTIVE, isActiveBooking };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CPAvail = api;
})(typeof window !== 'undefined' ? window : globalThis);
