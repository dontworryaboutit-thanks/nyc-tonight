const fetch = require('node-fetch');
const cheerio = require('cheerio');

const LOCATIONS = [
  { name: 'Nitehawk Williamsburg', url: 'https://nitehawkcinema.com/williamsburg/showtimes/' },
  { name: 'Nitehawk Prospect Park', url: 'https://nitehawkcinema.com/prospectpark/showtimes/' }
];

async function scrape() {
  const allEvents = [];
  
  for (const loc of LOCATIONS) {
    try {
      console.log(`[nitehawk] Fetching ${loc.name}...`);
      const res = await fetch(loc.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; nyc-tonight/1.0)' }
      });
      if (!res.ok) continue;
      
      const html = await res.text();
      const $ = cheerio.load(html);
      
      // Nitehawk uses WordPress blog posts for showtimes
      // Each post title is "Film Title – M/D/YY @ H:MM pm"
      // Try article titles, entry titles, post titles
      const selectors = [
        'h2.entry-title a',
        'h2 a[href*="showtimes"]',
        '.entry-title a',
        'article h2 a',
        '.post-title a',
        'a[href*="showtimes/"]'
      ];
      
      const seen = new Set();
      
      for (const sel of selectors) {
        $(sel).each((i, el) => {
          const $el = $(el);
          const text = $el.text().trim();
          const link = $el.attr('href') || '';
          
          if (seen.has(text)) return;
          
          // Parse "Title – M/D/YY @ H:MM pm"
          const match = text.match(/^(.+?)\s*[–-]\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s*@?\s*(\d{1,2}:\d{2}\s*[ap]m)?/i);
          if (!match) {
            // Also try URL-based parsing: /showtimes/film-title-M-D-YY-HMMpm/
            const urlMatch = link.match(/showtimes\/(.+?)(?:-(\d{1,2})-(\d{1,2})-(\d{2}))?-(\d{1,4})-?([ap]m)?/i);
            if (!urlMatch) return;
          }
          if (!match) return;
          
          seen.add(text);
          
          const title = match[1].trim().replace(/\s*\(\d{4}\)\s*$/, '');
          const month = match[2].padStart(2, '0');
          const day = match[3].padStart(2, '0');
          let year = match[4];
          if (year.length === 2) year = '20' + year;
          const date = `${year}-${month}-${day}`;
          
          let time = '';
          if (match[5]) {
            const tp = match[5].toLowerCase().match(/(\d{1,2}):(\d{2})\s*(am|pm)/);
            if (tp) {
              let h = parseInt(tp[1]);
              if (tp[3] === 'pm' && h !== 12) h += 12;
              if (tp[3] === 'am' && h === 12) h = 0;
              time = `${String(h).padStart(2, '0')}:${tp[2]}`;
            }
          }
          
          allEvents.push({
            name: title,
            artists: [],
            director: '',
            venue: loc.name,
            date,
            time,
            url: link.startsWith('http') ? link : `https://nitehawkcinema.com${link}`,
            source: 'nitehawk',
            genre: 'film',
            subGenre: '',
            type: 'film',
            description: ''
          });
        });
        
        if (allEvents.filter(e => e.venue === loc.name).length > 0) break;
      }
      
      // Fallback: search all links for showtime patterns in href
      if (allEvents.filter(e => e.venue === loc.name).length === 0) {
        $('a[href*="showtimes/"]').each((i, el) => {
          const href = $(el).attr('href') || '';
          const text = $(el).text().trim();
          if (!text || text.length < 3 || seen.has(text)) return;
          
          const match = text.match(/^(.+?)\s*[–-]\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s*@?\s*(\d{1,2}:\d{2}\s*[ap]m)?/i);
          if (!match) return;
          
          seen.add(text);
          const title = match[1].trim().replace(/\s*\(\d{4}\)\s*$/, '');
          const month = match[2].padStart(2, '0');
          const day = match[3].padStart(2, '0');
          let year = match[4]; if (year.length === 2) year = '20' + year;
          
          let time = '';
          if (match[5]) {
            const tp = match[5].toLowerCase().match(/(\d{1,2}):(\d{2})\s*(am|pm)/);
            if (tp) {
              let h = parseInt(tp[1]);
              if (tp[3] === 'pm' && h !== 12) h += 12;
              if (tp[3] === 'am' && h === 12) h = 0;
              time = `${String(h).padStart(2, '0')}:${tp[2]}`;
            }
          }
          
          allEvents.push({
            name: title,
            artists: [],
            director: '',
            venue: loc.name,
            date: `${year}-${month}-${day}`,
            time,
            url: href.startsWith('http') ? href : `https://nitehawkcinema.com${href}`,
            source: 'nitehawk',
            genre: 'film',
            subGenre: '',
            type: 'film',
            description: ''
          });
        });
      }
      
    } catch (err) {
      console.warn(`[nitehawk] Error for ${loc.name}: ${err.message}`);
    }
  }
  
  console.log(`[nitehawk] Found ${allEvents.length} showtimes`);
  return allEvents;
}

module.exports = { scrape };
