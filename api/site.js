// GET /api/site → ajustes públicos, productos, portafolio y opiniones para pintar la web.
const core = require('./_lib/core');
const data = require('./_lib/data');

module.exports = core.wrap(async (req, res) => {
  if (req.method !== 'GET') return core.fail(res, 405, 'Método no permitido');
  const [settings, products, portfolio, reviews] = await Promise.all([
    data.getSettings(), data.getProducts(), data.getPortfolio(), data.getReviews(),
  ]);
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=300');
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({
    mode: core.hasDb() ? 'live' : 'demo',
    payments: core.hasStripe(),
    settings: data.publicSettings(settings),
    products, portfolio, reviews,
  }));
});
