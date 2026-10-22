# Cristhian Pérez Tattoo · web con tienda, reservas y panel

Web completa del estudio: portada, portafolio con vídeos (con su música), tienda online con carrito y Stripe, reservas de cita en 5 pasos con diseño adjunto y señal de 50 €, y panel privado para gestionarlo todo sin tocar código.

**Sin compilación ni dependencias.** Son páginas HTML/CSS/JS más funciones de Vercel (`/api`) que hablan directamente con Supabase, Stripe y Resend. Se sube a GitHub tal cual (también desde el iPhone) y Vercel lo publica.

---

## Qué incluye

| Parte | Dónde | Qué hace |
|---|---|---|
| Portada | `index.html` | Vídeo, artista, estilos, portafolio, productos destacados, opiniones (solo si hay), banda de reserva, contacto, pie legal |
| Portafolio | `portafolio.html` | Vídeos con sonido (toca para oír la música, solo suena uno a la vez), fotos con visor y filtro por estilo |
| Tienda | `tienda.html`, `producto.html`, `carrito.html` | Categorías, orden, ficha con tallas/colores/formatos (con precio distinto si hace falta), carrito, envío por zona, envío gratis desde X €, datos de envío y factura, pago con Stripe |
| Reservas | `reservar.html` | 1) datos e idea · 2) adjuntar diseño (JPG/PNG/WEBP, vista previa, cambiar/eliminar, opcional) · 3) calendario con huecos reales · 4) precio estimado, señal, restante y condiciones · 5) confirmación tras pagar |
| Panel | `/admin` | Citas por estado, detalle con diseño, aprobar/rechazar/completar/cancelar (con devolución opcional de la señal), reprogramar, presupuesto final, citas manuales, calendario día/semana/mes, horario y descansos, bloqueos y vacaciones, señal y precios por tamaño, productos (fotos, stock, variantes), pedidos, portafolio, opiniones, datos del estudio y textos legales |

### Cómo funciona una reserva (y por qué no se puede duplicar)
1. El cliente elige día y hora. El servidor comprueba de nuevo que el hueco existe.
2. Se crea la cita como **«Sin pagar»** y la hora queda bloqueada 35 min mientras paga.
3. La base de datos tiene una regla (`bookings_no_overlap`) que **impide físicamente** dos citas activas solapadas, aunque dos personas pulsen a la vez.
4. Solo cuando **Stripe confirma el pago** la cita pasa a **«Pendiente de aprobar»** y se envían los correos (cliente + estudio con enlace privado al diseño).
5. Si no paga, la hora se libera sola.
6. Cristhian la aprueba desde el panel (puede poner el precio final) y el cliente recibe la confirmación.

Los 50 € son **a cuenta** del precio final (configurable en *Precios y señal*).

---

## Puesta en marcha (unos 20 minutos)

### 1. Subir a GitHub
Crea un repositorio (por ejemplo `cristhian-perez-tattoo`) y sube **todo el contenido de esta carpeta** (no la carpeta en sí: `index.html` debe quedar en la raíz).

