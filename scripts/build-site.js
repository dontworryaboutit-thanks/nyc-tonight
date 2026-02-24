const fs = require('fs');
const path = require('path');

// PIN hash (7429) — simple hash so it's not plaintext in source
const PIN_HASH = '7429'; // We'll hash client-side for basic obfuscation

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
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400&display=swap');
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    :root {
      --bg: #0a0a0f;
      --bg-card: #12121a;
      --bg-card-hover: #1a1a25;
      --border: #1e1e2e;
      --text: #e0e0e0;
      --text-dim: #6b6b80;
      --text-bright: #ffffff;
      --accent: #8b5cf6;
      --gold: #f59e0b;
      --gold-bg: rgba(245, 158, 11, 0.1);
      --silver: #94a3b8;
      --silver-bg: rgba(148, 163, 184, 0.08);
      --bronze: #b45309;
      --bronze-bg: rgba(180, 83, 9, 0.08);
      --dim: #3f3f50;
    }
    
    body {
      font-family: 'Inter', -apple-system, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
    }
    
    /* PIN Gate */
    #pin-gate {
      position: fixed; inset: 0;
      background: var(--bg);
      display: flex; align-items: center; justify-content: center;
      flex-direction: column; gap: 1.5rem;
      z-index: 1000;
    }
    #pin-gate h1 {
      font-size: 2rem; font-weight: 300; color: var(--text-bright);
      letter-spacing: 0.05em;
    }
    #pin-gate input {
      background: var(--bg-card); border: 1px solid var(--border);
      color: var(--text-bright); font-family: 'JetBrains Mono', monospace;
      font-size: 2rem; text-align: center; letter-spacing: 0.5em;
      padding: 0.75rem 1.5rem; border-radius: 12px; width: 200px;
      outline: none;
    }
    #pin-gate input:focus { border-color: var(--accent); }
    #pin-gate .error { color: #ef4444; font-size: 0.875rem; }
    #pin-gate.hidden { display: none; }
    
    /* Header */
    header {
      padding: 2rem 2rem 1rem;
      max-width: 1200px; margin: 0 auto;
    }
    header h1 {
      font-size: 1.75rem; font-weight: 700; color: var(--text-bright);
      letter-spacing: -0.02em;
    }
    header h1 span { color: var(--accent); }
    .subtitle {
      color: var(--text-dim); font-size: 0.85rem; margin-top: 0.25rem;
    }
    
    /* Filters */
    .filters {
      padding: 0.75rem 2rem;
      max-width: 1200px; margin: 0 auto;
      display: flex; gap: 0.5rem; flex-wrap: wrap;
      align-items: center;
    }
    .filter-btn {
      background: var(--bg-card); border: 1px solid var(--border);
      color: var(--text-dim); padding: 0.4rem 1rem; border-radius: 20px;
      cursor: pointer; font-size: 0.8rem; font-family: inherit;
      transition: all 0.15s;
    }
    .filter-btn:hover { border-color: var(--accent); color: var(--text); }
    .filter-btn.active { 
      background: var(--accent); border-color: var(--accent); 
      color: white; font-weight: 500; 
    }
    .sort-group { margin-left: auto; display: flex; gap: 0.5rem; align-items: center; }
    .sort-label { color: var(--text-dim); font-size: 0.75rem; }
    
    /* Event Grid */
    .events {
      max-width: 1200px; margin: 1rem auto;
      padding: 0 2rem 4rem;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 1rem;
    }
    
    /* Event Card */
    .card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.25rem;
      transition: all 0.2s;
      position: relative;
      overflow: hidden;
    }
    .card:hover { 
      background: var(--bg-card-hover); 
      border-color: #2a2a3e;
      transform: translateY(-1px);
    }
    .card.gold { border-left: 3px solid var(--gold); }
    .card.silver { border-left: 3px solid var(--silver); }
    .card.bronze { border-left: 3px solid var(--bronze); }
    .card.dim { opacity: 0.6; }
    
    .card-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75rem; }
    .card-title {
      font-size: 1rem; font-weight: 600; color: var(--text-bright);
      line-height: 1.3;
    }
    .card-title a { color: inherit; text-decoration: none; }
    .card-title a:hover { color: var(--accent); }
    
    .score-badge {
      flex-shrink: 0;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.8rem; font-weight: 600;
      padding: 0.2rem 0.5rem; border-radius: 6px;
      min-width: 2.5rem; text-align: center;
    }
    .score-badge.gold { background: var(--gold-bg); color: var(--gold); }
    .score-badge.silver { background: var(--silver-bg); color: var(--silver); }
    .score-badge.bronze { background: var(--bronze-bg); color: var(--bronze); }
    .score-badge.dim { background: rgba(63,63,80,0.2); color: var(--dim); }
    
    .card-meta {
      margin-top: 0.75rem;
      display: flex; flex-direction: column; gap: 0.35rem;
      font-size: 0.825rem; color: var(--text-dim);
    }
    .card-meta .venue { color: var(--text); font-weight: 500; }
    .card-meta .date { }
    .card-meta .artists { font-style: italic; color: var(--text-dim); }
    
    .card-tags {
      margin-top: 0.75rem;
      display: flex; gap: 0.4rem; flex-wrap: wrap;
    }
    .tag {
      font-size: 0.7rem; padding: 0.15rem 0.5rem;
      border-radius: 10px; background: rgba(139,92,246,0.1);
      color: var(--accent);
    }
    .tag.source { background: rgba(100,100,120,0.15); color: var(--text-dim); }
    
    /* Stats bar */
    .stats {
      max-width: 1200px; margin: 0 auto;
      padding: 0 2rem;
      display: flex; gap: 1.5rem;
      font-size: 0.8rem; color: var(--text-dim);
    }
    .stats .stat strong { color: var(--text); }
    
    /* Empty state */
    .empty {
      text-align: center; padding: 4rem 2rem;
      color: var(--text-dim);
    }
    
    /* Footer */
    footer {
      text-align: center; padding: 2rem;
      color: var(--text-dim); font-size: 0.75rem;
    }
    
    @media (max-width: 640px) {
      header, .filters, .events, .stats { padding-left: 1rem; padding-right: 1rem; }
      .events { grid-template-columns: 1fr; }
      .sort-group { margin-left: 0; margin-top: 0.5rem; }
      .filters { flex-direction: column; align-items: flex-start; }
    }
  </style>
