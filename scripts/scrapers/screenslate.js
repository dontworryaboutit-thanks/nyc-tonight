// Screen Slate — the definitive daily guide to NYC repertory and arthouse
// screenings. Covers the long tail of one-off screenings, 16mm prints, and
// microcinema programs that the individual venue scrapers miss entirely.
//
// Screen Slate publishes no API docs, and its markup has changed shape over
// the years, so this tries the known URL forms in order and parses whichever
// responds. Each strategy is logged, so a CI run tells us which one is live.

const fetch = require('node-fetch');
const cheerio = require('cheerio');

const BASE = 'https://www.screenslate.com';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const DAYS_AHEAD = 10;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function ymd(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

async function get(url) {
  const res = await fetch(url, {
    timeout: 25000,
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });
  if (!res.ok) return { ok: false, status: res.status, body: '' };
  return { ok: true, status: res.status, body: await res.text() };
}

function parseTime(raw) {
  if (!raw) return '';
  const m = String(raw).match(/(\d{1,2})(?::(\d{2}))?\s*([apAP])\.?[mM]?/);
  if (!m) return '';
  let h = parseInt(m[1], 10);
  const min = m[2] || '00';
  const mer = m[3].toLowerCase();
  if (mer === 'p' && h !== 12) h += 12;
  if (mer === 'a' && h === 12) h = 0;
  if (h > 23) return '';
  return `${String(h).padStart(2, '0')}:${min}`;
}

// Titles on Screen Slate often carry format/series annotations we don't want
// in the event name, e.g. "Vertigo (70mm)" or "Days of Heaven [35mm]".
function cleanTitle(t) {
  return String(t)
    .replace(/\s*[\[(](?:\d{2,3}\s?mm|DCP|4K|2K|16mm|35mm|70mm)[\])]\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isJunkTitle(t) {
  if (!t || t.length < 2 || t.length > 200) return true;
  return /^(more|tickets?|buy|read more|listings?|calendar|subscribe|donate|newsletter|about|search)$/i.test(t);
}

// --- Strategy A: JSON endpoints -------------------------------------------
// Screen Slate's front end has historically been fed by a Drupal JSON view.
function eventsFromJson(data, date) {
  const out = [];
  const rows = Array.isArray(data) ? data : (data.items || data.rows || data.data || []);
  if (!Array.isArray(rows)) return out;

  for (const r of rows) {
    const title = cleanTitle(r.title || r.name || r.field_title || '');
    if (isJunkTitle(title)) continue;
    const venue = String(r.venue || r.field_venue || r.location || '').replace(/<[^>]*>/g, '').trim();
    const timeRaw = r.time || r.field_time || r.showtimes || '';
    out.push({
      name: title,
      artists: [],
      director: String(r.director || r.field_director || '').trim(),
      venue: venue || 'NYC',
      date,
      time: parseTime(Array.isArray(timeRaw) ? timeRaw[0] : timeRaw),
      url: r.url || r.path || `${BASE}/listings`,
      source: 'screenslate',
      type: 'film',
      genre: 'film',
      subGenre: 'repertory',
      description: String(r.body || r.description || '').replace(/<[^>]*>/g, '').trim().slice(0, 200),
      image: r.image || r.field_image || ''
    });
  }
  return out;
}

// --- Strategy B: HTML ------------------------------------------------------
// Listings group under a venue heading, with one row per screening beneath it.
function eventsFromHtml(html, date) {
  const $ = cheerio.load(html);
  const out = [];
  const seen = new Set();

  // Venue groupings carry a heading; screenings sit in sibling rows. Selector
  // list is broad on purpose — Screen Slate has used several class names.
  const rowSel = [
    '.listing', '.listing-card', '.screening', '.views-row',
    '[class*="listing__"]', '[class*="screening"]'
  ].join(', ');

  $(rowSel).each((i, el) => {
    const $el = $(el);

    const title = cleanTitle(
      $el.find('.listing-title, .field--name-title, h2, h3, h4').first().text().trim() ||
      $el.find('a').first().text().trim()
    );
    if (isJunkTitle(title)) return;

    // Venue: either inside the row, or the nearest preceding venue heading
    let venue = $el.find('.venue, .listing-venue, [class*="venue"]').first().text().trim();
    if (!venue) {
      venue = $el.prevAll('h2, h3, .venue-title, [class*="venue"]').first().text().trim();
    }
    venue = venue.replace(/\s+/g, ' ').trim();

    const timeText =
      $el.find('.time, .showtime, .listing-time, [class*="time"]').first().text().trim() ||
      ($el.text().match(/\b\d{1,2}(?::\d{2})?\s*[apAP]\.?[mM]\b/) || [''])[0];

    let href = $el.find('a').first().attr('href') || '';
    if (href && !href.startsWith('http')) href = BASE + (href.startsWith('/') ? href : `/${href}`);

    const key = `${title}|${venue}|${date}`;
    if (seen.has(key)) return;
    seen.add(key);

    const directorMatch = $el.text().match(/(?:Dir(?:ected by|\.)?)\s*:?\s*([A-Z][^,\n(]{2,60})/);

    out.push({
      name: title,
      artists: [],
      director: directorMatch ? directorMatch[1].trim() : '',
      venue: venue || 'NYC',
      date,
      time: parseTime(timeText),
      url: href || `${BASE}/listings`,
      source: 'screenslate',
      type: 'film',
      genre: 'film',
      subGenre: 'repertory',
      description: '',
      image: ''
    });
  });

  return out;
}

async function fetchDay(date) {
  const compact = date.replace(/-/g, '');
  const candidates = [
    { kind: 'json', url: `${BASE}/api/listings/${compact}` },
    { kind: 'html', url: `${BASE}/listings?date=${date}` },
    { kind: 'html', url: `${BASE}/listings/${date}` }
  ];

  for (const c of candidates) {
    let res;
    try {
      res = await get(c.url);
    } catch (err) {
      continue;
    }
    if (!res.ok) continue;

    if (c.kind === 'json') {
      try {
        const events = eventsFromJson(JSON.parse(res.body), date);
        if (events.length) {
          console.log(`[screenslate] ${date}: ${events.length} via JSON ${c.url}`);
          return events;
        }
      } catch {
        // not JSON after all — fall through to the HTML candidates
      }
    } else {
      const events = eventsFromHtml(res.body, date);
      if (events.length) {
        console.log(`[screenslate] ${date}: ${events.length} via HTML ${c.url}`);
        return events;
      }
    }
  }

  console.log(`[screenslate] ${date}: no events found (all strategies)`);
  return [];
}

async function scrape() {
  console.log('[screenslate] Fetching repertory listings...');
  const all = [];

  for (let i = 0; i < DAYS_AHEAD; i++) {
    const date = ymd(i);
    try {
      all.push(...await fetchDay(date));
    } catch (err) {
      console.warn(`[screenslate] ${date} failed: ${err.message}`);
    }
    await sleep(700); // be gentle: this is a small independent publication
  }

  const seen = new Set();
  const deduped = all.filter(ev => {
    const key = `${ev.name}|${ev.venue}|${ev.date}|${ev.time}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`[screenslate] Found ${deduped.length} events`);
  return deduped;
}

module.exports = { scrape };
