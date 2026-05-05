'use strict';

// ════════════════════════════════════════
// STATE & CONFIG
// ════════════════════════════════════════
const API = 'https://pokeapi.co/api/v2';

const defaultSettings = {
  theme: 'dark',
  accent: 'cyan',
  animations: true,
  dexView: 'grid',
  defaultSort: 'number',
  hoverStats: true,
  typeBadges: true,
  showNumber: true,
  searchMode: 'instant',
};

let settings = { ...defaultSettings };
let favorites = [];
let dexOffset = 0;
const DEX_PER_PAGE = 20;
let allDexPokemon = [];
let filteredDex = [];
let dexSearchTimer = null;
let insightFilter = 'all';

// ════════════════════════════════════════
// LOCAL STORAGE
// ════════════════════════════════════════
function saveSettings() {
  localStorage.setItem('dexoria_settings', JSON.stringify(settings));
}

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('dexoria_settings'));
    if (s) settings = { ...defaultSettings, ...s };
  } catch (e) {}
}

function saveFavorites() {
  localStorage.setItem('dexoria_favorites', JSON.stringify(favorites));
}

function loadFavorites() {
  try {
    const f = JSON.parse(localStorage.getItem('dexoria_favorites'));
    if (Array.isArray(f)) favorites = f;
  } catch (e) {}
}

// ════════════════════════════════════════
// APPLY SETTINGS TO DOM
// ════════════════════════════════════════
function applySettings() {
  const html = document.documentElement;
  html.setAttribute('data-theme', settings.theme);
  html.setAttribute('data-accent', settings.accent);
  
  if (!settings.animations) {
    document.body.classList.add('no-animations');
  } else {
    document.body.classList.remove('no-animations');
  }
  
  // Update settings modal UI
  document.querySelectorAll('.pill-btn').forEach(btn => {
    const key = btn.dataset.setting;
    const val = btn.dataset.value;
    if (!key) return;
    const settingKey = key === 'theme' ? 'theme' :
      key === 'accent' ? 'accent' :
      key === 'dexView' ? 'dexView' :
      key === 'defaultSort' ? 'defaultSort' :
      key === 'searchMode' ? 'searchMode' :
      null;
    if (settingKey && settings[settingKey] === val) {
      btn.classList.add('selected');
    } else {
      btn.classList.remove('selected');
    }
  });
  
  const ta = document.getElementById('toggleAnimations');
  const ths = document.getElementById('toggleHoverStats');
  const ttb = document.getElementById('toggleTypeBadges');
  const tsn = document.getElementById('toggleShowNumber');
  if (ta) ta.checked = settings.animations;
  if (ths) ths.checked = settings.hoverStats;
  if (ttb) ttb.checked = settings.typeBadges;
  if (tsn) tsn.checked = settings.showNumber;
  
  // Apply dex view
  const dexGrid = document.getElementById('dexGrid');
  if (dexGrid) {
    if (settings.dexView === 'list') {
      dexGrid.style.gridTemplateColumns = '1fr';
    } else {
      dexGrid.style.gridTemplateColumns = '';
    }
  }
  
  // Apply sort pref
  const dexSort = document.getElementById('dexSort');
  if (dexSort) dexSort.value = settings.defaultSort;
  
  // Number visibility
  document.querySelectorAll('.poke-num').forEach(el => {
    el.classList.toggle('hidden', !settings.showNumber);
  });
  document.querySelectorAll('.type-badges').forEach(el => {
    el.classList.toggle('hidden', !settings.typeBadges);
  });
}

// ════════════════════════════════════════
// NAVIGATION / PAGE ROUTER
// ════════════════════════════════════════
function navigateTo(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  
  const page = document.getElementById('page-' + pageId);
  if (page) page.classList.add('active');
  
  const navBtn = document.querySelector(`.nav-btn[data-page="${pageId}"]`);
  if (navBtn) navBtn.classList.add('active');
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
  
  // Page-specific init
  if (pageId === 'explore' && !window._exploreLoaded) initExplore();
  if (pageId === 'pokedex' && !window._dexLoaded) initPokedex();
  if (pageId === 'favorites') renderFavorites();
  if (pageId === 'about') initAbout();
}

// ════════════════════════════════════════
// POKEMON API HELPERS
// ════════════════════════════════════════
async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('API error: ' + res.status);
  return res.json();
}

function getPokemonSprite(id, hd = false) {
  if (hd) return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
}

function padId(id) {
  return '#' + String(id).padStart(3, '0');
}

const GEN_RANGES = [
  [1, 151],
  [152, 251],
  [252, 386],
  [387, 493],
  [494, 649],
  [650, 721],
  [722, 809],
  [810, 905],
  [906, 1025]
];

function getGenByNumber(n) {
  for (let i = 0; i < GEN_RANGES.length; i++) {
    if (n >= GEN_RANGES[i][0] && n <= GEN_RANGES[i][1]) return i + 1;
  }
  return null;
}

// ════════════════════════════════════════
// EXPLORE PAGE
// ════════════════════════════════════════
async function initExplore() {
  window._exploreLoaded = true;
  
  // Background layer
  const bgEl = document.getElementById('exploreBg');
  const bgIds = [25, 6, 9, 3, 150, 94, 131, 149, 249, 245, 448, 282, 376, 143, 196, 197, 197, 248, 260, 395];
  let bgHTML = '<div class="bg-poke-layer">';
  let bgHTML2 = '<div class="bg-poke-layer layer2">';
  for (let i = 0; i < bgIds.length; i++) {
    bgHTML += `<img src="${getPokemonSprite(bgIds[i], true)}" alt="" />`;
    bgHTML2 += `<img src="${getPokemonSprite(bgIds[(i + 10) % bgIds.length], true)}" alt="" />`;
  }
  // Duplicate for seamless loop
  bgHTML += bgHTML.slice(25); // duplicate content
  bgHTML2 += bgHTML2.slice(26);
  bgHTML += '</div>';
  bgHTML2 += '</div>';
  if (settings.animations) {
    bgEl.innerHTML = bgHTML + bgHTML2;
  }
  
  // Fetch a batch of pokemon for the rows
  const totalIds = [];
  for (let i = 1; i <= 180; i++) totalIds.push(i);
  
  // Split into 3 rows of 60
  const rowIds = [
    totalIds.slice(0, 60),
    totalIds.slice(60, 120),
    totalIds.slice(120, 180),
  ];
  
  for (let r = 0; r < 3; r++) {
    const rowEl = document.getElementById('row' + (r + 1));
    const ids = rowIds[r];
    const items = ids.map(id => buildGalleryCard(id));
    const doubled = [...items, ...items]; // duplicate for infinite scroll
    rowEl.innerHTML = doubled.join('');
  }
  
  // Click handlers on gallery cards
  document.querySelectorAll('.gallery-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = parseInt(card.dataset.id);
      openPokemonModal(id);
    });
  });
}

