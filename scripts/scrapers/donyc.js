const fetch = require('node-fetch');
const cheerio = require('cheerio');

const BASE_URL = 'https://donyc.com';
const sleep = ms => new Promise(r => setTimeout(r, ms));

function mapType(category, eventName = '') {
  const nameLower = eventName.toLowerCase();
  
  if (category === 'comedy') return 'cultural';
  if (category === 'film') return 'film';
  if (category === 'theatre') return 'cultural';
  
  // Heuristics based on event name
  if (nameLower.includes('comedy') || nameLower.includes('stand up')) return 'cultural';
  if (nameLower.includes('film') || nameLower.includes('screening')) return 'film';
  if (nameLower.includes('theatre') || nameLower.includes('play') || nameLower.includes('broadway')) return 'cultural';
  
  return 'music';
}

function mapGenre(category, eventName = '') {
  const nameLower = eventName.toLowerCase();
  const catLower = String(category).toLowerCase();
  
  if (catLower.includes('comedy')) return 'comedy';
  if (catLower.includes('film')) return 'film';
  if (catLower.includes('theatre') || catLower.includes('theater')) return 'theatre';
  
  if (nameLower.includes('jazz')) return 'jazz';
  if (nameLower.includes('indie')) return 'indie';
  if (nameLower.includes('rock')) return 'rock';
  if (nameLower.includes('electronic') || nameLower.includes('techno') || nameLower.includes('house')) return 'electronic';
  if (nameLower.includes('hip hop') || nameLower.includes('hip-hop') || nameLower.includes('rap')) return 'hip-hop';
  if (nameLower.includes('classical')) return 'classical';
  if (nameLower.includes('folk')) return 'folk';
  if (nameLower.includes('country')) return 'country';
  if (nameLower.includes('soul')) return 'soul';
  if (nameLower.includes('funk')) return 'funk';
  if (nameLower.includes('blues')) return 'blues';
  
  return '';
}

function parseTime(timeStr) {
  if (!timeStr) return '';
  
  // Match time like "7:00PM" or "8:30 PM"
  const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!timeMatch) return '';
  
  let hours = parseInt(timeMatch[1]);
  const minutes = timeMatch[2];
  const ampm = timeMatch[3].toUpperCase();
  
  if (ampm === 'PM' && hours !== 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;
  
  return `${hours.toString().padStart(2, '0')}:${minutes}`;
}

function parseDateFromUrl(url) {
  // Extract date from URLs like /events/2026/5/2/event-name
  const match = url.match(/\/events\/(\d{4})\/(\d{1,2})\/(\d{1,2})\//);
  if (match) {
    const year = match[1];
    const month = match[2].padStart(2, '0');
    const day = match[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return null;
}

async function parseEventsFromPage(url, category) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; nyc-tonight/1.0)' }
  });
  
  if (!res.ok) {
    console.warn(`[donyc] HTTP ${res.status} for ${url}`);
    return [];
  }
  
  const html = await res.text();
  const $ = cheerio.load(html);
  const events = [];
  
  // The structure: Each event is in a ds-listing div containing an h2
  // The HTML structure shows events with pattern:
  // <h2><a href="/events/2026/5/2/event-name">Event Title</a></h2>
  // <a href="/venues/venue-name">Venue Name</a>
  // <time>7:00PM</time>
  
  // Find all links to events
  $('a[href*="/events/"]').each((i, el) => {
    const $el = $(el);
    const eventName = $el.text().trim();
    const href = $el.attr('href') || '';
    
    // Skip if not an actual event link (too short, starts with venues)
    if (!href.includes('/events/')) return;
    if (!eventName || eventName.length < 5) return;
    if (eventName === 'Buy') return;
    if (eventName.toLowerCase() === 'events') return;
    
    // Get parent element to find venue and time
    const parent = $el.closest('.ds-listing, li, article, div').first();
    
    // Look for venue - could be a direct child link or nearby
    let venueName = '';
    const venueEl = parent.find('a[href*="/venues/"]').first();
    if (venueEl.length) {
      venueName = venueEl.text().trim();
    }
    
    // Look for time - could be in a time element or text
    let timeStr = '';
    const timeEl = parent.find('time, .ds-time').first();
    if (timeEl.length) {
      timeStr = timeEl.text().trim();
    } else {
      // Try to find time in parent text
      const parentText = parent.text();
      const timeMatch = parentText.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
      if (timeMatch) timeStr = timeMatch[1];
    }
    
    const eventUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
    const date = parseDateFromUrl(href);
    const time = parseTime(timeStr);
    
    // Extract artist from event name
    const artistName = eventName.split(':')[0].split(' at ')[0].split('/')[0].split(' presents')[0].split(' - ')[0].split(' with ')[0].split(' ft.')[0].split(' featuring')[0].trim();
    
    if (!date) return;
    
    events.push({
      name: eventName,
      artists: [artistName],
      venue: venueName || 'NYC',
      date: date,
      time: time,
      url: eventUrl,
      source: 'donyc',
      type: mapType(category, eventName),
      genre: mapGenre(category, eventName)
    });
  });
  
  return events;
}

