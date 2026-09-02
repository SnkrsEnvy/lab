import a from './cover-parts/z6a1a.js';
import b from './cover-parts/z6a1b.js';
export default function handler(req,res){res.status(200).json({z6a1a:a.length,z6a1b:b.length,total:a.length+b.length});}
