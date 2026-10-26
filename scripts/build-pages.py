# Genera las páginas HTML con la misma cabecera <head>. Ejecutar: python3 scripts/build-pages.py
import os, json, time
ASSET_V = time.strftime('%Y%m%d%H%M')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS = "https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&display=swap"

def head(title, desc, extra=""):
    return f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="{desc}">
<meta name="theme-color" content="#fafaf9">
<meta property="og:type" content="website">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:image" content="media/hero.jpg">
<meta property="og:locale" content="es_ES">
<!-- Google Search Console: pega aquí tu etiqueta de verificación -->
<link rel="icon" href="img/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{FONTS}">
<link rel="stylesheet" href="assets/css/styles.css?v={ASSET_V}">
{extra}</head>
"""

def page(fname, page_key, title, desc, main, scripts, extra_head=""):
    js = "\n".join(f'<script src="assets/js/{s}?v={ASSET_V}" defer></script>' for s in ["config.js", "seed.js", "availability.js", "common.js"] + scripts)
    html = head(title, desc, extra_head) + f"""<body data-page="{page_key}">
<a class="label" href="#main" style="position:absolute;left:-9999px">Saltar al contenido</a>
<div id="site-header"></div>
<main id="main">
{main}
</main>
<div id="site-footer"></div>
{js}
</body>
</html>
"""
    open(os.path.join(ROOT, fname), "w", encoding="utf-8").write(html)

LDJSON = """<script type="application/ld+json">
{"@context":"https://schema.org","@type":"TattooParlor","name":"Cristhian Pérez Tattoo","image":"media/hero.jpg","telephone":"+34 646 62 37 06","address":{"@type":"PostalAddress","streetAddress":"C. Álvaro Martín Díaz, 18","postalCode":"38320","addressLocality":"San Cristóbal de La Laguna","addressRegion":"Santa Cruz de Tenerife","addressCountry":"ES"},"sameAs":["https://instagram.com/cristianperez.tat"]}
</script>
"""

page("index.html", "home", "Cristhian Pérez Tattoo",
  "Estudio de tatuaje de Cristhian Pérez en La Laguna, Tenerife. Realismo black & grey, fine line y diseño propio. Reserva tu cita online con señal y compra en la tienda oficial.",
  """<section class="hero">
  <div class="wrap hero-grid">
    <div class="hero-copy">
      <div class="hero-kicker label" data-bind="city">La Laguna, Tenerife</div>
      <h1 class="display hero-title"><span class="line"><span>Cristhian</span></span><span class="line"><span>Pérez</span></span><span class="line"><span>Tattoo</span></span></h1>
      <p class="hero-sub" data-bind="tagline">Realismo, fine line y piezas con alma editorial. Tenerife.</p>
      <div class="hero-ctas">
        <a class="btn btn-gold" href="reservar.html">Reservar cita</a>
        <a class="btn btn-ghost" href="tienda.html">Ver tienda</a>
      </div>
    </div>
    <div class="hero-media" data-video>
      <video src="media/hero.mp4" poster="media/hero.jpg" autoplay muted loop playsinline preload="auto" aria-label="Cristhian Pérez tatuando en el estudio"></video>
    </div>
  </div>
</section>

<section class="section" id="artista">
  <div class="wrap split">
    <figure class="artist-photo" style="margin:0" data-video>
      <video src="media/clip-llegada.mp4" poster="media/clip-llegada.jpg" autoplay muted loop playsinline preload="metadata" aria-label="Cristhian Pérez en el estudio"></video>
    </figure>
    <div class="about-text">
      <span class="label gold">El artista</span>
      <h2 class="display h2" style="margin:.8rem 0 1.6rem">Cada pieza empieza<br>con una conversación.</h2>
      <div id="about"></div>
      <dl class="facts">
        <div><dt class="label">Estudio</dt><dd data-bind="cityShort">Tenerife</dd></div>
        <div><dt class="label">Citas</dt><dd>Con reserva</dd></div>
        <div><dt class="label">Señal</dt><dd data-bind="deposit">50 €</dd></div>
      </dl>
    </div>
  </div>
</section>

<section class="section" id="estilos">
  <div class="wrap split">
    <div>
      <span class="label gold">Estilos</span>
      <h2 class="display h2" style="margin-top:.8rem">Lo que se tatúa aquí</h2>
      <p class="muted" style="margin-top:1.2rem;max-width:36ch">Elige un estilo y míralo en el portafolio, o llévalo directamente a tu solicitud de cita.</p>
    </div>
    <ul class="styles-list" id="styles-list"></ul>
  </div>
</section>

<section class="section" id="trabajos">
  <div class="wrap">
    <div class="section-head">
      <div><span class="label">Trabajos</span><h2 class="display h2">Portafolio</h2></div>
      <a class="btn btn-ghost" href="portafolio.html">Ver todo</a>
    </div>
    <div class="reel" id="reel"></div>
  </div>
</section>