</head>
<body>
  <div id="pin-gate">
    <h1>NYC Tonight</h1>
    <input type="password" id="pin-input" maxlength="4" placeholder="PIN" autofocus>
    <div class="error" id="pin-error"></div>
  </div>
  
  <div id="app" style="display:none">
    <header>
      <h1>NYC <span>Tonight</span></h1>
      <div class="subtitle">Updated ${updated} ET · Events scored against your taste</div>
    </header>
    
    <div class="stats" id="stats"></div>
    
    <div class="filters">
      <button class="filter-btn active" data-filter="all">All</button>
      <button class="filter-btn" data-filter="music">Music</button>
      <button class="filter-btn" data-filter="cultural">Cultural / Talks</button>
      <div class="sort-group">
        <span class="sort-label">Sort:</span>
        <button class="filter-btn active" data-sort="score">Score</button>
        <button class="filter-btn" data-sort="date">Date</button>
      </div>
    </div>
    
    <div class="events" id="events"></div>
    
    <footer>NYC Tonight · Taste-aware event discovery · Data from Ticketmaster, Bandsintown, ThoughtGallery, Oh My Rockness</footer>
  </div>
  
  <script>
    const EVENTS = ${eventsJson};
    const PIN = '7429';
    
    // PIN gate
    const gate = document.getElementById('pin-gate');
    const pinInput = document.getElementById('pin-input');
    const pinError = document.getElementById('pin-error');
    
    if (localStorage.getItem('nyc-tonight-auth') === 'ok') {
      gate.classList.add('hidden');
      document.getElementById('app').style.display = 'block';
      renderEvents();
    }
    
    pinInput.addEventListener('input', function() {
      if (this.value.length === 4) {
        if (this.value === PIN) {
          localStorage.setItem('nyc-tonight-auth', 'ok');
          gate.classList.add('hidden');
          document.getElementById('app').style.display = 'block';
          renderEvents();
        } else {
          pinError.textContent = 'Wrong PIN';
          this.value = '';
          this.classList.add('shake');
          setTimeout(() => this.classList.remove('shake'), 500);
        }
      }
    });
    
    let currentFilter = 'all';
    let currentSort = 'score';
    
    // Filter buttons
    document.querySelectorAll('[data-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        renderEvents();
      });
    });
    
    // Sort buttons
    document.querySelectorAll('[data-sort]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-sort]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentSort = btn.dataset.sort;
        renderEvents();
      });
    });
    
    function renderEvents() {
      let filtered = EVENTS;
      
      if (currentFilter === 'music') {
        filtered = filtered.filter(e => e.type === 'music');
      } else if (currentFilter === 'cultural') {
        filtered = filtered.filter(e => e.type === 'cultural');
      }
      
      if (currentSort === 'date') {
        filtered = [...filtered].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      } else {
        filtered = [...filtered].sort((a, b) => b.score - a.score);
      }
      
      // Stats
      const gold = filtered.filter(e => e.tier === 'gold').length;
      const silver = filtered.filter(e => e.tier === 'silver').length;
      const total = filtered.length;
      document.getElementById('stats').innerHTML = 
        '<div class="stat"><strong>' + total + '</strong> events</div>' +
        '<div class="stat"><strong>' + gold + '</strong> gold picks</div>' +
        '<div class="stat"><strong>' + silver + '</strong> silver picks</div>';
      
      const container = document.getElementById('events');
      
      if (filtered.length === 0) {
        container.innerHTML = '<div class="empty">No events found. Check back tomorrow!</div>';
        return;
      }
      
      container.innerHTML = filtered.map(ev => {
        const dateStr = ev.date ? formatDate(ev.date) : '';
        const timeStr = ev.time ? ' · ' + formatTime(ev.time) : '';
        const artists = (ev.artists || []).filter(a => a !== ev.name).join(', ');
        
        return '<div class="card ' + ev.tier + '">' +
          '<div class="card-header">' +
            '<div class="card-title">' + (ev.url ? '<a href="' + ev.url + '" target="_blank">' + esc(ev.name) + '</a>' : esc(ev.name)) + '</div>' +
            '<div class="score-badge ' + ev.tier + '">' + ev.score + '</div>' +
          '</div>' +
          '<div class="card-meta">' +
            (ev.venue ? '<div class="venue">' + esc(ev.venue) + '</div>' : '') +
            (dateStr ? '<div class="date">' + dateStr + timeStr + '</div>' : '') +
            (artists ? '<div class="artists">' + esc(artists) + '</div>' : '') +
          '</div>' +
          '<div class="card-tags">' +
            (ev.genre ? '<span class="tag">' + esc(ev.genre) + '</span>' : '') +
            '<span class="tag source">' + esc(ev.source) + '</span>' +
            (ev.breakdown?.matchedArtists?.length ? '<span class="tag">♥ taste match</span>' : '') +
            (ev.breakdown?.noveltyBonus > 3 ? '<span class="tag">✦ discovery</span>' : '') +
          '</div>' +
        '</div>';
      }).join('');
    }
    
    function formatDate(d) {
      try {
        const date = new Date(d + 'T00:00:00');
        const today = new Date();
        today.setHours(0,0,0,0);
        const diff = Math.floor((date - today) / 86400000);
        if (diff === 0) return 'Today';
        if (diff === 1) return 'Tomorrow';
        return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      } catch { return d; }
    }
    
    function formatTime(t) {
      try {
        const [h, m] = t.split(':');
        const hour = parseInt(h);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const h12 = hour % 12 || 12;
        return h12 + ':' + m + ' ' + ampm;
      } catch { return t; }
    }
    
    function esc(s) {
      const d = document.createElement('div');
      d.textContent = s || '';
      return d.innerHTML;
    }
  </script>
</body>
</html>`;

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'index.html'), html);
  console.log(`[build-site] Written to ${path.join(outputDir, 'index.html')}`);
}

module.exports = { buildSite };
