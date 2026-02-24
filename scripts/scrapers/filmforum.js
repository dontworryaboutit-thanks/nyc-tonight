const fetch = require('node-fetch');
const cheerio = require('cheerio');

async function scrape() {
  const allEvents = [];
  
  try {
    console.log('[filmforum] Fetching Film Forum screenings...');
    
    // Scrape now-playing and upcoming
    for (const section of ['now-playing', 'coming-soon']) {
      try {
        const res = await fetch(`https://filmforum.org/${section}`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; nyc-tonight/1.0)' }
        });
        
        if (!res.ok) continue;
        const html = await res.text();
        const $ = cheerio.load(html);
        
        // Film Forum uses .film-details blocks
        $('.film-details').each((i, el) => {
          const $el = $(el);
          const $parent = $el.closest('.film, .screening, [class*="film"]').length 
            ? $el.closest('.film, .screening, [class*="film"]') 
            : $el.parent();
          
          // Get title from nearby h5 with class "title" or any heading
          const titleEl = $parent.find('h5.title a, h4.title a, h3 a, h2 a').first();
          const title = titleEl.text().replace(/♪[^♪]*♪/g, '').replace(/<br\s*\/?>/g, ' ').trim();
          const url = titleEl.attr('href') || '';
          
          // Get date/time info
          const dateText = $parent.find('.date, .dates, .screening-date, time').first().text().trim();
          const details = $el.text().trim();
          
          if (title && title.length > 2) {
            allEvents.push({
              name: title,
              artists: [], // Films don't have "artists" in the music sense
              director: extractDirector(details),
              venue: 'Film Forum',
              date: '', // Film Forum shows run ranges, not single dates
              time: '',
              url: url.startsWith('http') ? url : `https://filmforum.org${url}`,
              source: 'filmforum',
              genre: 'film',
              subGenre: categorizeFilm(title + ' ' + details),
              type: 'film',
              description: details.substring(0, 200)
            });
          }
        });
        
        // Also grab direct film links from the page
        $('a[href*="/film/"]').each((i, el) => {
          const $el = $(el);
          const title = $el.text().replace(/♪[^♪]*♪/g, '').replace(/<br\s*\/?>/g, ' ').trim();
          const url = $el.attr('href') || '';
          
          if (title && title.length > 2 && title.length < 100) {
            // Avoid duplicates
            const exists = allEvents.some(e => 
              e.name.toLowerCase() === title.toLowerCase()
            );
            if (!exists) {
              allEvents.push({
                name: title,
                artists: [],
                director: '',
                venue: 'Film Forum',
                date: '',
                time: '',
                url: url.startsWith('http') ? url : `https://filmforum.org${url}`,
                source: 'filmforum',
                genre: 'film',
                subGenre: '',
                type: 'film',
                description: ''
              });
            }
          }
        });
        
      } catch (err) {
        console.warn(`[filmforum] Error scraping ${section}: ${err.message}`);
      }
    }
    
    console.log(`[filmforum] Found ${allEvents.length} films`);
    return allEvents;
  } catch (err) {
    console.error(`[filmforum] Error: ${err.message}`);
    return [];
  }
}

function extractDirector(text) {
  const match = text.match(/(?:dir(?:ected)?\.?\s*(?:by)?\s*:?\s*)([A-Z][a-zÀ-ÿ]+ [A-Z][a-zÀ-ÿ]+)/i);
  return match ? match[1] : '';
}

function categorizeFilm(text) {
  const lower = text.toLowerCase();
  if (/documentary|doc\b/.test(lower)) return 'documentary';
  if (/classic|restor|retrospect/.test(lower)) return 'classic';
  if (/foreign|subtitl|french|italian|japanese|korean|german/.test(lower)) return 'world cinema';
  if (/experiment|avant|underground/.test(lower)) return 'experimental';
  if (/animation|animated/.test(lower)) return 'animation';
  if (/noir|thriller|horror/.test(lower)) return 'genre';
  return '';
}

module.exports = { scrape };