function buildGalleryCard(id) {
  return `
    <div class="gallery-card" data-id="${id}">
      <img src="${getPokemonSprite(id)}" alt="Pokemon ${id}" loading="lazy" />
      <span class="gallery-card-name" id="gcn-${id}">…</span>
    </div>`;
}

// Lazy-load names for gallery cards (batch)
async function loadGalleryNames(ids) {
  for (const id of ids) {
    const el = document.getElementById('gcn-' + id);
    if (!el) continue;
    try {
      const data = await fetchJSON(`${API}/pokemon/${id}`);
      document.querySelectorAll(`[data-id="${id}"] .gallery-card-name`).forEach(e => {
        e.textContent = data.name;
      });
    } catch (e) {}
  }
}

// ════════════════════════════════════════
// POKÉDEX PAGE
// ════════════════════════════════════════
async function initPokedex() {
  window._dexLoaded = true;
  dexOffset = 0;
  
  // Pre-load all 1025 names + types
  await loadDexBatch();
  
  document.getElementById('dexSearch').addEventListener('input', onDexSearch);
  document.getElementById('dexType').addEventListener('change', onDexFilter);
  document.getElementById('dexGen').addEventListener('change', onDexFilter);
  document.getElementById('dexSort').addEventListener('change', onDexFilter);
  document.getElementById('dexClear').addEventListener('click', clearDexFilters);
  document.getElementById('dexLoadMore').addEventListener('click', loadMoreDex);
}

async function loadDexBatch() {
  if (allDexPokemon.length > 0) return;
  try {
    const data = await fetchJSON(`${API}/pokemon?limit=1025&offset=0`);
    allDexPokemon = data.results.map((p, i) => ({
      id: i + 1,
      name: p.name,
      types: [],
      typesLoaded: false,
    }));
    filteredDex = [...allDexPokemon];
    renderDexGrid(true);
    // Load types for first 40 in background
    loadTypesForRange(0, 40);
  } catch (e) {
    document.getElementById('dexGrid').innerHTML = '<p style="color:var(--text-muted);padding:2rem;grid-column:1/-1">Failed to load Pokédex. Check your connection.</p>';
  }
}

async function loadTypesForRange(start, end) {
  const slice = filteredDex.slice(start, end);
  await Promise.all(slice.map(async pk => {
    if (pk.typesLoaded) return;
    try {
      const d = await fetchJSON(`${API}/pokemon/${pk.id}`);
      pk.types = d.types.map(t => t.type.name);
      pk.typesLoaded = true;
      // Update card
      const card = document.querySelector(`.poke-card[data-id="${pk.id}"] .type-badges`);
      if (card) card.innerHTML = pk.types.map(t => `<span class="type-badge type-${t}">${t}</span>`).join('');
    } catch (e) {}
  }));
}

function renderDexGrid(reset = false) {
  const grid = document.getElementById('dexGrid');
  if (reset) {
    grid.innerHTML = '';
    dexOffset = 0;
  }
  const slice = filteredDex.slice(dexOffset, dexOffset + DEX_PER_PAGE);
  slice.forEach(pk => {
    grid.insertAdjacentHTML('beforeend', buildPokeCard(pk));
  });
  dexOffset += slice.length;
  document.getElementById('dexLoadMore').style.display = dexOffset >= filteredDex.length ? 'none' : '';
  
  // Bind card events
  bindPokeCardEvents();
  applySettings();
}

function buildPokeCard(pk) {
  const isFav = favorites.some(f => f.id === pk.id);
  const typeBadges = pk.types.map(t => `<span class="type-badge type-${t}">${t}</span>`).join('');
  return `
    <div class="poke-card scroll-reveal" data-id="${pk.id}" style="--type-color:${getTypeColor(pk.types[0])}">
      <button class="poke-fav-btn ${isFav ? 'active' : ''}" data-id="${pk.id}" title="Favorite"><i class="fas fa-star"></i></button>
      <img src="${getPokemonSprite(pk.id)}" alt="${pk.name}" loading="lazy" />
      <span class="poke-num ${settings.showNumber ? '' : 'hidden'}">${padId(pk.id)}</span>
      <span class="poke-name">${pk.name}</span>
      <div class="type-badges ${settings.typeBadges ? '' : 'hidden'}">${typeBadges}</div>
    </div>`;
}

function bindPokeCardEvents() {
  document.querySelectorAll('.poke-card').forEach(card => {
    if (card.dataset.bound) return;
    card.dataset.bound = '1';
    
    card.addEventListener('click', (e) => {
      if (e.target.closest('.poke-fav-btn')) return;
      openPokemonModal(parseInt(card.dataset.id));
    });
    
    const favBtn = card.querySelector('.poke-fav-btn');
    if (favBtn) {
      favBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFavorite(parseInt(favBtn.dataset.id), favBtn);
      });
    }
  });
  
  // Scroll reveal
  observeScrollReveal();
}

function observeScrollReveal() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  
  document.querySelectorAll('.scroll-reveal:not(.visible)').forEach(el => observer.observe(el));
}

