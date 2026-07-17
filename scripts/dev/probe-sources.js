// Diagnostic probe round 3: find the DICE request shape that returns events.
// Run from CI (GitHub runner has open egress).

const fetch = require('node-fetch');

const UA_BROWSER =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

function summarizeEvents(data) {
  // Hunt for anything event-shaped anywhere in the response
  const found = [];
  function walk(obj, path) {
    if (found.length > 3 || obj === null || typeof obj !== 'object') return;
    if (Array.isArray(obj)) { obj.slice(0, 5).forEach((v, i) => walk(v, `${path}[${i}]`)); return; }
    const keys = Object.keys(obj);
    if ((obj.name || obj.title) && (obj.date || obj.dates || obj.start_date || obj.starts_at || obj.event)) {
      found.push({ path, keys: keys.slice(0, 20), name: obj.name || obj.title });
      return;
    }
    if (obj.type === 'event' && obj.event) {
      found.push({ path, keys: Object.keys(obj.event).slice(0, 25), name: obj.event.name });
      return;
    }
    for (const k of keys.slice(0, 30)) walk(obj[k], `${path}.${k}`);
  }
  walk(data, '$');
  return found;
}

async function tryReq(label, url, opts = {}) {
  try {
    const res = await fetch(url, {
      timeout: 20000,
      ...opts,
      headers: { 'User-Agent': UA_BROWSER, Accept: 'application/json', ...(opts.headers || {}) }
    });
    const text = await res.text();
    console.log(`\n### ${label}\n    ${opts.method || 'GET'} ${url}\n    status=${res.status} bytes=${text.length}`);
    if (res.status !== 200) { console.log('    body:', text.slice(0, 200).replace(/\s+/g, ' ')); return; }
    try {
      const data = JSON.parse(text);
      const top = Array.isArray(data) ? `[array len=${data.length}]` : Object.keys(data).slice(0, 12).join(', ');
      console.log('    top keys:', top);
      const events = summarizeEvents(data);
      if (events.length) {
        console.log('    EVENT-SHAPED OBJECTS FOUND:');
        for (const e of events) console.log(`      at ${e.path}: "${e.name}" keys=[${e.keys.join(',')}]`);
      } else {
        console.log('    no event-shaped objects; sample:', text.slice(0, 350).replace(/\s+/g, ' '));
      }
    } catch { console.log('    not JSON; starts:', text.slice(0, 200).replace(/\s+/g, ' ')); }
  } catch (err) {
    console.log(`\n### ${label}\n    ERROR: ${err.message}`);
  }
}

async function main() {
  console.log('=== DICE PROBE ROUND 3 ===');
  const post = (label, body, headers = {}) =>
    tryReq(label, 'https://api.dice.fm/unified_search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body)
    });

  // Round-1 body returned 189KB — inspect what it actually contains
  await post('round-1 body (types event + cities filter)', {
    q: '', types: ['event'], filter: { cities: [{ id: 'new-york' }] }
  });

  await post('tag browse: music gigs new york', {
    tag: 'music:gig', city: { perm_name: 'new_york' }
  });

  await post('q + city string', { q: 'gigs', city: 'new_york' });

  await post('browse-style: empty q with city perm_name', {
    q: '', city: { perm_name: 'new_york', country_code: 'US' }
  });

  // Widget/partner-style endpoints
  await tryReq('events api (api.dice.fm/events geo)', 'https://api.dice.fm/events?page[size]=12&filter[geo][lat]=40.7128&filter[geo][lng]=-74.006&filter[radius]=10km');
  await tryReq('events api v2', 'https://api.dice.fm/v2/events?page[size]=12&filter[cities][]=new-york');
  await tryReq('web api discovery', 'https://dice.fm/api/browse/new-york');
  await tryReq('web api city events', 'https://dice.fm/api/v1/cities/new-york/events');

  console.log('\n=== PROBE DONE ===');
}

main().catch(e => { console.error(e); process.exit(1); });
