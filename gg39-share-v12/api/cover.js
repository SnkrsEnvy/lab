import p1 from './cover-parts/p1.js';
import p2 from './cover-parts/p2.js';

const DATA = p1 + p2;
const EXPECTED_BYTES = 130203;
const EXPECTED_SHA256 = 'a1d0a1129c18da7ee56f4382cefff19aa4fbcad380ca0865db06223e64e38d09';

export default function handler(req, res) {
  const buf = Buffer.from(DATA, 'base64');
  if (buf.length !== EXPECTED_BYTES) {
    res.status(500).json({ error: 'GG39_COVER_LENGTH_MISMATCH', expected: EXPECTED_BYTES, actual: buf.length });
    return;
  }
  res.setHeader('Content-Type', 'image/jpeg');
  res.setHeader('Content-Disposition', 'inline; filename="edition-39-cover-v15.jpg"');
  res.setHeader('Content-Length', String(buf.length));
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=31536000, immutable');
  res.setHeader('X-GG-Cover-SHA256', EXPECTED_SHA256);
  res.setHeader('X-GG-Cover-Build', 'gg39-v15-textsafe-jpeg');
  res.status(200).send(buf);
}