### 2. Supabase (base de datos + fotos de diseños)
1. [supabase.com](https://supabase.com) → **New project** (región: West EU / Frankfurt o Irlanda).
2. **SQL Editor → New query** → pega el contenido de `supabase/schema.sql` → **Run**. Crea las tablas, la regla anti‑solapes, los buckets de fotos (`designs` privado, `media` público) y los productos y trabajos de ejemplo.
3. **Project Settings → API**: copia la **Project URL** y la clave **service_role** (la secreta).

### 3. Stripe (pagos)
1. [dashboard.stripe.com](https://dashboard.stripe.com) → **Developers → API keys** → copia la **Secret key** (`sk_test_…` para probar).
2. **Developers → Webhooks → Add endpoint**
   - URL: `https://TU-DOMINIO/api/stripe-webhook`
   - Eventos: `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`
   - Copia el **Signing secret** (`whsec_…`).

### 4. Resend (correos)
1. [resend.com](https://resend.com) → **Domains** → añade y verifica el dominio de la web.
2. **API Keys** → crea una y cópiala.
> Sin Resend la web funciona igual, pero no se envían correos.

### 5. Vercel
1. [vercel.com](https://vercel.com) → **Add New → Project** → importa el repositorio. Framework: **Other**. Sin comando de build.
2. **Settings → Environment Variables**: añade las de `.env.example` con tus valores:

| Variable | Valor |
|---|---|
| `SUPABASE_URL` | Project URL de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | clave service_role |
| `STRIPE_SECRET_KEY` | `sk_test_…` o `sk_live_…` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` |
| `RESEND_API_KEY` | `re_…` |
| `EMAIL_FROM` | `Cristhian Pérez Tattoo <reservas@tudominio.com>` |
| `OWNER_EMAIL` | correo donde quiere recibir reservas y pedidos |
| `ADMIN_PASSWORD` | contraseña del panel |
| `ADMIN_SESSION_SECRET` | texto aleatorio de 32+ caracteres |
| `SITE_URL` | `https://tudominio.com` |

3. **Redeploy**. Entra en `https://tudominio.com/admin` con la contraseña.

Mientras falte Supabase o Stripe, la web se ve entera en **modo vista previa** (banda dorada arriba) y **no permite pagar ni reservar**: nunca muestra una cita como confirmada sin pago real.

### 6. Antes de abrir al público
- **Panel → Estudio y textos**: dirección, teléfono, WhatsApp, email, horario y revisar los **textos legales** (vienen como plantilla con [corchetes]; la política de cancelación y devolución la decide el estudio, idealmente con su asesor).
- **Horario y bloqueos**: días y horas de apertura, descansos, vacaciones.
- **Precios y señal**: precio orientativo y duración por tamaño.
- **Productos**: sustituir las ilustraciones de ejemplo por fotos reales, precios y stock.
- **Opiniones**: añadir solo opiniones reales (la sección se oculta si no hay).
- Prueba una reserva y una compra con la tarjeta de prueba `4242 4242 4242 4242` y luego cambia a claves `sk_live_`.

---

## Probar los pagos (modo test)
Tarjeta `4242 4242 4242 4242`, fecha futura, cualquier CVC. Comprueba:
1. Reserva → Stripe → vuelves a «Reserva confirmada» con referencia → la cita aparece en el panel como *Pendiente*.
2. Compra → Stripe → «Pedido confirmado» → el pedido aparece en *Pedidos · Por enviar* y baja el stock.

## SEO y analítica
- Títulos, descripciones, Open Graph, datos estructurados (TattooParlor), `robots.txt` y `sitemap.xml` (cambia `TU-DOMINIO`).
- **Google Analytics**: pon tu ID `G-XXXX` en `assets/js/config.js`.
- **Search Console**: pega la etiqueta de verificación donde indica el comentario en las páginas (o verifica por DNS, más fácil).

## Añadir más vídeos o fotos
- Fotos: **Panel → Portafolio → Subir foto**.
- Vídeos: súbelos a la carpeta `media/` en GitHub (mejor en MP4 de menos de 10 MB) y añádelos en **Panel → Portafolio → Vídeo (por URL)** con la ruta, p. ej. `media/video-3.mp4`.

## Estructura
```
index.html, portafolio.html, tienda.html, producto.html, carrito.html,
reservar.html, reserva-confirmada.html, pedido-confirmado.html, legal.html, 404.html
admin/index.html          panel privado
assets/css/styles.css     diseño
assets/js/                lógica de cada página (+ seed.js con datos por defecto)
api/                      funciones de servidor (Vercel)
  site, availability, bookings, status, checkout, stripe-webhook
  admin/ auth, bookings, settings, collection, upload
supabase/schema.sql       base de datos
media/                    vídeos y fotos del estudio
img/products/             ilustraciones de producto de ejemplo
scripts/                  servidor local, generador de páginas y pruebas
```

## Seguridad
- Las claves secretas solo existen en Vercel; el navegador nunca las ve.
- Todas las tablas tienen RLS activado sin acceso público; solo el servidor lee y escribe.
- Los diseños de clientes van a un bucket **privado** y se ven con enlaces firmados que caducan.
- Precios, stock, señal y disponibilidad se recalculan en el servidor: el navegador no puede cambiarlos.
- El panel usa una cookie HttpOnly firmada que caduca a las 12 h.
- El webhook valida la firma de Stripe y además vuelve a pedir el evento a Stripe.

## Desarrollo local (opcional, con ordenador)
```
cp .env.example .env    # rellena las claves
npm run dev             # http://localhost:3000
```
`scripts/test-flows.js` prueba de punta a punta reservas, pagos, tienda y panel contra un Postgres local.
