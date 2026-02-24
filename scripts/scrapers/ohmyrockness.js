const fetch = require('node-fetch');
const cheerio = require('cheerio');

const BASE_URL = 'https://www.ohmyrockness.com';

async function scrape() {
  try {
    console.log('[ohmyrockness] Fetching NYC shows...');
    
    // OMR has a JSON API endpoint for shows
    const res = await fetch(`${BASE_URL}/api/shows.json?index=true&page=1`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; nyc-tonight/1.0)',
        'Accept': 'application/json'
      }
    });

    if (res.ok) {
      const data = await res.json();
      return parseJsonResponse(data);
    }

    // Fallback to HTML scraping
    console.log('[ohmyrockness] JSON API unavailable, trying HTML...');
    return await scrapeHtml();
  } catch (err) {
    console.error(`[ohmyrockness] Error: ${err.message}`);
    // Try HTML fallback
    try {
      return await scrapeHtml();
    } catch (err2) {
      console.error(`[ohmyrockness] HTML fallback also failed: ${err2.message}`);
      return [];
    }
  }
}

function parseJsonResponse(data) {
  const shows = Array.isArray(data) ? data : data?.shows || [];
  console.log(`[ohmyrockness] Got ${shows.length} shows from API`);
  
  return shows.map(show => ({
    name: show.title || show.cached_headliners || '',
    artists: extractArtists(show),
    venue: show.venue_name || show.venue?.name || '',
    date: show.starts_at ? show.starts_at.split('T')[0] : (show.date || ''),
    time: show.doors || show.starts_at?.split('T')[1]?.substring(0, 5) || '',
    url: show.url || (show.slug ? `${BASE_URL}/shows/${show.slug}` : ''),
    source: 'ohmyrockness',
    genre: '',
    subGenre: '',
    type: 'music'
  })).filter(e => e.name);
}

function extractArtists(show) {
  if (show.bands && Array.isArray(show.bands)) {
    return show.bands.map(b => b.name || b).filter(Boolean);
  }
  if (show.cached_headliners) {
    return show.cached_headliners.split(/[,&\/]/).map(s => s.trim()).filter(Boolean);
  }
  if (show.title) {
    return show.title.split(/[,&\/]/).map(s => s.trim()).filter(Boolean);
  }
  return [];
}

async function scrapeHtml() {
  const res = await fetch(`${BASE_URL}/shows`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; nyc-tonight/1.0)'
    }
  });

  if (!res.ok) {
    console.error(`[ohmyrockness] HTML scrape HTTP ${res.status}`);
    return [];
  }

  const html = await res.text();
  const $ = cheerio.load(html);
  const events = [];

  // Try various selectors for show listings
  $('.show, .show-listing, [class*="show"]').each((i, el) => {
    const $el = $(el);
    const name = $el.find('h2, h3, .show-name, .headliners, [class*="headliner"]').first().text().trim();
    const venue = $el.find('.venue, [class*="venue"]').first().text().trim();
    const dateText = $el.find('time, .date, [class*="date"]').first().text().trim();
    const link = $el.find('a').first().attr('href') || '';
    
    if (name) {
      events.push({
        name,
        artists: name.split(/[,&\/]/).map(s => s.trim()).filter(Boolean),
        venue: venue || '',
        date: parseDate(dateText),
        time: '',
        url: link.startsWith('http') ? link : `${BASE_URL}${link}`,
        source: 'ohmyrockness',
        genre: '',
        subGenre: '',
        type: 'music'
      });
    }
  });

  console.log(`[ohmyrockness] Found ${events.length} events from HTML`);
  return events;
}

function parseDate(text) {
  if (!text) return '';
  try {
    const d = new Date(text);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  } catch {}
  const match = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match) return match[0];
  return '';
}

module.exports = { scrape };
