/* ═══════════════════════════════════════════════
   category.js — one shared engine that powers every
   occasion/category page and the search results page.
   Each page just sets window.CATEGORY_CONFIG and calls
   Category.render(). Nothing else is duplicated.
═══════════════════════════════════════════════ */

// Metadata for every occasion page + the two bespoke experiences
// (Festival, CultureConnect) — used by the hub page, related-occasion
// cross-links, and the footer.
window.CATEGORY_LIST = [
  { slug: 'birthday',        title: 'Birthday',          icon: '🎂', path: 'category-birthday.html' },
  { slug: 'anniversary',     title: 'Anniversary',       icon: '💍', path: 'category-anniversary.html' },
  { slug: 'wedding',         title: 'Wedding',           icon: '👰', path: 'category-wedding.html' },
  { slug: 'engagement',      title: 'Engagement',        icon: '💎', path: 'category-engagement.html' },
  { slug: 'valentine',       title: "Valentine's Day",   icon: '❤️', path: 'category-valentines-day.html' },
  { slug: 'mothers-day',     title: "Mother's Day",      icon: '🌷', path: 'category-mothers-day.html' },
  { slug: 'fathers-day',     title: "Father's Day",      icon: '🎩', path: 'category-fathers-day.html' },
  { slug: 'festival',        title: 'Festival Special',  icon: '🪔', path: 'festival.html' },
  { slug: 'corporate',       title: 'Corporate Gifting',  icon: '💼', path: 'category-corporate-gifting.html' },
  { slug: 'personalized',    title: 'Personalized Gifts', icon: '✍️', path: 'category-personalized-gifts.html' },
  { slug: 'premium',         title: 'Premium Gifts',      icon: '👑', path: 'category-premium-gifts.html' },
  { slug: 'cultural',        title: 'Cultural Gifts',     icon: '🎨', path: 'cultureconnect.html' }
];

