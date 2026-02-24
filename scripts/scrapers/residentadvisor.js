const fetch = require('node-fetch');

const GRAPHQL_URL = 'https://ra.co/graphql';
const NYC_AREA_ID = 8;

async function scrape() {
  try {
    console.log('[ra] Fetching NYC events from Resident Advisor...');
    
    const now = new Date();
    const twoWeeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const startDate = now.toISOString().split('T')[0];
    const endDate = twoWeeks.toISOString().split('T')[0];

    const allEvents = [];
    let page = 1;
    const pageSize = 50;
    let totalResults = Infinity;

    while (allEvents.length < totalResults && page <= 10) {
      const body = {
        operationName: 'GET_DEFAULT_EVENTS_LISTING',
        variables: {
          filters: {
            areas: { eq: NYC_AREA_ID },
            listingDate: { gte: startDate, lte: endDate }
          },
          pageSize,
          page
        },
        query: `query GET_DEFAULT_EVENTS_LISTING($filters:FilterInputDtoInput,$pageSize:Int,$page:Int){
          eventListings(filters:$filters,pageSize:$pageSize,page:$page){
            data{
              event{
                title
                date
                startTime
                contentUrl
                venue{name}
                artists{name}
              }
            }
            totalResults
          }
        }`
      };

      const res = await fetch(GRAPHQL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; nyc-tonight/1.0)',
          'Referer': 'https://ra.co/events/us/newyork'
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        console.error(`[ra] HTTP ${res.status} on page ${page}`);
        break;
      }

      const data = await res.json();
      const listings = data?.data?.eventListings;
      
      if (!listings) {
        console.error('[ra] Unexpected response shape');
        break;
      }

      totalResults = Math.min(listings.totalResults || 0, 500); // cap at 500
      const events = listings.data || [];
      
      if (events.length === 0) break;

      for (const item of events) {
        const ev = item.event;
        if (!ev) continue;

        const date = ev.date ? ev.date.split('T')[0] : '';
        const time = ev.startTime ? ev.startTime.split('T')[1]?.substring(0, 5) : '';
        const artists = (ev.artists || []).map(a => a.name).filter(Boolean);

        allEvents.push({
          name: ev.title || '',
          artists: artists.length ? artists : [ev.title || ''],
          venue: ev.venue?.name || '',
          date,
          time: time || '',
          url: ev.contentUrl ? `https://ra.co${ev.contentUrl}` : '',
          source: 'residentadvisor',
          genre: 'electronic', // RA is primarily electronic music
          subGenre: '',
          type: 'music'
        });
      }

      console.log(`[ra] Page ${page}: ${events.length} events (${allEvents.length}/${totalResults} total)`);
      page++;

      // Small delay between pages
      await new Promise(r => setTimeout(r, 200));
    }

    console.log(`[ra] Done. Found ${allEvents.length} NYC events`);
    return allEvents;
  } catch (err) {
    console.error(`[ra] Error: ${err.message}`);
    return [];
  }
}

module.exports = { scrape };
