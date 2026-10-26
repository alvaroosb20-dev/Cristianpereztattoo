// Sesión de administrador: cookie HttpOnly firmada con HMAC. La contraseña vive solo en variables de entorno.
const { env, crypto, HttpError } = require('./core');

const COOKIE = 'cp_admin';
const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 días

// ADMIN_SESSION_SECRET es opcional: si no está, se deriva de la contraseña y la clave de Supabase
// (cambiar la contraseña cierra todas las sesiones).
function secret() {
  if (!env.ADMIN_PASSWORD) throw new HttpError(503, 'El panel aún no tiene contraseña.');
  if (env.ADMIN_SESSION_SECRET && env.ADMIN_SESSION_SECRET.length >= 16) return env.ADMIN_SESSION_SECRET;
  return crypto.createHash('sha256').update(`cp-admin|${env.ADMIN_PASSWORD}|${env.SUPABASE_SERVICE_ROLE_KEY}|${env.STRIPE_SECRET_KEY}`).digest('hex');
}

const sign = (payload) => crypto.createHmac('sha256', secret()).update(payload).digest('base64url');

function createToken() {
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const payload = `admin.${exp}`;
  return `${payload}.${sign(payload)}`;
}

function verifyToken(token) {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const payload = `${parts[0]}.${parts[1]}`;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(parts[2]);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return false;
  return Number(parts[1]) > Date.now() / 1000;
}

function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  for (const c of raw.split(';')) {
    const [k, ...v] = c.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

function checkPassword(given) {
  const a = crypto.createHash('sha256').update(String(given || '').trim()).digest();
  const b = crypto.createHash('sha256').update(env.ADMIN_PASSWORD.trim()).digest();
  return crypto.timingSafeEqual(a, b);
}

function setSessionCookie(res, token) {
  const secure = process.env.VERCEL ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${token ? TTL_SECONDS : 0}${secure}`);
}

function requireAdmin(req) {
  secret();
  if (!verifyToken(readCookie(req, COOKIE))) throw new HttpError(401, 'Sesión caducada. Vuelve a entrar.');
}

module.exports = { createToken, verifyToken, readCookie, checkPassword, setSessionCookie, requireAdmin, COOKIE };
