CP.ready((site) => {
  const titles = { 'condiciones-reserva': 'Condiciones de reserva', 'envios-devoluciones': 'Envíos y devoluciones', privacidad: 'Política de privacidad', 'aviso-legal': 'Aviso legal', cookies: 'Cookies' };
  const doc = new URLSearchParams(location.search).get('doc') || 'condiciones-reserva';
  const title = titles[doc] || 'Información legal';
  CP.$('#legal-title').textContent = title;
  document.title = `${title} · ${site.settings.studio.name}`;
  const text = (site.settings.texts || {})[doc];
  CP.$('#legal-body').innerHTML = text ? CP.md(text) : '<p class="muted">Este texto todavía no está disponible.</p>';
});