async function fetchCategoryPage(category, page = 1) {
  const url = `${BASE_URL}/events/${category}/today?page=${page}`;
  return parseEventsFromPage(url, category);
}

async function fetchTodayTomorrow() {
  // Fetch from today and tomorrow pages for all events
  const events = [];
  
  for (const day of ['today', 'tomorrow']) {
    const url = `${BASE_URL}/events/${day}`;
    try {
      const pageEvents = await parseEventsFromPage(url, 'music');
      events.push(...pageEvents);
    } catch {}
    await sleep(300);
  }
  
  return events;
}

async function fetchMusicByDate(days = 14) {
  const allEvents = [];
  const today = new Date();
  
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const [year, month, day] = d.toISOString().split('T')[0].split('-');
    
    const url = `${BASE_URL}/events/music/${parseInt(year)}/${parseInt(month)}/${parseInt(day)}`;
    try {
      const events = await parseEventsFromPage(url, 'music');
      const newEvents = events.filter(ev => !allEvents.some(e => 
        e.name === ev.name && e.date === ev.date && e.venue === ev.venue
      ));
      allEvents.push(...newEvents);
    } catch {}
    
    await sleep(400);
  }
  
  return allEvents;
}

async function fetchCategoryPages(category, days = 7) {
  const allEvents = [];
  const today = new Date();
  
  // First fetch the category "today" page with pagination
  for (let page = 1; page <= 3; page++) {
    const url = `${BASE_URL}/events/${category}/today?page=${page}`;
    try {
      const events = await parseEventsFromPage(url, category);
      const newEvents = events.filter(ev => !allEvents.some(e => 
        e.name === ev.name && e.date === ev.date
      ));
      allEvents.push(...newEvents);
    } catch {}
    await sleep(300);
  }
  
  // Then fetch date-specific pages
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const [year, month, day] = d.toISOString().split('T')[0].split('-');
    
    const url = `${BASE_URL}/events/${category}/${parseInt(year)}/${parseInt(month)}/${parseInt(day)}`;
    try {
      const events = await parseEventsFromPage(url, category);
      const newEvents = events.filter(ev => !allEvents.some(e => 
        e.name === ev.name && e.date === ev.date
      ));
      allEvents.push(...newEvents);
    } catch {}
    
    await sleep(400);
  }
  
  return allEvents;
}

async function scrape() {
  console.log('[donyc] Fetching NYC events from DoNYC...');
  
  const allEvents = [];
  
  // Fetch music events by specific date (most reliable)
  console.log('[donyc] Fetching music events by date...');
  const musicEvents = await fetchMusicByDate(10);
  allEvents.push(...musicEvents);
  console.log(`[donyc] Got ${musicEvents.length} music events`);
  
  // Fetch comedy events
  console.log('[donyc] Fetching comedy events...');
  const comedyEvents = await fetchCategoryPages('comedy', 4);
  // Filter out duplicate venues/entries  
  const uniqueComedy = comedyEvents.filter(ev => !allEvents.some(e => 
    e.name === ev.name && e.date === ev.date && e.venue === ev.venue
  ));
  allEvents.push(...uniqueComedy);
  console.log(`[donyc] Got ${uniqueComedy.length} comedy events`);
  
  // Fetch film events
  console.log('[donyc] Fetching film events...');
  try {
    const filmEvents = await fetchCategoryPages('film-screenings', 3);
    const uniqueFilm = filmEvents.filter(ev => !allEvents.some(e => 
      e.name === ev.name && e.date === ev.date && e.venue === ev.venue
    ));
    allEvents.push(...uniqueFilm);
    console.log(`[donyc] Got ${uniqueFilm.length} film events`);
  } catch (err) {
    console.log('[donyc] Could not fetch film events:', err.message);
  }
  
  // Fetch theatre/art events
  console.log('[donyc] Fetching theatre/art events...');
  try {
    const theatreEvents = await fetchCategoryPages('theatre-art-design', 3);
    const uniqueTheatre = theatreEvents.filter(ev => !allEvents.some(e => 
      e.name === ev.name && e.date === ev.date && e.venue === ev.venue
    ));
    allEvents.push(...uniqueTheatre);
    console.log(`[donyc] Got ${uniqueTheatre.length} theatre/art events`);
  } catch (err) {
    console.log('[donyc] Could not fetch theatre events:', err.message);
  }
  
  // Deduplicate final list
  const seen = new Set();
  const deduped = [];
  for (const ev of allEvents) {
    const key = `${ev.name}|${ev.venue}|${ev.date}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(ev);
    }
  }
  
  console.log(`[donyc] Total: ${deduped.length} unique events`);
  return deduped;
}

module.exports = { scrape };