<section class="section" id="tienda">
  <div class="wrap">
    <div class="section-head">
      <div><span class="label">Tienda oficial</span><h2 class="display h2">Merch y aftercare</h2></div>
      <a class="btn btn-ghost" href="tienda.html">Ver tienda</a>
    </div>
    <div class="products" id="featured"></div>
  </div>
</section>

<section class="section" id="opiniones" hidden>
  <div class="wrap">
    <div class="section-head"><div><span class="label">Opiniones</span><h2 class="display h2">Lo que dicen en la piel</h2></div></div>
    <div class="reviews" id="reviews"></div>
  </div>
</section>

<section class="book-band">
  <div class="wrap band-grid">
    <div>
      <span class="label muted">Reserva online</span>
      <h2 class="display h2" style="margin:.8rem 0 1.4rem">Una señal de <span data-bind="deposit">50 €</span><br>bloquea tu fecha.</h2>
      <p class="muted" style="max-width:48ch" data-bind="depositNote">La señal se descuenta del precio final del tatuaje.</p>
      <a class="btn" href="reservar.html" style="margin-top:1rem">Reservar cita</a>
    </div>
    <ol class="steps-mini">
      <li>Cuéntanos tu idea, zona y tamaño</li>
      <li>Adjunta tu diseño o referencias</li>
      <li>Elige día y hora libres</li>
      <li>Paga la señal con Stripe y listo</li>
    </ol>
  </div>
</section>

<section class="section" id="contacto">
  <div class="wrap">
    <div class="section-head"><div><span class="label gold">Contacto</span><h2 class="display h2">Ven al estudio</h2></div></div>
    <div class="contact-grid" id="contact"></div>
    <div class="map" id="map"></div>
  </div>
</section>""", ["home.js"], LDJSON)

page("portafolio.html", "portfolio", "Portafolio · Cristhian Pérez Tattoo",
  "Tatuajes de Cristhian Pérez: realismo black & grey, fine line, microrealismo y lettering editorial. Vídeos de sesiones y fotos de trabajos.",
  """<section class="page-head"><div class="wrap">
  <span class="label">Trabajos</span>
  <h1 class="display h1">Portafolio</h1>
  <p class="lead muted" style="margin-top:1.2rem">Sesiones grabadas en el estudio. Los vídeos se reproducen solos y, con un toque en la pantalla, suenan con su música.</p>
</div></section>
<section class="wrap" style="padding-block:2rem 5rem">
  <div class="shop-bar"><div class="filters" id="pf-filters" role="group" aria-label="Filtrar por estilo"></div><span class="mono muted" id="pf-count"></span></div>
  <div class="video-row" id="pf-videos"></div>
  <div class="gallery" id="pf-photos"></div>
  <div class="notice" style="margin-top:2rem">¿Te gusta algún estilo? <a class="link" href="reservar.html">Solicita tu cita</a> y adjunta la referencia.</div>
</section>""", ["portfolio.js"])

page("tienda.html", "shop", "Tienda · Cristhian Pérez Tattoo",
  "Tienda oficial de Cristhian Pérez Tattoo: camisetas, gorras, sudaderas, prints, productos de cuidado del tatuaje y tarjetas regalo. Envíos a toda España.",
  """<section class="page-head"><div class="wrap">
  <span class="label">Tienda oficial</span>
  <h1 class="display h1">Tienda</h1>
  <p class="lead muted" style="margin-top:1.2rem">Tiradas cortas, cuidado del tatuaje y tarjetas regalo. Envíos a Canarias, Península y Baleares.</p>
</div></section>
<section class="wrap" style="padding-block:2rem 5rem">
  <div class="shop-bar">
    <div class="filters" id="cats" role="group" aria-label="Categorías"></div>
    <label class="mono muted" style="display:flex;gap:.6rem;align-items:center">Ordenar
      <select class="select" id="sort"><option value="sort">Destacados</option><option value="price-asc">Precio: menor a mayor</option><option value="price-desc">Precio: mayor a menor</option><option value="name">Nombre</option></select>
    </label>
  </div>
  <div class="products" id="grid"></div>
  <p class="muted" id="empty" hidden>No hay productos en esta categoría.</p>
</section>""", ["shop.js"])

page("producto.html", "shop", "Producto · Cristhian Pérez Tattoo",
  "Producto de la tienda oficial de Cristhian Pérez Tattoo.",
  """<div class="wrap"><nav class="mono muted" style="padding-top:1.4rem" aria-label="Migas"><a href="tienda.html" style="text-decoration:none">← Tienda</a></nav>
<div class="product" id="product"><div class="p-img skeleton"></div><div></div></div>
<section style="padding-block:2rem 5rem"><h2 class="display h3" style="margin-bottom:1.4rem">También te puede gustar</h2><div class="products" id="related"></div></section></div>""", ["product.js"])

page("carrito.html", "cart", "Carrito · Cristhian Pérez Tattoo",
  "Tu carrito en la tienda de Cristhian Pérez Tattoo.",
  """<section class="page-head"><div class="wrap"><span class="label">Tienda</span><h1 class="display h1">Carrito</h1></div></section>
