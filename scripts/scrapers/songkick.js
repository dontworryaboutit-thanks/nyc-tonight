const fetch = require('node-fetch');
const cheerio = require('cheerio');

const BASE_URL = 'https://www.songkick.com/metro-areas/7644-us-new-york';
const MAX_PAGES = 6; // 50 per page = ~300 events

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function scrape() {
  const allEvents = [];
  
  try {
    console.log('[songkick] Fetching NYC concerts...');
    
    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = page === 1 ? BASE_URL : `${BASE_URL}?page=${page}`;
      
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; nyc-tonight/1.0)' }
      });
      
      if (!res.ok) {
        console.warn(`[songkick] Page ${page}: HTTP ${res.status}`);
        break;
      }
      
      const html = await res.text();
      const $ = cheerio.load(html);
      
      // Extract JSON-LD structured data
      const jsonLdBlocks = [];
      $('script[type="application/ld+json"]').each((i, el) => {
        try {
          const data = JSON.parse($(el).html());
          const items = Array.isArray(data) ? data : [data];
          for (const item of items) {
            if (item['@type'] === 'MusicEvent') {
              jsonLdBlocks.push(item);
            }
          }
        } catch {}
      });
      
      if (jsonLdBlocks.length === 0) break;
      
      for (const ev of jsonLdBlocks) {
        const name = ev.name || '';
        const startDate = ev.startDate || '';
        const date = startDate.split('T')[0];
        const time = startDate.includes('T') ? startDate.split('T')[1].substring(0, 5) : '';
        const venue = ev.location?.name || '';
        const eventUrl = ev.url || '';
        const performers = (ev.performer || []).map(p => p.name).filter(Boolean);
        
        // Skip events in the past
        if (date && date < new Date().toISOString().split('T')[0]) continue;
        
        // Clean up name — Songkick often includes "@ Venue" in title
        const cleanName = name.replace(/ @ .+$/, '').trim();
        
        // Extract image if available
        const image = ev.image || (ev.performer?.[0]?.image) || '';
        
        allEvents.push({
          name: cleanName || name,
          artists: performers.length ? performers : [cleanName || name],
          venue,
          date,
          time,
          url: eventUrl.split('?')[0],
          source: 'songkick',
          genre: '',
          subGenre: '',
          type: 'music',
          image: typeof image === 'string' ? image : ''
        });
      }
      
      console.log(`[songkick] Page ${page}: ${jsonLdBlocks.length} events (${allEvents.length} total)`);
      
      if (jsonLdBlocks.length < 50) break; // last page
      await sleep(300);
    }
    
    console.log(`[songkick] Done. Found ${allEvents.length} NYC events`);
    return allEvents;
  } catch (err) {
    console.error(`[songkick] Error: ${err.message}`);
    return [];
  }
}

module.exports = { scrape };
