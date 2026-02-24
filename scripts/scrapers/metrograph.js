const fetch = require('node-fetch');
const cheerio = require('cheerio');

async function scrape() {
  try {
    console.log('[metrograph] Fetching Metrograph screenings...');
    const res = await fetch('https://metrograph.com/film/', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; nyc-tonight/1.0)' }
    });

    if (!res.ok) {
      console.error(`[metrograph] HTTP ${res.status}`);
      return [];
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const events = [];

    // Metrograph lists films with links to /film/?vista_film_id=...
    // Each film block has: title (h3), director, year/runtime, description
    $('a[href*="vista_film_id"]').each((i, el) => {
      const $el = $(el);
      const href = $el.attr('href') || '';
      
      // Get the film block container
      const $block = $el.closest('div, article, section');
      if (!$block.length) return;
      
      const title = $block.find('h3').first().text().trim();
      if (!title) return;
      
      // Extract director
      const directorMatch = $block.text().match(/Director:\s*([^\n]+)/);
      const director = directorMatch ? directorMatch[1].trim() : '';
      
      // Extract year and runtime
      const techMatch = $block.text().match(/(\d{4})\s*\/\s*(\d+)min/);
      const year = techMatch ? techMatch[1] : '';
      const runtime = techMatch ? techMatch[2] + 'min' : '';
      
      // Extract date (h6 elements like "Mon Feb 23")
      const dateText = $block.find('h6').first().text().trim();
      const date = parseDateText(dateText);
      
      // Get description
      const desc = $block.text()
        .replace(/Director:.*$/m, '')
        .replace(/\d{4}\s*\/\s*\d+min.*$/m, '')
        .replace(title, '')
        .replace(/More\.\.\./g, '')
        .trim()
        .substring(0, 200);
      
      // Skip if duplicate
      if (events.some(e => e.name === title)) return;
      // Skip junk
      if (title.length < 3 || /^(more|buy|ticket|watch)/i.test(title)) return;
      
      const url = href.startsWith('http') ? href : `https://metrograph.com${href}`;
      
      events.push({
        name: title,
        artists: [],
        director,
        venue: 'Metrograph',
        date,
        time: '',
        url,
        source: 'metrograph',
        genre: 'film',
        subGenre: year ? (parseInt(year) < 2000 ? 'classic' : '') : '',
        type: 'film',
        description: (director ? `Dir. ${director}` : '') + 
          (year ? ` (${year})` : '') + 
          (runtime ? ` · ${runtime}` : '') +
          (desc ? ` — ${desc.substring(0, 120)}` : ''),
        year
      });
    });

    console.log(`[metrograph] Found ${events.length} films`);
    return events;
  } catch (err) {
    console.error(`[metrograph] Error: ${err.message}`);
    return [];
  }
}

function parseDateText(text) {
  if (!text) return '';
  try {
    // "Mon Feb 23" or "Tue Feb 24" — need to add year
    const now = new Date();
    const year = now.getFullYear();
    const d = new Date(`${text} ${year}`);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  } catch {}
  return '';
}

module.exports = { scrape };