function onDexSearch() {
  if (settings.searchMode === 'instant') {
    clearTimeout(dexSearchTimer);
    dexSearchTimer = setTimeout(onDexFilter, 250);
  }
}

function onDexFilter() {
  const q = document.getElementById('dexSearch').value.toLowerCase().trim();
  const type = document.getElementById('dexType').value;
  const gen = parseInt(document.getElementById('dexGen').value);
  const sort = document.getElementById('dexSort').value;
  
  filteredDex = allDexPokemon.filter(pk => {
    if (q) {
      const matchName = pk.name.includes(q);
      const matchNum = pk.id === parseInt(q.replace('#', ''));
      if (!matchName && !matchNum) return false;
    }
    if (type && !pk.types.includes(type)) return false;
    if (gen) {
      const r = GEN_RANGES[gen - 1];
      if (pk.id < r[0] || pk.id > r[1]) return false;
    }
    return true;
  });
  
  if (sort === 'name') {
    filteredDex.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    filteredDex.sort((a, b) => a.id - b.id);
  }
  
  renderDexGrid(true);
  loadTypesForRange(0, Math.min(40, filteredDex.length));
}

function clearDexFilters() {
  document.getElementById('dexSearch').value = '';
  document.getElementById('dexType').value = '';
  document.getElementById('dexGen').value = '';
  document.getElementById('dexSort').value = settings.defaultSort;
  filteredDex = [...allDexPokemon];
  renderDexGrid(true);
}

function loadMoreDex() {
  const prevOffset = dexOffset;
  renderDexGrid(false);
  loadTypesForRange(prevOffset, prevOffset + DEX_PER_PAGE);
}

function getTypeColor(type) {
  const colors = {
    fire: '#FF6D00',
    water: '#2196F3',
    grass: '#4CAF50',
    electric: '#FFC107',
    psychic: '#E91E63',
    ice: '#00BCD4',
    dragon: '#3F51B5',
    dark: '#333',
    fairy: '#E91E8C',
    fighting: '#B71C1C',
    flying: '#7986CB',
    poison: '#9C27B0',
    ground: '#FF8F00',
    rock: '#795548',
    bug: '#8BC34A',
    ghost: '#4A148C',
    steel: '#78909C',
    normal: '#9E9E9E',
  };
  return colors[type] || 'var(--accent)';
}

// ════════════════════════════════════════
// POKÉMON DETAIL MODAL
// ════════════════════════════════════════
async function openPokemonModal(id) {
  const overlay = document.getElementById('pokemonModal');
  const content = document.getElementById('pokemonModalContent');
  overlay.classList.add('open');
  content.innerHTML = '<div class="modal-loader"><div class="loader-ring"></div><p>Loading…</p></div>';
  
  try {
    const [poke, spec] = await Promise.all([
      fetchJSON(`${API}/pokemon/${id}`),
      fetchJSON(`${API}/pokemon-species/${id}`).catch(() => null),
    ]);
    
    const name = poke.name;
    const num = padId(poke.id);
    const types = poke.types.map(t => t.type.name);
    const sprite = getPokemonSprite(poke.id, true);
    const isFav = favorites.some(f => f.id === poke.id);
    
    // Stats
    const statNames = { hp: 'HP', attack: 'ATK', defense: 'DEF', 'special-attack': 'Sp.ATK', 'special-defense': 'Sp.DEF', speed: 'SPD' };
    const statsHTML = poke.stats.map(s => {
      const pct = Math.round((s.base_stat / 255) * 100);
      return `<div class="stat-row">
        <span class="stat-row-name">${statNames[s.stat.name] || s.stat.name}</span>
        <span class="stat-row-val">${s.base_stat}</span>
        <div class="stat-bar-track"><div class="stat-bar-fill" style="width:0%" data-pct="${pct}%"></div></div>
      </div>`;
    }).join('');
    
    // Abilities
    const abilitiesHTML = poke.abilities.map(a => `<span class="ability-badge ${a.is_hidden ? 'hidden' : ''}">${a.ability.name}${a.is_hidden ? ' (hidden)' : ''}</span>`).join('');
    
    // Description
    let desc = 'No description available.';
    if (spec) {
      const engEntry = spec.flavor_text_entries.find(e => e.language.name === 'en');
      if (engEntry) desc = engEntry.flavor_text.replace(/\f/g, ' ').replace(/\n/g, ' ');
    }
    
    // Basic info
    const weight = (poke.weight / 10).toFixed(1) + ' kg';
    const height = (poke.height / 10).toFixed(1) + ' m';
    const baseExp = poke.base_experience || '—';
    
    // Types HTML
    const typesHTML = types.map(t => `<span class="type-badge type-${t}">${t}</span>`).join('');
    
    // Type gradient for bg
    const tc1 = getTypeColor(types[0]);
    const tc2 = types[1] ? getTypeColor(types[1]) : tc1;
    
    content.innerHTML = `
      <div class="pm-header" style="background:linear-gradient(135deg, ${tc1}22, ${tc2}11);">
        <div class="pm-img-side">
          <img src="${sprite}" alt="${name}" />
          <button class="pm-fav-btn ${isFav ? 'active' : ''}" id="pmFavBtn" data-id="${poke.id}">
            <i class="fas fa-star"></i> ${isFav ? 'Saved' : 'Save'}
          </button>
        </div>
        <div class="pm-info-side">
          <p class="pm-num">${num}</p>
          <h2 class="pm-name">${name}</h2>
          <div class="pm-types">${typesHTML}</div>
          <p class="pm-desc">${desc}</p>
          <div class="pm-info-grid">
            <div class="pm-info-item"><label>Height</label>${height}</div>
            <div class="pm-info-item"><label>Weight</label>${weight}</div>
            <div class="pm-info-item"><label>Base EXP</label>${baseExp}</div>
            <div class="pm-info-item"><label>Generation</label>Gen ${getGenByNumber(poke.id) || '?'}</div>
          </div>
        </div>
      </div>
      <div class="pm-body">
        <div class="pm-section">
          <h4>Base Stats</h4>
          <div class="stat-bars">${statsHTML}</div>
        </div>
        <div class="pm-section">
          <h4>Abilities</h4>
          <div class="abilities-list">${abilitiesHTML}</div>
        </div>
        <div class="pm-section" id="evoSection">
          <h4>Evolution Chain</h4>
          <div class="evo-chain" id="evoChain"><div class="loader-ring"></div></div>
        </div>
      </div>`;
    
    // Animate stat bars
    setTimeout(() => {
      document.querySelectorAll('.stat-bar-fill').forEach(bar => {
        bar.style.width = bar.dataset.pct;
      });
    }, 100);
    
    // Bind fav button
    document.getElementById('pmFavBtn').addEventListener('click', function() {
      toggleFavorite(parseInt(this.dataset.id), this, true);
    });
    
    // Load evolution chain
    if (spec && spec.evolution_chain) {
      loadEvoChain(spec.evolution_chain.url);
    } else {
      document.getElementById('evoChain').innerHTML = '<span style="color:var(--text-muted)">No evolution data.</span>';
    }
    
  } catch (e) {
    content.innerHTML = `<div class="modal-loader"><p style="color:var(--danger)">Failed to load Pokémon data.</p></div>`;
  }
}

