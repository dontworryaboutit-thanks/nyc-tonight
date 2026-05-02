# Task: Add New Event Sources to NYC Tonight

## Project
NYC events discovery dashboard at `/tmp/nyc-tonight/`. Scrapes events, scores against taste profile, builds static site.

## Problem
Current sources are DJ/electronic-heavy (RA dominates with 465 of 790 events). Missing: live bands, indie concerts, jazz, singer-songwriters, comedy, theatre. Need to diversify.

## Sources to Add (Priority Order)

### 1. jazz-nyc.com (HIGH PRIORITY — confirmed working)
- URL: `https://jazz-nyc.com/`
- Format: Plain HTML, ~390KB, all daily jazz listings
- Structure: Each event is a row with time, venue link, artist link
- Sample: `05/02/26 | 8:00 PM & 10:30 PM | Blue Note Jazz Club | José James Presents Facing East: The Music of John Coltrane`
- Output: Extract date, time, venue name, artist/show name, URL
- Set `type: 'music'` and `genre: 'jazz'`

### 2. DoNYC / donyc.com (HIGH PRIORITY — confirmed scrapeable) 
- URL: `https://donyc.com/events/today` and `https://donyc.com/events/tomorrow` 
- Also try: `https://donyc.com/events/music/today`, `https://donyc.com/events/2026/5/2` (date-specific)
- Format: Server-rendered HTML with event listings
- Extract: event name, venue, time, date, URL, category (music/comedy/film/theatre)
- This covers indie concerts, comedy, theatre — the biggest gaps
- Important: scrape multiple days (today + next 7-14 days)

### 3. Improve Songkick Scraper (MEDIUM)
- Current scraper at `scripts/scrapers/songkick.js` is only getting 37 events (should be hundreds)
- Check if their HTML structure has changed
- The JSON-LD extraction may be broken — investigate
- Try alternate URLs: `https://www.songkick.com/metro-areas/7644-us-new-york-nyc` (note the `-nyc` suffix)
- Also try paginating more aggressively (currently MAX_PAGES = 6)
- Songkick is critical for live bands, touring artists

### 4. DICE Event Pages (LOWER PRIORITY)  
- Individual event pages have JSON-LD `MusicEvent` data
- But no efficient listing API — the bundle page only has 9 event slugs
- Skip for now unless you find a listing endpoint

## Technical Details

### File structure
- New scrapers go in `scripts/scrapers/` (e.g., `jazznyc.js`, `donyc.js`)
- Each scraper exports: `module.exports = { scrape }` where `scrape()` returns array of event objects
- Register new scrapers in `scripts/run.js` in the `scrapers` array

### Event object format
```js
{
  name: 'Event Name',           // required
  artists: ['Artist 1'],        // array of performer names
  venue: 'Venue Name',          // required
  date: '2026-05-02',           // YYYY-MM-DD format, required
  time: '20:00',                // HH:MM 24hr format
  url: 'https://...',           // link to event
  source: 'jazznyc',            // scraper identifier
  type: 'music',                // music|film|cultural
  genre: 'jazz',                // optional
  subGenre: '',                 // optional
  description: '',              // optional
  image: '',                    // optional image URL
  lat: null,                    // optional
  lng: null                     // optional
}
```

### Dependencies available
- `node-fetch` (require('node-fetch'))
- `cheerio` (require('cheerio'))

### How to test
```bash
# Test individual scraper
node -e "const s = require('./scripts/scrapers/jazznyc'); s.scrape().then(e => console.log(e.length, 'events', JSON.stringify(e[0], null, 2)))"

# Full build
node scripts/run.js
```

### Registering in run.js
Look at existing pattern in `scripts/run.js`:
```js
const scrapers = [
  { name: 'songkick', fn: require('./scrapers/songkick') },
  // ... add new ones here
];
```

## Constraints
- No external dependencies beyond node-fetch and cheerio
- Be respectful with request rates — add 1s delays between pages
- Handle errors gracefully (try/catch, continue on failure)
- Console log progress: `[scraper-name] Fetching...`, `[scraper-name] Found X events`

## After completing scrapers
1. Run `node scripts/run.js` to verify full pipeline works
2. Check event counts per source
3. Commit all changes with clear message
4. Do NOT push (I'll handle that)
