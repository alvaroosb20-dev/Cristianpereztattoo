// POST /api/admin/upload {image: dataURL} → sube una foto (producto/portafolio) al bucket público "media".
const core = require('../_lib/core');
const auth = require('../_lib/auth');

module.exports = core.wrap(async (req, res) => {
  auth.requireAdmin(req);
  if (req.method !== 'POST') return core.fail(res, 405, 'Método no permitido');
  const { image, folder } = await core.readJson(req);
  const img = core.decodeImage(image);
  if (!img) return core.fail(res, 400, 'Falta la imagen.');
  const dir = ['products', 'portfolio'].includes(folder) ? folder : 'misc';
  const path = `${dir}/${Date.now()}-${core.crypto.randomUUID().slice(0, 8)}.${img.ext}`;
  await core.storageUpload('media', path, img.buffer, img.type);
  core.ok(res, { url: core.publicUrl('media', path) });
});
