const fetch = require('node-fetch');

const API_KEY = 'GQspMmPFcnZ2EMag5gRBGdR5aYMR5jBg';
const BASE_URL = 'https://app.ticketmaster.com/discovery/v2/events.json';

async function scrape() {
  const now = new Date();
  const twoWeeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  
  const params = new URLSearchParams({
    apikey: API_KEY,
    city: 'New York',
    stateCode: 'NY',
    classificationName: 'music',
    startDateTime: now.toISOString().replace(/\.\d+Z/, 'Z'),
    endDateTime: twoWeeks.toISOString().replace(/\.\d+Z/, 'Z'),
    size: '200',
    sort: 'date,asc'
  });

  try {
    console.log('[ticketmaster] Fetching NYC music events...');
    const res = await fetch(`${BASE_URL}?${params}`);
    
    if (!res.ok) {
      console.error(`[ticketmaster] API error: ${res.status} ${res.statusText}`);
      return [];
    }

    const data = await res.json();
    const events = data?._embedded?.events || [];
    console.log(`[ticketmaster] Found ${events.length} events`);

    return events.map(ev => {
      const venue = ev._embedded?.venues?.[0];
      const classification = ev.classifications?.[0];
      const date = ev.dates?.start?.localDate || '';
      const time = ev.dates?.start?.localTime || '';
      
      // Extract artist names from attractions
      const artists = (ev._embedded?.attractions || []).map(a => a.name);
      
      return {
        name: ev.name,
        artists: artists.length ? artists : [ev.name],
        venue: venue?.name || 'Unknown Venue',
        date,
        time,
        url: ev.url || '',
        source: 'ticketmaster',
        genre: classification?.genre?.name || '',
        subGenre: classification?.subGenre?.name || '',
        type: 'music'
      };
    });
  } catch (err) {
    console.error(`[ticketmaster] Error: ${err.message}`);
    return [];
  }
}

module.exports = { scrape };
