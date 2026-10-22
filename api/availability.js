// GET /api/availability?month=YYYY-MM&size=mediano → días y horas libres.
const core = require('./_lib/core');
const data = require('./_lib/data');
const { computeAvailability } = require('../assets/js/availability.js');

async function loadBusy(fromDate, toDate) {
  if (!core.hasDb()) return { bookings: [], blocked: [] };
  const [bookings, blocked] = await Promise.all([
    core.db(`bookings?select=id,appt_date,start_min,end_min,status,hold_expires_at&appt_date=gte.${fromDate}&appt_date=lte.${toDate}&status=in.(pending_payment,pending,confirmed)`),
    core.db(`blocked_dates?select=date_from,date_to,start_min,end_min&date_from=lte.${toDate}&date_to=gte.${fromDate}`),
  ]);
  return { bookings, blocked };
}

module.exports = core.wrap(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const month = url.searchParams.get('month') || '';
  const size = url.searchParams.get('size') || '';
  if (!/^\d{4}-\d{2}$/.test(month)) return core.fail(res, 400, 'Mes no válido');
  const settings = await data.getSettings();
  if (!settings.sizes.some((s) => s.id === size)) return core.fail(res, 400, 'Tamaño no válido');
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const busy = await loadBusy(`${month}-01`, `${month}-${String(last).padStart(2, '0')}`);
  const result = computeAvailability({ settings, sizeId: size, month, ...busy });
  core.ok(res, result);
});
module.exports.loadBusy = loadBusy;