async function loadEvoChain(url) {
  const evoEl = document.getElementById('evoChain');
  if (!evoEl) return;
  try {
    const data = await fetchJSON(url);
    const chain = [];
    let curr = data.chain;
    while (curr) {
      chain.push(curr.species);
      curr = curr.evolves_to[0];
    }
    const steps = await Promise.all(chain.map(async sp => {
      const id = parseInt(sp.url.split('/').filter(Boolean).pop());
      return { name: sp.name, id };
    }));
    evoEl.innerHTML = steps.map((s, i) => `
      ${i > 0 ? '<span class="evo-arrow">→</span>' : ''}
      <div class="evo-step" data-id="${s.id}">
        <img src="${getPokemonSprite(s.id)}" alt="${s.name}" />
        <span>${s.name}</span>
      </div>`).join('');
    
    evoEl.querySelectorAll('.evo-step').forEach(step => {
      step.addEventListener('click', () => openPokemonModal(parseInt(step.dataset.id)));
    });
  } catch (e) {
    if (evoEl) evoEl.innerHTML = '<span style="color:var(--text-muted)">Evolution data unavailable.</span>';
  }
}

// ════════════════════════════════════════
// FAVORITES
// ════════════════════════════════════════
function toggleFavorite(id, btn, isModal = false) {
  const idx = favorites.findIndex(f => f.id === id);
  if (idx === -1) {
    // Add
    const pk = allDexPokemon.find(p => p.id === id) || { id, name: 'pokemon-' + id, types: [] };
    favorites.unshift({ id: pk.id, name: pk.name, types: pk.types, addedAt: Date.now() });
    btn.classList.add('active');
    if (isModal) btn.innerHTML = '<i class="fas fa-star"></i> Saved';
  } else {
    // Remove
    favorites.splice(idx, 1);
    btn.classList.remove('active');
    if (isModal) btn.innerHTML = '<i class="fas fa-star"></i> Save';
  }
  saveFavorites();
  updateFavCount();
  
  // Sync other star buttons for same id
  document.querySelectorAll(`.poke-fav-btn[data-id="${id}"]`).forEach(b => {
    b.classList.toggle('active', favorites.some(f => f.id === id));
  });
}

function updateFavCount() {
  const el = document.getElementById('navFavCount');
  if (!el) return;
  if (favorites.length > 0) {
    el.textContent = favorites.length;
    el.style.display = '';
  } else {
    el.style.display = 'none';
  }
}

function renderFavorites() {
  const empty = document.getElementById('favEmpty');
  const grid = document.getElementById('favGrid');
  const controls = document.getElementById('favControls');
  const searchInput = document.getElementById('favSearch');
  const sortSelect = document.getElementById('favSort');
  
  function getDisplayFavs() {
    let list = [...favorites];
    const q = searchInput ? searchInput.value.toLowerCase().trim() : '';
    if (q) list = list.filter(f => f.name.includes(q));
    const sort = sortSelect ? sortSelect.value : 'recent';
    if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === 'type') list.sort((a, b) => (a.types[0] || '').localeCompare(b.types[0] || ''));
    else list.sort((a, b) => b.addedAt - a.addedAt);
    return list;
  }
  
  function render() {
    const list = getDisplayFavs();
    if (favorites.length === 0) {
      empty.style.display = '';
      grid.style.display = 'none';
      controls.style.display = 'none';
      return;
    }
    empty.style.display = 'none';
    grid.style.display = '';
    controls.style.display = '';
    
    grid.innerHTML = list.map(pk => `
      <div class="poke-card scroll-reveal" data-id="${pk.id}">
        <button class="poke-fav-btn active" data-id="${pk.id}" title="Remove"><i class="fas fa-star"></i></button>
        <img src="${getPokemonSprite(pk.id)}" alt="${pk.name}" loading="lazy" />
        <span class="poke-num">${padId(pk.id)}</span>
        <span class="poke-name">${pk.name}</span>
        <div class="type-badges">${pk.types.map(t => `<span class="type-badge type-${t}">${t}</span>`).join('')}</div>
      </div>`).join('');
    
    grid.querySelectorAll('.poke-card').forEach(card => {
      card.addEventListener('click', e => {
        if (e.target.closest('.poke-fav-btn')) return;
        openPokemonModal(parseInt(card.dataset.id));
      });
      const favBtn = card.querySelector('.poke-fav-btn');
      favBtn.addEventListener('click', e => {
        e.stopPropagation();
        const cardEl = favBtn.closest('.poke-card');
        cardEl.classList.add('fade-out');
        setTimeout(() => {
          removeFavorite(parseInt(favBtn.dataset.id));
          render();
        }, 350);
      });
    });
    observeScrollReveal();
  }
  
  if (searchInput) searchInput.addEventListener('input', render);
  if (sortSelect) sortSelect.addEventListener('change', render);
  
  render();
}

