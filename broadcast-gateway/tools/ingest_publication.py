#!/usr/bin/env python3
"""Golden Goose / CannaCardz publication ingest compiler.

Converts one PDF into a deterministic browser-reader bundle and receipts.
It does not deploy anything and does not mutate an existing reader.
"""
from __future__ import annotations
import argparse, hashlib, html, json, shutil
from pathlib import Path
import fitz
from PIL import Image

SCHEMA="grandcore.publication-ingest.v1"

def sha256_file(path:Path)->str:
    h=hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda:f.read(1024*1024),b""): h.update(block)
    return h.hexdigest()

def image_info(path:Path):
    with Image.open(path) as im:
        return {"width":int(im.width),"height":int(im.height),"mime":Image.MIME.get(im.format,"image/jpeg")}

def safe_slug(v:str)->str:
    out=[]
    for c in v.strip().lower():
        if c.isalnum(): out.append(c)
        elif c in " -_.": out.append("-")
    s="".join(out)
    while "--" in s:s=s.replace("--","-")
    return s.strip("-") or "publication"

def page_to_jpeg(page,out_path,target_width,quality):
    zoom=max(.1,float(target_width)/float(page.rect.width))
    pix=page.get_pixmap(matrix=fitz.Matrix(zoom,zoom),alpha=False,colorspace=fitz.csRGB)
    img=Image.frombytes("RGB",(pix.width,pix.height),pix.samples)
    out_path.parent.mkdir(parents=True,exist_ok=True)
    img.save(out_path,"JPEG",quality=quality,optimize=True,progressive=True)

