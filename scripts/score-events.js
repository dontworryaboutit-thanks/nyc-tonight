const fs = require('fs');
const path = require('path');

// Venue tier list — places that book stuff this user would love
const VENUE_TIERS = {
  // Tier 1: Perfect taste alignment (10pts)
  tier1: [
    'village vanguard', 'le poisson rouge', 'national sawdust', 'roulette',
    'pioneer works', 'issue project room', 'public records', 'nublu',
    'smalls', 'barbes', '55 bar', 'dizzy\'s club', 'the stone',
    'cafe oto', 'experimental intermedia'
  ],
  // Tier 2: Great venues, eclectic booking (7pts)
  tier2: [
    'brooklyn steel', 'baby\'s all right', 'elsewhere', 'knockdown center',
    'sultan room', 'blue note', 'jazz standard', 'market hotel',
    'rough trade', 'union pool', 'trans-pecos', 'the hall at elsewhere',
    'zankel hall', 'david geffen hall', 'stern auditorium',
    'joe\'s pub', 'le poisson rouge', 'bowery ballroom', 'music hall of williamsburg'
  ],
  // Tier 3: Solid venues (4pts)
  tier3: [
    'brooklyn academy of music', 'bam', 'town hall', 'beacon theatre',
    'terminal 5', 'irving plaza', 'webster hall', 'kings theatre',
    'brooklyn mirage', 'avant gardner', 'racket', 'tv eye',
    'carnegie hall', 'metropolitan museum', 'the met', 'moma',
    'whitney museum', 'new museum', 'the shed', 'park avenue armory'
  ]
};

// Cultural keywords from books/film taste — for scoring non-music events
const CULTURAL_KEYWORDS = {
  // From Goodreads (Bolaño, Murdoch, Le Guin, Baldwin, Lispector, PKD, Vonnegut)
  highAffinity: [
    'philosophy', 'existential', 'literary', 'fiction', 'sci-fi', 'science fiction',
    'speculative', 'dystopia', 'utopia', 'surreal', 'magical realism',
    'latin american', 'japanese', 'african', 'postcolonial', 'translation',
    'experimental', 'avant-garde', 'consciousness', 'identity', 'queer',
    'ai', 'artificial intelligence', 'technology', 'digital', 'future',
    'poetry', 'essay', 'journalism', 'media', 'culture', 'subculture'
  ],
  mediumAffinity: [
    'art', 'visual', 'design', 'architecture', 'photography', 'film',
    'cinema', 'documentary', 'animation', 'world', 'global', 'urban',
    'politics', 'justice', 'democracy', 'history', 'anthropology',
    'psychology', 'neuroscience', 'ecology', 'nature', 'climate'
  ]
};

function loadTasteProfile(rootDir) {
  const profilePath = path.join(rootDir, 'taste-profile.json');
  const profile = JSON.parse(fs.readFileSync(profilePath, 'utf-8'));
  
  // Build lookup maps
  const artistScores = new Map();
  for (const a of profile.topArtists || []) {
    artistScores.set(a.name.toLowerCase(), a.score);
  }
  
  const genreKeywords = new Set(
    (profile.genreKeywords || profile.keywords || []).map(g => g.toLowerCase())
  );

  return { artistScores, genreKeywords, raw: profile };
}

function loadCulturalProfile(rootDir) {
  // Load Goodreads data for cultural signal
  const themes = new Set();
  
  try {
    const goodreadsPath = path.join(rootDir, 'data/goodreads.csv');
    if (fs.existsSync(goodreadsPath)) {
      const csv = fs.readFileSync(goodreadsPath, 'utf-8');
      const lines = csv.split('\n');
      // Extract shelves/genres from highly-rated books
      for (const line of lines) {
        // Goodreads CSV has "Bookshelves" and "My Rating" columns
        if (line.includes('"5"') || line.includes('"4"')) {
          const lower = line.toLowerCase();
          if (lower.includes('fiction')) themes.add('fiction');
          if (lower.includes('sci-fi') || lower.includes('science-fiction')) themes.add('sci-fi');
          if (lower.includes('philosophy')) themes.add('philosophy');
          if (lower.includes('poetry')) themes.add('poetry');
        }
      }
    }
  } catch (err) {
    console.warn('[scorer] Could not load Goodreads data:', err.message);
  }

  try {
    const ratingsPath = path.join(rootDir, 'data/letterboxd/ratings.csv');
    if (fs.existsSync(ratingsPath)) {
      const csv = fs.readFileSync(ratingsPath, 'utf-8');
      // Just count it as present — the CULTURAL_KEYWORDS will do the matching
      if (csv.length > 100) themes.add('film-lover');
    }
  } catch (err) {
    console.warn('[scorer] Could not load Letterboxd data:', err.message);
  }

  return themes;
}

