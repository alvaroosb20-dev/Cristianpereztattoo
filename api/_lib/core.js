// Utilidades compartidas por todas las funciones de /api (Vercel Serverless, Node 18+).
// Sin dependencias: Supabase, Stripe y Resend se usan por su API REST con fetch.
const crypto = require('crypto');

// Limpia valores pegados a mano en Vercel: espacios, saltos de línea, comillas, «NOMBRE=valor»…
const clean = (v, name) => {
  let x = String(v || '').trim().replace(/^['"`]+|['"`]+$/g, '').trim();
  if (name && x.toUpperCase().startsWith(name + '=')) x = x.slice(name.length + 1).trim().replace(/^['"`]+|['"`]+$/g, '');
  return x;
};
// Acepta la URL de la API, la del panel de Supabase o solo el id del proyecto, con o sin https://
function normalizeSupabaseUrl(raw) {
  let v = clean(raw, 'SUPABASE_URL');
  if (!v) return '';
  const dash = v.match(/supabase\.com\/dashboard\/project\/([a-z0-9]{15,30})/i);
  if (dash) return `https://${dash[1].toLowerCase()}.supabase.co`;
  if (/^[a-z0-9]{15,30}$/i.test(v)) return `https://${v.toLowerCase()}.supabase.co`;
  if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
  try {
    const u = new URL(v);
    const ref = u.hostname.match(/^(?:db\.)?([a-z0-9]{15,30})\.supabase\.(co|in)$/i);
    if (ref) return `https://${ref[1].toLowerCase()}.supabase.co`;
    return `${u.protocol}//${u.host}`;
  } catch { return v.replace(/\/+$/, ''); }
}

const env = {
  // Proyecto de Supabase del estudio (la URL no es secreta); SUPABASE_URL en Vercel la sustituye si se pone
  SUPABASE_URL: normalizeSupabaseUrl(process.env.SUPABASE_URL) || 'https://ihyvszeikhvcunswrdfa.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: clean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_KEY, 'SUPABASE_SERVICE_ROLE_KEY'),
  STRIPE_SECRET_KEY: clean(process.env.STRIPE_SECRET_KEY, 'STRIPE_SECRET_KEY'),
  STRIPE_WEBHOOK_SECRET: clean(process.env.STRIPE_WEBHOOK_SECRET, 'STRIPE_WEBHOOK_SECRET'),
  RESEND_API_KEY: clean(process.env.RESEND_API_KEY, 'RESEND_API_KEY'),
  EMAIL_FROM: clean(process.env.EMAIL_FROM, 'EMAIL_FROM'),
  OWNER_EMAIL: clean(process.env.OWNER_EMAIL, 'OWNER_EMAIL'),
  ADMIN_PASSWORD: clean(process.env.ADMIN_PASSWORD, 'ADMIN_PASSWORD'),
  ADMIN_SESSION_SECRET: clean(process.env.ADMIN_SESSION_SECRET, 'ADMIN_SESSION_SECRET'),
  SITE_URL: clean(process.env.SITE_URL, 'SITE_URL').replace(/\/$/, ''),
  OWNER_WHATSAPP: clean(process.env.OWNER_WHATSAPP || '34646623706').replace(/\D/g, ''),
  CALLMEBOT_APIKEY: clean(process.env.CALLMEBOT_APIKEY, 'CALLMEBOT_APIKEY'),
};

const hasDb = () => Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);

// Detecta si se ha pegado una clave pública (publishable/anon) en vez de la secreta
function supabaseKeyProblem() {
  const k = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!k) return null;
  const start = k.slice(0, 4);
  if (/^postgres(ql)?:\/\//i.test(k)) return 'En SUPABASE_SERVICE_ROLE_KEY has puesto la cadena de conexión de la base de datos (postgresql://…). Hay que poner la clave secreta de la API: Supabase → Project Settings → API Keys.';
  if (/^https?:\/\//i.test(k)) return 'En SUPABASE_SERVICE_ROLE_KEY has puesto una dirección web. Hay que poner la clave secreta de la API: Supabase → Project Settings → API Keys.';
  if (/\s/.test(k)) return 'La clave de SUPABASE_SERVICE_ROLE_KEY tiene espacios o saltos de línea en medio. Vuelve a copiarla con el botón de copiar de Supabase y pégala sola.';
  if (!/^sb_secret_[A-Za-z0-9_-]{10,}$/.test(k) && !/^eyJ[\w-]+\.[\w-]+\.[\w-]+$/.test(k)) return `La clave de SUPABASE_SERVICE_ROLE_KEY no tiene el formato correcto (empieza por «${start}…»). Debe empezar por «sb_secret_» o por «eyJ» (service_role).`;
  if (/^sb_publishable_/i.test(k)) return 'En SUPABASE_SERVICE_ROLE_KEY has puesto la clave pública (sb_publishable_…). Pon la clave secreta (sb_secret_…).';
  if (k.startsWith('eyJ')) {
    try {
      const payload = JSON.parse(Buffer.from(k.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
      if (payload.role && payload.role !== 'service_role') return `En SUPABASE_SERVICE_ROLE_KEY has puesto la clave «${payload.role}». Pon la clave service_role o la secreta (sb_secret_…).`;
      if (payload.ref && !env.SUPABASE_URL.includes(payload.ref)) return 'La clave de Supabase es de otro proyecto. Copia la del proyecto cristhian-perez-tattoo.';
    } catch { /* no es un JWT válido: lo dirá Supabase */ }
  }
  return null;
}
const hasStripe = () => Boolean(env.STRIPE_SECRET_KEY);
const hasEmail = () => Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);

// ---------- HTTP helpers ----------
function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}
const ok = (res, data) => send(res, 200, data);
const fail = (res, status, message, extra) => send(res, status, { error: message, ...(extra || {}) });

async function readJson(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

function origin(req) {
  if (env.SITE_URL) return env.SITE_URL;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

function wrap(handler) {
  return async (req, res) => {
    try { await handler(req, res); }
    catch (e) {
      if (!(e instanceof HttpError) || e.status >= 500) console.error('[api]', e);
      if (!res.headersSent) fail(res, e.status || 500, e.publicMessage || 'Error interno. Inténtalo de nuevo en unos minutos.');
    }
  };
}

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; this.publicMessage = message; }
}

// ---------- Supabase (PostgREST + Storage) ----------
const DEFAULT_SUPABASE_URL = 'https://ihyvszeikhvcunswrdfa.supabase.co';
const netReason = (e) => {
  const c = e && (e.cause || e);
  return [c && c.code, c && c.message, e && e.message].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(' · ').slice(0, 180);
};
// Llama a Supabase; si la dirección configurada no responde, prueba con la del proyecto del estudio.
async function fetchSafe(url, opts) {
  if (typeof fetch !== 'function') throw new HttpError(500, `Este servidor usa Node ${process.version}, sin fetch. En Vercel → Settings → General → Node.js Version, elige 20.x o 22.x y vuelve a publicar.`);
  try { return await fetch(url, opts); }
  catch (e) {
    console.error('[supabase fetch]', url, e);
    if (env.SUPABASE_URL !== DEFAULT_SUPABASE_URL && url.startsWith(env.SUPABASE_URL)) {
      const alt = DEFAULT_SUPABASE_URL + url.slice(env.SUPABASE_URL.length);
      try {
        const r = await fetch(alt, opts);
        console.warn('[supabase] SUPABASE_URL no responde; usando', DEFAULT_SUPABASE_URL);
        env.SUPABASE_URL = DEFAULT_SUPABASE_URL;
        return r;
      } catch (e2) { console.error('[supabase fetch alt]', e2); }
    }
    const host = (() => { try { return new URL(url).host; } catch { return url.slice(0, 60); } })();
    const err = new HttpError(502, `No se puede conectar con la base de datos (${host}): ${netReason(e)}. Revisa SUPABASE_URL en Vercel o bórrala.`);
    err.cause = e; throw err;
  }
}
// Acepta la clave secreta nueva (sb_secret_…, solo va en «apikey») y la service_role antigua (JWT, también como Bearer).
function sbAuth() {
  const k = env.SUPABASE_SERVICE_ROLE_KEY;
  return k.startsWith('eyJ') ? { apikey: k, Authorization: `Bearer ${k}` } : { apikey: k };
}
async function db(path, { method = 'GET', body, prefer, headers } = {}) {
  if (!hasDb()) throw new HttpError(503, 'La base de datos no está configurada.');
  const kp = supabaseKeyProblem();
  if (kp) throw new HttpError(502, kp);
  const r = await fetchSafe(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      ...sbAuth(),
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
      ...(headers || {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!r.ok) {
    const err = new Error(`Supabase ${r.status}: ${text}`);
    err.code = data && data.code; err.details = data; err.supabaseStatus = r.status;
    // Nunca devolver 401 al navegador por un fallo de Supabase (se confundiría con la sesión del panel)
    err.status = 502;
    if (r.status === 401 || r.status === 403) err.publicMessage = 'La base de datos rechazó la conexión: revisa SUPABASE_SERVICE_ROLE_KEY en Vercel.';
    else if (r.status === 404 && /relation|schema/i.test(text)) err.publicMessage = 'Faltan las tablas en Supabase: ejecuta supabase/schema.sql.';
    throw err;
  }
  return data;
}

async function storageUpload(bucket, path, buffer, contentType) {
  if (!hasDb()) throw new HttpError(503, 'El almacenamiento no está configurado.');
  const r = await fetchSafe(`${env.SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
    method: 'POST',
    headers: {
      ...sbAuth(),
      'Content-Type': contentType,
      'x-upsert': 'false',
      'cache-control': '31536000',
    },
    body: buffer,
  });
  if (!r.ok) throw new Error(`Storage upload ${r.status}: ${await r.text()}`);
  return path;
}

async function storageDelete(bucket, path) {
  try {
    await fetch(`${env.SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
      method: 'DELETE',
      headers: sbAuth(),
    });
  } catch (e) { console.error('storageDelete', e); }
}

async function storageSignedUrl(bucket, path, expiresIn = 3600) {
  if (!path) return null;
  const r = await fetchSafe(`${env.SUPABASE_URL}/storage/v1/object/sign/${bucket}/${path}`, {
    method: 'POST',
    headers: {
      ...sbAuth(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ expiresIn }),
  });
  if (!r.ok) { console.error('sign', await r.text()); return null; }
  const j = await r.json();
  const signed = j.signedURL || j.signedUrl;
  return signed ? `${env.SUPABASE_URL}/storage/v1${signed}` : null;
}

const publicUrl = (bucket, path) => `${env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;

// ---------- Stripe (REST) ----------
function formEncode(obj, prefix, out = []) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((item, i) => {
      if (typeof item === 'object') formEncode(item, `${key}[${i}]`, out);
      else out.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(item)}`);
    });
    else if (typeof v === 'object') formEncode(v, key, out);
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
  }
  return out.join('&');
}

