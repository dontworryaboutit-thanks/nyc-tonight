const fetch = require('node-fetch');
const cheerio = require('cheerio');

const BASE_URL = 'https://thoughtgallery.org';

async function scrape() {
  try {
    console.log('[thoughtgallery] Fetching cultural events...');
    const res = await fetch(`${BASE_URL}/calendar/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; nyc-tonight/1.0)'
      }
    });

    if (!res.ok) {
      console.error(`[thoughtgallery] HTTP ${res.status}`);
      return [];
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const events = [];

    // ThoughtGallery lists events in article/post blocks
    // Try multiple selectors since their markup may vary
    const selectors = [
      'article', '.post', '.event', '.entry', 
      '.type-post', '.hentry', '[class*="event"]'
    ];

    let $items = $([]);
    for (const sel of selectors) {
      $items = $(sel);
      if ($items.length > 0) break;
    }

    if ($items.length === 0) {
      // Fallback: try to find any links with event-like content
      $('a[href*="/event"], a[href*="/calendar"]').each((i, el) => {
        const $el = $(el);
        const name = $el.text().trim();
        const url = $el.attr('href') || '';
        if (name && name.length > 5 && name.length < 200) {
          events.push({
            name,
            description: '',
            venue: '',
            date: '',
            time: '',
            url: url.startsWith('http') ? url : `${BASE_URL}/${url.replace(/^\//, '')}`,
            source: 'thoughtgallery',
            genre: 'cultural',
            subGenre: '',
            type: 'cultural'
          });
        }
      });
    } else {
      $items.each((i, el) => {
        const $el = $(el);
        const title = $el.find('h1, h2, h3, .entry-title, .event-title').first().text().trim();
        const link = $el.find('a').first().attr('href') || '';
        const desc = $el.find('p, .entry-content, .event-description, .excerpt').first().text().trim();
        const dateText = $el.find('time, .date, .event-date, [class*="date"]').first().text().trim();
        const venue = $el.find('.venue, .location, [class*="venue"], [class*="location"]').first().text().trim();
        
        if (title) {
          events.push({
            name: title,
            description: desc.substring(0, 300),
            venue: venue || '',
            date: parseDate(dateText),
            time: '',
            url: link.startsWith('http') ? link : `${BASE_URL}/${link.replace(/^\//, '')}`,
            source: 'thoughtgallery',
            genre: 'cultural',
            subGenre: categorize(title + ' ' + desc),
            type: 'cultural'
          });
        }
      });
    }

    console.log(`[thoughtgallery] Found ${events.length} events`);
    return events;
  } catch (err) {
    console.error(`[thoughtgallery] Error: ${err.message}`);
    return [];
  }
}

function parseDate(text) {
  if (!text) return '';
  try {
    const d = new Date(text);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  } catch {}
  // Try to extract YYYY-MM-DD pattern
  const match = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match) return match[0];
  return '';
}

function categorize(text) {
  const lower = text.toLowerCase();
  if (/philosoph|ethics|moral/.test(lower)) return 'philosophy';
  if (/science|physics|biology|neuro/.test(lower)) return 'science';
  if (/ai|artificial|machine learn|tech/.test(lower)) return 'technology';
  if (/liter|book|author|poetry|novel|reading/.test(lower)) return 'literature';
  if (/art|gallery|exhibit|museum/.test(lower)) return 'art';
  if (/film|cinema|screen|documentary/.test(lower)) return 'film';
  if (/music|compos|jazz|classical/.test(lower)) return 'music-talk';
  if (/politic|democra|justice|urban/.test(lower)) return 'politics';
  if (/histor/.test(lower)) return 'history';
  return 'talk';
}

module.exports = { scrape };
