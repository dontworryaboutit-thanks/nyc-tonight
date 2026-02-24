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

// Load taste DNA for cultural + cross-disciplinary scoring
function loadTasteDNA(rootDir) {
  try {
    const dnaPath = path.join(rootDir, 'taste-dna.json');
    return JSON.parse(fs.readFileSync(dnaPath, 'utf-8'));
  } catch {
    return null;
  }
}

// Cultural keywords — enriched from taste-dna.json if available, with fallbacks
const CULTURAL_KEYWORDS = {
  highAffinity: [
    'consciousness', 'identity', 'perception', 'memory', 'exile',
    'revolution', 'utopia', 'dystopia', 'surrealism', 'magical realism',
    'journalism', 'investigation', 'technology', 'ai', 'artificial intelligence',
    'translation', 'migration', 'postcolonial', 'queer',
    'philosophy', 'existential', 'phenomenology', 'experimental',
    'avant-garde', 'metafiction', 'craft of writing',
    'latin american', 'japanese', 'korean', 'west african', 'south asian',
    'cross-cultural', 'cross-genre', 'improvisation',
    'documentary', 'music documentary', 'retrospective',
    'sci-fi', 'science fiction', 'speculative',
    'literary', 'poetry', 'essay', 'media', 'culture', 'subculture'
  ],
  mediumAffinity: [
    'art', 'visual', 'design', 'architecture', 'photography', 'film',
    'cinema', 'animation', 'world', 'global', 'urban',
    'politics', 'justice', 'democracy', 'history', 'anthropology',
    'psychology', 'neuroscience', 'ecology', 'nature', 'climate',
    'auteur', 'indie', 'classic cinema', 'essay film'
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

function scoreEvent(event, taste, culturalProfile, tasteDNA) {
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
  
  // Use taste DNA venue affinities if available, fall back to hardcoded
  const dnaVenues = tasteDNA?.venueAffinities;
  const t1 = dnaVenues 
    ? [...(dnaVenues.tier1_perfect?.music || []), ...(dnaVenues.tier1_perfect?.cultural || [])].map(v => v.toLowerCase())
    : VENUE_TIERS.tier1;
  const t2 = dnaVenues
    ? [...(dnaVenues.tier2_great?.music || []), ...(dnaVenues.tier2_great?.cultural || [])].map(v => v.toLowerCase())
    : VENUE_TIERS.tier2;
  const t3 = dnaVenues
    ? [...(dnaVenues.tier3_solid?.music || []), ...(dnaVenues.tier3_solid?.cultural || [])].map(v => v.toLowerCase())
    : VENUE_TIERS.tier3;
    
  if (t1.some(v => venueLower.includes(v))) {
    venueBonus = 10;
  } else if (t2.some(v => venueLower.includes(v))) {
    venueBonus = 7;
  } else if (t3.some(v => venueLower.includes(v))) {
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
    const filmVenues = tasteDNA?.venueAffinities?.tier1_perfect?.film || [];
    const filmVenues2 = tasteDNA?.venueAffinities?.tier2_great?.film || [];
    const vl = (event.venue || '').toLowerCase();
    
    if (filmVenues.some(v => vl.includes(v.toLowerCase()))) {
      score += 10;
    } else if (filmVenues2.some(v => vl.includes(v.toLowerCase()))) {
      score += 6;
    }
    
    // Classic/art films get a cultural signal boost
    const filmText = (event.name + ' ' + (event.description || '') + ' ' + (event.subGenre || '')).toLowerCase();
    for (const kw of CULTURAL_KEYWORDS.highAffinity) {
      if (filmText.includes(kw)) score += 3;
    }
    
    // Director matching from taste DNA
    if (tasteDNA?.filmTaste?.favoredDirectors) {
      for (const dir of tasteDNA.filmTaste.favoredDirectors) {
        if (filmText.includes(dir.toLowerCase())) {
          score += 15;
          break;
        }
      }
    }
    
    // Cross-disciplinary signal boost
    if (tasteDNA?.crossDisciplinarySignals?.eventScoringHints?.strongPositive) {
      for (const hint of tasteDNA.crossDisciplinarySignals.eventScoringHints.strongPositive) {
        // Check if any words from the hint appear in event text
        const hintWords = hint.toLowerCase().split(/\s+/).filter(w => w.length > 4);
        const matches = hintWords.filter(w => filmText.includes(w)).length;
        if (matches >= 2) { score += 5; break; }
      }
    }
    
    score = Math.min(100, score);
  }
  
  // === 7. CROSS-DISCIPLINARY BOOST (for all event types) ===
  if (tasteDNA?.crossDisciplinarySignals?.eventScoringHints?.strongPositive) {
    const allText = eventText;
    for (const hint of tasteDNA.crossDisciplinarySignals.eventScoringHints.strongPositive) {
      const hintWords = hint.toLowerCase().split(/\s+/).filter(w => w.length > 4);
      const matches = hintWords.filter(w => allText.includes(w)).length;
      if (matches >= 2) { score += 3; break; }
    }
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

  const tasteDNA = loadTasteDNA(rootDir);
  if (tasteDNA) {
    console.log(`[scorer] Loaded taste DNA (${Object.keys(tasteDNA).length} sections)`);
  }

  const scored = events
    .map(ev => scoreEvent(ev, taste, culturalProfile, tasteDNA))
    .sort((a, b) => b.score - a.score);

  const tiers = { gold: 0, silver: 0, bronze: 0, dim: 0 };
  for (const ev of scored) {
    tiers[ev.tier]++;
  }
  console.log(`[scorer] Results: ${tiers.gold} gold, ${tiers.silver} silver, ${tiers.bronze} bronze, ${tiers.dim} dim`);

  return scored;
}

module.exports = { scoreAll, scoreEvent };
