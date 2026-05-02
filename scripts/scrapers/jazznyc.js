const fetch = require('node-fetch');
const cheerio = require('cheerio');

const BASE_URL = 'https://jazz-nyc.com/';
const sleep = ms => new Promise(r => setTimeout(r, ms));

function parseDate(dateStr) {
  // Input: 05/02/26 -> Output: 2026-05-02
  if (!dateStr || dateStr.length < 6) return null;
  const parts = dateStr.trim().split('/');
  if (parts.length !== 3) return null;
  const month = parts[0].padStart(2, '0');
  const day = parts[1].padStart(2, '0');
  const yearShort = parts[2];
  const year = yearShort.length === 2 ? '20' + yearShort : yearShort;
  return `${year}-${month}-${day}`;
}

function parseTime(timeStr) {
  // Parse various time formats like "7:30 PM", "7:30PM", "7:00PM - 11:30 PM"
  if (!timeStr) return '';
  
  // Extract the first valid time from ranges
  const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!timeMatch) return '';
  
  let hours = parseInt(timeMatch[1]);
  const minutes = timeMatch[2];
  const ampm = timeMatch[3].toUpperCase();
  
  if (ampm === 'PM' && hours !== 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;
  
  return `${hours.toString().padStart(2, '0')}:${minutes}`;
}

async function scrape() {
  const allEvents = [];
  
  try {
    console.log('[jazznyc] Fetching NYC jazz listings...');
    
    const res = await fetch(BASE_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; nyc-tonight/1.0)' }
    });
    
    if (!res.ok) {
      console.warn(`[jazznyc] HTTP ${res.status}`);
      return [];
    }
    
    const html = await res.text();
    const $ = cheerio.load(html);
    
    // Parse the events table
    const rows = $('#eventsTable tbody tr');
    
    rows.each((i, row) => {
      const cells = $(row).find('td');
      if (cells.length < 5) return;
      
      const dateStr = $(cells[0]).text().trim();
      const timeStr = $(cells[1]).text().trim();
      const areaCode = $(cells[2]).text().trim();
      const venueCell = $(cells[3]);
      const performerCell = $(cells[4]);
      
      const date = parseDate(dateStr);
      if (!date) return;
      
      // Skip events in the past
      const today = new Date().toISOString().split('T')[0];
      if (date < today) return;
      
      // Extract venue info
      const venueLink = venueCell.find('a');
      let venueName = venueCell.text().trim();
      let venueUrl = venueLink.length ? venueLink.attr('href') : '';
      
      // If no venue text but has link, extract domain as fallback
      if (!venueName && venueUrl) {
        try {
          const urlObj = new URL(venueUrl);
          venueName = urlObj.hostname.replace(/^www\./, '');
        } catch {}
      }
      
      // Extract performer info
      const performerLink = performerCell.find('a');
      const performerName = performerCell.text().trim();
      const performerUrl = performerLink.length ? performerLink.attr('href') : '';
      
      // Use venue URL if performer URL is not available
      const eventUrl = venueUrl || performerUrl || BASE_URL;
      
      // Cleanup performer name - remove duplicate URLs that appear in text
      const cleanPerformer = performerName.replace(/https?:\/\/\S+/g, '').trim();
      
      // Extract time
      const time = parseTime(timeStr);
      
      // Skip entries that look like "Closed" or "Closed for private event"
      if (cleanPerformer.toLowerCase().includes('closed')) return;
      
      // Skip entries without actual performers
      if (!cleanPerformer || cleanPerformer === 'TBD') return;
      
      // Filter to NYC metro area codes: MT (Manhattan), BK (Brooklyn), BX (Bronx), QS (Queens), SI (Staten Island)
      // Also include: LI (Long Island), NJ (New Jersey), WT (Westchester), RK (Rockland), CT (Connecticut), PA
      // Note: We'll skip LI, NJ, WT, RK, CT, PA for now since they're outside the city's five boroughs
      const nycBoroughs = ['MT', 'BK', 'BX', 'QS', 'SI'];
      const isNycFiveBoroughs = nycBoroughs.includes(areaCode.toUpperCase());
      
      // For this scraper, include all events as they're jazz-specific
      // The user can filter by borough in the UI if needed
      
      allEvents.push({
        name: cleanPerformer,
        artists: [cleanPerformer],
        venue: venueName,
        date: date,
        time: time,
        url: eventUrl,
        source: 'jazznyc',
        type: 'music',
        genre: 'jazz',
        areaCode: areaCode
      });
    });
    
    console.log(`[jazznyc] Found ${allEvents.length} jazz events`);
    return allEvents;
  } catch (err) {
    console.error(`[jazznyc] Error: ${err.message}`);
    return [];
  }
}

module.exports = { scrape };
