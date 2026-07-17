const fetch = require('node-fetch');
const cheerio = require('cheerio');

// The Skint (theskint.com) — long-running free/cheap NYC events newsletter.
// The RSS feed carries daily digest posts whose content is a sequence of
// <p> blocks: weekday section headers (<u>tuesday</u>) followed by event
// paragraphs ("<b>event name</b>: description. venue (hood), price. <a>link").

const FEED_URL = 'https://theskint.com/feed/';
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
};

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function todayNY() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

// Next occurrence of a weekday on/after a reference date (both NY-local)
function weekdayToDate(weekday, refDateStr) {
  const target = WEEKDAYS.indexOf(weekday);
  if (target === -1) return '';
  const ref = new Date(refDateStr + 'T12:00:00');
  const diff = (target - ref.getDay() + 7) % 7;
  ref.setDate(ref.getDate() + diff);
  return ref.toISOString().slice(0, 10);
}

function parsePost(contentHtml, pubDateStr) {
  const $ = cheerio.load(contentHtml);
  const events = [];
  // Section dates are relative to the post's publication day
  const pubDate = pubDateStr
    ? new Date(pubDateStr).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    : todayNY();
  let currentDate = '';

  $('p').each((i, el) => {
    const $p = $(el);
    const text = $p.text().replace(/\s+/g, ' ').trim();
    if (!text) return;

    // Weekday section header, e.g. "tuesday" (bold+underline, short)
    const headerText = text.toLowerCase().replace(/[^a-z]/g, '');
    if (WEEKDAYS.includes(headerText)) {
      currentDate = weekdayToDate(headerText, pubDate);
      return;
    }

    // Event paragraphs lead with a bold title
    const bold = $p.find('b, strong').first().text().replace(/\s+/g, ' ').trim();
    if (!bold || bold.length < 4 || bold.length > 120) return;
    if (!currentDate) return; // pre-section intro/sponsor content

    // Rest of the paragraph after the title = description/venue/price
    const rest = text.replace(bold, '').replace(/^[\s:–—-]+/, '').trim();

    // Venue guess: "... at <venue> (neighborhood)" or "<venue> (neighborhood), price"
    let venue = '';
    const atMatch = rest.match(/\bat\s+([^,.()]{3,60})(?:\s*\(([^)]+)\))?/i);
    const parenMatch = rest.match(/([^,.]{3,60})\s*\(([a-z\s]+)\)\s*,\s*(?:free|\$|donation|pay)/i);
    if (parenMatch) venue = parenMatch[1].trim();
    else if (atMatch) venue = atMatch[1].trim();
    // Strip leading prose the regexes can drag in ("weds 7pm: : at the ...")
    venue = venue.split(':').pop().replace(/^\s*at\s+/i, '').replace(/[^a-z0-9)\]]+$/i, '').trim();

    const link = $p.find('a[href^="http"]').last().attr('href') || '';
    const isFree = /\bfree\b/i.test(rest);

    events.push({
      name: bold.replace(/[:.]+$/, ''),
      artists: [],
      venue,
      date: currentDate,
      time: '',
      url: link,
      source: 'theskint',
      type: 'cultural',
      genre: isFree ? 'free' : '',
      subGenre: '',
      description: rest.slice(0, 250)
    });
  });

  return events;
}

async function scrape() {
  try {
    console.log('[theskint] Fetching RSS feed...');
    const res = await fetch(FEED_URL, { headers: HEADERS });
    if (!res.ok) {
      console.warn(`[theskint] HTTP ${res.status}`);
      return [];
    }
    const xml = await res.text();

    const items = xml.split('<item>').slice(1);
    console.log(`[theskint] ${items.length} feed items`);

    const allEvents = [];
    const today = todayNY();

    for (const item of items) {
      const title = ((item.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '').trim();
      // Skip standalone sponsored posts — the digests have day-list titles
      // like "TUES-THURS, 7/14-16: ..." or "WEEKEND, 7/11-13: ..."
      if (/sponsored/i.test(title)) continue;
      if (!/^[A-Z/,\s-]+\d/.test(title)) continue;

      const pub = ((item.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '').trim();
      const content = ((item.match(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/) || [])[1] || '');
      if (!content) continue;

      const events = parsePost(content, pub).filter(e => e.date >= today);
      allEvents.push(...events);
    }

    // Same event can appear in overlapping digests — dedupe on name+date
    const seen = new Set();
    const deduped = allEvents.filter(e => {
      const key = `${e.name.toLowerCase()}|${e.date}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log(`[theskint] Found ${deduped.length} events`);
    return deduped;
  } catch (err) {
    console.error(`[theskint] Error: ${err.message}`);
    return [];
  }
}

module.exports = { scrape, parsePost };