function removeFavorite(id) {
  const idx = favorites.findIndex(f => f.id === id);
  if (idx !== -1) favorites.splice(idx, 1);
  saveFavorites();
  updateFavCount();
  document.querySelectorAll(`.poke-fav-btn[data-id="${id}"]`).forEach(b => b.classList.remove('active'));
}

function clearAllFavorites() {
  favorites = [];
  saveFavorites();
  updateFavCount();
  renderFavorites();
}

// ════════════════════════════════════════
// INSIGHT PAGE
// ════════════════════════════════════════
const insightArticles = {
  featured: {
    title: 'Why Dragon Types Dominate Late Game',
    tag: 'Strategy',
    content: `
      <h3>Raw Power</h3>
      <p>Dragon-type Pokémon consistently feature some of the highest base stat totals in the game. Pokémon like Dragonite, Salamence, Garchomp, and Dragonite boast totals exceeding 600, putting them firmly in pseudo-legendary territory.</p>
      <h3>Resistance Profile</h3>
      <p>Dragon types resist Fire, Water, Grass, and Electric — four of the most commonly used offensive types. This means your Dragon can tank hits that would knock out most other Pokémon.</p>
      <h3>The One Weakness</h3>
      <p>Their Achilles heel: Ice, Dragon, and Fairy. Fairy-type introduction in Gen VI was specifically designed to counter Dragon's dominance. Smart teams now include a Fairy to handle these threats.</p>
      <h3>Competitive Usage</h3>
      <ul>
        <li>Garchomp is perennially one of the top OU Pokémon in Smogon</li>
        <li>Dragonapult has incredible Speed and mixed attacking stats</li>
        <li>Dragapult sees heavy use due to Ghost/Dragon dual typing</li>
        <li>Kyurem-Black and White dominate Ubers with unique Freeze Bolt/Ice Burn</li>
      </ul>
      <h3>Verdict</h3>
      <p>Dragon types aren't just powerful, they're versatile. With coverage moves like Earthquake, Fire Blast, or Thunderbolt, they can threaten nearly every team. Until Fairy-types become universal, Dragons will remain a dominant force in late-game battles.</p>
    `
  },
  guide1: {
    title: 'Evolution Mechanics Explained',
    tag: 'Guide',
    content: `
      <h3>Level-Up Evolution</h3>
      <p>The most common method is simply level up a Pokémon to a certain level and it evolves. Some have requirements like a specific move learned or a stat condition (like Kubfu).</p>
      <h3>Friendship Evolution</h3>
      <p>Pokémon like Eevee (into Espeon/Umbreon), Chansey, and Riolu evolve when their friendship stat reaches 160+. Walk with them, avoid fainting, and give them vitamins to boost friendship.</p>
      <h3>Stone Evolution</h3>
      <p>Fire Stone, Water Stone, Thunder Stone, Moon Stone, and others trigger evolution in specific Pokémon. These aren't level-dependent and you can evolve at any point.</p>
      <h3>Trade Evolution</h3>
      <p>Gengar, Machamp, Golem, and Alakazam all require trading to evolve. Some need items held during trade (e.g., Politoed needs King's Rock, Onix needs Metal Coat).</p>
      <h3>Special Conditions</h3>
      <ul>
        <li>Tyrogue evolves based on which stat is higher at level 20</li>
        <li>Inkay evolves by holding the console upside down at level 30</li>
        <li>Shedinja requires an empty party slot when Nincada evolves</li>
        <li>Milcery needs spinning with a Sweet held item</li>
      </ul>
    `
  },
  guide2: {
    title: 'Abilities & Moves Basics',
    tag: 'Guide',
    content: `
      <h3>What Are Abilities?</h3>
      <p>Each Pokémon has 1–2 regular abilities and optionally a hidden ability (obtainable through special means). Abilities trigger automatically in battle based on conditions.</p>
      <h3>Key Ability Categories</h3>
      <ul>
        <li><strong>Intimidate:</strong> Lowers opponent's Attack on switch-in, it is essential for defensive play</li>
        <li><strong>Speed Boost:</strong> Increases Speed each turn. Blaziken is so powerful it's often banned</li>
        <li><strong>Drought/Drizzle:</strong> Set automatic sun/rain that enables powerful weather strategies</li>
        <li><strong>Levitate:</strong> Grants immunity to Ground moves</li>
        <li><strong>Regenerator:</strong> Heals 1/3 HP on switch-out, incredible on pivots</li>
      </ul>
      <h3>Move Categories</h3>
      <p>Physical moves use Attack/Defense. Special moves use Sp.Atk/Sp.Def. Status moves cause conditions like sleep, paralysis, or stat drops without dealing direct damage.</p>
      <h3>Priority Moves</h3>
      <p>Moves like Quick Attack and Sucker Punch always go first regardless of Speed. Crucial for revenge killing low-health opponents.</p>
    `
  },
  guide3: {
    title: 'Type Matchups Made Simple',
    tag: 'Guide',
    content: `
      <h3>The Three Rules</h3>
      <ul>
        <li><strong>Super Effective (2x):</strong> Fire melts Ice, Water douses Fire, Grass soaks up Water</li>
        <li><strong>Not Very Effective (0.5x):</strong> Normal barely scratches Rock, Dragon shrugs off Water</li>
        <li><strong>No Effect (0x):</strong> Normal vs Ghost, Electric vs Ground, Ground vs Flying</li>
      </ul>
      <h3>Key Attacking Types to Know</h3>
      <ul>
        <li><strong>Ground:</strong> Hits Electric, Fire, Poison, Rock, Steel are incredible coverage</li>
        <li><strong>Fighting:</strong> Deals with Normal, Dark, Ice, Rock, Steel are great for breaking walls</li>
        <li><strong>Ice:</strong> Destroys Dragon, Flying, Grass, Ground, but Ice types are defensively weak</li>
        <li><strong>Fairy:</strong> Stops Dragon, Dark, Fighting cold, and introduced to balance the meta</li>
      </ul>
      <h3>Stacking Effectiveness</h3>
      <p>Dual-type Pokémon can have 4x weaknesses or resistances. Charizard (Fire/Flying) takes 4x damage from Rock. Swampert (Water/Ground) takes 4x from Grass but is otherwise incredibly well-covered.</p>
    `
  },
  top1: {
    title: 'Top 10 Strongest Pokémon',
    tag: 'Top List',
    content: `
      <p>Ranked by Base Stat Total (BST):</p>
      <h3>S-Tier (BST 680+)</h3>
      <ul>
        <li><strong>#1 Arceus</strong> – 720 BST – The God Pokémon, creator of the universe</li>
        <li><strong>#2 Eternatus Eternamax</strong> – 1125 BST – Technically the highest ever, but only as a boss</li>
        <li><strong>#3 Mega Rayquaza</strong> – 780 BST – Sky High Chain.Banned from Ubers</li>
        <li><strong>#4 Primal Groudon</strong> – 770 BST – Reshapes the land with Desolate Land</li>
        <li><strong>#5 Primal Kyogre</strong> – 770 BST – Commands the seas with Primordial Sea</li>
      </ul>
      <h3>A-Tier (650–679)</h3>
      <ul>
        <li><strong>#6 Zacian (Crowned)</strong> – 720 BST – Sword-wielding fairy legend of Galar</li>
        <li><strong>#7 Zamazenta (Crowned)</strong> – 720 BST – Shield form with unbreakable defense</li>
        <li><strong>#8 Kyurem-Black</strong> – 700 BST – Dragon/Ice fusion with unique Z-move</li>
        <li><strong>#9 Xerneas</strong> – 680 BST – Life-giving fairy that shaped Kalos</li>
        <li><strong>#10 Yveltal</strong> – 680 BST – The destruction bird, Dark/Flying nightmare</li>
      </ul>
    `
  },
  top2: {
    title: 'Best Starter Pokémon by Region',
    tag: 'Top List',
    content: `
      <h3>Kanto (Gen I)</h3>
      <p><strong>Winner: Bulbasaur</strong> — Easiest early game, best type coverage for the first three gyms.</p>
      <h3>Johto (Gen II)</h3>
      <p><strong>Winner: Cyndaquil</strong> — Typhlosion's Special Attack makes it a late-game powerhouse.</p>
      <h3>Hoenn (Gen III)</h3>
      <p><strong>Winner: Mudkip</strong> — Water/Ground typing gives it enormous coverage. Whitney's Milktank? No problem.</p>
      <h3>Sinnoh (Gen IV)</h3>
      <p><strong>Winner: Piplup</strong> — Empoleon is a Water/Steel with an incredible defensive typing.</p>
      <h3>Unova (Gen V)</h3>
      <p><strong>Winner: Oshawott</strong> — Samurott is versatile and Unova's Water coverage is fantastic.</p>
      <h3>Alola (Gen VII)</h3>
      <p><strong>Winner: Rowlet</strong> — Decidueye (Grass/Ghost) is unique and powerful, with style.</p>
      <h3>Galar (Gen VIII)</h3>
      <p><strong>Winner: Sobble</strong> — Inteleon's Sniper ability makes it a critical hit machine.</p>
    `
  },
  top3: {
    title: 'Most Underrated Pokémon',
    tag: 'Top List',
    content: `
      <h3>Why Underrated?</h3>
      <p>These Pokémon are often passed over for flashier legendaries or fan favorites. But in the right team, they're devastatingly effective.</p>
      <ul>
        <li><strong>Clefable</strong> – Magic Guard + Calm Mind = almost unkillable special wall</li>
        <li><strong>Toxapex</strong> – 152 Defense / 142 Sp.Def, Regenerator, and access to Scald + Toxic makes it a nightmare to face</li>
        <li><strong>Rotom-Wash</strong> – Water/Electric with Levitate gives it only one weakness — Grass. Incredible pivot.</li>
        <li><strong>Skarmory</strong> – Physical Defense wall with Spikes + Whirlwind. Steel/Flying typing has 9 resistances.</li>
        <li><strong>Blissey</strong> – 620+ HP stat. Special walls don't get better than this, even with its paper-thin physical defense.</li>
        <li><strong>Scizor</strong> – Technician + Bullet Punch. 50% priority STAB with 150 Attack after boost? Yes please.</li>
      </ul>
    `
  },
  top4: {
    title: 'Most Iconic Pokémon of All Time',
    tag: 'Top List',
    content: `
      <h3>Cultural Legends</h3>
      <ul>
        <li><strong>Pikachu</strong> – The face of the franchise. 25 years as mascot, no explanation needed.</li>
        <li><strong>Charizard</strong> – The most demanded Pokémon in history. Consistently banned from competitive formats for power.</li>
        <li><strong>Mewtwo</strong> – The first legendary. The villain of the original movie. Psychic powerhouse.</li>
        <li><strong>Gengar</strong> – Fan-favorite ghost since 1996. Consistently top-tier competitively.</li>
        <li><strong>Eevee</strong> – Eight evolutions, each distinct, each beloved by a different community.</li>
        <li><strong>Lucario</strong> – Steel/Fighting aura Pokémon, protagonist of the best movie, top smash Bros character.</li>
        <li><strong>Snorlax</strong> – A cultural mood. Blocking the road since 1996.</li>
        <li><strong>Gyarados</strong> – The ultimate comeback story. From pathetic Magikarp to terrifying sea serpent.</li>
      </ul>
    `
  },
  strat1: {
    title: 'Beginner Battle Guide',
    tag: 'Strategy',
    content: `
      <h3>The Turn Structure</h3>
      <p>Each turn, both players choose an action simultaneously. Actions are: Attack, Switch, Use Item, or Run. Speed determines who goes first among same-priority moves.</p>
      <h3>The Golden Rules</h3>
      <ul>
        <li><strong>Never keep a Pokémon in a bad matchup</strong>. Switch to something that resists the opponent's attacks</li>
        <li><strong>Status conditions are often more valuable than attacking</strong>. Paralysis halves speed; sleep wastes turns; burn halves Attack</li>
        <li><strong>STAB matters</strong>. Same-type attack bonus multiplies power by 1.5x. Always consider it when choosing moves</li>
        <li><strong>Don't use all your best Pokémon early</strong>. Save at least one healthy Pokémon for the final fight</li>
      </ul>
      <h3>Coverage Moves</h3>
      <p>Don't teach all moves of the same type. Charizard with 4 Fire moves can't touch Rock or Water types. Give it Air Slash (Flying) and Dragon Pulse for better coverage.</p>
      <h3>Status is King</h3>
      <p>Toxic + Protect stalling, Thunder Wave before a sweep, Spore to put threats to sleep. Status moves win more games than raw damage.</p>
    `
  },
  strat2: {
    title: 'Build a Balanced Team',
    tag: 'Strategy',
    content: `
      <h3>The 6-Slot Framework</h3>
      <p>A standard competitive team has 6 roles, though they can overlap:</p>
      <ul>
        <li><strong>Physical Sweeper</strong> – High Attack, can sweep weakened teams (e.g., Garchomp)</li>
        <li><strong>Special Sweeper</strong> – High Sp.Atk (e.g., Alakazam, Gengar)</li>
        <li><strong>Physical Wall</strong> – Tanks physical hits (e.g., Skarmory, Ferrothorn)</li>
        <li><strong>Special Wall</strong> – Tanks special hits (e.g., Blissey, Chansey)</li>
        <li><strong>Pivot / Support</strong> – Sets hazards, heals, passes boosts (e.g., Rotom, Clefable)</li>
        <li><strong>Revenge Killer</strong> – Fast, hits hard, takes out weakened sweepers (e.g., Scizor, Weavile)</li>
      </ul>
      <h3>Type Coverage Checklist</h3>
      <p>Before finalizing your team, ask: "Can I deal with a Dragon? A Fairy? A Psychic?" Make sure at least one team member covers each major threat type.</p>
      <h3>Speed Tiers Matter</h3>
      <p>Know your speed. If your sweeper is outspeed, it's a liability. Priority moves (Quick Attack, Bullet Punch) can patch lower speed tiers.</p>
    `
  },
  strat3: {
    title: 'Best Type Combinations',
    tag: 'Strategy',
    content: `
      <h3>Defensively Strong Combos</h3>
      <ul>
        <li><strong>Water/Ground</strong> – Only 1 weakness (Grass). Swampert, Gastrodon</li>
        <li><strong>Steel/Flying</strong> – 9 resistances, only 2 weaknesses. Skarmory</li>
        <li><strong>Electric/Steel</strong> – Extremely few weaknesses. Magnezone</li>
        <li><strong>Ghost/Dark</strong> – Immune to Normal, Fighting, Psychic. Sableye (with Prankster)</li>
      </ul>
      <h3>Offensively Strong Combos</h3>
      <ul>
        <li><strong>Ground/Rock</strong> – EdgeQuake combo: hits almost every type for neutral or super effective</li>
        <li><strong>Fighting/Ice</strong> – BoltBeam equivalent: covers most of the meta</li>
        <li><strong>Fire/Flying</strong> – Charizard's classic: wide neutral coverage</li>
        <li><strong>Dragon/Fighting</strong> – Unresisted by most, especially powerful in late game</li>
      </ul>
      <h3>The BoltBeam Standard</h3>
      <p>Thunderbolt + Ice Beam is called "BoltBeam" for a reason. Together, only Electric, Water, Dragon, and Grass types resist one or both. It's the gold standard of coverage on special attackers.</p>
    `
  }
};