function scoreEvent(event, taste, culturalProfile) {
  let score = 0;
  let breakdown = {};

  const eventText = [
    event.name, 
    event.genre, 
    event.subGenre, 
    event.description || '',
    event.venue
  ].join(' ').toLowerCase();

  // === 1. DIRECT ARTIST MATCH (max 40pts) ===
  let directMatch = 0;
  const matchedArtists = [];
  for (const artist of event.artists || []) {
    const artistLower = artist.toLowerCase();
    const tasteScore = taste.artistScores.get(artistLower);
    if (tasteScore !== undefined) {
      // Normalize taste score (0-1.1ish) to contribution (max ~40pts for top artist)
      directMatch = Math.max(directMatch, Math.min(40, tasteScore * 36));
      matchedArtists.push(artist);
    }
  }
  score += directMatch;
  breakdown.directMatch = Math.round(directMatch * 10) / 10;
  breakdown.matchedArtists = matchedArtists;

  // === 2. GENRE MATCH (max 25pts) ===
  let genreMatch = 0;
  const eventGenres = [event.genre, event.subGenre]
    .filter(Boolean)
    .map(g => g.toLowerCase());
  
  for (const g of eventGenres) {
    // Check each word in the genre against taste keywords
    const words = g.split(/[\s,\-\/]+/);
    for (const word of words) {
      if (taste.genreKeywords.has(word)) {
        genreMatch += 8;
      }
    }
    // Also check full genre string
    if (taste.genreKeywords.has(g)) {
      genreMatch += 12;
    }
  }
  genreMatch = Math.min(25, genreMatch);
  score += genreMatch;
  breakdown.genreMatch = genreMatch;

  // === 3. VENUE BONUS (max 10pts) ===
  let venueBonus = 0;
  const venueLower = (event.venue || '').toLowerCase();
  if (VENUE_TIERS.tier1.some(v => venueLower.includes(v))) {
    venueBonus = 10;
  } else if (VENUE_TIERS.tier2.some(v => venueLower.includes(v))) {
    venueBonus = 7;
  } else if (VENUE_TIERS.tier3.some(v => venueLower.includes(v))) {
    venueBonus = 4;
  }
  score += venueBonus;
  breakdown.venueBonus = venueBonus;

  // === 4. CULTURAL SIGNAL (max 15pts, mainly for non-music events) ===
  let culturalSignal = 0;
  if (event.type === 'cultural' || event.source === 'thoughtgallery') {
    for (const keyword of CULTURAL_KEYWORDS.highAffinity) {
      if (eventText.includes(keyword)) {
        culturalSignal += 5;
      }
    }
    for (const keyword of CULTURAL_KEYWORDS.mediumAffinity) {
      if (eventText.includes(keyword)) {
        culturalSignal += 3;
      }
    }
    culturalSignal = Math.min(15, culturalSignal);
  }
  score += culturalSignal;
  breakdown.culturalSignal = culturalSignal;

  // === 5. NOVELTY / DISCOVERY BONUS (max 10pts) ===
  let noveltyBonus = 0;
  if (directMatch === 0 && genreMatch > 0) {
    // Unknown artist in a genre you like = discovery opportunity
    noveltyBonus = Math.min(10, genreMatch * 0.4);
    
    // Extra boost if at a great venue (venue acts as taste filter)
    if (venueBonus >= 7) {
      noveltyBonus = Math.min(10, noveltyBonus + 3);
    }
  }
  score += noveltyBonus;
  breakdown.noveltyBonus = Math.round(noveltyBonus * 10) / 10;

  // === 6. FILM SCORING (for film type events) ===
  if (event.type === 'film') {
    // Films at great venues get a boost
    const filmVenues = {
      'film forum': 10, 'metrograph': 10, 'anthology film archives': 10,
      'bam': 8, 'ifc center': 8, 'film at lincoln center': 9,
      'angelika': 5, 'village east': 5, 'nitehawk': 7,
      'museum of the moving image': 8, 'moma': 8
    };
    const vl = (event.venue || '').toLowerCase();
    for (const [v, pts] of Object.entries(filmVenues)) {
      if (vl.includes(v)) { score += pts; break; }
    }
    
    // Classic/art films get a cultural signal boost
    const filmText = (event.name + ' ' + (event.description || '') + ' ' + (event.subGenre || '')).toLowerCase();
    for (const kw of CULTURAL_KEYWORDS.highAffinity) {
      if (filmText.includes(kw)) score += 3;
    }
    score = Math.min(100, score);
  }

  // Final score capped at 100
  score = Math.min(100, Math.round(score * 10) / 10);

  return {
    ...event,
    score,
    breakdown,
    tier: score >= 80 ? 'gold' : score >= 60 ? 'silver' : score >= 40 ? 'bronze' : 'dim'
  };
}

function scoreAll(events, rootDir) {
  console.log(`[scorer] Scoring ${events.length} events...`);
  
  const taste = loadTasteProfile(rootDir);
  const culturalProfile = loadCulturalProfile(rootDir);
  
  console.log(`[scorer] Loaded ${taste.artistScores.size} artists, ${taste.genreKeywords.size} genre keywords`);

  const scored = events
    .map(ev => scoreEvent(ev, taste, culturalProfile))
    .sort((a, b) => b.score - a.score);

  const tiers = { gold: 0, silver: 0, bronze: 0, dim: 0 };
  for (const ev of scored) {
    tiers[ev.tier]++;
  }
  console.log(`[scorer] Results: ${tiers.gold} gold, ${tiers.silver} silver, ${tiers.bronze} bronze, ${tiers.dim} dim`);

  return scored;
}

module.exports = { scoreAll, scoreEvent };
