// SeatGeek — fills the touring-band gap that Songkick and DICE leave open.
//
// Enabled by setting the SEATGEEK_CLIENT_ID repository secret; a client id is
// free and issued instantly at https://seatgeek.com/account/develop.
// Covers the mid-size rooms (Bowery Ballroom, Brooklyn Steel, Webster Hall,
// Music Hall of Williamsburg) as well as the arenas.

const fetch = require('node-fetch');

const API = 'https://api.seatgeek.com/2/events';
const DAYS_AHEAD = 21;
const PER_PAGE = 100;
const MAX_PAGES = 8;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// SeatGeek taxonomies we care about. Their 'concert' bucket covers touring
// bands; 'music_festival' catches the multi-day events. Sports and the theater
// taxonomies are deliberately excluded — other sources cover those better and
// they'd swamp the feed.
const TAXONOMIES = ['concert', 'music_festival'];

function ymd(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

// SeatGeek returns local ISO datetimes; when time is unknown it pins 03:00,
// which would otherwise render as a bogus 3am start.
function splitDateTime(ev) {
  const raw = ev.datetime_local || '';
  const [date, clock] = raw.split('T');
  if (!date) return { date: '', time: '' };
  const timeTBD = ev.date_tbd || ev.time_tbd;
  const time = !timeTBD && clock ? clock.slice(0, 5) : '';
  return { date, time: time === '03:00' ? '' : time };
}

function mapGenre(ev) {
  const genres = (ev.performers || [])
    .flatMap(p => p.genres || [])
    .map(g => String(g.slug || g.name || '').toLowerCase());
  if (!genres.length) return '';

  // Collapse SeatGeek's long genre tail onto the buckets the scorer knows
  const buckets = [
    ['jazz', /jazz|bebop|swing/],
    ['electronic', /electronic|techno|house|edm|dance|dubstep/],
    ['indie', /indie|alternative|shoegaze|post-punk/],
    ['rock', /rock|metal|punk|grunge/],
    ['hip-hop', /hip.?hop|rap|trap/],
    ['classical', /classical|orchestra|opera|chamber/],
    ['folk', /folk|americana|bluegrass|singer.?songwriter/],
    ['soul', /soul|r&b|rnb|funk|motown/],
    ['world', /world|latin|afro|reggae|cumbia|k-?pop/]
  ];
  for (const [name, re] of buckets) {
    if (genres.some(g => re.test(g))) return name;
  }
  return genres[0] || '';
}

function pickImage(ev) {
  for (const p of ev.performers || []) {
    const img = p.image || (p.images && (p.images.huge || p.images.large || p.images.medium));
    if (img) return img;
  }
  return '';
}

async function fetchPage(clientId, taxonomy, page) {
  const params = new URLSearchParams({
    client_id: clientId,
    'venue.city': 'New York',
    'taxonomies.name': taxonomy,
    'datetime_local.gte': ymd(0),
    'datetime_local.lte': ymd(DAYS_AHEAD),
    per_page: String(PER_PAGE),
    page: String(page),
    sort: 'datetime_local.asc'
  });

  const res = await fetch(`${API}?${params}`, { timeout: 25000 });
  if (!res.ok) {
    // 401/403 means a bad or unauthorised client id — worth saying plainly
    console.warn(`[seatgeek] HTTP ${res.status} on ${taxonomy} page ${page}`);
    return null;
  }
  return res.json();
}

async function scrape() {
  const clientId = process.env.SEATGEEK_CLIENT_ID;
  if (!clientId) {
    console.log('[seatgeek] skipped — set SEATGEEK_CLIENT_ID to enable');
    return [];
  }

  console.log('[seatgeek] Fetching NYC concerts...');
  const events = [];

  for (const taxonomy of TAXONOMIES) {
    for (let page = 1; page <= MAX_PAGES; page++) {
      let data;
      try {
        data = await fetchPage(clientId, taxonomy, page);
      } catch (err) {
        console.warn(`[seatgeek] ${taxonomy} page ${page} failed: ${err.message}`);
        break;
      }
      if (!data || !Array.isArray(data.events) || !data.events.length) break;

      for (const ev of data.events) {
        const { date, time } = splitDateTime(ev);
        if (!date) continue;

        const performers = (ev.performers || []).map(p => p.name).filter(Boolean);
        const headliner = (ev.performers || []).find(p => p.primary) || (ev.performers || [])[0];

        events.push({
          name: ev.short_title || ev.title || (headliner && headliner.name) || '',
          artists: performers,
          venue: (ev.venue && ev.venue.name) || 'NYC',
          date,
          time,
          url: ev.url || '',
          source: 'seatgeek',
          type: 'music',
          genre: mapGenre(ev),
          subGenre: '',
          description: '',
          image: pickImage(ev),
          lat: (ev.venue && ev.venue.location && ev.venue.location.lat) || null,
          lng: (ev.venue && ev.venue.location && ev.venue.location.lon) || null
        });
      }

      const total = (data.meta && data.meta.total) || 0;
      if (page * PER_PAGE >= total) break;
      await sleep(350);
    }
  }

  const seen = new Set();
  const deduped = events.filter(ev => {
    const key = `${(ev.artists[0] || ev.name).toLowerCase()}|${ev.venue.toLowerCase()}|${ev.date}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`[seatgeek] Found ${deduped.length} events`);
  return deduped;
}

module.exports = { scrape };