function openInsightModal(key) {
  const art = insightArticles[key];
  if (!art) return;
  const overlay = document.getElementById('insightModal');
  const content = document.getElementById('insightModalContent');
  overlay.classList.add('open');
  const tagClass = art.tag.toLowerCase().replace(' ', '');
  content.innerHTML = `
    <span class="ins-tag ${tagClass}" style="display:block;margin:1.5rem 2rem 0;">${art.tag}</span>
    <h2 class="ins-modal-title">${art.title}</h2>
    <div class="ins-modal-body">${art.content}</div>`;
}

// ════════════════════════════════════════
// ABOUT PAGE
// ════════════════════════════════════════
function initAbout() {
  observeScrollReveal();
  // Back to top
  const btn = document.getElementById('backToTop');
  if (btn) {
    const page = document.getElementById('page-about');
    window.addEventListener('scroll', () => {
      btn.classList.toggle('visible', window.scrollY > 400);
    });
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }
}

// ════════════════════════════════════════
// HOME COUNTER ANIMATION
// ════════════════════════════════════════
function animateCounters() {
  document.querySelectorAll('.stat-num[data-target]').forEach(el => {
    const target = parseInt(el.dataset.target);
    let current = 0;
    const step = Math.ceil(target / 60);
    const timer = setInterval(() => {
      current = Math.min(current + step, target);
      el.textContent = current.toLocaleString();
      if (current >= target) clearInterval(timer);
    }, 16);
  });
}

