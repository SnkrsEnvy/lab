import crypto from 'node:crypto';
import z1 from './cover-parts/z1.js';
import z2 from './cover-parts/z2.js';
import z3 from './cover-parts/z3.js';
import z4 from './cover-parts/z4.js';
import z5 from './cover-parts/z5.js';
import z6 from './cover-parts/z6.js';

const DATA = z1 + z2 + z3 + z4 + z5 + z6;
const EXPECTED_BYTES = 39672;
const EXPECTED_SHA256 = '264b2a0ba1bb27434352e3f29d4afe8f1ba12ec06bb22c67eb8a2b5dd643fd25';

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
  res.setHeader('Content-Disposition', 'inline; filename="edition-39-cover-v16.jpg"');
  res.setHeader('Content-Length', String(buf.length));
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=31536000, immutable');
  res.setHeader('X-GG-Cover-SHA256', EXPECTED_SHA256);
  res.setHeader('X-GG-Cover-Build', 'gg39-v16-textsafe-q10');
  res.status(200).send(buf);
}
