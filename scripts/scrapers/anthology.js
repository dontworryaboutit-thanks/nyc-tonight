const fetch = require('node-fetch');
const cheerio = require('cheerio');

async function scrape() {
  try {
    console.log('[anthology] Fetching Anthology Film Archives screenings...');
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    
    const res = await fetch(
      `https://anthologyfilmarchives.org/film_screenings/calendar?view=list&month=${month}&year=${year}`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; nyc-tonight/1.0)' } }
    );
    if (!res.ok) return [];
    
    const html = await res.text();
    const $ = cheerio.load(html);
    const events = [];
    let currentDate = '';
    
    // Anthology uses a list view with date headers and screening items
    // Structure: date header → list of screenings with times and titles
    $('*').each((i, el) => {
      const $el = $(el);
      
      // Date anchors like id="day-24"
      if ($el.attr('id')?.startsWith('day-')) {
        const day = $el.attr('id').replace('day-', '');
        currentDate = `${year}-${month}-${day.padStart(2, '0')}`;
        return;
      }
      
      // Look for screening links
      if (el.tagName === 'a' && $el.attr('href')?.includes('film_screenings')) {
        const title = $el.text().trim();
        if (!title || title.length < 3) return;
        if (/^(film screenings|calendar|month view|list view)/i.test(title)) return;
        
        // Time is usually in a preceding element
        const parentText = $el.parent().text().trim();
        const timeMatch = parentText.match(/(\d{1,2}:\d{2}\s*[AP]M)/i);
        let time = '';
        if (timeMatch) {
          const t = timeMatch[1];
          const match = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
          if (match) {
            let h = parseInt(match[1]);
            if (match[3].toUpperCase() === 'PM' && h !== 12) h += 12;
            if (match[3].toUpperCase() === 'AM' && h === 12) h = 0;
            time = `${String(h).padStart(2, '0')}:${match[2]}`;
          }
        }
        
        // Skip dupes (same title + date)
        if (events.some(e => e.name === title && e.date === currentDate && e.time === time)) return;
        
        events.push({
          name: title,
          artists: [],
          director: '',
          venue: 'Anthology Film Archives',
          date: currentDate,
          time,
          url: `https://anthologyfilmarchives.org${$el.attr('href') || ''}`,
          source: 'anthology',
          genre: 'film',
          subGenre: 'experimental',
          type: 'film',
          description: ''
        });
      }
    });
    
    // Filter to upcoming only
    const today = now.toISOString().split('T')[0];
    const filtered = events.filter(e => !e.date || e.date >= today);
    
    console.log(`[anthology] Found ${filtered.length} upcoming screenings`);
    return filtered;
  } catch (err) {
    console.error(`[anthology] Error: ${err.message}`);
    return [];
  }
}

module.exports = { scrape };
