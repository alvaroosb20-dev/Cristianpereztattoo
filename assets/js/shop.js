CP.ready((site) => {
  const cats = (window.CPSeed.CATEGORIES || []).filter((c) => site.products.some((p) => p.category === c.id));
  const extra = [...new Set(site.products.map((p) => p.category))].filter((id) => !cats.some((c) => c.id === id)).map((id) => ({ id, label: id }));
  const allCats = [...cats, ...extra];
  let cat = new URLSearchParams(location.search).get('cat') || '';
  const catsEl = CP.$('#cats'), sortEl = CP.$('#sort');
  function renderCats() {
    catsEl.innerHTML = [{ id: '', label: 'Todo' }, ...allCats].map((c) => `<button class="filter" type="button" data-cat="${CP.esc(c.id)}" aria-pressed="${c.id === cat}">${CP.esc(c.label)}</button>`).join('');
  }
  function render() {
    let list = site.products.filter((p) => !cat || p.category === cat);
    const s = sortEl.value;
    if (s === 'price-asc') list.sort((a, b) => CP.minPrice(a).min - CP.minPrice(b).min);
    else if (s === 'price-desc') list.sort((a, b) => CP.minPrice(b).min - CP.minPrice(a).min);
    else if (s === 'name') list.sort((a, b) => a.name.localeCompare(b.name, 'es'));
    else list.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    CP.$('#grid').innerHTML = list.map(CP.productCard).join('');
    CP.$('#empty').hidden = list.length > 0;
  }
  catsEl.addEventListener('click', (e) => { const b = e.target.closest('[data-cat]'); if (!b) return; cat = b.dataset.cat; renderCats(); render(); });
  sortEl.addEventListener('change', render);
  renderCats(); render();
});
