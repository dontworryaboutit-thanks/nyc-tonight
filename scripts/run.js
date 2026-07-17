const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');

async function main() {
  console.log('=== NYC Tonight Builder ===');
  console.log(`Started at ${new Date().toISOString()}\n`);

  // 1. Run all scrapers
  const scrapers = [
    { name: 'songkick', mod: require('./scrapers/songkick') },
    { name: 'residentadvisor', mod: require('./scrapers/residentadvisor') },
    { name: 'jazznyc', mod: require('./scrapers/jazznyc') },
    { name: 'donyc', mod: require('./scrapers/donyc') },
    { name: 'thoughtgallery', mod: require('./scrapers/thoughtgallery') },
    { name: 'filmforum', mod: require('./scrapers/filmforum') },
    { name: 'metrograph', mod: require('./scrapers/metrograph') },
    { name: 'ifc', mod: require('./scrapers/ifc') },
    { name: 'anthology', mod: require('./scrapers/anthology') },
    { name: 'nitehawk', mod: require('./scrapers/nitehawk') },
    { name: 'theskint', mod: require('./scrapers/theskint') },
    // Oh My Rockness: API domain gone, site bot-blocked (checked 2026-07)
    // { name: 'ohmyrockness', mod: require('./scrapers/ohmyrockness') },
  ];

  // Keyed sources: enabled automatically when their API key is present
  // (set as GitHub Actions secrets → env in daily.yml)
  if (process.env.TICKETMASTER_API_KEY) {
    scrapers.push({ name: 'ticketmaster', mod: require('./scrapers/ticketmaster') });
  } else {
    console.log('(ticketmaster skipped — set TICKETMASTER_API_KEY to enable)');
  }
  if (process.env.BANDSINTOWN_APP_ID) {
    scrapers.push({ name: 'bandsintown', mod: require('./scrapers/bandsintown') });
  } else {
    console.log('(bandsintown skipped — set BANDSINTOWN_APP_ID to enable)');
  }

  let allEvents = [];
  
  for (const { name, mod } of scrapers) {
    try {
      console.log(`\n--- ${name} ---`);
      const events = await mod.scrape();
      console.log(`✓ ${name}: ${events.length} events`);
      allEvents.push(...events);
    } catch (err) {
      console.error(`✗ ${name} failed: ${err.message}`);
    }
  }

  console.log(`\n=== Total raw events: ${allEvents.length} ===\n`);

  // 2a. Sanitize: drop junk entries, invalid dates, past events, far-future noise
  const { sanitizeEvents } = require('./sanitize-events');
  allEvents = sanitizeEvents(allEvents);

  // 2. Deduplicate (same artist + venue + date)
  const seen = new Set();
  const deduped = [];
  for (const ev of allEvents) {
    const key = [
      (ev.artists?.[0] || ev.name || '').toLowerCase(),
      (ev.venue || '').toLowerCase(),
      ev.date || ''
    ].join('|');
    
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(ev);
    }
  }
  console.log(`After dedup: ${deduped.length} events (removed ${allEvents.length - deduped.length} duplicates)\n`);

  // 3. Score events
  const { scoreAll } = require('./score-events');
  const scored = scoreAll(deduped, ROOT);

  // 4. Add venue coordinates for map
  const venueCoords = require('./venue-coords.json');
  for (const ev of scored) {
    const venueLower = (ev.venue || '').toLowerCase();
    for (const [name, coords] of Object.entries(venueCoords)) {
      if (venueLower.includes(name)) {
        ev.lat = coords[0];
        ev.lng = coords[1];
        break;
      }
    }
  }
  const withCoords = scored.filter(e => e.lat);
  console.log(`Geocoded: ${withCoords.length}/${scored.length} events have coordinates`);

  // 5. Filter out very low-scoring events
  const MIN_SCORE = 10;
  const filtered = scored.filter(ev => ev.score >= MIN_SCORE);
  console.log(`\nFiltered: ${scored.length} → ${filtered.length} events (removed ${scored.length - filtered.length} below score ${MIN_SCORE})`);

  // 5b. Feed balance: no single source may flood a given day.
  // Events arrive sorted by score, so keeping the first N per source+day keeps the best.
  const MAX_PER_SOURCE_PER_DAY = 20;
  const perSourceDay = new Map();
  const balanced = filtered.filter(ev => {
    const key = `${ev.source}|${ev.date || 'undated'}`;
    const n = (perSourceDay.get(key) || 0) + 1;
    perSourceDay.set(key, n);
    return n <= MAX_PER_SOURCE_PER_DAY;
  });
  console.log(`Balanced: ${filtered.length} → ${balanced.length} events (capped at ${MAX_PER_SOURCE_PER_DAY}/source/day)`);
  const scoredFinal = balanced;

  // 5. Save scored events as JSON (for debugging)
  const cachePath = path.join(ROOT, '.cache');
  fs.mkdirSync(cachePath, { recursive: true });
  fs.writeFileSync(
    path.join(cachePath, 'scored-events.json'),
    JSON.stringify(scoredFinal, null, 2)
  );
  console.log(`Saved scored events to .cache/scored-events.json`);

  // 6. Build static site
  const { buildSite } = require('./build-site');
  buildSite(scoredFinal, path.join(ROOT, 'docs'));

  // 7. Copy to root index.html (GitHub Pages may serve from root)
  fs.copyFileSync(path.join(ROOT, 'docs', 'index.html'), path.join(ROOT, 'index.html'));

  console.log(`\n=== Done! ${scoredFinal.length} events scored and site generated ===`);
  
  // Print top 5
  console.log('\nTop 5 picks:');
  scoredFinal.slice(0, 5).forEach((ev, i) => {
    console.log(`  ${i + 1}. [${ev.score}] ${ev.name} @ ${ev.venue} (${ev.date})`);
  });
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