async function stripe(path, { method = 'GET', params, idempotencyKey } = {}) {
  if (!hasStripe()) throw new HttpError(503, 'Los pagos todavía no están activados en esta web.');
  const url = `https://api.stripe.com/v1/${path}` + (method === 'GET' && params ? `?${formEncode(params)}` : '');
  const r = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': '2024-06-20',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: method !== 'GET' && params ? formEncode(params) : undefined,
  });
  const data = await r.json();
  if (!r.ok) {
    console.error('Stripe error', data);
    throw new HttpError(502, 'No se pudo iniciar el pago con Stripe. Inténtalo de nuevo.');
  }
  return data;
}

// ---------- Email (Resend) ----------
async function sendEmail({ to, subject, html, replyTo }) {
  if (!hasEmail() || !to) { console.warn('[email] no configurado, se omite:', subject); return false; }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: Array.isArray(to) ? to : [to], subject, html, reply_to: replyTo }),
    });
    if (!r.ok) console.error('[email]', r.status, await r.text());
    return r.ok;
  } catch (e) { console.error('[email]', e); return false; }
}

// ---------- WhatsApp al estudio (CallMeBot, gratuito) ----------
// Requiere activarlo una vez desde el móvil del estudio (ver README) y poner CALLMEBOT_APIKEY en Vercel.
async function sendWhatsApp(text) {
  if (!env.CALLMEBOT_APIKEY || !env.OWNER_WHATSAPP) { console.warn('[whatsapp] no configurado, se omite'); return false; }
  try {
    const url = `https://api.callmebot.com/whatsapp.php?phone=${env.OWNER_WHATSAPP}&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(env.CALLMEBOT_APIKEY)}`;
    const r = await fetch(url);
    if (!r.ok) console.error('[whatsapp]', r.status, await r.text());
    return r.ok;
  } catch (e) { console.error('[whatsapp]', e); return false; }
}

