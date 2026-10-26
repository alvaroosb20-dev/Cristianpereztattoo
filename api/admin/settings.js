// GET/PUT /api/admin/settings → ajustes completos del estudio (horario, señal, precios, textos, envíos…)
const core = require('../_lib/core');
const auth = require('../_lib/auth');
const data = require('../_lib/data');

const ALLOWED = ['studio', 'about', 'announcement', 'deposit_cents', 'deposit_deducted', 'sizes', 'styles', 'body_zones', 'schedule', 'shipping', 'texts', 'maintenance'];

module.exports = core.wrap(async (req, res) => {
  auth.requireAdmin(req);
  if (req.method === 'GET') return core.ok(res, await data.getSettings());
  if (req.method !== 'PUT') return core.fail(res, 405, 'Método no permitido');
  const body = await core.readJson(req);
  const current = await data.getSettings();
  const next = { ...current };
  for (const k of ALLOWED) if (body[k] !== undefined) next[k] = body[k];

  // Validaciones básicas
  next.deposit_cents = Math.round(Number(next.deposit_cents));
  if (!(next.deposit_cents >= 100)) return core.fail(res, 400, 'La señal debe ser de al menos 1 €.');
  if (!Array.isArray(next.sizes) || !next.sizes.length) return core.fail(res, 400, 'Debe haber al menos un tamaño.');
  for (const s of next.sizes) {
    if (!s.id || !s.label) return core.fail(res, 400, 'Cada tamaño necesita nombre.');
    s.price_cents = Math.max(0, Math.round(Number(s.price_cents) || 0));
    s.duration_min = Math.max(15, Math.round(Number(s.duration_min) || 60));
  }
  for (const z of (next.shipping && next.shipping.zones) || []) z.price_cents = Math.max(0, Math.round(Number(z.price_cents) || 0));

  await core.db('settings', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: { id: 1, data: next, updated_at: new Date().toISOString() } });
  core.ok(res, next);
});