// ════════════════════════════════════════
// SETTINGS PANEL
// ════════════════════════════════════════
function initSettings() {
  // Settings pill buttons
  document.querySelectorAll('.pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.setting;
      const val = btn.dataset.value;
      if (!key || !val) return;
      
      const settingKeyMap = {
        theme: 'theme',
        accent: 'accent',
        dexView: 'dexView',
        defaultSort: 'defaultSort',
        searchMode: 'searchMode',
      };
      const sk = settingKeyMap[key];
      if (sk) {
        settings[sk] = val;
        saveSettings();
        applySettings();
      }
    });
  });
  
  // Toggle checkboxes
  document.getElementById('toggleAnimations').addEventListener('change', function() {
    settings.animations = this.checked;
    saveSettings();
    applySettings();
  });
  document.getElementById('toggleHoverStats').addEventListener('change', function() {
    settings.hoverStats = this.checked;
    saveSettings();
  });
  document.getElementById('toggleTypeBadges').addEventListener('change', function() {
    settings.typeBadges = this.checked;
    saveSettings();
    applySettings();
  });
  document.getElementById('toggleShowNumber').addEventListener('change', function() {
    settings.showNumber = this.checked;
    saveSettings();
    applySettings();
  });
  
  // Clear favorites from settings
  document.getElementById('settingsClearFavs').addEventListener('click', () => {
    closeModal('settingsModal');
    openConfirmModal();
  });
  
  // Settings button
  document.getElementById('settingsBtn').addEventListener('click', () => {
    document.getElementById('settingsModal').classList.add('open');
    applySettings();
  });
  document.getElementById('closeSettings').addEventListener('click', () => closeModal('settingsModal'));
}

