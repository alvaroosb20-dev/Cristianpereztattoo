// GET /api/site → ajustes públicos, productos, portafolio y opiniones para pintar la web.
const core = require('./_lib/core');
const data = require('./_lib/data');
const auth = require('./_lib/auth');

module.exports = core.wrap(async (req, res) => {
  if (req.method !== 'GET') return core.fail(res, 405, 'Método no permitido');
  const [settings, products, portfolio, reviews] = await Promise.all([
    data.getSettings(), data.getProducts(), data.getPortfolio(), data.getReviews(),
  ]);
  // Si quien mira es el estudio (sesión del panel), puede ver la web aunque esté en «Preparando web».
  let viewerIsAdmin = false;
  try { viewerIsAdmin = auth.verifyToken(auth.readCookie(req, auth.COOKIE)); } catch { viewerIsAdmin = false; }
  res.setHeader('Cache-Control', 'no-store');
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({
    mode: core.hasDb() ? 'live' : 'demo',
    payments: core.hasStripe(),
    viewer_is_admin: viewerIsAdmin,
    settings: data.publicSettings(settings),
    products, portfolio, reviews,
  }));
});
