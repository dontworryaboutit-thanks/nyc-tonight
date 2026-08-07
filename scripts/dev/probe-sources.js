// Diagnostic probe: learn the real request/response shape for candidate
// sources. Run from CI (the GitHub runner has open egress; the dev sandbox
// does not, so this is the only place these hosts are reachable).
//
//   Actions → "Test Build (branch)" → Run workflow → mode: probe

const fetch = require('node-fetch');

const UA_BROWSER =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

function ymd(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

async function probe(label, url, opts = {}) {
  try {
    const res = await fetch(url, {
      timeout: 25000,
      redirect: 'follow',
      ...opts,
      headers: { 'User-Agent': UA_BROWSER, ...(opts.headers || {}) }
    });
    const text = await res.text();
    console.log(`\n### ${label}`);
    console.log(`    GET ${url}`);
    console.log(`    status=${res.status} bytes=${text.length} type=${res.headers.get('content-type')}`);

    if (res.status !== 200) {
      console.log('    body:', text.slice(0, 200).replace(/\s+/g, ' '));
      return null;
    }

    const ct = res.headers.get('content-type') || '';
    if (ct.includes('json')) {
      try {
        const data = JSON.parse(text);
        console.log('    JSON top:', Array.isArray(data)
          ? `array len=${data.length}`
          : Object.keys(data).slice(0, 15).join(', '));
        console.log('    sample:', JSON.stringify(Array.isArray(data) ? data[0] : data).slice(0, 600));
      } catch {
        console.log('    (declared json but failed to parse)');
      }
    } else {
      // Show the structural skeleton so we can write real selectors
      const classes = [...text.matchAll(/class="([^"]{3,80})"/g)]
        .map(m => m[1])
        .filter(c => /listing|screening|film|event|venue|show|time|series/i.test(c));
      const counts = {};
      for (const c of classes) for (const one of c.split(/\s+/)) counts[one] = (counts[one] || 0) + 1;
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 25);
      console.log('    candidate classes:', JSON.stringify(top));
      const jsonld = [...text.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)];
      console.log('    ld+json blocks:', jsonld.length);
      if (jsonld.length) console.log('    ld+json sample:', jsonld[0][1].replace(/\s+/g, ' ').slice(0, 400));
    }
    return text;
  } catch (err) {
    console.log(`\n### ${label}\n    GET ${url}\n    ERROR ${err.message}`);
    return null;
  }
}

async function main() {
  console.log('=== SCREENSLATE ===');
  const d = ymd(0);
  const compact = d.replace(/-/g, '');
  await probe('screenslate listings (today)', 'https://www.screenslate.com/listings');
  await probe('screenslate listings ?date=', `https://www.screenslate.com/listings?date=${d}`);
  await probe('screenslate listings /date', `https://www.screenslate.com/listings/${d}`);
  await probe('screenslate api compact', `https://www.screenslate.com/api/listings/${compact}`);
  await probe('screenslate jsonapi node', 'https://www.screenslate.com/jsonapi/node/screening?page[limit]=5');

  console.log('\n\n=== SONGKICK (is it actually bot-blocked?) ===');
  await probe('songkick metro plain', 'https://www.songkick.com/metro-areas/7644-us-new-york');
  await probe('songkick metro -nyc', 'https://www.songkick.com/metro-areas/7644-us-new-york-nyc');
  await probe('songkick with full browser headers',
    'https://www.songkick.com/metro-areas/7644-us-new-york', {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Upgrade-Insecure-Requests': '1'
      }
    });

  console.log('\n\n=== KEYLESS ALTERNATIVES FOR LIVE BANDS ===');
  await probe('bowerypresents shows', 'https://www.bowerypresents.com/shows');
  await probe('elsewhere calendar', 'https://www.elsewherebrooklyn.com/calendar');
  await probe('babys all right', 'https://babysallright.com/calendar/');
  await probe('le poisson rouge', 'https://lpr.com/calendar/');
  await probe('brooklyn steel (bowery net)', 'https://www.brooklynsteel.com/shows/brooklyn-steel');
}

main().catch(err => {
  console.error('probe fatal:', err);
  process.exit(1);
});
