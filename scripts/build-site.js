const fs = require('fs');
const path = require('path');

function buildSite(events, outputDir) {
  console.log(`[build-site] Generating site with ${events.length} events...`);

  const now = new Date();
  const updated = now.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
  const todayNY = now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

  const sources = [...new Set(events.map(e => e.source))].sort();
  const eventsJson = JSON.stringify(events);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NYC Tonight</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..700;1,9..40,400&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    :root { color-scheme: dark light; }

    [data-theme="light"] {
      --bg: #faf8f4;
      --bg-card: #ffffff;
      --bg-card-hover: #f6f3ee;
      --bg-inset: #f1ede6;
      --border: #e7e2d9;
      --border-soft: #efebe3;
      --text: #46413a;
      --text-dim: #97907f;
      --text-bright: #1f1b16;
      --accent: #bf4e18;
      --accent-glow: rgba(191, 78, 24, 0.09);
      --accent-light: #d4622b;
      --teal: #2d7a6c;
      --teal-dim: rgba(45, 122, 108, 0.09);
      --gold: #a97c08;
      --gold-bg: rgba(184, 134, 11, 0.09);
      --silver: #6b7280;
      --silver-bg: rgba(107, 114, 128, 0.07);
      --bronze: #92631e;
      --bronze-bg: rgba(146, 99, 30, 0.07);
      --dim: #b0a89d;
      --film: #6b5b95;
      --film-bg: rgba(107, 91, 149, 0.09);
      --shadow: 0 2px 12px rgba(60, 50, 30, 0.07);
      --shadow-hover: 0 4px 18px rgba(60, 50, 30, 0.11);
    }

    [data-theme="dark"] {
      --bg: #0d1017;
      --bg-card: #131722;
      --bg-card-hover: #191f2c;
      --bg-inset: #10141d;
      --border: #202636;
      --border-soft: #1a1f2d;
      --text: #c3c8d2;
      --text-dim: #616a7e;
      --text-bright: #edeff4;
      --accent: #d4622b;
      --accent-glow: rgba(212, 98, 43, 0.14);
      --accent-light: #e8854f;
      --teal: #4a9e8e;
      --teal-dim: rgba(74, 158, 142, 0.12);
      --gold: #d4a02b;
      --gold-bg: rgba(212, 160, 43, 0.1);
      --silver: #8892a4;
      --silver-bg: rgba(136, 146, 164, 0.08);
      --bronze: #a06830;
      --bronze-bg: rgba(160, 104, 48, 0.08);
      --dim: #3e4453;
      --film: #8474b8;
      --film-bg: rgba(123, 104, 174, 0.12);
      --shadow: 0 2px 12px rgba(0, 0, 0, 0.25);
      --shadow-hover: 0 6px 22px rgba(0, 0, 0, 0.35);
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
      padding: 2.25rem 2rem 0.25rem;
      max-width: 1180px; margin: 0 auto;
      display: flex; justify-content: space-between; align-items: baseline;
    }
    .brand h1 {
      font-size: 1.45rem; font-weight: 700; color: var(--text-bright);
      letter-spacing: -0.03em;
    }
    .brand h1 span { color: var(--accent); font-weight: 300; font-style: italic; }
    .brand .tagline {
      color: var(--text-dim); font-size: 0.78rem; margin-top: 0.15rem;
    }
    .header-right { display: flex; align-items: center; gap: 0.6rem; }
    .meta {
      color: var(--text-dim); font-size: 0.7rem;
      font-family: 'DM Mono', monospace;
    }

    /* === Controls === */
    .controls {
      position: sticky; top: 0; z-index: 50;
      background: color-mix(in srgb, var(--bg) 88%, transparent);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid var(--border-soft);
    }
    .controls-inner {
      padding: 0.75rem 2rem;
      max-width: 1180px; margin: 0 auto;
      display: flex; gap: 0.5rem; flex-wrap: wrap;
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

    .pill-group {
      display: flex; gap: 0.35rem; align-items: center;
      padding-right: 0.75rem; margin-right: 0.25rem;
      border-right: 1px solid var(--border-soft);
    }
    .pill-group:last-of-type { border-right: none; }

    .search-box {
      background: var(--bg-card); border: 1px solid var(--border);
      color: var(--text); font-family: inherit; font-size: 0.78rem;
      padding: 0.35rem 0.85rem; border-radius: 20px; width: 150px;
      outline: none; transition: all 0.15s;
    }
    .search-box:focus { border-color: var(--accent); width: 200px; }
    .search-box::placeholder { color: var(--text-dim); }

    .spacer { flex: 1; }

    .view-toggle {
      display: flex; border: 1px solid var(--border); border-radius: 20px; overflow: hidden;
    }
    .view-btn {
      background: transparent; border: none; color: var(--text-dim);
      padding: 0.35rem 0.7rem; cursor: pointer; font-size: 0.78rem;
      transition: all 0.15s; font-family: inherit;
    }
    .view-btn:hover { color: var(--text); }
    .view-btn.active { background: var(--bg-inset); color: var(--accent); font-weight: 500; }
    .view-btn + .view-btn { border-left: 1px solid var(--border-soft); }

    /* === Stats === */
    .stats {
      max-width: 1180px; margin: 0 auto;
      padding: 0.6rem 2rem 0.25rem;
      display: flex; gap: 1.5rem;
      font-size: 0.72rem; color: var(--text-dim);
      font-family: 'DM Mono', monospace;
    }
    .stats strong { color: var(--accent); font-weight: 500; }

    /* === Day headers === */
    .day-header {
      grid-column: 1 / -1;
      display: flex; align-items: baseline; gap: 0.6rem;
      padding: 1.6rem 0 0.5rem;
      border-bottom: 1px solid var(--border-soft);
      margin-bottom: 0.35rem;
    }
    .day-header:first-child { padding-top: 0.5rem; }
    .day-header .day-name {
      font-size: 1.02rem; font-weight: 700; color: var(--text-bright);
      letter-spacing: -0.01em;
    }
    .day-header .day-name.tonight { color: var(--accent); }
    .day-header .day-date {
      font-family: 'DM Mono', monospace;
      font-size: 0.7rem; color: var(--text-dim);
    }
    .day-header .day-count {
      font-family: 'DM Mono', monospace;
      font-size: 0.7rem; color: var(--text-dim); margin-left: auto;
    }

    /* === Card Grid === */
    .events-grid {
      max-width: 1180px; margin: 0.5rem auto;
      padding: 0 2rem 4rem;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(330px, 1fr));
      gap: 0.7rem;
    }

    .card {
      background: var(--bg-card);
      border: 1px solid var(--border-soft);
      border-radius: 12px;
      padding: 1rem 1.15rem;
      transition: transform 0.15s, box-shadow 0.15s, background 0.15s;
      position: relative;
      box-shadow: var(--shadow);
    }
    .card:hover {
      background: var(--bg-card-hover);
      transform: translateY(-1px);
      box-shadow: var(--shadow-hover);
    }
    .card-img {
      width: 100%; height: 140px; object-fit: cover;
      border-radius: 8px; margin-bottom: 0.6rem;
      background: var(--border);
    }
    .card.gold { box-shadow: inset 3px 0 0 var(--gold), var(--shadow); }
    .card.silver { box-shadow: inset 3px 0 0 var(--silver), var(--shadow); }
    .card.gold:hover { box-shadow: inset 3px 0 0 var(--gold), var(--shadow-hover); }
    .card.silver:hover { box-shadow: inset 3px 0 0 var(--silver), var(--shadow-hover); }
    .card.gold .card-title, .card.silver .card-title { font-weight: 700; }
    .card.film-card { box-shadow: inset 3px 0 0 var(--film), var(--shadow); }
    .card.film-card:hover { box-shadow: inset 3px 0 0 var(--film), var(--shadow-hover); }

    .card-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.6rem; }
    .card-title {
      font-size: 0.94rem; font-weight: 600; color: var(--text-bright);
      line-height: 1.35;
    }

    .badge {
      flex-shrink: 0;
      font-family: 'DM Mono', monospace;
      font-size: 0.68rem; font-weight: 500;
      padding: 0.15rem 0.45rem; border-radius: 5px;
      min-width: 2rem; text-align: center;
    }
    .badge.gold { background: var(--gold-bg); color: var(--gold); }
    .badge.silver { background: var(--silver-bg); color: var(--silver); }
    .badge.bronze { background: var(--bronze-bg); color: var(--bronze); }
    .badge.dim { background: var(--bg-inset); color: var(--dim); }
    .badge.film-badge { background: var(--film-bg); color: var(--film); }

    .card-body {
      margin-top: 0.5rem;
      display: flex; flex-direction: column; gap: 0.22rem;
      font-size: 0.79rem; color: var(--text-dim);
    }
    .venue { color: var(--text); font-weight: 500; }
    .when { font-size: 0.75rem; }
    .artists {
      font-style: italic;
      display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .tags {
      margin-top: 0.55rem;
      display: flex; gap: 0.3rem; flex-wrap: wrap;
    }
    .tag {
      font-size: 0.64rem; padding: 0.12rem 0.45rem;
      border-radius: 10px;
    }
    .tag.match { background: var(--accent-glow); color: var(--accent-light); }
    .tag.discover { background: var(--teal-dim); color: var(--teal); }
    .tag.free-tag { background: var(--teal-dim); color: var(--teal); }
    .tag.source { background: var(--bg-inset); color: var(--text-dim); }
    .tag.genre { background: var(--bg-inset); color: var(--text-dim); }
    .tag.film-tag { background: var(--film-bg); color: var(--film); }

    /* === List View === */
    .events-list {
      max-width: 1180px; margin: 0.5rem auto;
      padding: 0 2rem 4rem;
      display: flex; flex-direction: column;
    }
    .events-list .row {
      display: grid;
      grid-template-columns: 3.2rem 1fr 2.4rem;
      gap: 0.75rem;
      align-items: center;
      padding: 0.55rem 0.6rem;
      border-radius: 8px;
      transition: background 0.1s;
      font-size: 0.85rem;
    }
    .events-list .row + .row { border-top: 1px solid var(--border-soft); }
    .events-list .row:hover { background: var(--bg-card); }
    .events-list .row.gold .title-line, .events-list .row.silver .title-line { font-weight: 700; }

    .row .score {
      font-family: 'DM Mono', monospace;
      font-size: 0.72rem; font-weight: 500;
      text-align: right;
    }
    .row .score.gold { color: var(--gold); }
    .row .score.silver { color: var(--silver); }
    .row .score.bronze { color: var(--bronze); }
    .row .score.dim { color: var(--dim); }
    .row .score.film-score { color: var(--film); }

    .row .time-col {
      font-family: 'DM Mono', monospace;
      font-size: 0.68rem; color: var(--text-dim);
      white-space: nowrap; text-align: right;
    }
    .row .info { min-width: 0; }
    .row .title-line {
      font-weight: 500; color: var(--text-bright);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .row .venue-line {
      font-size: 0.74rem; color: var(--text-dim);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .row .venue-line .v { color: var(--text); }
    .row .mini-tag {
      font-size: 0.6rem; padding: 0.05rem 0.35rem;
      border-radius: 8px; margin-left: 0.3rem;
    }
    .row .mini-tag.match { background: var(--accent-glow); color: var(--accent-light); }
    .row .mini-tag.free { background: var(--teal-dim); color: var(--teal); }
    .row .mini-tag.source { background: var(--bg-inset); color: var(--text-dim); }

    /* === Empty === */
    .empty {
      text-align: center; padding: 4rem 2rem;
      color: var(--text-dim); font-style: italic;
      grid-column: 1 / -1;
    }

    /* === Footer === */
    footer {
      text-align: center; padding: 2rem 2rem 2.5rem;
      color: var(--text-dim); font-size: 0.68rem;
      font-family: 'DM Mono', monospace;
      line-height: 1.8;
    }
    footer a { color: var(--accent); text-decoration: none; }
    .theme-toggle {
      background: var(--bg-card); border: 1px solid var(--border);
      color: var(--text); padding: 0.3rem 0.5rem; border-radius: 50%;
      cursor: pointer; font-size: 0.9rem; line-height: 1;
      transition: all 0.2s; width: 1.9rem; height: 1.9rem;
      display: flex; align-items: center; justify-content: center;
    }
    .theme-toggle:hover { border-color: var(--accent); }

    .refresh-btn {
      background: transparent; border: 1px solid var(--border);
      color: var(--text-dim); padding: 0.3rem 0.7rem; border-radius: 20px;
      cursor: pointer; font-family: 'DM Mono', monospace; font-size: 0.68rem;
      transition: all 0.2s;
    }
    .refresh-btn:hover { color: var(--accent); border-color: var(--accent); }
    .refresh-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .refresh-status { font-size: 0.65rem; color: var(--teal); }

    /* Modal */
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.55);
      display: flex; align-items: center; justify-content: center;
      z-index: 100; backdrop-filter: blur(4px);
    }
    .modal-overlay.hidden { display: none; }
    .modal {
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: 14px; padding: 1.75rem; max-width: 480px; width: 90%;
      position: relative; max-height: 80vh; overflow-y: auto;
      box-shadow: var(--shadow-hover);
    }
    .modal-close {
      position: absolute; top: 0.75rem; right: 1rem;
      background: none; border: none; color: var(--text-dim);
      font-size: 1.5rem; cursor: pointer; line-height: 1;
    }
    .modal-close:hover { color: var(--text); }
    .modal-badge {
      font-family: 'DM Mono', monospace; font-size: 0.75rem;
      display: inline-block; padding: 0.15rem 0.5rem; border-radius: 5px;
      margin-bottom: 0.75rem;
    }
    .modal h2 {
      font-size: 1.2rem; font-weight: 600; color: var(--text-bright);
      line-height: 1.3; margin-bottom: 1rem;
    }
    .modal-details { display: flex; flex-direction: column; gap: 0.5rem; }
    .modal-row { font-size: 0.85rem; color: var(--text); }
    .modal-row:empty { display: none; }
    .modal-row .label { color: var(--text-dim); font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 0.1rem; }
    .modal-tags { display: flex; gap: 0.35rem; flex-wrap: wrap; margin-top: 0.5rem; }
    .modal-link {
      display: inline-block; margin-top: 1.25rem;
      color: var(--accent); font-size: 0.85rem; text-decoration: none;
      padding: 0.5rem 1rem; border: 1px solid var(--accent); border-radius: 8px;
      transition: all 0.2s;
    }
    .modal-link:hover { background: var(--accent); color: #fff; }

    /* === Responsive === */
    @media (max-width: 768px) {
      header { flex-direction: column; gap: 0.4rem; padding: 1.25rem 1rem 0.25rem; }
      .header-right { align-self: flex-end; margin-top: -1.75rem; }
      .brand .tagline { display: none; }
      .controls-inner { padding: 0.6rem 1rem; gap: 0.35rem; }
      .pill-group { padding-right: 0.5rem; }
      .pill { padding: 0.3rem 0.65rem; font-size: 0.72rem; }
      .search-box { width: 110px; }
      .search-box:focus { width: 140px; }
      .events-grid { padding: 0 1rem 3rem; grid-template-columns: 1fr; }
      .events-list { padding: 0 0.5rem 3rem; }
      .events-list .row {
        grid-template-columns: 2.6rem 1fr 2rem;
        gap: 0.5rem; font-size: 0.8rem;
        padding: 0.5rem 0.4rem;
      }
      .stats { padding: 0.5rem 1rem 0.25rem; gap: 1rem; flex-wrap: wrap; }
      .day-header { padding: 1.25rem 0.4rem 0.4rem; }
      .spacer { display: none; }
    }

    @media (max-width: 480px) {
      .events-grid { gap: 0.5rem; }
      .card { padding: 0.9rem 1rem; }
    }

    /* Map */
    .events-map {
      max-width: 1180px; margin: 0.5rem auto;
      padding: 0 2rem 4rem;
    }
    .events-map.hidden { display: none; }
    .leaflet-popup-content { font-family: 'DM Sans', sans-serif; font-size: 0.8rem; }
    .leaflet-popup-content strong { color: var(--accent); }
    .map-popup-score { font-family: 'DM Mono', monospace; font-size: 0.7rem; }

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
        <div class="tagline">events across the city, scored to your taste</div>
      </div>
      <div class="header-right">
        <button class="theme-toggle" id="theme-toggle" onclick="toggleTheme()" title="Toggle light/dark mode">☀</button>
        <div class="meta">updated ${updated} ET</div>
      </div>
    </header>

    <div class="stats" id="stats"></div>

    <div class="controls">
      <div class="controls-inner">
        <div class="pill-group">
          <button class="pill active" data-range="week">Next 7 days</button>
          <button class="pill" data-range="tonight">Tonight</button>
          <button class="pill" data-range="all">Everything</button>
        </div>
        <div class="pill-group">
          <button class="pill active" data-filter="all">All</button>
          <button class="pill" data-filter="music">Music</button>
          <button class="pill teal" data-filter="cultural">Talks & Culture</button>
          <button class="pill film" data-filter="film">Film</button>
        </div>
        <input type="search" class="search-box" id="search" placeholder="Search…" autocomplete="off">

        <div class="spacer"></div>

        <div class="view-toggle">
          <button class="view-btn active" data-view="list">List</button>
          <button class="view-btn" data-view="grid">Cards</button>
          <button class="view-btn" data-view="map">Map</button>
        </div>
      </div>
    </div>

    <div class="events-grid hidden" id="grid"></div>
    <div class="events-list" id="list"></div>
    <div class="events-map hidden" id="map-container">
      <div id="map" style="width:100%;height:600px;border-radius:12px;border:1px solid var(--border)"></div>
    </div>

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
      <button class="refresh-btn" id="refresh-btn" onclick="triggerRefresh()">↻ refresh data</button>
      <span class="refresh-status" id="refresh-status"></span><br>
      sources: ${sources.join(' · ')}<br>
      rebuilt nightly · scored against your taste profile
    </footer>
  </div>

  <script>
    const EVENTS = ${eventsJson};
    const TODAY = '${todayNY}';
    const PIN = '7429';
    let currentFilter = 'all';
    let currentRange = 'week';
    let currentView = 'list';
    let searchQuery = '';
    let lastFiltered = [];

    // Theme
    function initTheme() {
      const saved = localStorage.getItem('nyc-tonight-theme') || 'dark';
      document.documentElement.setAttribute('data-theme', saved);
      updateThemeIcon(saved);
    }
    function toggleTheme() {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('nyc-tonight-theme', next);
      updateThemeIcon(next);
    }
    function updateThemeIcon(theme) {
      const btn = document.getElementById('theme-toggle');
      if (btn) btn.textContent = theme === 'dark' ? '☀' : '🌙';
    }
    initTheme();

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

    document.querySelectorAll('[data-range]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-range]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentRange = btn.dataset.range;
        renderAll();
      });
    });

    let searchTimer = null;
    document.getElementById('search').addEventListener('input', function() {
      clearTimeout(searchTimer);
      const v = this.value;
      searchTimer = setTimeout(() => { searchQuery = v.trim().toLowerCase(); renderAll(); }, 150);
    });

    document.querySelectorAll('[data-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-view]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentView = btn.dataset.view;
        document.getElementById('grid').classList.toggle('hidden', currentView !== 'grid');
        document.getElementById('list').classList.toggle('hidden', currentView !== 'list');
        document.getElementById('map-container').classList.toggle('hidden', currentView !== 'map');
        if (currentView === 'map') initMap();
        renderAll();
      });
    });

    function addDays(dateStr, n) {
      const d = new Date(dateStr + 'T12:00:00');
      d.setDate(d.getDate() + n);
      return d.toISOString().slice(0, 10);
    }

    function getFiltered() {
      let f = EVENTS;
      if (currentFilter !== 'all') f = f.filter(e => e.type === currentFilter);

      // Range: dateless films count as "now showing" and appear in every range
      if (currentRange === 'tonight') {
        f = f.filter(e => !e.date ? e.type === 'film' : e.date === TODAY);
      } else if (currentRange === 'week') {
        const end = addDays(TODAY, 7);
        f = f.filter(e => !e.date ? e.type === 'film' : (e.date >= TODAY && e.date < end));
      }

      if (searchQuery) {
        f = f.filter(e =>
          (e.name || '').toLowerCase().includes(searchQuery) ||
          (e.venue || '').toLowerCase().includes(searchQuery) ||
          (e.artists || []).some(a => a.toLowerCase().includes(searchQuery)) ||
          (e.genre || '').toLowerCase().includes(searchQuery)
        );
      }
      return f;
    }

    // Group by day (chronological), score-sorted within each day.
    // Dateless films form a trailing "Now Showing" group.
    function groupByDay(events) {
      const byDay = new Map();
      const undated = [];
      for (const ev of events) {
        if (!ev.date) { undated.push(ev); continue; }
        if (!byDay.has(ev.date)) byDay.set(ev.date, []);
        byDay.get(ev.date).push(ev);
      }
      const groups = [...byDay.keys()].sort().map(date => ({
        date,
        events: byDay.get(date).sort((a, b) => b.score - a.score)
      }));
      if (undated.length) {
        groups.push({ date: null, events: undated.sort((a, b) => b.score - a.score) });
      }
      return groups;
    }

    function dayLabel(date) {
      if (!date) return { name: 'Now Showing', date: 'repertory & first-run', cls: '' };
      const d = new Date(date + 'T12:00:00');
      const t = new Date(TODAY + 'T12:00:00');
      const diff = Math.round((d - t) / 86400000);
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (diff === 0) return { name: 'Tonight', date: dateStr, cls: 'tonight' };
      if (diff === 1) return { name: 'Tomorrow', date: dateStr, cls: '' };
      return { name: d.toLocaleDateString('en-US', { weekday: 'long' }), date: dateStr, cls: '' };
    }

    function renderAll() {
      const filtered = getFiltered();
      const groups = groupByDay(filtered);
      // Flat order matching render order, for modal indexing
      lastFiltered = groups.flatMap(g => g.events);

      const tonight = filtered.filter(e => e.date === TODAY).length;
      const top = filtered.filter(e => e.tier === 'gold' || e.tier === 'silver').length;
      document.getElementById('stats').innerHTML =
        '<span><strong>' + filtered.length + '</strong> events</span>' +
        '<span><strong>' + tonight + '</strong> tonight</span>' +
        (top ? '<span><strong>' + top + '</strong> top picks</span>' : '');

      renderGrid(groups);
      renderList(groups);
    }

    function renderGrid(groups) {
      const c = document.getElementById('grid');
      if (!lastFiltered.length) { c.innerHTML = '<div class="empty">Nothing found — try widening the range or clearing the search.</div>'; return; }

      let idx = 0;
      c.innerHTML = groups.map(g => {
        const label = dayLabel(g.date);
        const header = '<div class="day-header">' +
          '<span class="day-name ' + label.cls + '">' + label.name + '</span>' +
          '<span class="day-date">' + label.date + '</span>' +
          '<span class="day-count">' + g.events.length + '</span>' +
        '</div>';

        const cards = g.events.map(ev => {
          const i = idx++;
          const isFilm = ev.type === 'film';
          const tierClass = isFilm ? 'film-card' : ev.tier;
          const badgeClass = isFilm ? 'film-badge' : ev.tier;
          const allArtists = (ev.artists || []).filter(a => a !== ev.name);
          const artists = allArtists.length > 4
            ? allArtists.slice(0, 4).join(', ') + ' +' + (allArtists.length - 4) + ' more'
            : allArtists.join(', ');
          const timeStr = ev.time ? fmtTime(ev.time) : '';
          const showImg = ev.image && ev.score >= 40;
          const isFree = ev.genre === 'free';

          return '<div class="card ' + tierClass + '" onclick="openModal(' + i + ')" style="cursor:pointer">' +
            (showImg ? '<img class="card-img" src="' + esc(ev.image) + '" alt="" loading="lazy" onerror="this.remove()">' : '') +
            '<div class="card-head">' +
              '<div class="card-title">' + esc(ev.name) + '</div>' +
              '<div class="badge ' + badgeClass + '">' + ev.score + '</div>' +
            '</div>' +
            '<div class="card-body">' +
              (ev.venue ? '<div class="venue">' + esc(ev.venue) + '</div>' : '') +
              (timeStr ? '<div class="when">' + timeStr + '</div>' : '') +
              (artists ? '<div class="artists">' + esc(artists) + '</div>' : '') +
              (ev.director ? '<div class="artists">dir. ' + esc(ev.director) + '</div>' : '') +
            '</div>' +
            '<div class="tags">' +
              (ev.breakdown?.matchedArtists?.length ? '<span class="tag match">♥ match</span>' : '') +
              (ev.breakdown?.noveltyBonus > 3 ? '<span class="tag discover">✦ discover</span>' : '') +
              (isFree ? '<span class="tag free-tag">free</span>' : '') +
              (isFilm ? '<span class="tag film-tag">film</span>' : '') +
              (ev.genre && !isFilm && !isFree ? '<span class="tag genre">' + esc(ev.genre) + '</span>' : '') +
              '<span class="tag source">' + esc(ev.source) + '</span>' +
            '</div>' +
          '</div>';
        }).join('');

        return header + cards;
      }).join('');
    }

    function renderList(groups) {
      const c = document.getElementById('list');
      if (!lastFiltered.length) { c.innerHTML = '<div class="empty">Nothing found — try widening the range or clearing the search.</div>'; return; }

      let idx = 0;
      c.innerHTML = groups.map(g => {
        const label = dayLabel(g.date);
        const header = '<div class="day-header">' +
          '<span class="day-name ' + label.cls + '">' + label.name + '</span>' +
          '<span class="day-date">' + label.date + '</span>' +
          '<span class="day-count">' + g.events.length + '</span>' +
        '</div>';

        const rows = g.events.map(ev => {
          const i = idx++;
          const isFilm = ev.type === 'film';
          const scoreClass = isFilm ? 'film-score' : ev.tier;
          const timeStr = ev.time ? fmtTime(ev.time) : '';
          const isFree = ev.genre === 'free';

          return '<div class="row ' + ev.tier + '" onclick="openModal(' + i + ')" style="cursor:pointer">' +
            '<div class="time-col">' + (timeStr || '—') + '</div>' +
            '<div class="info">' +
              '<div class="title-line">' + esc(ev.name) + '</div>' +
              '<div class="venue-line"><span class="v">' + esc(ev.venue || '') + '</span>' +
                (ev.breakdown?.matchedArtists?.length ? '<span class="mini-tag match">♥</span>' : '') +
                (isFree ? '<span class="mini-tag free">free</span>' : '') +
                '<span class="mini-tag source">' + esc(ev.source) + '</span>' +
              '</div>' +
            '</div>' +
            '<div class="score ' + scoreClass + '">' + ev.score + '</div>' +
          '</div>';
        }).join('');

        return header + rows;
      }).join('');
    }

    function fmtDate(d) {
      if (!d) return '';
      try {
        const date = new Date(d + 'T12:00:00');
        const today = new Date(TODAY + 'T12:00:00');
        const diff = Math.round((date - today) / 86400000);
        if (diff === 0) return 'Today';
        if (diff === 1) return 'Tomorrow';
        return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      } catch { return d; }
    }

    function fmtTime(t) {
      try {
        const [h, m] = t.split(':');
        const hour = parseInt(h);
        return (hour % 12 || 12) + ':' + m + (hour >= 12 ? 'p' : 'a');
      } catch { return t; }
    }

    function openModal(idx) {
      const ev = lastFiltered[idx];
      if (!ev) return;

      const isFilm = ev.type === 'film';
      const badgeClass = isFilm ? 'film-badge' : ev.tier;
      const artists = (ev.artists || []).filter(a => a !== ev.name).join(', ');
      const dateStr = ev.date ? fmtDate(ev.date) : (isFilm ? 'Now showing' : '');
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

    let mapInstance = null;
    function initMap() {
      if (mapInstance) { mapInstance.invalidateSize(); return; }

      const filtered = lastFiltered.filter(e => e.lat && e.lng && e.score >= 30);

      mapInstance = L.map('map').setView([40.7280, -73.9800], 12);

      const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
      L.tileLayer(isDark
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        { attribution: '&copy; OSM &copy; CARTO', maxZoom: 18 }
      ).addTo(mapInstance);

      // Group events by venue (lat+lng)
      const venues = {};
      for (const ev of filtered) {
        const key = ev.lat + ',' + ev.lng;
        if (!venues[key]) venues[key] = { lat: ev.lat, lng: ev.lng, venue: ev.venue, events: [] };
        venues[key].events.push(ev);
      }

      for (const v of Object.values(venues)) {
        const topScore = Math.max(...v.events.map(e => e.score));
        const color = topScore >= 60 ? '#d4a02b' : topScore >= 40 ? '#d4622b' : '#4a9e8e';
        const radius = Math.max(6, Math.min(14, topScore / 5));

        const marker = L.circleMarker([v.lat, v.lng], {
          radius, fillColor: color, color: '#fff', weight: 1, fillOpacity: 0.8
        }).addTo(mapInstance);

        const eventList = v.events
          .sort((a, b) => b.score - a.score)
          .slice(0, 8)
          .map(e => '<div style="margin:3px 0"><span class="map-popup-score">[' + e.score + ']</span> <strong>' + esc(e.name).substring(0, 40) + '</strong>' +
            (e.date ? '<br><span style="opacity:0.6">' + fmtDate(e.date) + '</span>' : '') + '</div>')
          .join('');

        const more = v.events.length > 8 ? '<div style="opacity:0.5">+' + (v.events.length - 8) + ' more</div>' : '';

        marker.bindPopup(
          '<div style="max-width:220px"><strong style="font-size:0.9rem">' + esc(v.venue) + '</strong>' +
          '<div style="margin-top:6px">' + eventList + more + '</div></div>',
          { maxWidth: 250 }
        );
      }
    }

    async function triggerRefresh() {
      const btn = document.getElementById('refresh-btn');
      const status = document.getElementById('refresh-status');

      // Check if a GitHub PAT is configured
      const token = localStorage.getItem('nyc-tonight-gh-token');

      if (token) {
        // Use PAT to trigger GitHub Actions
        btn.disabled = true;
        btn.textContent = '↻ rebuilding...';
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
        setTimeout(() => { btn.disabled = false; btn.textContent = '↻ refresh data'; }, 10000);
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
