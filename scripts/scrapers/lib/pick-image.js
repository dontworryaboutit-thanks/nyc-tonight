// Shared poster/thumbnail extraction for the venue scrapers.
//
// Every site markets its own listings, so a usable image is almost always in
// the listing block already — the trick is picking the real one out of the
// tracking pixels, spacers, and lazy-load placeholders sitting next to it.
// Returns '' when nothing suitable is found; callers treat that as "no image".

const JUNK = /placeholder|spacer|blank|pixel|1x1|loading|lazy-?load|data:image\/gif|\.svg(\?|$)/i;

// Lazy-loading libraries stash the real URL in one of these before hydration.
const SRC_ATTRS = ['data-src', 'data-lazy-src', 'data-original', 'data-image', 'src'];

function absolutize(src, baseUrl) {
  if (!src) return '';
  if (src.startsWith('http://') || src.startsWith('https://')) return src;
  if (src.startsWith('//')) return `https:${src}`;
  if (!baseUrl) return '';
  return baseUrl.replace(/\/$/, '') + (src.startsWith('/') ? src : `/${src}`);
}

// Picks the largest candidate out of a srcset, which is usually the poster
// rather than the thumbnail crop.
function fromSrcset(srcset) {
  if (!srcset) return '';
  const best = srcset
    .split(',')
    .map(part => {
      const [url, size] = part.trim().split(/\s+/);
      return { url, width: parseInt(size) || 0 };
    })
    .filter(c => c.url)
    .sort((a, b) => b.width - a.width)[0];
  return best ? best.url : '';
}

/**
 * @param {cheerio} $        cheerio instance
 * @param {cheerio} $block   the listing element to search within
 * @param {string}  baseUrl  site origin, for relative paths
 * @returns {string} absolute image URL, or ''
 */
function pickImage($, $block, baseUrl) {
  if (!$block || !$block.length) return '';

  const imgs = $block.find('img').toArray();
  for (const el of imgs) {
    const $img = $(el);

    const srcsetUrl = fromSrcset($img.attr('srcset') || $img.attr('data-srcset'));
    if (srcsetUrl && !JUNK.test(srcsetUrl)) {
      const abs = absolutize(srcsetUrl, baseUrl);
      if (abs) return abs;
    }

    for (const attr of SRC_ATTRS) {
      const raw = $img.attr(attr);
      if (!raw || JUNK.test(raw)) continue;
      const abs = absolutize(raw, baseUrl);
      if (abs) return abs;
    }
  }

  // Some listings set the poster as a CSS background instead of an <img>
  const styled = $block.find('[style*="background-image"]').first().attr('style') || '';
  const bg = styled.match(/background-image:\s*url\(['"]?([^'")]+)['"]?\)/i);
  if (bg && bg[1] && !JUNK.test(bg[1])) {
    const abs = absolutize(bg[1], baseUrl);
    if (abs) return abs;
  }

  return '';
}

module.exports = { pickImage };
