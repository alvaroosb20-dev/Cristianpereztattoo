// /api/admin/collection?type=products|portfolio|reviews|blocked|orders
// CRUD genérico con lista blanca de campos por tipo.
const core = require('../_lib/core');
const auth = require('../_lib/auth');

const TYPES = {
  products: {
    table: 'products', order: 'sort.asc,created_at.desc',
    fields: ['slug', 'name', 'description', 'category', 'price_cents', 'images', 'variants', 'stock', 'active', 'featured', 'sort'],
    clean(r, isCreate) {
      if (r.name !== undefined) r.name = core.str(r.name, 140);
      if (r.slug !== undefined || (isCreate && r.name)) r.slug = core.str(r.slug || r.name, 140).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      if (r.price_cents !== undefined) r.price_cents = Math.max(0, Math.round(Number(r.price_cents) || 0));
      if (r.stock !== undefined) r.stock = Math.max(0, Math.round(Number(r.stock) || 0));
      if (r.sort !== undefined) r.sort = Math.round(Number(r.sort) || 0);
      if (r.images !== undefined && !Array.isArray(r.images)) r.images = [];
      if (r.variants !== undefined && !Array.isArray(r.variants)) r.variants = [];
      return r;
    },
  },
  portfolio: {
    table: 'portfolio', order: 'sort.asc,created_at.desc',
    fields: ['kind', 'src', 'poster', 'title', 'style', 'sort', 'visible'],
    clean(r) { if (r.kind && !['photo', 'video'].includes(r.kind)) r.kind = 'photo'; return r; },
  },
  reviews: { table: 'reviews', order: 'sort.asc,created_at.desc', fields: ['author', 'text', 'rating', 'visible', 'sort'], clean: (r) => r },
  blocked: {
    table: 'blocked_dates', order: 'date_from.asc',
    fields: ['date_from', 'date_to', 'start_min', 'end_min', 'reason'],
    clean(r) {
      if (!r.date_to) r.date_to = r.date_from;
      ['start_min', 'end_min'].forEach((k) => { if (r[k] === '' || r[k] === undefined) r[k] = null; });
      return r;
    },
  },
  orders: { table: 'orders', order: 'created_at.desc', fields: ['status', 'tracking', 'admin_notes'], readOnlyCreate: true, clean: (r) => r },
};

module.exports = core.wrap(async (req, res) => {
  auth.requireAdmin(req);
  const url = new URL(req.url, 'http://x');
  const t = TYPES[url.searchParams.get('type')];
  if (!t) return core.fail(res, 400, 'Tipo no válido');

  if (req.method === 'GET') {
    const status = url.searchParams.get('status');
    const extra = status && t.table === 'orders' && /^[a-z_,]+$/.test(status) ? `&status=in.(${status})` : '';
    return core.ok(res, await core.db(`${t.table}?select=*&order=${t.order}&limit=500${extra}`));
  }

  const body = await core.readJson(req);
  const pick = (src, isCreate) => t.clean(Object.fromEntries(t.fields.filter((f) => src[f] !== undefined).map((f) => [f, src[f]])), isCreate);

  if (req.method === 'POST') {
    if (t.readOnlyCreate) return core.fail(res, 405, 'No permitido');
    try {
      const [row] = await core.db(t.table, { method: 'POST', body: pick(body, true), prefer: 'return=representation' });
      return core.ok(res, row);
    } catch (e) {
      if (e.code === '23505') return core.fail(res, 409, 'Ya existe un elemento con ese nombre o URL.');
      throw e;
    }
  }
  if (req.method === 'PATCH') {
    if (!core.isUuid(body.id)) return core.fail(res, 400, 'Id no válido');
    const patch = pick(body);
    if (t.table === 'orders' && patch.status && !['paid', 'shipped', 'completed', 'cancelled', 'refunded'].includes(patch.status)) return core.fail(res, 400, 'Estado no válido');
    const [row] = await core.db(`${t.table}?id=eq.${body.id}`, { method: 'PATCH', body: patch, prefer: 'return=representation' });
    return core.ok(res, row);
  }
  if (req.method === 'DELETE') {
    if (t.readOnlyCreate) return core.fail(res, 405, 'No permitido');
    const id = url.searchParams.get('id');
    if (!core.isUuid(id)) return core.fail(res, 400, 'Id no válido');
    await core.db(`${t.table}?id=eq.${id}`, { method: 'DELETE' });
    return core.ok(res, { ok: true });
  }
  core.fail(res, 405, 'Método no permitido');
});
