// Utilidades compartidas por todas las funciones de /api (Vercel Serverless, Node 18+).
// Sin dependencias: Supabase, Stripe y Resend se usan por su API REST con fetch.
const crypto = require('crypto');

const env = {
  SUPABASE_URL: (process.env.SUPABASE_URL || '').replace(/\/$/, ''),
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  EMAIL_FROM: process.env.EMAIL_FROM || '',
  OWNER_EMAIL: process.env.OWNER_EMAIL || '',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || '',
  ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET || '',
  SITE_URL: (process.env.SITE_URL || '').replace(/\/$/, ''),
};

const hasDb = () => Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
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
async function db(path, { method = 'GET', body, prefer, headers } = {}) {
  if (!hasDb()) throw new HttpError(503, 'La base de datos no está configurada.');
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
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
    err.status = r.status; err.code = data && data.code; err.details = data;
    throw err;
  }
  return data;
}

async function storageUpload(bucket, path, buffer, contentType) {
  if (!hasDb()) throw new HttpError(503, 'El almacenamiento no está configurado.');
  const r = await fetch(`${env.SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
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
      headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
    });
  } catch (e) { console.error('storageDelete', e); }
}

async function storageSignedUrl(bucket, path, expiresIn = 3600) {
  if (!path) return null;
  const r = await fetch(`${env.SUPABASE_URL}/storage/v1/object/sign/${bucket}/${path}`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
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
  env, hasDb, hasStripe, hasEmail, send, ok, fail, readJson, origin, wrap, HttpError,
  db, storageUpload, storageDelete, storageSignedUrl, publicUrl, stripe, sendEmail,
  esc, str, isEmail, isUuid, makeRef, decodeImage, euros, crypto,
};
