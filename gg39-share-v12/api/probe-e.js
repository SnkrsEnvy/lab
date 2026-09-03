import crypto from 'node:crypto';
import e1 from './cover-parts/e1.js';
import e2 from './cover-parts/e2.js';
import e3 from './cover-parts/e3.js';

export default function handler(req, res) {
  const buf = Buffer.from(e1+e2+e3, 'base64');
  res.status(200).json({bytes:buf.length, sha256:crypto.createHash('sha256').update(buf).digest('hex'), head:buf.subarray(0,4).toString('hex'), tail:buf.subarray(-4).toString('hex')});
}