def reader_html(pub):
    title=html.escape(pub["title"]); edition=html.escape(pub["edition"]); brand=html.escape(pub["brand"])
    pub_json=json.dumps(pub,ensure_ascii=False).replace("</","<\\/")
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#070604"><meta name="robots" content="noindex,nofollow"><title>{title} — {edition}</title><style>:root{{--gold:#d7b86b;--ink:#f7efde;--muted:#a79b86}}*{{box-sizing:border-box}}html,body{{margin:0;height:100%;background:#070604;color:var(--ink);font-family:system-ui,-apple-system,Segoe UI,sans-serif;overflow:hidden}}.app{{height:100%;display:grid;grid-template-rows:auto 1fr auto;background:radial-gradient(circle at 50% 15%,#21190c 0,#0b0906 34%,#050403 75%)}}.top{{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid #d7b86b22;background:#090806dd}}.brand{{font-family:Georgia,serif;color:#e3c476}}.edition{{color:var(--muted);font-size:12px}}.stage{{position:relative;display:grid;place-items:center;min-height:0;padding:10px 14px}}.page-shell{{max-width:min(94vw,760px);max-height:100%;filter:drop-shadow(0 26px 42px #000b);touch-action:pan-y}}.page-shell img{{display:block;max-width:100%;max-height:calc(100vh - 120px);width:auto;height:auto;border-radius:5px;background:#17120c;user-select:none}}.nav{{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:12px;padding:10px 14px max(10px,env(safe-area-inset-bottom));border-top:1px solid #d7b86b22;background:#090806ee}}button{{border:1px solid #d7b86b44;color:var(--ink);background:#17130d;border-radius:999px;padding:10px 15px;font-weight:700}}button:disabled{{opacity:.35}}.count{{text-align:center;color:var(--muted);font:12px ui-monospace,monospace}}.loading{{position:absolute;inset:0;display:grid;place-items:center;color:#baa97f;background:#090806;z-index:5;transition:opacity .25s}}.loading.hide{{opacity:0;pointer-events:none}}</style></head><body><div class="app"><header class="top"><div><div class="brand">{brand}</div><div class="edition">{edition}</div></div><div class="edition" id="label"></div></header><main class="stage"><div class="loading" id="loading">Preparing publication…</div><div class="page-shell" id="shell"><img id="page" alt=""></div></main><footer class="nav"><button id="prev">← Previous</button><div class="count" id="count"></div><button id="next">Next →</button></footer></div><script>const PUB={pub_json};let i=0,startX=null;const img=document.getElementById('page'),loading=document.getElementById('loading'),count=document.getElementById('count'),label=document.getElementById('label'),prev=document.getElementById('prev'),next=document.getElementById('next');function draw(n){{i=Math.max(0,Math.min(PUB.pages.length-1,n));const p=PUB.pages[i];loading.classList.remove('hide');img.onload=()=>loading.classList.add('hide');img.src=p.src;img.alt=`${{PUB.edition}} page ${{i+1}}`;count.textContent=`${{i+1}} / ${{PUB.pages.length}}`;label.textContent=p.label||`Page ${{i+1}}`;prev.disabled=i===0;next.disabled=i===PUB.pages.length-1;history.replaceState(null,'',`#p=${{i+1}}`);}}prev.onclick=()=>draw(i-1);next.onclick=()=>draw(i+1);addEventListener('keydown',e=>{{if(e.key==='ArrowLeft')draw(i-1);if(e.key==='ArrowRight'||e.key===' ')draw(i+1)}});const shell=document.getElementById('shell');shell.addEventListener('touchstart',e=>startX=e.touches[0].clientX,{{passive:true}});shell.addEventListener('touchend',e=>{{if(startX==null)return;const dx=e.changedTouches[0].clientX-startX;if(Math.abs(dx)>42)draw(i+(dx<0?1:-1));startX=null}},{{passive:true}});const m=location.hash.match(/p=(\\d+)/);draw(m?Number(m[1])-1:0);</script></body></html>'''

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--pdf',required=True);ap.add_argument('--out',required=True);ap.add_argument('--brand',default='Golden Goose Magazine');ap.add_argument('--title',default='Golden Goose Video Magazine');ap.add_argument('--edition',required=True);ap.add_argument('--slug');ap.add_argument('--description');ap.add_argument('--target-width',type=int,default=1541);ap.add_argument('--jpeg-quality',type=int,default=90);ap.add_argument('--share-origin');ap.add_argument('--destination');ap.add_argument('--version',default='bg1');a=ap.parse_args()
    pdf=Path(a.pdf).resolve();out=Path(a.out).resolve()
    if not pdf.is_file():raise SystemExit(f'Missing PDF: {pdf}')
    if not 320<=a.target_width<=4000:raise SystemExit('target width must be 320..4000')
    if not 45<=a.jpeg_quality<=100:raise SystemExit('jpeg quality must be 45..100')
    slug=a.slug or safe_slug(a.edition.replace('Edition',''));desc=a.description or f'Open the interactive {a.brand} {a.edition}.'
    if out.exists():shutil.rmtree(out)
    (out/'reader/pages').mkdir(parents=True);(out/'broadcast').mkdir(parents=True)
    source_sha=sha256_file(pdf);doc=fitz.open(pdf);pages=[]
    for idx,page in enumerate(doc,start=1):
        rel=f'pages/page-{idx:03d}.jpg';path=out/'reader'/rel;page_to_jpeg(page,path,a.target_width,a.jpeg_quality);info=image_info(path);pages.append({'number':idx,'label':'Cover' if idx==1 else f'Page {idx}','src':rel,'bytes':path.stat().st_size,'sha256':sha256_file(path),**info})
    doc.close();cover_src=out/'reader'/pages[0]['src'];cover_dst=out/'broadcast/cover.jpg';shutil.copyfile(cover_src,cover_dst);cover={**image_info(cover_dst),'bytes':cover_dst.stat().st_size,'sha256':sha256_file(cover_dst)}
    pub={'schema_version':SCHEMA,'brand':a.brand,'title':a.title,'edition':a.edition,'slug':slug,'description':desc,'source':{'file':pdf.name,'bytes':pdf.stat().st_size,'sha256':source_sha,'page_count':len(pages)},'render':{'target_width':a.target_width,'jpeg_quality':a.jpeg_quality},'pages':pages}
    (out/'publication.json').write_text(json.dumps(pub,indent=2,ensure_ascii=False)+'\n');(out/'reader/index.html').write_text(reader_html(pub))
    manifest={'schema_version':'broadcast-gateway.issue.v1','brand':{'id':'golden-goose' if 'Goose' in a.brand else safe_slug(a.brand),'name':a.brand,'site_name':a.brand,'theme_color':'#0c0907'},'issue':{'slug':slug,'title':f'{a.brand} · {a.edition}','label':a.edition,'description':desc},'share':{'origin':a.share_origin or 'UNKNOWN','path':f'/broadcast/{slug}/','version':a.version},'cover':{'mode':'local','file':'cover.jpg',**cover},'destination':a.destination or 'UNKNOWN','alt':f'{a.brand} {a.edition} cover','twitter_card':'summary_large_image'}
    (out/'broadcast/issue-manifest.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n')
    receipt={'schema_version':'publication-ingest.receipt.v1','status':'INGEST_PASS','source_pdf':pub['source'],'output':{'page_count':len(pages),'reader_html_sha256':sha256_file(out/'reader/index.html'),'publication_json_sha256':sha256_file(out/'publication.json'),'cover':cover},'release_gates':{'A':1,'P':None,'T':None,'I':1,'M':None,'K':1,'L':None,'R':1,'D':None},'next_gate':'Bind public share origin and destination -> stage -> prove transport/metadata/lineage -> fresh compositor proof'}
    (out/'receipt.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps({'status':'INGEST_PASS','out':str(out),'pages':len(pages),'source_sha256':source_sha,'cover':cover},indent=2))
if __name__=='__main__':main()