// ---------- Validación ----------
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const str = (v, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
const isUuid = (v) => /^[0-9a-f-]{36}$/i.test(String(v || ''));

function makeRef(prefix) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  const bytes = crypto.randomBytes(6);
  for (const b of bytes) s += alphabet[b % alphabet.length];
  return `${prefix}-${s}`;
}

// Imagen en base64 (data URL o base64 puro). Valida tipo por "magic bytes" y tamaño.
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
function decodeImage(input) {
  if (!input || typeof input !== 'string') return null;
  const b64 = input.includes(',') ? input.split(',').pop() : input;
  const buf = Buffer.from(b64, 'base64');
  if (!buf.length) throw new HttpError(400, 'La imagen está vacía.');
  if (buf.length > MAX_IMAGE_BYTES) throw new HttpError(413, 'La imagen pesa demasiado (máximo 4 MB).');
  let type = null, ext = null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) { type = 'image/jpeg'; ext = 'jpg'; }
  else if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) { type = 'image/png'; ext = 'png'; }
  else if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') { type = 'image/webp'; ext = 'webp'; }
  if (!type) throw new HttpError(415, 'Formato no válido. Usa JPG, PNG o WEBP.');
  return { buffer: buf, type, ext };
}

const euros = (cents) => (cents / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

module.exports = {
  env, normalizeSupabaseUrl, supabaseKeyProblem, hasDb, hasStripe, hasEmail, send, ok, fail, readJson, origin, wrap, HttpError,
  db, storageUpload, storageDelete, storageSignedUrl, publicUrl, stripe, sendEmail, sendWhatsApp,
  esc, str, isEmail, isUuid, makeRef, decodeImage, euros, crypto,
};
