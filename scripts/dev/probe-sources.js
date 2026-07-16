// Diagnostic probe round 2: structure deep-dive for Nitehawk, DICE,
// The Skint, AdHoc. Run from CI (GitHub runner has open egress).

const fetch = require('node-fetch');
const cheerio = require('cheerio');

const UA_BROWSER =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

async function get(url, opts = {}) {
  const { method = 'GET', headers = {}, body } = opts;
  try {
    const res = await fetch(url, {
      method,
      headers: { 'User-Agent': UA_BROWSER, Accept: 'text/html,application/json;q=0.9,*/*;q=0.8', ...headers },
      body,
      timeout: 20000
    });
    const text = await res.text();
    console.log(`\n### ${method} ${url}\n    status=${res.status} bytes=${text.length}`);
    return { status: res.status, text };
  } catch (err) {
    console.log(`\n### ${method} ${url}\n    ERROR: ${err.message}`);
    return { status: 0, text: '' };
  }
}

function walkKeys(obj, depth = 0, maxDepth = 3) {
  if (depth > maxDepth || obj === null || typeof obj !== 'object') return;
  const indent = '      ' + '  '.repeat(depth);
  if (Array.isArray(obj)) {
    console.log(`${indent}[array len=${obj.length}]`);
    if (obj.length) walkKeys(obj[0], depth + 1, maxDepth);
    return;
  }
  for (const [k, v] of Object.entries(obj).slice(0, 25)) {
    const t = Array.isArray(v) ? `array(${v.length})` : typeof v;
    const preview = typeof v === 'string' ? ` = "${v.slice(0, 60)}"` : typeof v === 'number' ? ` = ${v}` : '';
    console.log(`${indent}${k}: ${t}${preview}`);
    if (t.startsWith('array') && v.length && typeof v[0] === 'object') walkKeys(v[0], depth + 1, maxDepth);
    else if (t === 'object') walkKeys(v, depth + 1, maxDepth);
  }
}

async function main() {
  console.log('=== SOURCE PROBE ROUND 2 ===');

  // --- 1. Nitehawk: inspect venue page structure ---
  const nh = await get('https://nitehawkcinema.com/williamsburg/');
  if (nh.status === 200) {
    const $ = cheerio.load(nh.text);
    // Dump the first "film" block's HTML to understand structure
    const block = $('.film, .show, .movie, [class*="showtime"]').first();
    console.log('    first film-ish block HTML (1800 chars):');
    console.log('    ' + (block.parent().html() || '').replace(/\s+/g, ' ').slice(0, 1800));
    // Look for date-based navigation
    const dateLinks = new Set();
    $('a[href*="date"], a[href*="?d="], [data-date]').each((i, el) => {
      dateLinks.add(($(el).attr('href') || $(el).attr('data-date') || '').slice(0, 80));
    });
    console.log('    date-ish links:', [...dateLinks].slice(0, 8).join(' | '));
    // Any embedded JSON?
    const scripts = $('script:not([src])');
    scripts.each((i, el) => {
      const txt = $(el).html() || '';
      if (/showtime|sessions|films|movies/i.test(txt) && txt.length > 500) {
        console.log(`    inline script #${i} (${txt.length} bytes) mentions films/showtimes:`);
        console.log('    ' + txt.replace(/\s+/g, ' ').slice(0, 800));
      }
    });
    // API endpoints in page source?
    const apiRefs = nh.text.match(/https?:\/\/[^"'\s]*(?:api|veezi|boxoffice|agile)[^"'\s]*/gi);
    console.log('    api-ish URLs:', apiRefs ? [...new Set(apiRefs)].slice(0, 6).join(' | ') : 'none');
  }
  // Try likely date-view URL
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  await get(`https://nitehawkcinema.com/williamsburg/?date=${tomorrow}`).then(r => {
    if (r.status === 200) {
      const $ = cheerio.load(r.text);
      console.log(`    film blocks on date view: ${$('.film, .show, .movie').length}`);
    }
  });

  // --- 2. DICE unified_search: inspect response shape ---
  const dicePost = (body) => get('https://api.dice.fm/unified_search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  let r = await dicePost({ q: 'new york' });
  if (r.status === 200) {
    try {
      const data = JSON.parse(r.text);
      console.log('    top-level keys + structure:');
      walkKeys(data, 0, 4);
    } catch (e) { console.log('    JSON parse fail:', e.message); }
  }

  // Also check the browse page for embedded state (it 404s but renders SPA content)
  r = await get('https://dice.fm/browse/new-york');
  if (r.text) {
    const $ = cheerio.load(r.text);
    const nd = $('#__NEXT_DATA__');
    console.log(`    __NEXT_DATA__ present: ${nd.length > 0} (${nd.length ? nd.html().length + ' bytes' : ''})`);
    if (nd.length) {
      try {
        const data = JSON.parse(nd.html());
        walkKeys(data?.props?.pageProps || data, 0, 3);
      } catch {}
    }
    const apiRefs = r.text.match(/https?:\/\/api\.dice\.fm[^"'\s\\]*/gi);
    console.log('    api.dice.fm refs:', apiRefs ? [...new Set(apiRefs)].slice(0, 8).join(' | ') : 'none');
  }

  // --- 3. The Skint: RSS item content structure ---
  r = await get('https://theskint.com/feed/');
  if (r.status === 200) {
    const items = r.text.split('<item>').slice(1);
    console.log(`    items: ${items.length}`);
    for (const item of items.slice(0, 3)) {
      const title = (item.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
      const pub = (item.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '';
      console.log(`    --- item: "${title.trim().slice(0, 80)}" pub=${pub.trim()}`);
      const content = (item.match(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/) || [])[1] || '';
      console.log(`    content bytes=${content.length}; first 1000:`);
      console.log('    ' + content.replace(/\s+/g, ' ').slice(0, 1000));
    }
  }

  // --- 4. AdHoc Presents: find the right path ---
  for (const u of ['https://www.adhocpresents.com/', 'https://adhocpresents.com/shows', 'https://www.adhocpresents.com/events']) {
    const a = await get(u);
    if (a.status === 200) {
      const $ = cheerio.load(a.text);
      console.log('    title:', $('title').text().trim().slice(0, 80));
      const links = new Set();
      $('a').each((i, el) => { const h = $(el).attr('href') || ''; if (/show|event/i.test(h)) links.add(h.slice(0, 70)); });
      console.log('    show/event links:', [...links].slice(0, 10).join(' | '));
      break;
    }
  }

  console.log('\n=== PROBE DONE ===');
}

main().catch(e => { console.error(e); process.exit(1); });
