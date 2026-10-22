// POST /api/admin/auth {password} → inicia sesión · DELETE → cierra sesión · GET → comprueba sesión
const core = require('../_lib/core');
const auth = require('../_lib/auth');

module.exports = core.wrap(async (req, res) => {
  if (req.method === 'GET') {
    try { auth.requireAdmin(req); return core.ok(res, { ok: true, db: core.hasDb(), stripe: core.hasStripe(), email: core.hasEmail() }); }
    catch (e) { return core.fail(res, e.status || 401, e.publicMessage || 'No autorizado'); }
  }
  if (req.method === 'DELETE') { auth.setSessionCookie(res, ''); return core.ok(res, { ok: true }); }
  if (req.method !== 'POST') return core.fail(res, 405, 'Método no permitido');
  const { password } = await core.readJson(req);
  if (!core.env.ADMIN_PASSWORD) return core.fail(res, 503, 'Falta configurar ADMIN_PASSWORD en Vercel.');
  if (!auth.checkPassword(password)) {
    await new Promise((r) => setTimeout(r, 800));
    return core.fail(res, 401, 'Contraseña incorrecta.');
  }
  auth.setSessionCookie(res, auth.createToken());
  core.ok(res, { ok: true });
});
