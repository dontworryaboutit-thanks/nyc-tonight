const fetch = require('node-fetch');
const cheerio = require('cheerio');

// Nitehawk restructured in 2026: /showtimes/ is gone. Each venue page shows
// one day's films as .show-thumbnail-holder blocks, with per-date pages at
// /<venue>/<YYYY-MM-DD>/<n>/ linked from the date navigation.

const LOCATIONS = [
  { name: 'Nitehawk Williamsburg', base: 'https://nitehawkcinema.com/williamsburg' },
  { name: 'Nitehawk Prospect Park', base: 'https://nitehawkcinema.com/prospectpark' }
];

const MAX_DAYS = 7;
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

function todayNY() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

// "3:10 pm 5:40 pm Sold Out 9:15 pm" → first time as HH:MM (24h)
function firstShowtime(text) {
  const m = text.match(/(\d{1,2}):(\d{2})\s*([ap])m?/i);
  if (!m) return '';
  let h = parseInt(m[1]);
  if (m[3].toLowerCase() === 'p' && h !== 12) h += 12;
  if (m[3].toLowerCase() === 'a' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

function parseDayPage(html, loc, date) {
  const $ = cheerio.load(html);
  const events = [];
  const seen = new Set();

  $('.show-thumbnail-holder').each((i, el) => {
    const $el = $(el);
    const title = $el.find('.show-title').first().text().trim();
    if (!title || seen.has(title)) return;
    seen.add(title);

    let url = $el.find('a.overlay-link').attr('href') || $el.find('a[href*="/movies/"]').attr('href') || '';
    if (url && !url.startsWith('http')) url = `${loc.base}${url}`;
    url = url.split('?')[0];

    const time = firstShowtime($el.parent().text());

    events.push({
      name: title.replace(/\s*\((DCP|35MM|16MM|4K)\)\s*$/i, '').trim(),
      artists: [],
      venue: loc.name,
      date,
      time,
      url: url || `${loc.base}/`,
      source: 'nitehawk',
      genre: 'film',
      subGenre: '',
      type: 'film',
      description: $el.find('.short-description').first().text().trim().slice(0, 200)
    });
  });

  return events;
}

async function scrape() {
  const allEvents = [];

  for (const loc of LOCATIONS) {
    try {
      console.log(`[nitehawk] Fetching ${loc.name}...`);
      const res = await fetch(`${loc.base}/`, { headers: HEADERS });
      if (!res.ok) {
        console.warn(`[nitehawk] ${loc.name}: HTTP ${res.status}`);
        continue;
      }
      const html = await res.text();

      // Today's films from the venue page itself
      allEvents.push(...parseDayPage(html, loc, todayNY()));

      // Date navigation links: /<venue>/<YYYY-MM-DD>/<n>/
      const dateUrls = [...new Set(html.match(/https?:\/\/nitehawkcinema\.com\/[a-z]+\/(\d{4}-\d{2}-\d{2})\/\d+\//g) || [])]
        .filter(u => u.startsWith(loc.base))
        .slice(0, MAX_DAYS);

      for (const dayUrl of dateUrls) {
        const date = (dayUrl.match(/(\d{4}-\d{2}-\d{2})/) || [])[1];
        if (!date || date === todayNY()) continue;
        try {
          await sleep(500);
          const dayRes = await fetch(dayUrl, { headers: HEADERS });
          if (!dayRes.ok) continue;
          allEvents.push(...parseDayPage(await dayRes.text(), loc, date));
        } catch {}
      }
    } catch (err) {
      console.warn(`[nitehawk] Error for ${loc.name}: ${err.message}`);
    }
  }

  console.log(`[nitehawk] Found ${allEvents.length} showtimes`);
  return allEvents;
}

module.exports = { scrape };
