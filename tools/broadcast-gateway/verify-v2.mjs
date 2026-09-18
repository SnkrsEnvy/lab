#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';

function die(message, detail = null) {
  const payload = { ok: false, error: message };
  if (detail !== null) payload.detail = detail;
  console.error(JSON.stringify(payload, null, 2));
  process.exit(1);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const v = argv[i];
    if (!v.startsWith('--')) continue;
    const key = v.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) { out[key] = next; i += 1; }
    else out[key] = true;
  }
  return out;
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function attrs(tag) {
  const out = {};
  const re = /([:\w-]+)\s*=\s*(["'])(.*?)\2/gms;
  let m;
  while ((m = re.exec(tag))) out[m[1].toLowerCase()] = m[3];
  return out;
}

function tags(html, name) {
  return [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gim'))].map(m => attrs(m[0]));
}

function meta(html, key, kind = 'property') {
  const needle = String(key).toLowerCase();
  for (const a of tags(html, 'meta')) if ((a[kind] || '').toLowerCase() === needle) return a.content || null;
  return null;
}

function link(html, rel) {
  const needle = String(rel).toLowerCase();
  for (const a of tags(html, 'link')) {
    const rels = (a.rel || '').toLowerCase().split(/\s+/);
    if (rels.includes(needle)) return a.href || null;
  }
  return null;
}

function hrefs(html) {
  return tags(html, 'a').map(a => a.href).filter(Boolean);
}

function jpegSize(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buffer.length) {
    if (buffer[i] !== 0xff) { i += 1; continue; }
    const marker = buffer[i + 1];
    if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
      return { height: buffer.readUInt16BE(i + 5), width: buffer.readUInt16BE(i + 7) };
    }
    if (marker === 0xd8 || marker === 0xd9) { i += 2; continue; }
    if (i + 3 >= buffer.length) break;
    const len = buffer.readUInt16BE(i + 2);
    if (!len) break;
    i += 2 + len;
  }
  return null;
}

function pngSize(buffer) {
  if (buffer.length < 24 || buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function webpSize(buffer) {
  if (buffer.length < 30 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') return null;
  const kind = buffer.toString('ascii', 12, 16);
  if (kind === 'VP8X') {
    return {
      width: 1 + buffer[24] + (buffer[25] << 8) + (buffer[26] << 16),
      height: 1 + buffer[27] + (buffer[28] << 8) + (buffer[29] << 16)
    };
  }
  return null;
}

function imageSize(buffer, mime) {
  if (mime === 'image/jpeg') return jpegSize(buffer);
  if (mime === 'image/png') return pngSize(buffer);
  if (mime === 'image/webp') return webpSize(buffer);
  return null;
}

function cleanMime(v) {
  return String(v || '').split(';')[0].trim().toLowerCase();
}

function sameUrl(a, b) {
  try { return new URL(a).toString() === new URL(b).toString(); }
  catch { return a === b; }
}

function requireEq(actual, expected, label) {
  if (actual !== expected) die(`${label} mismatch`, { expected, actual });
}

const args = parseArgs(process.argv.slice(2));
if (!args.url || !args.lock) die('usage: verify-v2.mjs --url <share-url> --lock <manifest.lock.json>');
const lock = JSON.parse(await readFile(resolve(args.lock), 'utf8'));
if (lock.schema_version !== 'broadcast-gateway.issue.v2') die(`unsupported lock schema ${lock.schema_version}`);

const expectedCanonical = lock.share.canonical_url;
const expectedImage = lock.cover.resolved_url;
const expectedDestination = lock.destination.url;
const expectedBuild = lock.share.build_marker;
const expectedMime = cleanMime(lock.cover.mime);
const expectedBytes = lock.cover.bytes;
const expectedSha = lock.cover.sha256;
const expectedWidth = lock.cover.width;
const expectedHeight = lock.cover.height;
const allowRedirects = lock.cover.allow_redirects !== false;

const page = await fetch(args.url, { redirect: 'follow' });
if (!page.ok) die(`page returned ${page.status}`);
const html = await page.text();
if (!cleanMime(page.headers.get('content-type')).startsWith('text/html')) die(`page returned non-HTML content-type ${page.headers.get('content-type')}`);

const observed = {
  page: {
    requested_url: args.url,
    final_url: page.url,
    redirected: page.redirected,
    status: page.status,
    content_type: page.headers.get('content-type'),
    build_marker: meta(html, 'broadcast-gateway-build', 'name')
  },
  metadata: {
    canonical: link(html, 'canonical'),
    image_src: link(html, 'image_src'),
    og_title: meta(html, 'og:title'),
    og_description: meta(html, 'og:description'),
    og_url: meta(html, 'og:url'),
    og_image: meta(html, 'og:image'),
    og_image_secure_url: meta(html, 'og:image:secure_url'),
    og_image_type: meta(html, 'og:image:type'),
    og_image_width: meta(html, 'og:image:width'),
    og_image_height: meta(html, 'og:image:height'),
    twitter_card: meta(html, 'twitter:card', 'name'),
    twitter_image: meta(html, 'twitter:image', 'name')
  }
};

requireEq(observed.page.build_marker, expectedBuild, 'build marker');
if (!sameUrl(observed.metadata.canonical, expectedCanonical)) die('canonical mismatch', { expected: expectedCanonical, actual: observed.metadata.canonical });
if (!sameUrl(observed.metadata.og_url, expectedCanonical)) die('og:url mismatch', { expected: expectedCanonical, actual: observed.metadata.og_url });
for (const [label, value] of [
  ['image_src', observed.metadata.image_src],
  ['og:image', observed.metadata.og_image],
  ['og:image:secure_url', observed.metadata.og_image_secure_url],
  ['twitter:image', observed.metadata.twitter_image]
])  if (!sameUrl(value, expectedImage)) die(`${label} mismatch`, { expected: expectedImage, actual: value });
requireEq(cleanMime(observed.metadata.og_image_type), expectedMime, 'og:image:type');
requireEq(Number(observed.metadata.og_image_width), expectedWidth, 'og:image:width');
requireEq(Number(observed.metadata.og_image_height), expectedHeight, 'og:image:height');
if (!String(observed.metadata.twitter_card || '').trim()) die('twitter:card missing');

const version = lock.share.version;
const canonicalUrl = new URL(observed.metadata.canonical);
if (canonicalUrl.searchParams.get('v') !== version) die('cache/version token missing from canonical URL', { expected: version, actual: canonicalUrl.searchParams.get('v') });

const image = await fetch(expectedImage, { redirect: allowRedirects ? 'follow' : 'manual' });
if (!allowRedirects && image.status >= 300 && image.status < 400) die('image redirected but redirects are disallowed', { status: image.status, location: image.headers.get('location') });
if (!image.ok) die(`image returned ${image.status}`);
const bytes = Buffer.from(await image.arrayBuffer());
const imageMime = cleanMime(image.headers.get('content-type'));
const dimensions = imageSize(bytes, imageMime);
if (!dimensions) die(`unable to parse image dimensions for ${imageMime}`);
const imageObserved = {
  requested_url: expectedImage,
  final_url: image.url,
  redirected: image.redirected,
  status: image.status,
  mime: imageMime,
  bytes: bytes.length,
  content_length: Number(image.headers.get('content-length') || 0) || null,
  width: dimensions.width,
  height: dimensions.height,
  sha256: sha256(bytes)
};
observed.image = imageObserved;

requireEq(imageObserved.mime, expectedMime, 'image MIME');
requireEq(imageObserved.bytes, expectedBytes, 'image byte count');
requireEq(imageObserved.width, expectedWidth, 'image width');
requireEq(imageObserved.height, expectedHeight, 'image height');
requireEq(imageObserved.sha256, expectedSha, 'image sha256');
if (imageObserved.content_length !== null) requireEq(imageObserved.content_length, expectedBytes, 'image content-length');
if (!allowRedirects && imageObserved.redirected) die('image redirected but redirects are disallowed');

const pageLinks = hrefs(html).map(v => { try { return new URL(v, page.url).toString(); } catch { return v; } });
if (!pageLinks.some(v => sameUrl(v, expectedDestination))) die('protected destination handoff missing from page links', { expected: expectedDestination });
const destination = await fetch(expectedDestination, { redirect: 'follow' });
if (!destination.ok) die(`protected destination returned ${destination.status}`);
const destinationText = await destination.text();
const destinationObserved = {
  requested_url: expectedDestination,
  final_url: destination.url,
  redirected: destination.redirected,
  status: destination.status,
  content_type: destination.headers.get('content-type'),
  markers: {}
};
for (const marker of lock.destination.expected_markers || []) {
  const actual = meta(destinationText, marker.name, 'name');
  destinationObserved.markers[marker.name] = actual;
  requireEq(actual, marker.value, `destination marker ${marker.name}`);
}
observed.destination = destinationObserved;

const gates = { A: 1, P: 1, T: 1, I: 1, M: 1, K: 1, L: null, R: 1, D: null };
const serverGate = gates.A * gates.P * gates.T * gates.I * gates.M * gates.K * gates.R;
const result = {
  ok: true,
  verifier: 'broadcast-gateway.verify-v2',
  observed,
  gates,
  G_server: serverGate === 1 ? 'PASS' : 'FAIL',
  L_lineage: 'UNPROVEN_BY_THIS_SCRIPT',
  D_device_compositor: 'UNPROVEN_BY_THIS_SCRIPT',
  perceptual_visual_gate: 'SEPARATE_FROM_BINARY_IDENTITY',
  next_proof: 'prove candidate deployment/source lineage, then production alias and final compositor'
};
console.log(JSON.stringify(result, null, 2));
