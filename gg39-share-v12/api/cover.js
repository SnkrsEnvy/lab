import crypto from 'node:crypto';
import z1a from './cover-parts/z1a.js';
import z1b from './cover-parts/z1b.js';
import z2 from './cover-parts/z2.js';
import z3a from './cover-parts/z3a.js';
import z3b from './cover-parts/z3b.js';
import z4 from './cover-parts/z4.js';
import z5a from './cover-parts/z5a.js';
import z5b from './cover-parts/z5b.js';
import z6a1a1 from './cover-parts/z6a1a1.js';
import z6a1a2 from './cover-parts/z6a1a2.js';
import z6a1b from './cover-parts/z6a1b.js';
import z6a2 from './cover-parts/z6a2.js';
import z6b from './cover-parts/z6b.js';

const DATA = z1a + z1b + z2 + z3a + z3b + z4 + z5a + z5b + z6a1a1 + z6a1a2 + z6a1b + z6a2 + z6b;
const EXPECTED_BYTES = 39672;
const EXPECTED_SHA256 = '064c463f52caa8f2cf6ffaee79682df8418e54261b2101021a9ad6cf72618f20';

export default function handler(req, res) {
  const buf = Buffer.from(DATA, 'base64');
  const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
  if (buf.length !== EXPECTED_BYTES || sha256 !== EXPECTED_SHA256) {
    res.status(500).json({
      error: 'GG39_COVER_INTEGRITY_MISMATCH',
      expectedBytes: EXPECTED_BYTES,
      actualBytes: buf.length,
      expectedSha256: EXPECTED_SHA256,
      actualSha256: sha256
    });
    return;
  }
  res.setHeader('Content-Type', 'image/jpeg');
  res.setHeader('Content-Disposition', 'inline; filename="edition-39-cover-v16R1.jpg"');
  res.setHeader('Content-Length', String(buf.length));
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=31536000, immutable');
  res.setHeader('X-GG-Cover-SHA256', EXPECTED_SHA256);
  res.setHeader('X-GG-Cover-Build', 'gg39-v16R1-rebaseline');
  res.status(200).send(buf);
}
