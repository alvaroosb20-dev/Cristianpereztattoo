CP.ready((site) => {
  const s = site.settings, st = s.studio;
  const bind = (k, v) => CP.$$(`[data-bind="${k}"]`).forEach((el) => { el.textContent = v; });
  bind('city', st.city);
  bind('cityShort', (st.city || '').split(',')[0]);
  bind('tagline', st.tagline);
  bind('ig', st.instagram ? '@' + st.instagram : '');
  bind('deposit', CP.euros(s.deposit_cents));
  bind('depositNote', s.deposit_deducted ? 'La señal se descuenta del precio final del tatuaje. El presupuesto del tatuaje te lo confirma Cristhian al revisar tu idea.' : 'Consulta las condiciones de la señal antes de pagar.');

  CP.$('#about').innerHTML = (s.about || '').split(/\n\n+/).map((p) => `<p>${CP.esc(p)}</p>`).join('');

  CP.$('#styles-list').innerHTML = (s.styles || []).map((name) => `<li><a class="name" href="portafolio.html?estilo=${encodeURIComponent(name)}">${CP.esc(name)}</a><a class="label muted" href="reservar.html?estilo=${encodeURIComponent(name)}">Reservar →</a></li>`).join('');

  // Portafolio: hasta 4 piezas (vídeos primero)
  // Sin repetir los clips que ya salen en la portada y en «El artista»
  const used = CP.$$('[data-video] video').map((v) => v.getAttribute('src'));
  const items = (site.portfolio || []).slice().sort((a, b) => (a.kind === 'video' ? -1 : 1) - (b.kind === 'video' ? -1 : 1) || a.sort - b.sort)
    .filter((it) => !used.includes(CP.asset(it.src))).slice(0, 4);
  CP.$('#reel').style.setProperty('--n', Math.max(1, items.length));
  CP.$('#reel').innerHTML = items.map((it, i) => it.kind === 'video' ? CP.videoCard(it) :
    `<button class="tile" type="button" data-photo="${i}"><img src="${CP.asset(it.src)}" alt="${CP.esc(it.title)}" loading="lazy"><div class="tile-cap"><span class="label gold">${CP.esc(it.style)}</span><span class="t">${CP.esc(it.title)}</span></div></button>`).join('');
  CP.wireVideoCards(CP.$('#reel'));
  CP.$$('#reel [data-photo]').forEach((b) => b.addEventListener('click', () => CP.lightbox(items[Number(b.dataset.photo)])));


  const featured = (site.products || []).filter((p) => p.featured).slice(0, 4);
  CP.$('#featured').innerHTML = (featured.length ? featured : site.products.slice(0, 4)).map(CP.productCard).join('');

  if (site.reviews && site.reviews.length) {
    CP.$('#opiniones').hidden = false;
    CP.$('#reviews').innerHTML = site.reviews.slice(0, 6).map((r) => `<figure class="review"><span class="stars" aria-label="${r.rating} de 5">${'★'.repeat(r.rating || 5)}</span><blockquote>«${CP.esc(r.text)}»</blockquote><figcaption class="label muted">${CP.esc(r.author)}</figcaption></figure>`).join('');
  }

  const wa = (st.whatsapp || '').replace(/\D/g, '');
  const mapsQ = encodeURIComponent(st.maps_query || st.address || st.city);
  const mapsDir = `https://www.google.com/maps/dir/?api=1&destination=${mapsQ}`;
  CP.$('#map').innerHTML = `
    <div class="map-frame">
      <div class="map-fallback"><span class="label">[ Mapa ]</span><p>${CP.esc(st.address || st.city)}</p><a class="link" href="${mapsDir}" target="_blank" rel="noopener">Abrir en Google Maps</a></div>
      <iframe title="Mapa de Google: ${CP.esc(st.address || st.city)}" src="https://www.google.com/maps?q=${mapsQ}&hl=es&z=17&output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>
    </div>
    <div class="map-bar"><span class="label">[ ${CP.esc(st.address || st.city)} ]</span><a class="btn" href="${mapsDir}" target="_blank" rel="noopener">Cómo llegar</a></div>`;
  CP.$('#contact').innerHTML = `
    <div><span class="label muted">Dirección</span><p class="v">${CP.esc(st.address || st.city)}</p><a class="link mono" href="${mapsDir}" target="_blank" rel="noopener">Cómo llegar</a></div>
    <div><span class="label muted">Horario</span><p class="v">${CP.esc(st.hours_text)}</p><a class="link mono" href="reservar.html">Ver huecos libres</a></div>
    <div><span class="label muted">Escríbenos</span>
      ${st.instagram ? `<p class="v"><a href="https://instagram.com/${CP.esc(st.instagram)}" target="_blank" rel="noopener">@${CP.esc(st.instagram)}</a></p>` : ''}
      ${st.phone ? `<p class="mono" style="margin:0">Tel. <a href="tel:${CP.esc(st.phone.replace(/\s/g, ''))}">${CP.esc(st.phone)}</a></p>` : ''}
      ${wa ? `<p class="mono" style="margin:0"><a href="https://wa.me/${wa}" target="_blank" rel="noopener">Escribir por WhatsApp</a></p>` : ''}
      ${st.email ? `<p class="mono" style="margin:0">${CP.esc(st.email)}</p>` : ''}
    </div>`;
});
