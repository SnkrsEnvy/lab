import crypto from 'node:crypto';
import c1 from './cover-parts/c1.js';
import c2 from './cover-parts/c2.js';
import c3 from './cover-parts/c3.js';
import c4 from './cover-parts/c4.js';
import c5 from './cover-parts/c5.js';
import c6 from './cover-parts/c6.js';

export default function handler(req, res) {
  const buf = Buffer.from(c1+c2+c3+c4+c5+c6, 'base64');
  res.status(200).json({bytes:buf.length, sha256:crypto.createHash('sha256').update(buf).digest('hex'), head:buf.subarray(0,4).toString('hex'), tail:buf.subarray(-4).toString('hex')});
}