// ════════════════════════════════════════
// MODAL HELPERS
// ════════════════════════════════════════
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

function openConfirmModal() {
  document.getElementById('confirmModal').classList.add('open');
}

document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});

// ════════════════════════════════════════
// POKÉDEX SEARCH (enter mode)
// ════════════════════════════════════════
function handleDexSearchEnter(e) {
  if (settings.searchMode === 'enter' && e.key === 'Enter') {
    onDexFilter();
  }
}

// ════════════════════════════════════════
// INSIGHT FILTER TABS
// ════════════════════════════════════════
function initInsightTabs() {
  document.querySelectorAll('.ins-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.ins-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      insightFilter = tab.dataset.filter;
      
      document.querySelectorAll('.insight-section').forEach(sec => {
        if (insightFilter === 'all') {
          sec.style.display = '';
        } else {
          sec.style.display = sec.dataset.category === insightFilter ? '' : 'none';
        }
      });
      
      const featured = document.querySelector('.insight-featured');
      if (featured) {
        featured.style.display = (insightFilter === 'all' || insightFilter === 'strategy') ? '' : 'none';
      }
    });
  });
  
  // Insight card clicks
  document.querySelectorAll('.insight-card').forEach(card => {
    card.addEventListener('click', () => {
      const key = card.dataset.modal;
      if (key) openInsightModal(key);
    });
  });
  
  document.querySelector('.ins-read-btn').addEventListener('click', () => openInsightModal('featured'));
  document.getElementById('closeInsightModal').addEventListener('click', () => closeModal('insightModal'));
}

// ════════════════════════════════════════
// POKÉBALL PARTICLES
// ════════════════════════════════════════
function initPokeballParticles() {
  const container = document.getElementById('pokeballParticles');
  if (!container) return;
  for (let i = 0; i < 8; i++) {
    const p = document.createElement('div');
    p.style.cssText = `
      position:absolute;
      width:4px;height:4px;
      border-radius:50%;
      background:var(--accent);
      opacity:0;
      top:50%;left:50%;
      animation:particle-burst ${2 + Math.random()}s ease-out ${Math.random() * 2}s infinite;
      --px:${(Math.random() - 0.5) * 200}px;
      --py:${(Math.random() - 0.5) * 200}px;
    `;
    container.appendChild(p);
  }
  // Inject keyframe
  const style = document.createElement('style');
  style.textContent = `
    @keyframes particle-burst {
      0%   { transform:translate(0,0); opacity:1; }
      100% { transform:translate(var(--px),var(--py)); opacity:0; }
    }
  `;
  document.head.appendChild(style);
}

// ════════════════════════════════════════
// SCROLL OBSERVER (global)
// ════════════════════════════════════════
const globalObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      globalObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });

function observeScrollReveal() {
  document.querySelectorAll('.scroll-reveal:not(.visible), .about-section:not(.visible)').forEach(el => {
    globalObserver.observe(el);
  });
}

// ════════════════════════════════════════
// INIT
// ════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  loadFavorites();
  applySettings();
  updateFavCount();
  initSettings();
  initInsightTabs();
  initPokeballParticles();
  
  // Nav buttons
  document.querySelectorAll('.nav-btn[data-page]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      navigateTo(btn.dataset.page);
    });
  });
  
  // CTA buttons (goto)
  document.querySelectorAll('[data-goto]').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.goto));
  });
  
  // Pokemon modal close
  document.getElementById('closePokemonModal').addEventListener('click', () => closeModal('pokemonModal'));
  
  // Confirm clear all
  document.getElementById('confirmCancel').addEventListener('click', () => closeModal('confirmModal'));
  document.getElementById('confirmClear').addEventListener('click', () => {
    clearAllFavorites();
    closeModal('confirmModal');
  });
  
  // Fav page clear all
  document.getElementById('clearAllFavBtn').addEventListener('click', openConfirmModal);
  
  // Dex search enter key
  document.getElementById('dexSearch').addEventListener('keydown', handleDexSearchEnter);
  
  // About TOC smooth scroll
  document.querySelectorAll('.toc-links a').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      const target = document.querySelector(a.getAttribute('href'));
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
  });
  
  // Animate counters on home
  setTimeout(animateCounters, 300);
  
  // Observe about sections
  observeScrollReveal();
  
  // Feature cards
  document.querySelectorAll('.feature-card[data-goto]').forEach(card => {
    card.addEventListener('click', () => navigateTo(card.dataset.goto));
  });
  
  // Start on home
  navigateTo('home');
  
  // Load gallery names lazily after explore loads
  // (names will populate on hover as data is fetched)
  
  console.log('%cDexoria v1.0.0 — Loaded', 'color:#27F5FF;font-family:monospace;font-size:14px;font-weight:bold');
});