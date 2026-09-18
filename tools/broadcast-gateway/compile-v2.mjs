#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import process from 'node:process';

function die(message) {
  console.error(`Broadcast Gateway v2 compile: ${message}`);
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

function esc(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function required(value, label) {
  if (value === undefined || value === null || value === '') die(`missing ${label}`);
  return value;
}

function publicUrl(value, label) {
  required(value, label);
  const u = new URL(value);
  const local = ['localhost', '127.0.0.1'].includes(u.hostname);
  if (u.protocol !== 'https:' && !(local && u.protocol === 'http:')) die(`${label} must use https except localhost tests`);
  return u;
}

function validate(m) {
  if (m.schema_version !== 'broadcast-gateway.issue.v2') die(`unsupported schema_version ${m.schema_version}`);
  for (const [v, label] of [
    [m.brand?.id, 'brand.id'], [m.brand?.name, 'brand.name'], [m.brand?.site_name, 'brand.site_name'],
    [m.issue?.slug, 'issue.slug'], [m.issue?.title, 'issue.title'], [m.issue?.label, 'issue.label'],
    [m.issue?.description, 'issue.description'], [m.share?.origin, 'share.origin'], [m.share?.path, 'share.path'],
    [m.share?.version, 'share.version'], [m.destination?.url, 'destination.url']
  ]) required(v, label);
  publicUrl(m.share.origin, 'share.origin');
  publicUrl(m.destination.url, 'destination.url');
  if (!String(m.share.path).startsWith('/')) die('share.path must start with /');
  if (!['external', 'local'].includes(m.cover?.mode)) die('cover.mode must be external or local');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(m.cover?.mime)) die('cover.mime unsupported');
  for (const k of ['width', 'height']) if (!Number.isInteger(m.cover?.[k]) || m.cover[k] < 1) die(`cover.${k} must be positive integer`);
  if (m.cover.mode === 'external') {
    publicUrl(m.cover.url, 'cover.url');
    if (!Number.isInteger(m.cover.bytes) || m.cover.bytes < 1) die('external cover.bytes required');
    if (!/^[a-f0-9]{64}$/.test(m.cover.sha256 || '')) die('external cover.sha256 required');
  }
  if (m.cover.mode === 'local') required(m.cover.file, 'cover.file');
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
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

function appendVersion(url, version) {
  const u = new URL(url);
  if (!u.searchParams.has('v')) u.searchParams.set('v', version);
  return u.toString();
}

function semanticJsonLd(m, canonical, coverUrl) {
  const type = m.semantic?.type || 'CreativeWork';
  const publisher = m.semantic?.publisher_name || m.brand.publisher || m.brand.name;
  const data = {
    '@context': 'https://schema.org',
    '@type': type,
    name: m.issue.title,
    description: m.issue.description,
    url: canonical,
    image: coverUrl,
    publisher: { '@type': 'Organization', name: publisher }
  };
  if (m.issue.identifier) data.identifier = m.issue.identifier;
  if (m.semantic?.is_part_of) data.isPartOf = { '@type': 'CreativeWork', name: m.semantic.is_part_of };
  return JSON.stringify(data).replaceAll('</', ':\\/');
}

function renderShell(m, coverUrl, canonical, buildMarker) {
  const alt = m.alt || `${m.brand.name} ${m.issue.label} cover`;
  const theme = m.brand.theme_color || '#0c0907';
  const destination = m.destination.url;
  const jsonLd = semanticJsonLd(m, canonical, coverUrl);
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="broadcast-gateway-build" content="${esc(buildMarker)}">
<title>${esc(m.issue.title)}</title>
<meta name="description" content="${esc(m.issue.description)}">
<meta name="robots" content="index,follow,max-image-preview:large"><meta name="theme-color" content="${esc(theme)}">
<link rel="canonical" href="${esc(canonical)}"><link rel="image_src" href="${esc(coverUrl)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="${esc(m.brand.site_name)}">
<meta property="og:title" content="${esc(m.issue.title)}"><meta property="og:description" content="${esc(m.issue.description)}">
<meta property="og:url" content="${esc(canonical)}"><meta property="og:image" content="${esc(coverUrl)}"><meta property="og:image:secure_url" content="${esc(coverUrl)}">
<meta property="og:image:type" content="${esc(m.cover.mime)}"><meta property="og:image:width" content="${m.cover.width}"><meta property="og:image:height" content="${m.cover.height}"><meta property="og:image:alt" content="${esc(alt)}">
<meta name="twitter:card" content="${esc(m.twitter_card || 'summary_large_image')}"><meta name="twitter:title" content="${esc(m.issue.title)}"><meta name="twitter:description" content="${esc(m.issue.description)}"><meta name="twitter:image" content="${esc(coverUrl)}">
<script type="application/ld+json">${jsonLd}</script>
<style>*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:${esc(theme)};color:#f2e4bc;font-family:system-ui,-apple-system,Segoe UI,sans-serif}body{display:grid;place-items:center;padding:18px}main{width:min(92vw,430px);text-align:center}.cover{display:block;border-radius:18px;overflow:hidden}.cover img{display:block;width:100%;height:auto}.open{display:inline-block;padding:11px 18px;border:1px solid #c9a65b88;border-radius:999px;color:#f2e4bc;text-decoration:none;background:#18130c}</style>
</head><body><main><a class="cover" href="${esc(destination)}"><img src="${esc(coverUrl)}" width="${m.cover.width}" height="${m.cover.height}" alt="${esc(alt)}"></a><h1>${esc(m.issue.title)}</h1><p>${esc(m.issue.description)}</p><a class="open" href="${esc(destination)}">Open ${esc(m.issue.label)}</a></main></body></html>`;
}

const args = parseArgs(process.argv.slice(2));
if (!args.manifest) die('usage: compile-v2.mjs --manifest <file> --out <dir> [--verify-remote-cover]');
const manifestPath = resolve(args.manifest);
const outDir = resolve(args.out || `broadcast-v2/${Date.now()}`);
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
validate(manifest);

let coverUrl;
let receipt;
await mkdir(outDir, { recursive: true });

if (manifest.cover.mode === 'local') {
  const source = resolve(dirname(manifestPath), manifest.cover.file);
  const bytes = await readFile(source);
  const ext = extname(source).toLowerCase() || '.bin';
  const size = imageSize(bytes, manifest.cover.mime);
  if (!size) die(`could not parse local ${manifest.cover.mime} dimensions`);
  receipt = { mime: manifest.cover.mime, bytes: bytes.length, width: size.width, height: size.height, sha256: sha256(bytes), source: 'local' };
  if (receipt.width !== manifest.cover.width || receipt.height !== manifest.cover.height) die(`local cover dimensions ${receipt.width}x${receipt.height} do not match manifest ${manifest.cover.width}x${manifest.cover.height}`);
  if (manifest.cover.bytes && receipt.bytes !== manifest.cover.bytes) die('local cover byte count mismatch');
  if (manifest.cover.sha256 && receipt.sha256 !== manifest.cover.sha256) die('local cover sha256 mismatch');
  const outCover = resolve(outDir, `cover${ext}`);
  await copyFile(source, outCover);
  coverUrl = new URL(`cover${ext}?v=${encodeURIComponent(manifest.share.version)}`, manifest.share.origin + manifest.share.path).toString();
} else {
  coverUrl = appendVersion(manifest.cover.url, manifest.share.version);
  receipt = {
    mime: manifest.cover.mime,
    bytes: manifest.cover.bytes,
    width: manifest.cover.width,
    height: manifest.cover.height,
    sha256: manifest.cover.sha256,
    source: 'manifest'
  };
  if (args['verify-remote-cover']) {
    const response = await fetch(coverUrl, { redirect: manifest.cover.allow_redirects === false ? 'manual' : 'follow' });
    if (!response.ok) die(`remote cover returned ${response.status}`);
    if (manifest.cover.allow_redirects === false && response.status >= 300 && response.status < 400) die('remote cover redirected but redirects are disallowed');
    const bytes = Buffer.from(await response.arrayBuffer());
    const mime = (response.headers.get('content-type') || '').split(';')[0].trim();
    const size = imageSize(bytes, mime);
    const observed = { mime, bytes: bytes.length, width: size?.width || null, height: size?.height || null, sha256: sha256(bytes), source: 'remote' };
    for (const k of ['mime', 'bytes', 'width', 'height', 'sha256']) if (observed[k] !== receipt[k]) die(`remote cover ${k} mismatch: expected ${receipt[k]}, observed ${observed[k]}`);
    receipt = observed;
  }
}

const canonicalBase = new URL(manifest.share.path, manifest.share.origin).toString();
const canonical = appendVersion(canonicalBase, manifest.share.version);
const buildMarker = manifest.share.build_marker || `bg2-${manifest.issue.slug}-${manifest.share.version}`;
await writeFile(resolve(outDir, 'index.html'), renderShell(manifest, coverUrl, canonical, buildMarker));

const lock = {
  ...manifest,
  share: { ...manifest.share, canonical_url: canonical, build_marker: buildMarker },
  cover: { ...manifest.cover, ...receipt, resolved_url: coverUrl },
  compiled: {
    compiler: 'broadcast-gateway.compile-v2',
    runtime_gate_policy: 'compile does not self-promote runtime gates'
  }
};
await writeFile(resolve(outDir, 'manifest.lock.json'), JSON.stringify(lock, null, 2) + '\n');

const releaseReceipt = {
  schema_version: 'broadcast-gateway.receipt.v2',
  issue: manifest.issue.slug,
  version: manifest.share.version,
  candidate: {
    canonical_url: canonical,
    cover_url: coverUrl,
    destination: manifest.destination.url,
    build_marker: buildMarker,
    image_fingerprint: receipt,
    metadata: 'COMPILED_NOT_RUNTIME_PROVEN'
  },
  gates: { A: 1, P: null, T: null, I: null, M: null, K: 1, L: null, R: null, D: null },
  perceptual_visual_gate: null,
  server_gate_formula: 'G_server = A * P * T * I * M * K * R',
  final_gate_formula: 'G_final = A * P * T * I * M * K * L * R * D',
  next_proof: 'run strict local/remote verifier, then prove deployment lineage, production alias, perceptual result and final compositor'
};
await writeFile(resolve(outDir, 'receipt.json'), JSON.stringify(releaseReceipt, null, 2) + '\n');
console.log(JSON.stringify({ ok: true, outDir, canonical, coverUrl, buildMarker, receipt, gates: releaseReceipt.gates }, null, 2));
