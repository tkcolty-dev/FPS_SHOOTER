// Turns a product link into { url, title, image, price, store }.
// Amazon hands different page versions to different visitors, so we try a few
// user agents and keep whatever pieces each one gives us.

const UAS = [
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  'curl/8.4.0',
  'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
];

function decode(s) {
  if (!s) return s;
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim();
}

function meta(html, prop) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)`, 'i');
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`, 'i');
  return decode((html.match(re) || html.match(re2) || [])[1]);
}

function isBlocked(html) {
  return /captcha/i.test(html) && html.length < 20000;
}

// The on-page product title is best; the <title> tag is a fallback with extra bits glued on.
function productTitle(html) {
  return decode((html.match(/id="productTitle"[^>]*>\s*([^<]+)/) || [])[1]) || null;
}

function pickTitle(html) {
  let t = productTitle(html);
  if (t) return t;
  t = meta(html, 'og:title') || decode((html.match(/<title[^>]*>([^<]+)/i) || [])[1]);
  if (!t) return null;
  t = t
    .replace(/^Amazon\.[a-z.]+\s*:\s*/i, '')
    .replace(/\s*:\s*Amazon\.[a-z.]+.*$/i, '')
    .replace(/\s*:\s*[\dX]{10,13}$/, '')
    .replace(/\s*:\s*[^:]+$/, (m) => (m.length < 30 ? '' : m));
  if (/^amazon\.[a-z.]+$/i.test(t) || /page not found/i.test(t)) return null;
  return t;
}

function pickImage(html) {
  const m =
    html.match(/"hiRes":"(https:[^"]+)"/) ||
    html.match(/data-old-hires="(https:[^"]+)"/) ||
    html.match(/"large":"(https:[^"]+)"/) ||
    html.match(/id="landingImage"[^>]+src="(https:[^"]+)"/);
  if (m) return m[1];
  const og = meta(html, 'og:image');
  if (!og) return null;
  // Amazon's share image has a padded/cropped transform glued on; ask for the plain picture.
  return og.replace(/(\/images\/I\/[^./]+)\.jpg_.*$/, '$1._AC_SL1000_.jpg');
}

function pickPrice(html) {
  const amt = (html.match(/"priceAmount":([\d.]+)/) || [])[1];
  if (amt) return '$' + Number(amt).toFixed(2);
  // The main price box comes before "other sellers", "Kindle", etc.
  const box = html.match(/id="(?:corePrice(?:Display)?_[a-z_]+|apex_desktop|apex_mobile|corePrice_feature_div)"[\s\S]{0,6000}/);
  const scan = (s) => {
    for (const m of s.matchAll(/class="a-offscreen">\s*([^<]*?)\s*</g)) {
      const p = decode(m[1]);
      if (/\d/.test(p)) return p;
    }
    return null;
  };
  return (box && scan(box[0])) || scan(html);
}

function blockedHost(hostname) {
  return /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[?::1\]?$)/i.test(hostname) || !hostname.includes('.');
}

async function get(url, ua) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 9000);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': ua, 'Accept-Language': 'en-US,en;q=0.9' }, redirect: 'follow', signal: ctrl.signal });
    return { status: r.status, url: r.url, html: (await r.text()).slice(0, 3_000_000) };
  } finally {
    clearTimeout(t);
  }
}

