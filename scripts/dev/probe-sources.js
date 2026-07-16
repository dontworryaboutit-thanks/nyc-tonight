// Diagnostic probe: run from CI (GitHub runner has open egress) to check
// source health and feasibility of new sources. Prints structured findings
// to the log; not part of the production build.

const fetch = require('node-fetch');
const cheerio = require('cheerio');

const UA_BOT = 'Mozilla/5.0 (compatible; nyc-tonight/1.0)';
const UA_BROWSER =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

async function probe(label, url, opts = {}) {
  const { ua = UA_BROWSER, method = 'GET', headers = {}, body } = opts;
  try {
    const res = await fetch(url, {
      method,
      headers: { 'User-Agent': ua, Accept: 'text/html,application/json;q=0.9,*/*;q=0.8', ...headers },
      body,
      timeout: 20000,
      redirect: 'follow'
    });
    const text = await res.text();
    console.log(`\n### ${label}`);
    console.log(`    ${method} ${url}`);
    console.log(`    status=${res.status} bytes=${text.length} content-type=${res.headers.get('content-type')}`);
    return { status: res.status, text };
  } catch (err) {
    console.log(`\n### ${label}\n    ${method} ${url}\n    ERROR: ${err.message}`);
    return { status: 0, text: '' };
  }
}

function analyzeHtml(text, checks) {
  if (!text) return;
  const $ = cheerio.load(text);
  for (const [desc, sel] of Object.entries(checks)) {
    const found = $(sel);
    const sample = found.first().text().trim().replace(/\s+/g, ' ').slice(0, 120);
    console.log(`    ${desc}: ${found.length} matches ${sample ? `| first: "${sample}"` : ''}`);
  }
  const jsonLd = $('script[type="application/ld+json"]');
  let ldTypes = [];
  jsonLd.each((i, el) => {
    try {
      const data = JSON.parse($(el).html());
      const items = Array.isArray(data) ? data : [data];
      items.forEach(it => ldTypes.push(it['@type']));
    } catch {}
  });
  console.log(`    JSON-LD blocks: ${jsonLd.length} | types: ${ldTypes.slice(0, 10).join(', ')}`);
  const nextData = $('#__NEXT_DATA__');
  if (nextData.length) console.log(`    __NEXT_DATA__: present (${nextData.html().length} bytes)`);
}

async function main() {
  console.log('=== SOURCE PROBE ===\n');

  // --- 1. Songkick (currently returns 0) ---
  let r = await probe('songkick metro page (bot UA)', 'https://www.songkick.com/metro-areas/7644-us-new-york', { ua: UA_BOT });
  if (r.status !== 200) {
    r = await probe('songkick metro page (browser UA)', 'https://www.songkick.com/metro-areas/7644-us-new-york');
  }
  if (r.status === 200) {
    analyzeHtml(r.text, {
      'event listings (.event-listings li)': '.event-listings li',
      'microformat listings': 'li[title]',
      'artist links': 'a[href*="/concerts/"]'
    });
  } else {
    console.log(`    body starts: ${r.text.slice(0, 300).replace(/\s+/g, ' ')}`);
  }

  // --- 2. Nitehawk (currently returns 0) ---
  for (const url of ['https://nitehawkcinema.com/williamsburg/showtimes/', 'https://nitehawkcinema.com/williamsburg/']) {
    const n = await probe(`nitehawk ${url.split('.com')[1]}`, url);
    if (n.status === 200) {
      analyzeHtml(n.text, {
        'entry titles (h2.entry-title a)': 'h2.entry-title a',
        'showtime links (a[href*=showtimes])': 'a[href*="showtimes"]',
        'film blocks (.film, .show, .movie)': '.film, .show, .movie, [class*="showtime"]'
      });
      const m = n.text.match(/showtimes\/[a-z0-9-]+/gi);
      console.log(`    showtimes/ URLs in raw html: ${m ? m.length : 0} | sample: ${m ? m.slice(0, 3).join(', ') : ''}`);
    } else {
      console.log(`    body starts: ${n.text.slice(0, 300).replace(/\s+/g, ' ')}`);
    }
  }

  // --- 3. DICE ---
  r = await probe('dice browse page', 'https://dice.fm/browse/new-york/music');
  if (r.status === 200) analyzeHtml(r.text, { 'event links': 'a[href*="/event/"]' });
  r = await probe(
    'dice unified search API',
    'https://api.dice.fm/unified_search',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-timestamp': new Date().toISOString() },
      body: JSON.stringify({ q: '', 'types': ['event'], filter: { cities: [{ id: 'new-york' }] } })
    }
  );
  if (r.status === 200) console.log(`    body starts: ${r.text.slice(0, 400)}`);
  else console.log(`    body starts: ${r.text.slice(0, 200)}`);
  r = await probe('dice events api v1', 'https://events-api.dice.fm/v1/events?page[size]=5&filter[cities][]=New%20York');
  console.log(`    body starts: ${r.text.slice(0, 300).replace(/\s+/g, ' ')}`);

  // --- 4. Bandsintown (artist-targeted, driven by taste profile) ---
  for (const artist of ['Floating Points', 'Geese', 'Kamasi Washington']) {
    r = await probe(
      `bandsintown artist events: ${artist}`,
      `https://rest.bandsintown.com/artists/${encodeURIComponent(artist)}/events?app_id=nyc-tonight-personal&date=upcoming`
    );
    console.log(`    body starts: ${r.text.slice(0, 250).replace(/\s+/g, ' ')}`);
  }

  // --- 5. Oh My Rockness (indie shows) ---
  r = await probe('ohmyrockness API no auth', 'https://api.ohmyrockness.com/api/v3/shows.json?index=true&regioned=1');
  console.log(`    body starts: ${r.text.slice(0, 200).replace(/\s+/g, ' ')}`);
  r = await probe('ohmyrockness homepage', 'https://www.ohmyrockness.com/');
  if (r.status === 200) {
    const tokenMatch = r.text.match(/Token token=[^"'\\]+/);
    console.log(`    auth token in page source: ${tokenMatch ? tokenMatch[0].slice(0, 40) + '...' : 'not found'}`);
    const jsSrcs = [];
    cheerio.load(r.text)('script[src]').each((i, el) => jsSrcs.push(cheerio.load(r.text)(el).attr('src')));
    console.log(`    script srcs: ${jsSrcs.slice(0, 8).join(' | ')}`);
  }

  // --- 6. The Skint (daily free/cheap NYC events blog, WordPress) ---
  r = await probe('theskint RSS', 'https://theskint.com/feed/');
  if (r.status === 200) {
    const items = r.text.match(/<item>/g);
    console.log(`    RSS items: ${items ? items.length : 0}`);
    const title = r.text.match(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>/);
    console.log(`    first item title: ${title ? title[1].trim().slice(0, 100) : 'n/a'}`);
  }

  // --- 7. AdHoc Presents (indie/experimental shows NYC) ---
  r = await probe('adhoc presents shows', 'https://www.adhocpresents.com/shows');
  if (r.status === 200) analyzeHtml(r.text, { 'show links': 'a[href*="/shows/"], a[href*="/event"]', 'headings': 'h1,h2,h3' });

  // --- 8. NYC Parks free events ---
  r = await probe('nycgovparks events', 'https://www.nycgovparks.org/events');
  if (r.status === 200) analyzeHtml(r.text, { 'event rows': '.event, [class*="event"]' });

  console.log('\n=== PROBE DONE ===');
}

main().catch(e => { console.error(e); process.exit(1); });
