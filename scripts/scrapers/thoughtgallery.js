const fetch = require('node-fetch');
const cheerio = require('cheerio');

const BASE_URL = 'https://thoughtgallery.org';

async function scrape() {
  try {
    console.log('[thoughtgallery] Fetching cultural events...');
    const res = await fetch(`${BASE_URL}/calendar/`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; nyc-tonight/1.0)' }
    });

    if (!res.ok) {
      console.error(`[thoughtgallery] HTTP ${res.status}`);
      return [];
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const events = [];
    let currentDate = '';

    // Walk through all items in order — date headers set the current date,
    // event containers have the event details
    $('.date_group_header, .all_categories_item_container').each((i, el) => {
      const $el = $(el);
      
      if ($el.hasClass('date_group_header')) {
        // e.g. "Tuesday, February 24, 2026"
        currentDate = parseDate($el.text().trim());
        return;
      }
      
      // Event item
      const timeText = $el.find('.all_categories_time_container').text().trim();
      const eventContainer = $el.find('.all_categories_event_container');
      
      const titleLink = eventContainer.find('h3 a').first();
      const title = titleLink.text().trim();
      const href = titleLink.attr('href') || '';
      
      const location = eventContainer.find('.location').first().text().trim();
      const categories = [];
      eventContainer.find('.category a').each((j, cat) => {
        categories.push($(cat).text().trim());
      });
      
      if (!title) return;
      
      const url = href.startsWith('http') ? href : `${BASE_URL}/${href.replace(/^\//, '')}`;
      const time = parseTime(timeText);
      
      events.push({
        name: title,
        description: categories.join(', '),
        venue: location,
        date: currentDate,
        time,
        url,
        source: 'thoughtgallery',
        genre: 'cultural',
        subGenre: categorizeFromTags(categories),
        type: 'cultural',
        categories
      });
    });

    // Filter to next 14 days
    const now = new Date();
    const twoWeeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const nowStr = now.toISOString().split('T')[0];
    const twoWeeksStr = twoWeeks.toISOString().split('T')[0];
    
    const filtered = events.filter(e => {
      if (!e.date) return true; // keep events without dates
      return e.date >= nowStr && e.date <= twoWeeksStr;
    });

    console.log(`[thoughtgallery] Found ${events.length} total events, ${filtered.length} in next 14 days`);
    return filtered;
  } catch (err) {
    console.error(`[thoughtgallery] Error: ${err.message}`);
    return [];
  }
}

function parseDate(text) {
  if (!text) return '';
  try {
    const cleaned = text.replace(/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s*/i, '');
    const d = new Date(cleaned);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  } catch {}
  return '';
}

function parseTime(text) {
  if (!text) return '';
  const match = text.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return '';
  let hour = parseInt(match[1]);
  const min = match[2];
  const ampm = match[3].toUpperCase();
  if (ampm === 'PM' && hour !== 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${min}`;
}

function categorizeFromTags(categories) {
  const tags = categories.map(c => c.toLowerCase()).join(' ');
  if (tags.includes('science') || tags.includes('tech')) return 'science';
  if (tags.includes('books') || tags.includes('literary')) return 'literature';
  if (tags.includes('art') || tags.includes('photo') || tags.includes('design')) return 'art';
  if (tags.includes('performing') || tags.includes('film')) return 'performing-arts';
  if (tags.includes('politics') || tags.includes('legal') || tags.includes('economics')) return 'politics';
  if (tags.includes('history')) return 'history';
  if (tags.includes('lgbtq')) return 'lgbtq';
  if (tags.includes('religion') || tags.includes('spiritual')) return 'religion';
  return 'talk';
}

module.exports = { scrape };
