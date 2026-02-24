const fetch = require('node-fetch');
const cheerio = require('cheerio');

async function scrape() {
  try {
    console.log('[ifc] Fetching IFC Center films...');
    const res = await fetch('https://www.ifccenter.com', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; nyc-tonight/1.0)' }
    });
    if (!res.ok) return [];
    
    const html = await res.text();
    const $ = cheerio.load(html);
    const events = [];
    
    // IFC lists films as linked blocks on homepage
    $('a[href*="/films/"]').each((i, el) => {
      const $el = $(el);
      const href = $el.attr('href') || '';
      const text = $el.text().trim();
      
      // Skip nav/empty links
      if (!text || text.length < 3 || text.length > 300) return;
      if (/^(home|about|films|membership|merch|trailers|menu|now playing)/i.test(text)) return;
      
      // Parse title and details from the block text
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      const title = lines[0] || '';
      const rest = lines.slice(1).join(' ');
      
      // Extract dates/times from the text
      const dateMatch = rest.match(/(Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d+/i);
      const timeMatch = rest.match(/at\s+(\d{1,2}:\d{2})/);
      
      let date = '';
      if (dateMatch) {
        try {
          const d = new Date(dateMatch[0] + ' 2026');
          if (!isNaN(d.getTime())) date = d.toISOString().split('T')[0];
        } catch {}
      }
      
      const time = timeMatch ? timeMatch[1] : '';
      
      // Skip dupes
      if (events.some(e => e.name === title)) return;
      if (/trailer|buy ticket|watch/i.test(title)) return;
      
      const url = href.startsWith('http') ? href : `https://www.ifccenter.com${href}`;
      
      events.push({
        name: title,
        artists: [],
        director: '',
        venue: 'IFC Center',
        date,
        time,
        url,
        source: 'ifc',
        genre: 'film',
        subGenre: '',
        type: 'film',
        description: rest.substring(0, 200)
      });
    });
    
    console.log(`[ifc] Found ${events.length} films`);
    return events;
  } catch (err) {
    console.error(`[ifc] Error: ${err.message}`);
    return [];
  }
}

module.exports = { scrape };
