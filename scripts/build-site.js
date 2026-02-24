const fs = require('fs');
const path = require('path');

function buildSite(events, outputDir) {
  console.log(`[build-site] Generating site with ${events.length} events...`);
  
  const now = new Date();
  const updated = now.toLocaleString('en-US', { 
    timeZone: 'America/New_York',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });

  const eventsJson = JSON.stringify(events);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NYC Tonight</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    :root {
      --bg: #0c1018;
      --bg-warm: #0f1119;
      --bg-card: #141822;
      --bg-card-hover: #1a1f2d;
      --border: #1f2535;
      --border-warm: #2a2520;
      --text: #c8ccd4;
      --text-dim: #5e6578;
      --text-bright: #eef0f4;
      --accent: #d4622b;
      --accent-glow: rgba(212, 98, 43, 0.15);
      --accent-light: #e8854f;
      --teal: #4a9e8e;
      --teal-dim: rgba(74, 158, 142, 0.12);
      --gold: #d4a02b;
      --gold-bg: rgba(212, 160, 43, 0.1);
      --silver: #8892a4;
      --silver-bg: rgba(136, 146, 164, 0.08);
      --bronze: #a06830;
      --bronze-bg: rgba(160, 104, 48, 0.08);
      --dim: #3a3f4d;
      --film: #7b68ae;
      --film-bg: rgba(123, 104, 174, 0.1);
    }
    
    body {
      font-family: 'DM Sans', -apple-system, system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
    }
    
    /* === PIN Gate === */
    #pin-gate {
      position: fixed; inset: 0;
      background: var(--bg);
      display: flex; align-items: center; justify-content: center;
      flex-direction: column; gap: 1.5rem;
      z-index: 1000;
    }
    #pin-gate .logo {
      font-family: 'DM Mono', monospace;
      font-size: 0.85rem; letter-spacing: 0.15em; text-transform: uppercase;
      color: var(--accent);
    }
    #pin-gate h1 {
      font-size: 2.5rem; font-weight: 300; color: var(--text-bright);
      letter-spacing: -0.02em;
    }
    #pin-gate h1 em { font-style: italic; color: var(--accent); }
    #pin-gate input {
      background: var(--bg-card); border: 1px solid var(--border);
      color: var(--text-bright); font-family: 'DM Mono', monospace;
      font-size: 1.75rem; text-align: center; letter-spacing: 0.5em;
      padding: 0.75rem 1.5rem; border-radius: 8px; width: 180px;
      outline: none; transition: border-color 0.2s;
    }
    #pin-gate input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-glow); }
    #pin-gate .error { color: #e04040; font-size: 0.8rem; }
    #pin-gate.hidden { display: none; }
    
    /* === Header === */
    header {
      padding: 2.5rem 2rem 0.5rem;
      max-width: 1280px; margin: 0 auto;
      display: flex; justify-content: space-between; align-items: baseline;
    }
    .brand {
      display: flex; align-items: baseline; gap: 0.75rem;
    }
    .brand h1 {
      font-size: 1.5rem; font-weight: 700; color: var(--text-bright);
      letter-spacing: -0.03em;
    }
    .brand h1 span { color: var(--accent); font-weight: 300; font-style: italic; }
    .meta {
      color: var(--text-dim); font-size: 0.75rem;
      font-family: 'DM Mono', monospace;
    }
    
    /* === Controls === */
    .controls {
      padding: 1rem 2rem;
      max-width: 1280px; margin: 0 auto;
      display: flex; gap: 0.75rem; flex-wrap: wrap;
      align-items: center;
    }
    .pill {
      background: transparent; border: 1px solid var(--border);
      color: var(--text-dim); padding: 0.35rem 0.85rem; border-radius: 20px;
      cursor: pointer; font-size: 0.75rem; font-family: inherit;
      transition: all 0.15s; white-space: nowrap;
    }
    .pill:hover { border-color: var(--accent); color: var(--text); }
    .pill.active { 
      background: var(--accent); border-color: var(--accent); 
      color: #fff; font-weight: 500; 
    }
    .pill.teal.active { background: var(--teal); border-color: var(--teal); }
    .pill.film.active { background: var(--film); border-color: var(--film); }
    
    .spacer { flex: 1; }
    
    .view-toggle {
      display: flex; border: 1px solid var(--border); border-radius: 6px; overflow: hidden;
    }
    .view-btn {
      background: transparent; border: none; color: var(--text-dim);
      padding: 0.35rem 0.6rem; cursor: pointer; font-size: 0.8rem;
      transition: all 0.15s;
    }
    .view-btn:hover { color: var(--text); }
    .view-btn.active { background: var(--bg-card); color: var(--accent); }
    .view-btn + .view-btn { border-left: 1px solid var(--border); }
    
    .sort-group { display: flex; gap: 0.4rem; align-items: center; }
    .sort-label { color: var(--text-dim); font-size: 0.7rem; font-family: 'DM Mono', monospace; }
    
    /* === Stats === */
    .stats {
      max-width: 1280px; margin: 0 auto;
      padding: 0.5rem 2rem 0.5rem;
      display: flex; gap: 2rem;
      font-size: 0.75rem; color: var(--text-dim);
      font-family: 'DM Mono', monospace;
    }
    .stats strong { color: var(--accent); }
    
    /* === Card Grid === */
    .events-grid {
      max-width: 1280px; margin: 0.5rem auto;
      padding: 0 2rem 4rem;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 0.75rem;
    }
    
    /* === Card === */
    .card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 1.1rem 1.25rem;
      transition: all 0.2s;
      position: relative;
    }
    .card:hover { 
      background: var(--bg-card-hover);
      transform: translateY(-1px);
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    }
    .card.gold { border-left: 3px solid var(--gold); }
    .card.silver { border-left: 3px solid var(--silver); }
    .card.bronze { border-left: 3px solid var(--bronze); }
    .card.dim { opacity: 0.5; }
    .card.film-card { border-left: 3px solid var(--film); }
    
    .card-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.6rem; }
    .card-title {
      font-size: 0.95rem; font-weight: 600; color: var(--text-bright);
      line-height: 1.35;
    }
    .card-title a { color: inherit; text-decoration: none; }
    .card-title a:hover { color: var(--accent); }
    
    .badge {
      flex-shrink: 0;
      font-family: 'DM Mono', monospace;
      font-size: 0.7rem; font-weight: 500;
      padding: 0.15rem 0.45rem; border-radius: 4px;
      min-width: 2rem; text-align: center;
    }
    .badge.gold { background: var(--gold-bg); color: var(--gold); }
    .badge.silver { background: var(--silver-bg); color: var(--silver); }
    .badge.bronze { background: var(--bronze-bg); color: var(--bronze); }
    .badge.dim { background: rgba(58,63,77,0.2); color: var(--dim); }
    .badge.film-badge { background: var(--film-bg); color: var(--film); }
    
    .card-body {
      margin-top: 0.6rem;
      display: flex; flex-direction: column; gap: 0.25rem;
      font-size: 0.8rem; color: var(--text-dim);
    }
    .venue { color: var(--text); font-weight: 500; }
    .artists { font-style: italic; }
    .description { font-size: 0.75rem; margin-top: 0.25rem; opacity: 0.7; }
    
    .tags {
      margin-top: 0.6rem;
      display: flex; gap: 0.35rem; flex-wrap: wrap;
    }
    .tag {
      font-size: 0.65rem; padding: 0.1rem 0.45rem;
      border-radius: 3px;
    }
    .tag.match { background: var(--accent-glow); color: var(--accent-light); }
    .tag.discover { background: var(--teal-dim); color: var(--teal); }
    .tag.source { background: rgba(94,101,120,0.15); color: var(--text-dim); }
    .tag.genre { background: rgba(94,101,120,0.1); color: var(--text-dim); }
    .tag.film-tag { background: var(--film-bg); color: var(--film); }
    
    /* === Row/List View === */
    .events-list {
      max-width: 1280px; margin: 0.5rem auto;
      padding: 0 2rem 4rem;
      display: flex; flex-direction: column;
    }
    .events-list .row {
      display: grid;
      grid-template-columns: 2.5rem 1fr auto auto;
      gap: 1rem;
      align-items: center;
      padding: 0.6rem 0.75rem;
      border-bottom: 1px solid var(--border);
      transition: background 0.1s;
      font-size: 0.85rem;
    }
    .events-list .row:hover { background: var(--bg-card); }
    .events-list .row.dim { opacity: 0.45; }
    
    .row .score {
      font-family: 'DM Mono', monospace;
      font-size: 0.75rem; font-weight: 500;
      text-align: center;
    }
    .row .score.gold { color: var(--gold); }
    .row .score.silver { color: var(--silver); }
    .row .score.bronze { color: var(--bronze); }
    .row .score.dim { color: var(--dim); }
    .row .score.film-score { color: var(--film); }
    
    .row .info { min-width: 0; }
    .row .title-line {
      font-weight: 500; color: var(--text-bright);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .row .title-line a { color: inherit; text-decoration: none; }
    .row .title-line a:hover { color: var(--accent); }
    .row .venue-line {
      font-size: 0.75rem; color: var(--text-dim);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .row .date-col {
      font-family: 'DM Mono', monospace;
      font-size: 0.7rem; color: var(--text-dim);
      white-space: nowrap;
    }
    .row .tags-col {
      display: flex; gap: 0.25rem;
    }
    .row .mini-tag {
      font-size: 0.6rem; padding: 0.05rem 0.3rem;
      border-radius: 2px;
    }
    .row .mini-tag.match { background: var(--accent-glow); color: var(--accent-light); }
    .row .mini-tag.source { background: rgba(94,101,120,0.1); color: var(--text-dim); }
    
    /* === Empty === */
    .empty {
      text-align: center; padding: 4rem 2rem;
      color: var(--text-dim); font-style: italic;
    }
    
    /* === Footer === */
    footer {
      text-align: center; padding: 2rem;
      color: var(--text-dim); font-size: 0.7rem;
      font-family: 'DM Mono', monospace;
    }
    footer a { color: var(--accent); text-decoration: none; }
    .refresh-btn {
      background: transparent; border: 1px solid var(--border);
      color: var(--accent); padding: 0.3rem 0.8rem; border-radius: 20px;
      cursor: pointer; font-family: 'DM Mono', monospace; font-size: 0.7rem;
      transition: all 0.2s;
    }
    .refresh-btn:hover { background: var(--accent); color: #fff; border-color: var(--accent); }
    .refresh-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .refresh-status { font-size: 0.65rem; color: var(--teal); }
    
    /* Modal */
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.7);
      display: flex; align-items: center; justify-content: center;
      z-index: 100; backdrop-filter: blur(4px);
    }
    .modal-overlay.hidden { display: none; }
    .modal {
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: 12px; padding: 1.75rem; max-width: 480px; width: 90%;
      position: relative; max-height: 80vh; overflow-y: auto;
    }
    .modal-close {
      position: absolute; top: 0.75rem; right: 1rem;
      background: none; border: none; color: var(--text-dim);
      font-size: 1.5rem; cursor: pointer; line-height: 1;
    }
    .modal-close:hover { color: var(--text); }
    .modal-badge {
      font-family: 'DM Mono', monospace; font-size: 0.75rem;
      display: inline-block; padding: 0.15rem 0.5rem; border-radius: 4px;
      margin-bottom: 0.75rem;
    }
    .modal h2 {
      font-size: 1.2rem; font-weight: 600; color: var(--text-bright);
      line-height: 1.3; margin-bottom: 1rem;
    }
    .modal-details { display: flex; flex-direction: column; gap: 0.5rem; }
    .modal-row { font-size: 0.85rem; color: var(--text); }
    .modal-row:empty { display: none; }
    .modal-row .label { color: var(--text-dim); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 0.1rem; }
    .modal-tags { display: flex; gap: 0.35rem; flex-wrap: wrap; margin-top: 0.5rem; }
    .modal-link {
      display: inline-block; margin-top: 1.25rem;
      color: var(--accent); font-size: 0.85rem; text-decoration: none;
      padding: 0.5rem 1rem; border: 1px solid var(--accent); border-radius: 6px;
      transition: all 0.2s;
    }
    .modal-link:hover { background: var(--accent); color: #fff; }
    
    /* === Responsive === */
    @media (max-width: 768px) {
      header { flex-direction: column; gap: 0.25rem; padding: 1.5rem 1rem 0.5rem; }
      .controls { padding: 0.75rem 1rem; }
      .events-grid { padding: 0 1rem 3rem; grid-template-columns: 1fr; }
      .events-list { padding: 0 0.5rem 3rem; }
      .events-list .row { 
        grid-template-columns: 2rem 1fr auto;
        gap: 0.5rem; font-size: 0.8rem;
        padding: 0.5rem;
      }
      .events-list .row .tags-col { display: none; }
      .stats { padding: 0.5rem 1rem; gap: 1rem; flex-wrap: wrap; }
      .spacer { display: none; }
      .sort-group { margin-left: auto; }
    }
    
    @media (max-width: 480px) {
      .events-grid { gap: 0.5rem; }
      .card { padding: 0.9rem 1rem; }
    }
    
    /* Hide one view */
    .events-grid.hidden, .events-list.hidden { display: none; }
  </style>
</head>
<body>
  <div id="pin-gate">
    <div class="logo">nyc tonight</div>
    <h1>What's on <em>tonight</em></h1>
    <input type="password" id="pin-input" maxlength="4" placeholder="· · · ·" autofocus>
    <div class="error" id="pin-error"></div>
  </div>
  
  <div id="app" style="display:none">
    <header>
      <div class="brand">
        <h1>NYC <span>Tonight</span></h1>
      </div>
      <div class="meta">${updated} ET</div>
    </header>
    
    <div class="stats" id="stats"></div>
    
    <div class="controls">
      <button class="refresh-btn" id="refresh-btn" onclick="triggerRefresh()">↻ Refresh</button>
      <span class="refresh-status" id="refresh-status"></span>
      <button class="pill active" data-filter="all">All</button>
      <button class="pill" data-filter="music">Music</button>
      <button class="pill teal" data-filter="cultural">Talks & Culture</button>
      <button class="pill film" data-filter="film">Film</button>
      
      <div class="spacer"></div>
      
      <div class="view-toggle">
        <button class="view-btn active" data-view="grid" title="Cards">▦</button>
        <button class="view-btn" data-view="list" title="List">☰</button>
      </div>
      
      <div class="sort-group">
        <span class="sort-label">sort</span>
        <button class="pill active" data-sort="score">Score</button>
        <button class="pill" data-sort="date">Date</button>
      </div>
    </div>
    
    <div class="events-grid" id="grid"></div>
    <div class="events-list hidden" id="list"></div>
    
    <!-- Detail Modal -->
    <div class="modal-overlay hidden" id="modal-overlay" onclick="closeModal()">
      <div class="modal" onclick="event.stopPropagation()">
        <button class="modal-close" onclick="closeModal()">×</button>
        <div class="modal-badge" id="modal-badge"></div>
        <h2 id="modal-title"></h2>
        <div class="modal-details">
          <div class="modal-row" id="modal-venue"></div>
          <div class="modal-row" id="modal-date"></div>
          <div class="modal-row" id="modal-artists"></div>
          <div class="modal-row" id="modal-desc"></div>
          <div class="modal-tags" id="modal-tags"></div>
        </div>
        <a class="modal-link" id="modal-link" href="#" target="_blank" rel="noopener">View original event page →</a>
      </div>
    </div>
    
    <footer>
      NYC Tonight · RA · ThoughtGallery · Film Forum · Taste-scored
    </footer>
  </div>
  
  <script>
    const EVENTS = ${eventsJson};
    const PIN = '7429';
    let currentFilter = 'all';
    let currentSort = 'score';
    let currentView = 'grid';
    
    // PIN gate
    const gate = document.getElementById('pin-gate');
    const pinInput = document.getElementById('pin-input');
    const pinError = document.getElementById('pin-error');
    
    if (localStorage.getItem('nyc-tonight-auth') === 'ok') {
      gate.classList.add('hidden');
      document.getElementById('app').style.display = 'block';
      renderAll();
    }
    
    pinInput.addEventListener('input', function() {
      if (this.value.length === 4) {
        if (this.value === PIN) {
          localStorage.setItem('nyc-tonight-auth', 'ok');
          gate.classList.add('hidden');
          document.getElementById('app').style.display = 'block';
          renderAll();
        } else {
          pinError.textContent = 'nope';
          this.value = '';
        }
      }
    });
    
    document.querySelectorAll('[data-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        renderAll();
      });
    });
    
    document.querySelectorAll('[data-sort]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-sort]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentSort = btn.dataset.sort;
        renderAll();
      });
    });
    
    document.querySelectorAll('[data-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-view]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentView = btn.dataset.view;
        document.getElementById('grid').classList.toggle('hidden', currentView !== 'grid');
        document.getElementById('list').classList.toggle('hidden', currentView !== 'list');
      });
    });
    
    function getFiltered() {
      let f = EVENTS;
      if (currentFilter === 'music') f = f.filter(e => e.type === 'music');
      else if (currentFilter === 'cultural') f = f.filter(e => e.type === 'cultural');
      else if (currentFilter === 'film') f = f.filter(e => e.type === 'film');
      
      if (currentSort === 'date') {
        f = [...f].sort((a, b) => (a.date || 'z').localeCompare(b.date || 'z'));
      } else {
        f = [...f].sort((a, b) => b.score - a.score);
      }
      return f;
    }
    
    function renderAll() {
      const filtered = getFiltered();
      
      const gold = filtered.filter(e => e.tier === 'gold').length;
      const silver = filtered.filter(e => e.tier === 'silver').length;
      const music = filtered.filter(e => e.type === 'music').length;
      const cultural = filtered.filter(e => e.type === 'cultural').length;
      const films = filtered.filter(e => e.type === 'film').length;
      
      document.getElementById('stats').innerHTML = 
        '<span><strong>' + filtered.length + '</strong> events</span>' +
        '<span><strong>' + music + '</strong> music</span>' +
        '<span><strong>' + cultural + '</strong> talks</span>' +
        '<span><strong>' + films + '</strong> films</span>' +
        (gold ? '<span><strong>' + gold + '</strong> top picks</span>' : '');
      
      lastFiltered = filtered;
      renderGrid(filtered);
      renderList(filtered);
    }
    
    function renderGrid(events) {
      const c = document.getElementById('grid');
      if (!events.length) { c.innerHTML = '<div class="empty">Nothing found.</div>'; return; }
      
      c.innerHTML = events.map((ev, i) => {
        const isFilm = ev.type === 'film';
        const tierClass = isFilm ? 'film-card' : ev.tier;
        const badgeClass = isFilm ? 'film-badge' : ev.tier;
        const artists = (ev.artists || []).filter(a => a !== ev.name).join(', ');
        const dateStr = ev.date ? fmtDate(ev.date) : '';
        const timeStr = ev.time ? ' · ' + fmtTime(ev.time) : '';
        
        return '<div class="card ' + tierClass + '" onclick="openModal(' + i + ')" style="cursor:pointer">' +
          '<div class="card-head">' +
            '<div class="card-title">' + esc(ev.name) + '</div>' +
            '<div class="badge ' + badgeClass + '">' + ev.score + '</div>' +
          '</div>' +
          '<div class="card-body">' +
            (ev.venue ? '<div class="venue">' + esc(ev.venue) + '</div>' : '') +
            (dateStr ? '<div>' + dateStr + timeStr + '</div>' : '') +
            (artists ? '<div class="artists">' + esc(artists) + '</div>' : '') +
            (ev.director ? '<div class="artists">dir. ' + esc(ev.director) + '</div>' : '') +
          '</div>' +
          '<div class="tags">' +
            (ev.breakdown?.matchedArtists?.length ? '<span class="tag match">♥ match</span>' : '') +
            (ev.breakdown?.noveltyBonus > 3 ? '<span class="tag discover">✦ discover</span>' : '') +
            (isFilm ? '<span class="tag film-tag">film</span>' : '') +
            (ev.genre && !isFilm ? '<span class="tag genre">' + esc(ev.genre) + '</span>' : '') +
            (ev.subGenre ? '<span class="tag genre">' + esc(ev.subGenre) + '</span>' : '') +
            '<span class="tag source">' + esc(ev.source) + '</span>' +
          '</div>' +
        '</div>';
      }).join('');
    }
    
    function renderList(events) {
      const c = document.getElementById('list');
      if (!events.length) { c.innerHTML = '<div class="empty">Nothing found.</div>'; return; }
      
      c.innerHTML = events.map((ev, i) => {
        const isFilm = ev.type === 'film';
        const scoreClass = isFilm ? 'film-score' : ev.tier;
        const dateStr = ev.date ? fmtDateShort(ev.date) : '';
        
        return '<div class="row ' + (ev.tier === 'dim' && !isFilm ? 'dim' : '') + '" onclick="openModal(' + i + ')" style="cursor:pointer">' +
          '<div class="score ' + scoreClass + '">' + ev.score + '</div>' +
          '<div class="info">' +
            '<div class="title-line">' + esc(ev.name) + '</div>' +
            '<div class="venue-line">' + esc(ev.venue || '') + '</div>' +
          '</div>' +
          '<div class="date-col">' + dateStr + '</div>' +
          '<div class="tags-col">' +
            (ev.breakdown?.matchedArtists?.length ? '<span class="mini-tag match">♥</span>' : '') +
            '<span class="mini-tag source">' + esc(ev.source) + '</span>' +
          '</div>' +
        '</div>';
      }).join('');
    }
    
    function fmtDate(d) {
      try {
        const date = new Date(d + 'T12:00:00');
        const today = new Date(); today.setHours(0,0,0,0);
        const diff = Math.floor((date - today) / 86400000);
        if (diff === 0) return 'Today';
        if (diff === 1) return 'Tomorrow';
        return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      } catch { return d; }
    }
    
    function fmtDateShort(d) {
      try {
        const date = new Date(d + 'T12:00:00');
        const today = new Date(); today.setHours(0,0,0,0);
        const diff = Math.floor((date - today) / 86400000);
        if (diff === 0) return 'today';
        if (diff === 1) return 'tmrw';
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } catch { return d; }
    }
    
    function fmtTime(t) {
      try {
        const [h, m] = t.split(':');
        const hour = parseInt(h);
        return (hour % 12 || 12) + ':' + m + (hour >= 12 ? 'p' : 'a');
      } catch { return t; }
    }
    
    let lastFiltered = [];
    
    function openModal(idx) {
      const ev = lastFiltered[idx];
      if (!ev) return;
      
      const isFilm = ev.type === 'film';
      const badgeClass = isFilm ? 'film-badge' : ev.tier;
      const artists = (ev.artists || []).filter(a => a !== ev.name).join(', ');
      const dateStr = ev.date ? fmtDate(ev.date) : '';
      const timeStr = ev.time ? fmtTime(ev.time) : '';
      
      const badge = document.getElementById('modal-badge');
      badge.textContent = ev.score + ' pts';
      badge.className = 'modal-badge badge ' + badgeClass;
      
      document.getElementById('modal-title').textContent = ev.name;
      
      const venueEl = document.getElementById('modal-venue');
      venueEl.innerHTML = ev.venue ? '<span class="label">Venue</span>' + esc(ev.venue) : '';
      
      const dateEl = document.getElementById('modal-date');
      dateEl.innerHTML = (dateStr || timeStr) ? '<span class="label">When</span>' + [dateStr, timeStr].filter(Boolean).join(' · ') : '';
      
      const artistEl = document.getElementById('modal-artists');
      if (artists) {
        artistEl.innerHTML = '<span class="label">Artists</span>' + esc(artists);
      } else if (ev.director) {
        artistEl.innerHTML = '<span class="label">Director</span>' + esc(ev.director);
      } else {
        artistEl.innerHTML = '';
      }
      
      const descEl = document.getElementById('modal-desc');
      descEl.innerHTML = ev.description ? '<span class="label">About</span>' + esc(ev.description) : '';
      
      const tagsEl = document.getElementById('modal-tags');
      let tagsHtml = '';
      if (ev.breakdown?.matchedArtists?.length) tagsHtml += '<span class="tag match">♥ taste match</span>';
      if (ev.breakdown?.noveltyBonus > 3) tagsHtml += '<span class="tag discover">✦ discovery pick</span>';
      if (isFilm) tagsHtml += '<span class="tag film-tag">film</span>';
      if (ev.genre) tagsHtml += '<span class="tag genre">' + esc(ev.genre) + '</span>';
      if (ev.subGenre) tagsHtml += '<span class="tag genre">' + esc(ev.subGenre) + '</span>';
      tagsHtml += '<span class="tag source">' + esc(ev.source) + '</span>';
      tagsEl.innerHTML = tagsHtml;
      
      const linkEl = document.getElementById('modal-link');
      if (ev.url) {
        linkEl.href = ev.url;
        linkEl.style.display = 'inline-block';
      } else {
        linkEl.style.display = 'none';
      }
      
      document.getElementById('modal-overlay').classList.remove('hidden');
    }
    
    function closeModal() {
      document.getElementById('modal-overlay').classList.add('hidden');
    }
    
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeModal();
    });
    
    function esc(s) {
      const d = document.createElement('div');
      d.textContent = s || '';
      return d.innerHTML;
    }
    
    async function triggerRefresh() {
      const btn = document.getElementById('refresh-btn');
      const status = document.getElementById('refresh-status');
      
      // Check if a GitHub PAT is configured
      const token = localStorage.getItem('nyc-tonight-gh-token');
      
      if (token) {
        // Use PAT to trigger GitHub Actions
        btn.disabled = true;
        btn.textContent = '↻ Rebuilding...';
        status.textContent = 'Triggering build...';
        
        try {
          const res = await fetch('https://api.github.com/repos/dontworryaboutit-thanks/nyc-tonight/actions/workflows/daily.yml/dispatches', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github.v3+json' },
            body: JSON.stringify({ ref: 'main' })
          });
          
          if (res.status === 204) {
            status.textContent = 'Build triggered — reload in ~2 min';
            status.style.color = 'var(--teal)';
          } else {
            if (res.status === 401 || res.status === 403) localStorage.removeItem('nyc-tonight-gh-token');
            status.textContent = 'Error ' + res.status + ' — try again';
            status.style.color = '#e04040';
          }
        } catch (err) {
          status.textContent = 'Network error';
          status.style.color = '#e04040';
        }
        setTimeout(() => { btn.disabled = false; btn.textContent = '↻ Refresh'; }, 10000);
      } else {
        // No PAT — just reload the page (data updates via cron)
        status.textContent = 'Data updates automatically. Reloading page...';
        status.style.color = 'var(--teal)';
        setTimeout(() => location.reload(), 800);
      }
    }
  </script>
</body>
</html>`;

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'index.html'), html);
  console.log(`[build-site] Written to ${path.join(outputDir, 'index.html')}`);
}

module.exports = { buildSite };