<div class="wrap">
  <div id="cart-notice"></div>
  <div class="cart-layout" id="cart-layout">
    <div>
      <div id="cart-lines"></div>
      <form id="checkout-form" novalidate style="margin-top:2.4rem;display:flex;flex-direction:column;gap:1.6rem">
        <h2 class="display h3">Datos de envío</h2>
        <div class="form-grid">
          <label class="field full"><span class="label">Nombre y apellidos</span><input class="input" id="c-name" autocomplete="name" required></label>
          <label class="field"><span class="label">Correo</span><input class="input" id="c-email" type="email" autocomplete="email" required></label>
          <label class="field"><span class="label">Teléfono</span><input class="input" id="c-phone" type="tel" autocomplete="tel" required></label>
          <label class="field full"><span class="label">Zona de envío</span><select class="select" id="c-zone"></select></label>
        </div>
        <div class="form-grid" id="address-fields">
          <label class="field full"><span class="label">Dirección</span><input class="input" id="a-line1" autocomplete="address-line1"></label>
          <label class="field full"><span class="label">Piso, puerta (opcional)</span><input class="input" id="a-line2" autocomplete="address-line2"></label>
          <label class="field"><span class="label">Código postal</span><input class="input" id="a-cp" inputmode="numeric" maxlength="5" autocomplete="postal-code"></label>
          <label class="field"><span class="label">Localidad</span><input class="input" id="a-city" autocomplete="address-level2"></label>
          <label class="field full"><span class="label">Provincia</span><input class="input" id="a-prov" autocomplete="address-level1"></label>
        </div>
        <label class="check"><input type="checkbox" id="b-same" checked> Usar los mismos datos para la factura</label>
        <div class="form-grid" id="billing-fields" hidden>
          <label class="field"><span class="label">Nombre o razón social</span><input class="input" id="b-name"></label>
          <label class="field"><span class="label">NIF / CIF</span><input class="input" id="b-nif"></label>
          <label class="field full"><span class="label">Dirección de facturación</span><input class="input" id="b-line1"></label>
          <label class="field"><span class="label">Código postal</span><input class="input" id="b-cp" inputmode="numeric" maxlength="5"></label>
          <label class="field"><span class="label">Localidad</span><input class="input" id="b-city"></label>
          <label class="field full"><span class="label">Provincia</span><input class="input" id="b-prov"></label>
        </div>
        <label class="field"><span class="label">Notas del pedido (opcional)</span><textarea class="textarea" id="c-notes" style="min-height:90px"></textarea></label>
      </form>
    </div>
    <aside class="summary" id="summary"></aside>
  </div>
</div>""", ["cart.js"])

page("reservar.html", "book", "Reservar cita · Cristhian Pérez Tattoo",
  "Reserva tu cita de tatuaje con Cristhian Pérez: cuenta tu idea, adjunta tu diseño, elige día y hora y confirma con una señal de 50 €.",
  """<section class="page-head"><div class="wrap">
  <span class="label">Reserva online</span>
  <h1 class="display h1">Reservar cita</h1>
</div></section>
<div class="wrap">
  <div class="booking">
    <div>
      <ol class="steps" id="steps" style="padding:0;margin-top:0"></ol>
      <div id="flow-notice"></div>
      <form id="booking-form" novalidate></form>
    </div>
    <aside class="ticket" id="ticket" aria-live="polite"></aside>
  </div>
</div>""", ["booking.js"])

page("reserva-confirmada.html", "book", "Reserva confirmada · Cristhian Pérez Tattoo",
  "Confirmación de tu reserva en Cristhian Pérez Tattoo.",
  """<div class="wrap"><div class="confirm-card" id="confirm"><p class="muted">Comprobando el pago con Stripe…</p></div></div>""", ["confirm.js"])

page("pedido-confirmado.html", "cart", "Pedido confirmado · Cristhian Pérez Tattoo",
  "Confirmación de tu pedido en la tienda de Cristhian Pérez Tattoo.",
  """<div class="wrap"><div class="confirm-card" id="confirm"><p class="muted">Comprobando el pago con Stripe…</p></div></div>""", ["confirm.js"])

page("legal.html", "legal", "Información legal · Cristhian Pérez Tattoo",
  "Condiciones de reserva, envíos, privacidad y aviso legal de Cristhian Pérez Tattoo.",
  """<section class="page-head"><div class="wrap"><span class="label">Información</span><h1 class="display h2" id="legal-title">Legal</h1></div></section>
<div class="wrap"><article class="prose" id="legal-body"></article></div>""", ["legal.js"])

page("404.html", "404", "Página no encontrada · Cristhian Pérez Tattoo", "Página no encontrada.",
  """<section class="page-head" style="border:0"><div class="wrap"><span class="label">Error 404</span><h1 class="display h1">Aquí no hay tinta.</h1>
<p class="lead muted" style="margin:1.4rem 0 2rem">La página que buscas no existe o se ha movido.</p><a class="btn" href="index.html">Volver al inicio</a></div></section>""", [])
print("ok")
