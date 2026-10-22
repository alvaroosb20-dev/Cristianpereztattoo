CP.ready((site) => {
  const all = (site.portfolio || []).slice().sort((a, b) => a.sort - b.sort);
  const styles = [...new Set(all.map((p) => p.style).filter(Boolean))];
  const params = new URLSearchParams(location.search);
  let current = params.get('estilo') || '';
  if (current && !styles.includes(current)) current = '';

  const filters = CP.$('#pf-filters');
  function renderFilters() {
    filters.innerHTML = ['', ...styles].map((st) => `<button class="filter" type="button" data-style="${CP.esc(st)}" aria-pressed="${st === current}">${st ? CP.esc(st) : 'Todo'}</button>`).join('');
  }
  function render() {
    const list = all.filter((p) => !current || p.style === current);
    const videos = list.filter((p) => p.kind === 'video');
    const photos = list.filter((p) => p.kind !== 'video');
    CP.$('#pf-videos').innerHTML = videos.map(CP.videoCard).join('');
    CP.$('#pf-videos').hidden = !videos.length;
    CP.$('#pf-photos').innerHTML = photos.map((p, i) => `<button class="tile" type="button" data-i="${i}"><img src="${CP.asset(p.src)}" alt="${CP.esc(p.title)}" loading="lazy"><div class="tile-cap"><span class="label gold">${CP.esc(p.style)}</span><span class="t">${CP.esc(p.title)}</span></div></button>`).join('');
    CP.$('#pf-count').textContent = `${list.length} ${list.length === 1 ? 'pieza' : 'piezas'}`;
    CP.wireVideoCards(CP.$('#pf-videos'));
    CP.$$('#pf-photos [data-i]').forEach((b) => b.addEventListener('click', () => CP.lightbox(photos[Number(b.dataset.i)])));
  }
  filters.addEventListener('click', (e) => {
    const b = e.target.closest('[data-style]');
    if (!b) return;
    current = b.dataset.style;
    renderFilters(); render();
  });
  renderFilters(); render();
});