const Category = (() => {
  let cfg = null;
  let candidates = [];      // full matched+curated pool for this page, before filters
  let filters = { tags: new Set(), price: null, rating: null, inStockOnly: false };
  let sortMode = 'featured';

  function priceInBucket(price, bucket) {
    if (bucket === 'u500') return price < 500;
    if (bucket === '500-1000') return price >= 500 && price <= 1000;
    if (bucket === '1000-1500') return price > 1000 && price <= 1500;
    if (bucket === '1500plus') return price > 1500;
    return true;
  }

  function matchesFilters(p) {
    if (filters.price && !priceInBucket(p.price, filters.price)) return false;
    if (filters.rating && p.rating < filters.rating) return false;
    if (filters.inStockOnly && p.outOfStock === true) return false;
    if (filters.tags.size > 0) {
      const has = [...filters.tags].some(t => (p.tags || []).includes(t));
      if (!has) return false;
    }
    return true;
  }

  function sortList(list) {
    const arr = list.slice();
    if (sortMode === 'price-asc') arr.sort((a, b) => a.price - b.price);
    else if (sortMode === 'price-desc') arr.sort((a, b) => b.price - a.price);
    else if (sortMode === 'rating') arr.sort((a, b) => b.rating - a.rating);
    else if (sortMode === 'newest') arr.sort((a, b) => b.id - a.id);
    // 'featured' = catalog order (already curated by relevance)
    return arr;
  }

  function activeFilterCount() {
    let n = filters.tags.size;
    if (filters.price) n++;
    if (filters.rating) n++;
    if (filters.inStockOnly) n++;
    return n;
  }

  function tagLabel(t) {
    return { 'for-her': 'For Her', 'for-him': 'For Him', premium: 'Premium', personalized: 'Personalized', budget: 'Budget-Friendly' }[t] || t;
  }

  function renderChips() {
    const wrap = document.getElementById('chipRow');
    if (!wrap) return;
    const chips = [];
    filters.tags.forEach(t => chips.push({ label: tagLabel(t), clear: () => filters.tags.delete(t) }));
    if (filters.price) {
      const priceLabels = { u500: 'Under ₹500', '500-1000': '₹500–₹1000', '1000-1500': '₹1000–₹1500', '1500plus': '₹1500+' };
      chips.push({ label: priceLabels[filters.price], clear: () => filters.price = null });
    }
    if (filters.rating) chips.push({ label: filters.rating + '★ & up', clear: () => filters.rating = null });
    if (filters.inStockOnly) chips.push({ label: 'In Stock Only', clear: () => filters.inStockOnly = false });

    if (!chips.length) { wrap.innerHTML = ''; wrap.hidden = true; return; }
    wrap.hidden = false;
    wrap.innerHTML = chips.map((c, i) => `<span class="chip" data-i="${i}">${c.label} <button aria-label="Remove filter">✕</button></span>`).join('')
      + `<button class="chip-clear-all" id="clearAllBtn">Clear all</button>`;
    wrap.querySelectorAll('.chip button').forEach((btn, i) => {
      btn.addEventListener('click', () => { chips[i].clear(); applyAndRender(); });
    });
    document.getElementById('clearAllBtn')?.addEventListener('click', clearAllFilters);
  }

  function clearAllFilters() {
    filters = { tags: new Set(), price: null, rating: null, inStockOnly: false };
    document.querySelectorAll('.filter-opt input').forEach(i => i.checked = false);
    applyAndRender();
  }

  function buildFilterPanel() {
    const panel = document.getElementById('filterPanel');
    if (!panel) return;

    const tagCounts = {};
    candidates.forEach(p => (p.tags || []).forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1; }));
    const availableTags = Object.keys(tagCounts).sort();

    panel.innerHTML = `
      <div class="filter-panel-head">
        <strong style="font-family:var(--font-serif);font-size:1.1rem">Filters</strong>
        <button class="filter-panel-close" id="filterCloseBtn" aria-label="Close filters">✕</button>
      </div>
      ${availableTags.length ? `<h4>Attributes</h4>
      ${availableTags.map(t => `
        <label class="filter-opt">
          <input type="checkbox" data-kind="tag" value="${t}" ${filters.tags.has(t) ? 'checked' : ''}/>
          ${tagLabel(t)} <span class="n">${tagCounts[t]}</span>
        </label>`).join('')}` : ''}

      <h4>Price</h4>
      ${[['u500','Under ₹500'],['500-1000','₹500 – ₹1000'],['1000-1500','₹1000 – ₹1500'],['1500plus','₹1500 & above']].map(([v,l]) => `
        <label class="filter-opt">
          <input type="radio" name="price" data-kind="price" value="${v}" ${filters.price===v?'checked':''}/> ${l}
        </label>`).join('')}

      <h4>Rating</h4>
      ${[[4.5,'4.5★ & up'],[4,'4★ & up']].map(([v,l]) => `
        <label class="filter-opt">
          <input type="radio" name="rating" data-kind="rating" value="${v}" ${filters.rating===v?'checked':''}/> ${l}
        </label>`).join('')}

      <h4>Availability</h4>
      <label class="filter-opt">
        <input type="checkbox" data-kind="stock" ${filters.inStockOnly?'checked':''}/> In Stock Only
      </label>

      <button class="filter-clear-btn" id="panelClearBtn">Clear all filters</button>
      <button class="filter-apply-btn" id="panelApplyBtn">Apply Filters</button>
    `;

    panel.querySelectorAll('input[data-kind="tag"]').forEach(cb => {
      cb.addEventListener('change', () => {
        if (cb.checked) filters.tags.add(cb.value); else filters.tags.delete(cb.value);
        if (window.innerWidth > 880) applyAndRender();
      });
    });
    panel.querySelectorAll('input[data-kind="price"]').forEach(rb => {
      rb.addEventListener('change', () => { filters.price = rb.checked ? rb.value : null; if (window.innerWidth > 880) applyAndRender(); });
    });
    panel.querySelectorAll('input[data-kind="rating"]').forEach(rb => {
      rb.addEventListener('change', () => { filters.rating = rb.checked ? Number(rb.value) : null; if (window.innerWidth > 880) applyAndRender(); });
    });
    panel.querySelector('input[data-kind="stock"]')?.addEventListener('change', e => {
      filters.inStockOnly = e.target.checked; if (window.innerWidth > 880) applyAndRender();
    });
    document.getElementById('panelClearBtn')?.addEventListener('click', clearAllFilters);
    document.getElementById('panelApplyBtn')?.addEventListener('click', () => { applyAndRender(); closeDrawer(); });
    document.getElementById('filterCloseBtn')?.addEventListener('click', closeDrawer);
  }

  function openDrawer() {
    document.getElementById('filterPanel')?.classList.add('open');
    document.getElementById('filterScrim')?.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeDrawer() {
    document.getElementById('filterPanel')?.classList.remove('open');
    document.getElementById('filterScrim')?.classList.remove('open');
    document.body.style.overflow = '';
  }

  function renderToolbar(count) {
    const rc = document.getElementById('resultCount');
    if (rc) rc.innerHTML = `<strong>${count}</strong> gift${count !== 1 ? 's' : ''} found`;
    const n = activeFilterCount();
    const badge = document.getElementById('filterCount');
    if (badge) { badge.textContent = n; badge.style.display = n ? 'inline-flex' : 'none'; }
  }

  function applyAndRender() {
    const filtered = sortList(candidates.filter(matchesFilters));
    renderChips();
    renderToolbar(filtered.length);

    const grid = document.getElementById('productGrid');
    const empty = document.getElementById('catEmpty');
    if (!filtered.length) {
      grid.hidden = true; grid.innerHTML = '';
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;
    grid.hidden = false;
    grid.innerHTML = filtered.map(buildProductCard).join('');
    requestAnimationFrame(() => {
      grid.querySelectorAll('.pcard').forEach((c, i) => {
        setTimeout(() => c.classList.add('visible'), Math.min(i * 40, 320));
      });
    });
  }

  function renderRelated() {
    const wrap = document.getElementById('relatedGrid');
    if (!wrap || !cfg.related) return;
    const items = window.CATEGORY_LIST.filter(c => cfg.related.includes(c.slug));
    wrap.innerHTML = items.map(c => `
      <a class="related-tile" href="${c.path}"><div class="ic">${c.icon}</div><div class="tt">${c.title}</div></a>
    `).join('');
  }

  function renderCurated() {
    const wrap = document.getElementById('curatedGrid');
    if (!wrap) return;
    const shownIds = new Set(candidates.map(p => p.id));
    const picks = PRODUCTS.filter(p => !shownIds.has(p.id)).sort((a, b) => b.rating - a.rating).slice(0, 4);
    if (!picks.length) { document.getElementById('curatedSection')?.setAttribute('hidden', ''); return; }
    wrap.innerHTML = picks.map(buildProductCard).join('');
    wrap.querySelectorAll('.pcard').forEach(c => c.classList.add('visible'));
  }

  // ── Wishlist / Cart / Quick View (event delegation on the whole body,
  // covers both the main grid and the curated-picks grid) ──
  function getWishlist() { try { return JSON.parse(localStorage.getItem('gg_wishlist') || '[]'); } catch (_) { return []; } }
  function setWishlist(a) { localStorage.setItem('gg_wishlist', JSON.stringify(a)); }
  function getCart() { try { return JSON.parse(localStorage.getItem('gg_cart') || '[]'); } catch (_) { return []; } }
  function setCart(a) { localStorage.setItem('gg_cart', JSON.stringify(a)); }

  function addToCart(p) {
    const cart = getCart();
    const existing = cart.find(i => i.id === p.id);
    if (existing) existing.qty = (existing.qty || 1) + 1;
    else cart.push({ id: p.id, name: p.name, price: p.price, img: p.image, qty: 1 });
    setCart(cart);
    showToast('🛒 ' + p.name + ' added to cart');
  }

  function toggleWish(id) {
    const wish = getWishlist();
    const has = wish.map(String).includes(String(id));
    const next = has ? wish.filter(x => String(x) !== String(id)) : [...wish, id];
    setWishlist(next);
    return !has;
  }

  function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2600);
  }

  function syncWishButtons() {
    const wish = getWishlist().map(String);
    document.querySelectorAll('.pcard').forEach(card => {
      const id = card.dataset.id;
      const btn = card.querySelector('.wish-btn');
      if (btn && wish.includes(id)) { btn.classList.add('active'); btn.textContent = '❤️'; }
    });
  }

  function openQuickView(p) {
    const overlay = document.getElementById('qvOverlay');
    if (!overlay || !p) return;
    document.getElementById('qvImg').src = p.image;
    document.getElementById('qvImg').alt = p.alt;
    document.getElementById('qvCat').textContent = p.category;
    document.getElementById('qvName').textContent = p.name;
    document.getElementById('qvRating').textContent = `${p.starsDisplay} ${p.rating} (${p.reviewCount} reviews)`;
    document.getElementById('qvOg').textContent = '₹' + p.originalPrice.toLocaleString('en-IN');
    document.getElementById('qvNow').textContent = '₹' + p.price.toLocaleString('en-IN');
    document.getElementById('qvDesc').textContent = p.description;
    const addBtn = document.getElementById('qvAddBtn');
    addBtn.onclick = () => { addToCart(p); closeQuickView(); };
    const detailsBtn = document.getElementById('qvDetailsBtn');
    detailsBtn.onclick = () => { localStorage.setItem('gg_viewed_product', p.id); location.href = 'product.html'; };
    overlay.classList.add('open');
  }
  function closeQuickView() { document.getElementById('qvOverlay')?.classList.remove('open'); }

  let eventsWired = false;
  function wireGridEvents() {
    if (eventsWired) return;
    eventsWired = true;
    document.body.addEventListener('click', e => {
      const wishBtn = e.target.closest('.wish-btn');
      if (wishBtn) {
        const card = wishBtn.closest('.pcard');
        const id = card?.dataset.id;
        const p = getProductById(Number(id));
        if (!id || !p) return;
        const nowActive = toggleWish(id);
        wishBtn.classList.toggle('active', nowActive);
        wishBtn.textContent = nowActive ? '❤️' : '🤍';
        showToast(nowActive ? `❤️ ${p.name} saved to wishlist` : `Removed ${p.name} from wishlist`);
        return;
      }
      const addBtn = e.target.closest('.add-btn');
      if (addBtn) {
        const card = addBtn.closest('.pcard');
        const p = getProductById(Number(card?.dataset.id));
        if (!p) return;
        addToCart(p);
        addBtn.textContent = '✓ Added';
        setTimeout(() => { addBtn.textContent = '+ Add'; }, 1600);
        return;
      }
      const qvBtn = e.target.closest('.quickview-btn');
      if (qvBtn) { openQuickView(getProductById(Number(qvBtn.dataset.id))); return; }

      const card = e.target.closest('.pcard');
      if (card && !e.target.closest('.wish-btn,.add-btn,.quickview-btn')) {
        localStorage.setItem('gg_viewed_product', card.dataset.id);
        location.href = 'product.html';
      }
    });
    document.getElementById('qvClose')?.addEventListener('click', closeQuickView);
    document.getElementById('qvOverlay')?.addEventListener('click', e => { if (e.target.id === 'qvOverlay') closeQuickView(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeQuickView(); });

    document.getElementById('filterToggleBtn')?.addEventListener('click', openDrawer);
    document.getElementById('filterScrim')?.addEventListener('click', closeDrawer);
    document.getElementById('sortSelect')?.addEventListener('change', e => { sortMode = e.target.value; applyAndRender(); });
  }

  function render(config) {
    cfg = config;

    // Theme
    const saved = localStorage.getItem('gg_theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    const themeBtn = document.getElementById('themeBtn');
    if (themeBtn) {
      themeBtn.textContent = saved === 'dark' ? '☀️' : '🌙';
      themeBtn.addEventListener('click', () => {
        const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('gg_theme', next);
        themeBtn.textContent = next === 'dark' ? '☀️' : '🌙';
      });
    }

    // Hero content
    const heroTitle = document.getElementById('heroTitle');
    if (heroTitle) heroTitle.innerHTML = cfg.heroTitle;
    const heroDesc = document.getElementById('heroDesc');
    if (heroDesc) heroDesc.textContent = cfg.heroDesc;
    const eyebrow = document.getElementById('heroEyebrow');
    if (eyebrow) eyebrow.textContent = cfg.eyebrow;
    const bcLabel = document.getElementById('bcLabel');
    if (bcLabel) bcLabel.textContent = cfg.breadcrumb;
    document.title = cfg.pageTitle;

    // Build candidate pool: direct matches first, then curated fallback
    // (never a literal empty grid — the fallback is a real, honest
    // catalog-wide curation, not fabricated products)
    const direct = PRODUCTS.filter(cfg.match);
    let pool = direct;
    if (pool.length < 4 && cfg.curatedFallback) {
      const extra = PRODUCTS.filter(p => cfg.curatedFallback(p) && !direct.includes(p));
      pool = [...direct, ...extra];
    }
    candidates = pool;

    const curatedNote = document.getElementById('curatedNote');
    if (curatedNote) curatedNote.hidden = direct.length >= 4;

    buildFilterPanel();
    wireGridEvents();
    applyAndRender();
    renderCurated();
    renderRelated();
    syncWishButtons();
  }

  return { render };
})();
