// /api/admin/auth
//  GET    → estado de la sesión y de la configuración (solo verdadero/falso, nunca claves)
//  POST   {password} → inicia sesión (30 días)
//  DELETE → cierra sesión
const core = require('../_lib/core');
const auth = require('../_lib/auth');

const setup = () => ({ password: Boolean(core.env.ADMIN_PASSWORD), db: core.hasDb(), stripe: core.hasStripe(), email: core.hasEmail() });

module.exports = core.wrap(async (req, res) => {
  if (req.method === 'GET') {
    if (!core.env.ADMIN_PASSWORD) return core.send(res, 200, { ok: false, reason: 'no_password', setup: setup() });
    let logged = false;
    try { logged = auth.verifyToken(auth.readCookie(req, auth.COOKIE)); } catch { logged = false; }
    if (!logged) return core.send(res, 200, { ok: false, reason: 'login', setup: setup() });
    return core.ok(res, { ok: true, ...setup() });
  }
  if (req.method === 'DELETE') { auth.setSessionCookie(res, ''); return core.ok(res, { ok: true }); }
  if (req.method !== 'POST') return core.fail(res, 405, 'Método no permitido');
  const { password } = await core.readJson(req);
  if (!core.env.ADMIN_PASSWORD) return core.fail(res, 503, 'El panel aún no tiene contraseña. Añade ADMIN_PASSWORD en Vercel y vuelve a publicar.');
  if (!auth.checkPassword(password)) {
    await new Promise((r) => setTimeout(r, 700));
    return core.fail(res, 401, 'Contraseña incorrecta.');
  }
  auth.setSessionCookie(res, auth.createToken());
  core.ok(res, { ok: true, ...setup() });
});
