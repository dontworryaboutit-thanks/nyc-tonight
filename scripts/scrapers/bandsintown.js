const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');

const APP_ID = 'nyc-tonight';
const BASE_URL = 'https://rest.bandsintown.com/artists';

// Rate limit: be nice, 100ms between requests
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function scrape() {
  const profilePath = path.join(__dirname, '../../taste-profile.json');
  const profile = JSON.parse(fs.readFileSync(profilePath, 'utf-8'));
  
  // Top 100 artists by score
  const artists = profile.topArtists
    .sort((a, b) => b.score - a.score)
    .slice(0, 100);

  console.log(`[bandsintown] Checking events for top ${artists.length} artists...`);
  
  const allEvents = [];
  let found = 0;
  let checked = 0;

  for (const artist of artists) {
    checked++;
    try {
      const encoded = encodeURIComponent(artist.name);
      const url = `${BASE_URL}/${encoded}/events?app_id=${APP_ID}&date=upcoming`;
      const res = await fetch(url);
      
      if (!res.ok) {
        await sleep(100);
        continue;
      }

      const events = await res.json();
      
      if (!Array.isArray(events)) {
        await sleep(100);
        continue;
      }

      // Filter to NYC area
      const nycEvents = events.filter(ev => {
        const city = (ev.venue?.city || '').toLowerCase();
        const region = (ev.venue?.region || '').toLowerCase();
        return (
          city === 'new york' || 
          city === 'brooklyn' || 
          city === 'queens' ||
          city === 'bronx' ||
          (region === 'ny' && ['jersey city', 'hoboken'].includes(city)) ||
          city.includes('new york')
        );
      });

      for (const ev of nycEvents) {
        found++;
        const date = ev.datetime ? ev.datetime.split('T')[0] : '';
        const time = ev.datetime ? ev.datetime.split('T')[1]?.replace(/:\d{2}$/, '') : '';
        
        allEvents.push({
          name: ev.title || `${artist.name} live`,
          artists: [artist.name, ...(ev.lineup || []).filter(a => a !== artist.name)],
          venue: ev.venue?.name || 'Unknown Venue',
          date,
          time: time || '',
          url: ev.url || '',
          source: 'bandsintown',
          genre: '',
          subGenre: '',
          type: 'music',
          _tasteScore: artist.score // carry through for scoring
        });
      }

      if (checked % 20 === 0) {
        console.log(`[bandsintown] Checked ${checked}/${artists.length} artists, found ${found} NYC events so far`);
      }

      await sleep(100);
    } catch (err) {
      // Skip individual artist failures
      await sleep(100);
    }
  }

  console.log(`[bandsintown] Done. Found ${allEvents.length} NYC events from ${artists.length} artists`);
  return allEvents;
}

module.exports = { scrape };
