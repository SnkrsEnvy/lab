import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'public');
const SOURCE = 'https://golden-goose-39-public-v18.vercel.app/edition-39-cover.jpg';

const res = await fetch(SOURCE, { redirect: 'follow' });
if (!res.ok) throw new Error(`Cover source fetch failed: ${res.status}`);
const source = Buffer.from(await res.arrayBuffer());
if (source.length < 10000) throw new Error(`Cover source unexpectedly small: ${source.length}`);

const meta = await sharp(source, { failOn: 'error' }).metadata();
if (!meta.width || !meta.height || meta.width < 300) throw new Error(`Bad cover source metadata: ${JSON.stringify(meta)}`);

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, '39'), { recursive: true });

await sharp(source, { failOn: 'error' })
  .rotate()
  .resize({ width: 900, withoutEnlargement: false })
  .png({ compressionLevel: 9, palette: true, quality: 100, colours: 256 })
  .toFile(path.join(OUT, 'edition-39-cover-v13.png'));

await sharp(source, { failOn: 'error' }).rotate().resize(180,180,{fit:'cover',position:'top'}).png().toFile(path.join(OUT,'apple-touch-icon.png'));
await sharp(source, { failOn: 'error' }).rotate().resize(192,192,{fit:'cover',position:'top'}).png().toFile(path.join(OUT,'icon-192.png'));
await sharp(source, { failOn: 'error' }).rotate().resize(512,512,{fit:'cover',position:'top'}).png().toFile(path.join(OUT,'icon-512.png'));

fs.copyFileSync(path.join(ROOT,'index.html'), path.join(OUT,'index.html'));
fs.copyFileSync(path.join(ROOT,'39','index.html'), path.join(OUT,'39','index.html'));

for (const f of ['edition-39-cover-v13.png','apple-touch-icon.png','icon-192.png','icon-512.png']) {
  const p = path.join(OUT,f);
  const st = fs.statSync(p);
  if (st.size < 1000) throw new Error(`${f} unexpectedly small: ${st.size}`);
  console.log(`${f} ${st.size} bytes`);
}
console.log(`GG39_BUILD_OK source=${meta.width}x${meta.height} bytes=${source.length}`);
