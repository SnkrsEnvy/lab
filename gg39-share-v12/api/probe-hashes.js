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
const sha=s=>crypto.createHash('sha256').update(s,'utf8').digest('hex');
export default function handler(req,res){const parts={z1a,z1b,z2,z3a,z3b,z4,z5a,z5b,z6a1a1,z6a1a2,z6a1b,z6a2,z6b};res.status(200).json(Object.fromEntries(Object.entries(parts).map(([k,v])=>[k,{len:v.length,sha256:sha(v)}])));}