async function scrape(input) {
  let url;
  try {
    url = new URL(String(input).trim().match(/https?:\/\/\S+/i)?.[0] || String(input).trim());
  } catch {
    throw new Error("That doesn't look like a link");
  }
  if (!/^https?:$/.test(url.protocol) || blockedHost(url.hostname)) throw new Error("That doesn't look like a link");

  // Short links (a.co, amzn.to) — follow them first so we can find the product code.
  let final = url.href;
  if (/^(a\.co|amzn\.to|amzn\.com|amzn\.eu)$/i.test(url.hostname)) {
    const r = await get(final, UAS[1]);
    final = r.url;
  }

  const u = new URL(final);
  const isAmazon = /(^|\.)amazon\.[a-z.]+$/i.test(u.hostname);
  const asin = (u.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d|exec\/obidos\/ASIN)\/([A-Z0-9]{10})/i) || [])[1];
  const clean = isAmazon && asin ? `https://${u.hostname}/dp/${asin.toUpperCase()}` : final;

  const out = { url: clean, title: null, image: null, price: null, store: isAmazon ? 'Amazon' : u.hostname.replace(/^www\./, '') };
  let lastStatus = 0;
  for (const ua of UAS) {
    let r;
    try {
      r = await get(clean, ua);
    } catch {
      continue;
    }
    lastStatus = r.status;
    if (r.status >= 400 || isBlocked(r.html)) continue;
    out.title = productTitle(r.html) || out.title || pickTitle(r.html);
    if (productTitle(r.html)) out.strongTitle = true;
    out.image ||= pickImage(r.html);
    out.price ||= pickPrice(r.html);
    if (out.strongTitle && out.image && out.price) break;
    if (!isAmazon && out.title) break;
  }

  // Nothing came back — make a name out of the link so the item still lands on the list.
  if (!out.title) {
    const slug = u.pathname.split('/').find((p) => p.length > 8 && /-/.test(p) && !/^dp$/i.test(p));
    out.title = slug ? decodeURIComponent(slug).replace(/-/g, ' ') : null;
  }
  if (!out.title && lastStatus === 404) throw new Error("Amazon says that page doesn't exist");
  out.title ||= isAmazon ? 'Amazon item' : out.store;
  delete out.strongTitle;
  if (out.title.length > 200) out.title = out.title.slice(0, 197) + '…';
  return out;
}

// Name → Amazon results with picture, name and price, best first (real results before ads).
async function searchResults(q) {
  const r = await get('https://www.amazon.com/s?k=' + encodeURIComponent(q), UAS[0]);
  if (r.status >= 400 || isBlocked(r.html)) throw new Error("Amazon search didn't answer — try a link instead");
  const organic = [], ads = [], seen = new Set();
  for (const part of r.html.split(/(?=<div[^>]*data-component-type="s-search-result")/).slice(1)) {
    const p = part.slice(0, 60000);
    const asin = (p.match(/data-asin="([A-Z0-9]{10})"/) || [])[1];
    if (!asin || seen.has(asin)) continue;
    seen.add(asin);
    const img = (p.match(/src="(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+\.jpg)"/) || [])[1];
    // Mobile results split the brand and the name into separate <h2>s ("LEGO" + "Technic Bush Plane…").
    const heads = [...p.matchAll(/<h2[^>]*>(?:\s*<a[^>]*>)?\s*<span[^>]*>([^<]+)<\/span>/g)].map((m) => decode(m[1]));
    const name = heads.length ? heads[heads.length - 1] : decode((p.match(/<h2[^>]*aria-label="([^"]+)"/) || [])[1] || '');
    const brand = heads.length > 1 ? heads[0] : '';
    const title = brand && !name.toLowerCase().startsWith(brand.toLowerCase()) ? `${brand} ${name}` : name;
    const ad = /\/sspa\/click|Sponsored Ad/.test(p);
    (ad ? ads : organic).push({
      url: `https://www.amazon.com/dp/${asin}`,
      title: title.replace(/^Sponsored Ad\s*-\s*/i, '') || null,
      image: img ? img.replace(/\._[^/]*_\.jpg$/, '._AC_SL1000_.jpg') : null,
      price: decode((p.match(/a-offscreen">\s*([^<]*\d[^<]*)</) || [])[1]) || null,
      store: 'Amazon',
    });
  }
  return [...organic, ...ads].slice(0, 12);
}

async function searchAmazon(q) {
  return (await searchResults(q)).map((r) => r.url.slice(-10));
}

// Find something by name. `skip` picks a later result (for "show me a different one").
async function findByName(q, skip = 0) {
  q = String(q).trim().slice(0, 150);
  if (!q) throw new Error('Type a link or the name of something');
  const asins = await searchAmazon(q);
  if (!asins.length) throw new Error(`Couldn't find "${q}" on Amazon`);
  const i = skip % asins.length;
  const out = await scrape(`https://www.amazon.com/dp/${asins[i]}`);
  return { ...out, search: { q, i, n: asins.length } };
}

module.exports = { scrape, findByName, searchResults };
