import crypto from 'node:crypto';
import p1 from './cover-parts/p1.js';
import p2 from './cover-parts/p2.js';
export default function handler(req,res){const buf=Buffer.from(p1+p2,'base64');res.status(200).json({bytes:buf.length,sha256:crypto.createHash('sha256').update(buf).digest('hex'),head:buf.subarray(0,4).toString('hex'),tail:buf.subarray(-4).toString('hex')});}
