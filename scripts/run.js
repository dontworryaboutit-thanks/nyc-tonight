const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');

async function main() {
  console.log('=== NYC Tonight Builder ===');
  console.log(`Started at ${new Date().toISOString()}\n`);

  // 1. Run all scrapers
  const scrapers = [
    { name: 'residentadvisor', mod: require('./scrapers/residentadvisor') },
    { name: 'thoughtgallery', mod: require('./scrapers/thoughtgallery') },
    { name: 'filmforum', mod: require('./scrapers/filmforum') },
    // Ticketmaster: needs valid API key (get one at developer.ticketmaster.com)
    // { name: 'ticketmaster', mod: require('./scrapers/ticketmaster') },
    // Bandsintown: API now requires auth, disabled for now
    // { name: 'bandsintown', mod: require('./scrapers/bandsintown') },
    // Oh My Rockness: API locked down, JS-rendered pages
    // { name: 'ohmyrockness', mod: require('./scrapers/ohmyrockness') },
  ];

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

  // 4. Save scored events as JSON (for debugging)
  const cachePath = path.join(ROOT, '.cache');
  fs.mkdirSync(cachePath, { recursive: true });
  fs.writeFileSync(
    path.join(cachePath, 'scored-events.json'),
    JSON.stringify(scored, null, 2)
  );
  console.log(`\nSaved scored events to .cache/scored-events.json`);

  // 5. Build static site
  const { buildSite } = require('./build-site');
  buildSite(scored, path.join(ROOT, 'docs'));

  console.log(`\n=== Done! ${scored.length} events scored and site generated ===`);
  
  // Print top 5
  console.log('\nTop 5 picks:');
  scored.slice(0, 5).forEach((ev, i) => {
    console.log(`  ${i + 1}. [${ev.score}] ${ev.name} @ ${ev.venue} (${ev.date})`);
  });
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
