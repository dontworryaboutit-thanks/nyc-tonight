// Central event sanitization: runs on the raw scraper output before dedup/scoring.
// Scrapers are messy — this is the single safety net for junk entries, bad dates,
// past events, and far-future noise.

const MAX_DAYS_AHEAD = 120;

// Nav-link / section-page titles that film scrapers pick up alongside real films
const JUNK_NAMES = new Set([
  'series', 'film details', 'special screenings', 'afa preservations',
  'new filmmakers', 'essential cinema', 'now playing', 'coming soon',
  'calendar', 'showtimes', 'tickets', 'membership', 'about', 'events',
  'all films', 'view all', 'more info', 'read more', 'home'
]);

// Today's date in New York, as YYYY-MM-DD (builds run on UTC machines)
function todayNY() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

function isValidDate(str) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const d = new Date(str + 'T12:00:00');
  return !isNaN(d) && d.toISOString().slice(0, 10) === str;
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function sanitizeEvents(events) {
  const today = todayNY();
  const horizon = addDays(today, MAX_DAYS_AHEAD);
  const dropped = { junkName: 0, noName: 0, badDate: 0, past: 0, farFuture: 0 };
  const kept = [];

  for (const ev of events) {
    const name = (ev.name || '').trim();
    if (!name || name.length < 2) { dropped.noName++; continue; }
    if (JUNK_NAMES.has(name.toLowerCase())) { dropped.junkName++; continue; }

    if (ev.date) {
      if (!isValidDate(ev.date)) {
        // Films render as "Now showing" without a date; other types need one
        if (ev.type === 'film') { ev.date = ''; kept.push(ev); continue; }
        dropped.badDate++; continue;
      }
      if (ev.date < today) { dropped.past++; continue; }
      if (ev.date > horizon) { dropped.farFuture++; continue; }
    } else if (ev.type !== 'film') {
      // Dateless non-film events can't be shown meaningfully
      dropped.badDate++; continue;
    }

    kept.push(ev);
  }

  const totalDropped = events.length - kept.length;
  console.log(
    `[sanitize] ${events.length} → ${kept.length} events ` +
    `(dropped ${totalDropped}: ${dropped.junkName} junk names, ${dropped.noName} unnamed, ` +
    `${dropped.badDate} bad dates, ${dropped.past} past, ${dropped.farFuture} >${MAX_DAYS_AHEAD}d out)`
  );
  return kept;
}

module.exports = { sanitizeEvents, todayNY };
