
(()=>{
'use strict';
const BUILD='PS-PUBLIC-DEMO-G6K-v012-r1';
const SCHEMA='psdemo-2';
const q=(s,r=document)=>r.querySelector(s), qa=(s,r=document)=>[...r.querySelectorAll(s)];
const clone=v=>JSON.parse(JSON.stringify(v));
const uid=(p='id')=>p+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const toast=msg=>{const t=q('#toast');if(!t)return;t.textContent=msg;t.classList.add('show');clearTimeout(window.__opsToast);window.__opsToast=setTimeout(()=>t.classList.remove('show'),2300);};
const S={active:false,mode:'page',doc:null,sel:null,block:null,undo:[],redo:[],baseline:null,pdfUrl:null,pdfFile:null,pdfInspection:null,pdfStaged:[],lastPdfReceipt:null,count:1,drag:null,focusAfter:null};

function blockType(type='paragraph'){
  if(type==='heading')return 'heading2';
  return ['paragraph','heading1','heading2','quote','bullet','number','table'].includes(type)?type:'paragraph';
}
function textStyle(type='paragraph'){
  type=blockType(type);
  if(type==='heading1')return {fontFamily:'Georgia, Times New Roman, serif',fontSize:30,align:'left',bold:true,italic:false,underline:false,opacity:100};
  if(type==='heading2')return {fontFamily:'Georgia, Times New Roman, serif',fontSize:22,align:'left',bold:true,italic:false,underline:false,opacity:100};
  if(type==='quote')return {fontFamily:'Georgia, Times New Roman, serif',fontSize:13,align:'left',bold:false,italic:true,underline:false,opacity:100};
  return {fontFamily:'Georgia, Times New Roman, serif',fontSize:12,align:'left',bold:false,italic:false,underline:false,opacity:100};
}
function blockLabel(type){
  type=blockType(type);
  return ({paragraph:'Paragraph',heading1:'Heading 1',heading2:'Heading 2',quote:'Quote',bullet:'Bulleted item',number:'Numbered item',table:'Table'})[type]||'Paragraph';
}
function blockTag(type){
  type=blockType(type);
  return ({paragraph:'P',heading1:'H1',heading2:'H2',quote:'Q',bullet:'•',number:'1.',table:'TB'})[type]||'P';
}
function plainFromHtml(html){
  const d=document.createElement('div');d.innerHTML=html||'';return (d.innerText||d.textContent||'').replace(/\r/g,'');
}
function sanitizeInline(html){
  const t=document.createElement('template');t.innerHTML=html||'';
  const allowed=new Set(['B','STRONG','I','EM','U','BR','SUB','SUP']);
  function clean(node){
    [...node.childNodes].forEach(ch=>{
      if(ch.nodeType===1){
        clean(ch);
        if(!allowed.has(ch.tagName)){while(ch.firstChild)ch.parentNode.insertBefore(ch.firstChild,ch);ch.remove();}
        else [...ch.attributes].forEach(a=>ch.removeAttribute(a.name));
      }else if(ch.nodeType!==3)ch.remove();
    });
  }
  clean(t.content);return t.innerHTML;
}
function mkBlock(type='paragraph',text=''){
  type=blockType(type);
  if(type==='table')return {id:uid('block'),type:'table',rows:2,cols:2,cells:[['',''],['','']],style:textStyle('paragraph')};
  return {id:uid('block'),type,text,html:'',style:textStyle(type)};
}
function mkPage(n,blockIds=[]){
  return {id:uid('page'),label:'Page '+n,kind:'native',flowBlockIds:blockIds,objects:[]};
}
function freshDoc(){
  const b=mkBlock('paragraph','');
  const p=mkPage(1,[b.id]);
  return {schema:SCHEMA,id:uid('doc'),name:'Untitled-'+S.count++,kind:'native',revision:0,snapPt:8,guides:true,marginPct:9.4,pages:[p],currentPageId:p.id,flow:[b],comments:[],history:[],source:{authority:'NATIVE_SEMANTIC_DOCUMENT',claim:'Native semantic source; Page and Flow are views of the same blocks'}};
}
function pdfDoc(file,url){
  const p={id:uid('page'),label:'PDF source',kind:'pdf-source',flowBlockIds:[],objects:[],sourceUrl:url};
  return {schema:SCHEMA,id:uid('doc'),name:file.name,kind:'pdf',revision:0,snapPt:8,guides:false,marginPct:9.4,pages:[p],currentPageId:p.id,flow:[],comments:[],history:[],source:{authority:'LOCAL_PDF_SOURCE',claim:'Local PDF source + bounded page deltas',fileName:file.name,size:file.size,type:file.type}};
}
function migrate(doc){
  if(!doc||typeof doc!=='object')throw new Error('Invalid project');
  if(doc.schema===SCHEMA){
    doc.pages=Array.isArray(doc.pages)?doc.pages:[];
    doc.flow=Array.isArray(doc.flow)?doc.flow:[];
    doc.comments=Array.isArray(doc.comments)?doc.comments:[];
    doc.history=Array.isArray(doc.history)?doc.history:[];
    doc.pages.forEach((p,i)=>{p.flowBlockIds=Array.isArray(p.flowBlockIds)?p.flowBlockIds:[];p.objects=Array.isArray(p.objects)?p.objects:[];p.label=p.label||'Page '+(i+1);});
    repairDoc(doc);
    return doc;
  }
  if(doc.schema==='psdemo-1'){
    doc.schema=SCHEMA;doc.flow=Array.isArray(doc.flow)?doc.flow:[];doc.pages=Array.isArray(doc.pages)?doc.pages:[];
    if(doc.kind!=='pdf'&&!doc.flow.length)doc.flow.push(mkBlock('paragraph',''));
    doc.pages.forEach((p,i)=>{p.flowBlockIds=[];p.objects=Array.isArray(p.objects)?p.objects:[];p.label=p.label||'Page '+(i+1);});
    if(doc.kind!=='pdf'&&doc.pages.length){
      doc.pages[0].flowBlockIds=doc.flow.map(b=>b.id);
      if(!doc.pages[0].flowBlockIds.length){const b=mkBlock('paragraph','');doc.flow.push(b);doc.pages[0].flowBlockIds=[b.id];}
    }
    repairDoc(doc);return doc;
  }
  throw new Error('Unsupported Publisher Studio demo schema');
}
function repairDoc(doc=S.doc){
  if(!doc)return;
  doc.flow=Array.isArray(doc.flow)?doc.flow:[];
  doc.flow.forEach(b=>{
    b.type=blockType(b.type);
    b.style=b.style||textStyle(b.type);
    if(b.type==='table'){
      b.rows=Math.max(1,Number(b.rows)||2);b.cols=Math.max(1,Number(b.cols)||2);
      b.cells=Array.isArray(b.cells)?b.cells:[];
      while(b.cells.length<b.rows)b.cells.push(Array(b.cols).fill(''));
      b.cells=b.cells.slice(0,b.rows).map(r=>{r=Array.isArray(r)?r:[];while(r.length<b.cols)r.push('');return r.slice(0,b.cols).map(x=>String(x??''));});
    }else{
      b.text=String(b.text??'');
      if(typeof b.html!=='string')b.html='';
      b.html=sanitizeInline(b.html);
      if(b.html)b.text=plainFromHtml(b.html);
    }
  });
  if(!doc.pages.length){
    if(doc.kind==='pdf')doc.pages.push({id:uid('page'),label:'PDF source',kind:'pdf-source',flowBlockIds:[],objects:[]});
    else{const b=mkBlock('paragraph','');doc.flow.push(b);doc.pages.push(mkPage(1,[b.id]));}
  }
  const ids=new Set(doc.flow.map(b=>b.id));
  doc.pages.forEach((p,i)=>{
    p.flowBlockIds=(p.flowBlockIds||[]).filter(id=>ids.has(id));p.objects=p.objects||[];p.label=p.label||'Page '+(i+1);
  });
  if(doc.kind!=='pdf'){
    const assigned=new Set(doc.pages.flatMap(p=>p.flowBlockIds));
    doc.flow.filter(b=>!assigned.has(b.id)).forEach(b=>doc.pages[0].flowBlockIds.push(b.id));
    doc.pages.forEach(p=>{if(!p.flowBlockIds.length){const b=mkBlock('paragraph','');doc.flow.push(b);p.flowBlockIds.push(b.id);}});
  }
  if(!doc.pages.some(p=>p.id===doc.currentPageId))doc.currentPageId=doc.pages[0].id;
}
function curPage(){return S.doc?.pages.find(p=>p.id===S.doc.currentPageId)||S.doc?.pages[0]||null;}
function applyPdfPageOrder(order){
  if(S.doc?.kind!=='pdf'||!Array.isArray(order)||!order.length)return false;
  const bySource=new Map(S.doc.pages.map(pg=>[Number(pg.pdfPage),pg]));
  const next=order.map(n=>bySource.get(Number(n))).filter(Boolean);
  if(next.length!==order.length||next.length!==S.doc.pages.length)return false;
  S.doc.pages=next;return true;
}
function curObj(){const p=curPage();return p?.objects.find(o=>o.id===S.sel)||null;}
function curBlock(){return S.doc?.flow.find(b=>b.id===S.block)||null;}
function blockPage(blockId){return S.doc?.pages.find(p=>(p.flowBlockIds||[]).includes(blockId))||null;}
function state(){return JSON.stringify(S.doc);}
function record(label){S.doc.revision=(S.doc.revision||0)+1;S.doc.history.unshift({revision:S.doc.revision,label,at:new Date().toISOString()});S.doc.history=S.doc.history.slice(0,60);}
function persist(){
  if(!S.active||!S.doc||S.doc.kind==='pdf')return;
  try{localStorage.setItem('publisherStudioDemoDoc',JSON.stringify(S.doc));}catch(e){}
}
function mutate(label,fn){
  if(!S.active)return;
  const before=state();fn();repairDoc();
  if(state()===before)return;
  S.undo.push(before);if(S.undo.length>80)S.undo.shift();S.redo=[];record(label);persist();renderAll();
}
function begin(){if(S.active&&!S.baseline)S.baseline=state();}
function commit(label){
  if(!S.baseline)return;
  const before=S.baseline;S.baseline=null;repairDoc();
  if(state()===before)return;
  S.undo.push(before);if(S.undo.length>80)S.undo.shift();S.redo=[];record(label);persist();renderHistory();renderThumbs();renderStructure();status();authority();inspector();
}
async function undo(){
  if(S.active&&S.doc?.kind==='pdf'&&S.pdfStaged.length){
    const b=pdfBridge(),st=pdfBridgeState();
    if(!b?.readyFor?.('undo')||st.source==null){pdfBridgeHold('Undo PDF delta');return;}
    try{
      const result=await b.undo();
      if(result?.status==='UNDONE'){
        if(result?.operation?.type==='reorder_pages'&&Array.isArray(result.operation.previousPageList))applyPdfPageOrder(result.operation.previousPageList);
        S.pdfStaged.pop();record('Undo PDF engine delta');renderAll();toast('PDF delta undone.');
      }
      else toast('No staged PDF delta to undo.');
    }catch(error){modal('PDF undo failed','<div class="proof-item"><strong class="hold">UNDO · FAIL</strong><small>'+esc(error?.message||error)+'</small></div>');}
    return;
  }
  if(!S.active||!S.undo.length){toast('Nothing to undo.');return;}
  const cur=state();S.doc=JSON.parse(S.undo.pop());S.redo.push(cur);repairDoc();S.sel=null;S.block=S.doc.flow[0]?.id||null;renderAll();toast('Undo');
}
function redo(){
  if(!S.active||!S.redo.length){toast('Nothing to redo.');return;}
  const cur=state();S.doc=JSON.parse(S.redo.pop());S.undo.push(cur);repairDoc();S.sel=null;S.block=S.doc.flow[0]?.id||null;renderAll();toast('Redo');
}

function openBackstage(view='new'){const el=q('#fileBackstage');el.classList.add('open');el.setAttribute('aria-hidden','false');showFile(view);refreshResume();}
function closeBackstage(){const el=q('#fileBackstage');el.classList.remove('open');el.setAttribute('aria-hidden','true');}
function showFile(view){qa('.file-nav[data-file-view]').forEach(b=>b.classList.toggle('active',b.dataset.fileView===view));qa('.file-view').forEach(p=>p.classList.toggle('hidden',p.dataset.filePanel!==view));}
qa('.file-nav[data-file-view]').forEach(b=>b.addEventListener('click',()=>showFile(b.dataset.fileView)));
q('#fileClose')?.addEventListener('click',closeBackstage);
q('#fileTab')?.addEventListener('click',()=>openBackstage('new'));

function refreshResume(){
  const btn=q('#resumeSavedBtn');if(!btn)return;
  try{const d=JSON.parse(localStorage.getItem('publisherStudioDemoDoc')||'null');btn.disabled=!d;btn.querySelector('small').textContent=d?'Resume '+(d.name||'last browser document'):'No browser-saved document yet';}
  catch(e){btn.disabled=true;}
}
function activate(doc,pdfUrl=null,{focus=true}={}){
  if(S.pdfUrl&&S.pdfUrl!==pdfUrl){try{URL.revokeObjectURL(S.pdfUrl);}catch(e){}}
  S.pdfUrl=pdfUrl;S.doc=migrate(doc);S.active=true;S.sel=null;S.block=S.doc.flow[0]?.id||null;S.undo=[];S.redo=[];S.baseline=null;if(S.doc.kind!=='pdf'){S.pdfFile=null;S.pdfInspection=null;S.pdfStaged=[];S.lastPdfReceipt=null;}closeBackstage();
  q('.tab[data-tab="home"]')?.click();
  setMode('page');renderAll();
  if(focus&&S.doc.kind!=='pdf')setTimeout(()=>focusSemantic(S.block),40);
  toast(S.doc.kind==='pdf'?'PDF opened. Page source remains authoritative.':'Fresh document ready — start typing.');
}
q('#newDocumentBtn')?.addEventListener('click',()=>{
  if(S.active&&S.doc?.revision>0&&!confirm('Create a new document? Unsaved current changes may be lost.'))return;
  activate(freshDoc());
});
q('#resumeSavedBtn')?.addEventListener('click',()=>{
  try{const d=JSON.parse(localStorage.getItem('publisherStudioDemoDoc')||'null');if(!d)throw 0;activate(d,null,{focus:false});toast('Browser-saved document reopened.');}
  catch(e){toast('No valid browser-saved document was found.');}
});

function setMode(mode){
  S.mode=mode;q('#pageMode')?.classList.toggle('active',mode==='page');q('#flowMode')?.classList.toggle('active',mode==='flow');
  if(S.active){q('#pageCanvas').style.display=mode==='page'?'block':'none';q('#flowCanvas').classList.toggle('active',mode==='flow');if(mode==='page')renderPage();else renderFlow();}
  if(q('#modeStatus'))q('#modeStatus').textContent=mode==='page'?'Page Mode':'Flow Mode';inspector();
}
q('#pageMode')?.addEventListener('click',()=>S.active&&setMode('page'));
q('#flowMode')?.addEventListener('click',()=>S.active&&setMode('flow'));

function renderAll(){if(!S.active)return;renderThumbs();renderPage();renderFlow();renderStructure();renderHistory();renderComments();authority();status();inspector();}
function renderThumbs(){
  const host=q('#pagesPane');if(!host)return;
  host.innerHTML='<button class="ops-new-page" id="opsNewPage">+ New page</button><div id="opsThumbs"></div>';
  const t=q('#opsThumbs');
  S.doc.pages.forEach((p,i)=>{
    const el=document.createElement('div');el.className='thumb'+(p.id===S.doc.currentPageId?' active':'');
    el.innerHTML='<div class="thumb-page '+(p.kind==='pdf-source'?'pdf-thumb':'blank-thumb')+'">'+(p.kind==='pdf-source'?'PDF':'')+'</div><div class="thumb-label"><strong>'+(i+1)+'</strong><small>'+esc(p.label)+'</small></div>';
    el.onclick=()=>{S.doc.currentPageId=p.id;S.sel=null;S.block=p.flowBlockIds?.[0]||null;setMode('page');renderAll();};
    t.appendChild(el);
  });
  q('#opsNewPage').onclick=addPage;
}
function listMarker(block){
  if(block.type==='bullet')return '•';
  if(block.type!=='number')return '';
  const p=blockPage(block.id);if(!p)return '1.';
  let n=0;
  for(const id of p.flowBlockIds){const b=S.doc.flow.find(x=>x.id===id);if(b?.type==='number')n++;if(id===block.id)return n+'.';}
  return '1.';
}
function syncInline(block,el){
  block.html=sanitizeInline(el.innerHTML);
  block.text=plainFromHtml(block.html||esc(el.innerText||''));
}
function semanticBlockEl(block,context='page'){
  block.type=blockType(block.type);
  const el=document.createElement('div');
  el.className=(context==='page'?'page-semantic-block ':'ops-block ')+block.type+(block.id===S.block?' selected':'');
  el.dataset.blockId=block.id;
  if(block.type==='table'){
    el.classList.add('semantic-table-wrap');
    const tag=document.createElement('span');tag.className='table-tag';tag.textContent='TABLE '+block.rows+'×'+block.cols;el.appendChild(tag);
    const table=document.createElement('table');table.className='semantic-table';
    for(let r=0;r<block.rows;r++){
      const tr=document.createElement('tr');
      for(let c=0;c<block.cols;c++){
        const td=document.createElement('td');td.contentEditable='true';td.spellcheck=true;td.dataset.row=r;td.dataset.col=c;td.textContent=block.cells[r][c]||'';
        td.addEventListener('focus',()=>{S.block=block.id;S.sel=null;begin();markSelections();inspector();});
        td.addEventListener('input',()=>{block.cells[r][c]=td.innerText.replace(/\r/g,'');});
        td.addEventListener('blur',()=>commit('Edit table cell'));
        td.addEventListener('paste',e=>{e.preventDefault();document.execCommand('insertText',false,e.clipboardData.getData('text/plain'));});
        tr.appendChild(td);
      }
      table.appendChild(tr);
    }
    el.appendChild(table);
    el.addEventListener('pointerdown',()=>{S.block=block.id;S.sel=null;markSelections();inspector();});
    return el;
  }
  const tagName=block.type==='heading1'?'h2':block.type==='heading2'?'h3':'p';
  if(context==='flow')el.innerHTML='<span class="handle">⋮⋮</span><span class="type">'+blockTag(block.type)+'</span><'+tagName+' class="semantic-content" contenteditable="true" spellcheck="true"></'+tagName+'>';
  else el.innerHTML='<span class="semantic-block-tag">'+blockLabel(block.type).toUpperCase()+'</span><'+tagName+' class="semantic-content" contenteditable="true" spellcheck="true"></'+tagName+'>';
  if(block.type==='bullet'||block.type==='number'){const m=document.createElement('span');m.className='block-marker';m.textContent=listMarker(block);el.appendChild(m);}
  const c=q('.semantic-content',el);c.innerHTML=block.html||esc(block.text||'');applyTextStyle(c,block.style||textStyle(block.type));
  el.addEventListener('pointerdown',()=>{S.block=block.id;S.sel=null;markSelections();inspector();});
  c.addEventListener('focus',()=>{S.block=block.id;S.sel=null;begin();markSelections();inspector();});
  c.addEventListener('input',()=>syncInline(block,c));
  c.addEventListener('blur',()=>{syncInline(block,c);commit('Edit '+blockLabel(block.type).toLowerCase());maybeRebalance();});
  c.addEventListener('paste',e=>{e.preventDefault();document.execCommand('insertText',false,e.clipboardData.getData('text/plain'));});
  c.addEventListener('keydown',e=>semanticKeys(e,block,c));
  return el;
}
function applyTextStyle(el,st){
  Object.assign(el.style,{fontFamily:st.fontFamily||'Georgia, Times New Roman, serif',fontSize:(st.fontSize||12)+'px',textAlign:st.align||'left',fontWeight:st.bold?'700':'400',fontStyle:st.italic?'italic':'normal',textDecoration:st.underline?'underline':'none',opacity:(st.opacity??100)/100});
}
function semanticKeys(e,block,el){
  if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();insertPageBreakAt(block,el);return;}
  if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();splitBlockAtCaret(block,el);return;}
  if(e.key==='Backspace'&&!el.innerText&&blockPage(block.id)?.flowBlockIds.length>1){e.preventDefault();const p=blockPage(block.id),idx=p.flowBlockIds.indexOf(block.id),prev=p.flowBlockIds[Math.max(0,idx-1)];mutate('Remove empty paragraph',()=>{p.flowBlockIds.splice(idx,1);S.doc.flow=S.doc.flow.filter(b=>b.id!==block.id);S.block=prev;});setTimeout(()=>focusSemantic(prev,true),30);}
}
function splitInlineAtCaret(el){
  const sel=window.getSelection();if(!sel||!sel.rangeCount||!el.contains(sel.anchorNode))return {beforeHtml:sanitizeInline(el.innerHTML),afterHtml:'',beforeText:el.innerText.replace(/\r/g,''),afterText:''};
  const caret=sel.getRangeAt(0),all=document.createRange();all.selectNodeContents(el);
  const before=all.cloneRange(),after=all.cloneRange();before.setEnd(caret.startContainer,caret.startOffset);after.setStart(caret.startContainer,caret.startOffset);
  const a=document.createElement('div'),b=document.createElement('div');a.appendChild(before.cloneContents());b.appendChild(after.cloneContents());
  const ah=sanitizeInline(a.innerHTML),bh=sanitizeInline(b.innerHTML);
  return {beforeHtml:ah,afterHtml:bh,beforeText:plainFromHtml(ah),afterText:plainFromHtml(bh)};
}
function splitBlockAtCaret(block,el){
  const parts=splitInlineAtCaret(el);block.html=parts.beforeHtml;block.text=parts.beforeText;
  const nb=mkBlock('paragraph',parts.afterText);nb.html=parts.afterHtml;nb.style=clone(block.style||textStyle(block.type));nb.type='paragraph';
  const p=blockPage(block.id)||curPage(),pi=p.flowBlockIds.indexOf(block.id),gi=S.doc.flow.findIndex(b=>b.id===block.id);
  const before=state();p.flowBlockIds.splice(pi+1,0,nb.id);S.doc.flow.splice(gi+1,0,nb);S.block=nb.id;S.sel=null;
  S.undo.push(before);S.redo=[];record('New paragraph');persist();renderAll();setTimeout(()=>focusSemantic(nb.id),25);setTimeout(maybeRebalance,45);
}
function focusSemantic(id,end=false){
  const el=q('[data-block-id="'+CSS.escape(id)+'"] .semantic-content');if(!el)return;el.focus();
  if(end){const r=document.createRange(),s=window.getSelection();r.selectNodeContents(el);r.collapse(false);s.removeAllRanges();s.addRange(r);}
}
function renderPage(){
  const host=q('#pageCanvas');if(!host||!S.active)return;const p=curPage();if(!p){host.innerHTML='';return;}
  const pageNo=Number(p.pdfPage||1);
  const pdf=p.kind==='pdf-source'&&S.pdfUrl?'<div class="pdf-source"><embed src="'+esc(S.pdfUrl)+'#page='+pageNo+'&toolbar=0&navpanes=0" type="application/pdf"><div class="pdf-source-note">PDF source · local page '+pageNo+' · bounded G5I overlays</div></div>':'';
  const semantic=S.doc.kind==='pdf'?'':'<div class="semantic-sheet '+(p.flowBlockIds.length?'':'empty')+'" id="semanticSheet"></div>';
  host.innerHTML='<article class="paper native-page '+(S.doc.guides?'guides ':'')+((p.objects.length||p.flowBlockIds.length||p.kind==='pdf-source')?'has-objects has-semantic':'')+'" id="opsPage" style="--margin-guide:'+(S.doc.marginPct||9.4)+'%"><div class="paper-inner"></div>'+pdf+semantic+'<div class="blank-placeholder"><span>Blank page<small>Start typing or insert a layout object</small></span></div><div class="object-layer" id="opsLayer"></div></article>';
  if(S.doc.kind!=='pdf'){
    const sheet=q('#semanticSheet');p.flowBlockIds.map(id=>S.doc.flow.find(b=>b.id===id)).filter(Boolean).forEach(b=>sheet.appendChild(semanticBlockEl(b,'page')));
  }
  const layer=q('#opsLayer');p.objects.slice().sort((a,b)=>(a.z||10)-(b.z||10)).forEach(o=>layer.appendChild(objectEl(o)));
  if(S.doc.kind==='pdf'&&S.pdfInspection){
    const meta=S.pdfInspection.pages?.find(x=>Number(x.page)===pageNo);
    if(meta){
      S.pdfStaged.filter(op=>op.type==='redact'&&Number(op.page)===pageNo).forEach(op=>{
        const [x0,y0,x1,y1]=(op.bbox||[]).map(Number);if([x0,y0,x1,y1].some(Number.isNaN))return;
        const el=document.createElement('div');el.className='pdf-redaction-overlay';el.title='Staged true redaction · Undo removes this delta';
        Object.assign(el.style,{left:(x0/meta.width*100)+'%',top:(y0/meta.height*100)+'%',width:((x1-x0)/meta.width*100)+'%',height:((y1-y0)/meta.height*100)+'%'});
        layer.appendChild(el);
      });
      S.pdfStaged.filter(op=>op.type==='replace_text'&&Number(op.page)===pageNo).forEach(op=>{
        const [x0,y0,x1,y1]=(op.bbox||[]).map(Number);if([x0,y0,x1,y1].some(Number.isNaN))return;
        const el=document.createElement('div');el.className='pdf-replacement-overlay';el.title='Staged text replacement · Undo removes this delta';
        Object.assign(el.style,{left:(x0/meta.width*100)+'%',top:(y0/meta.height*100)+'%',width:((x1-x0)/meta.width*100)+'%',height:((y1-y0)/meta.height*100)+'%'});
        el.innerHTML='<span>'+esc(op.newText||'')+'</span>';
        layer.appendChild(el);
      });
      S.pdfStaged.filter(op=>op.type==='add_link'&&Number(op.page)===pageNo).forEach(op=>{
        const [x0,y0,x1,y1]=(op.bbox||[]).map(Number);if([x0,y0,x1,y1].some(Number.isNaN))return;
        const el=document.createElement('div');el.className='pdf-link-overlay';el.title='Staged URI link · '+(op.uri||'')+' · Undo removes this delta';
        Object.assign(el.style,{left:(x0/meta.width*100)+'%',top:(y0/meta.height*100)+'%',width:((x1-x0)/meta.width*100)+'%',height:((y1-y0)/meta.height*100)+'%'});
        el.innerHTML='<span>↗ '+esc(op.uri||'LINK')+'</span>';
        layer.appendChild(el);
      });
    }
  }
  q('#opsPage').addEventListener('pointerdown',e=>{if(e.target.id==='opsPage'||e.target.id==='opsLayer'){S.sel=null;markSelections();inspector();}});
}
function objectEl(o){
  const el=document.createElement('div');el.className='page-object '+(o.type==='image'?'image-object':'text-object')+(o.id===S.sel?' selected':'');el.dataset.id=o.id;
  Object.assign(el.style,{left:o.x+'%',top:o.y+'%',width:o.w+'%',height:o.h+'%',zIndex:o.z||10,opacity:(o.opacity??100)/100});
  const st=o.style||textStyle();
  if(o.type==='image')el.innerHTML='<div class="object-grip">MOVE</div><div class="object-content"><img src="'+o.src+'" alt="'+esc(o.alt||'Inserted image')+'"></div><span class="object-badge">IMAGE</span><span class="resize-handle"></span>';
  else{
    el.innerHTML='<div class="object-grip">MOVE</div><div class="object-content" contenteditable="true" spellcheck="true"></div><span class="object-badge">TEXT FRAME</span><span class="resize-handle"></span>';
    const c=q('.object-content',el);c.innerHTML=o.html||esc(o.text||'');applyTextStyle(c,st);
    c.onfocus=()=>{S.sel=o.id;S.block=null;begin();markSelections();inspector();};
    c.oninput=()=>{o.html=sanitizeInline(c.innerHTML);o.text=plainFromHtml(o.html||esc(c.innerText||''));};
    c.onblur=()=>commit('Edit text frame');
    c.addEventListener('paste',e=>{e.preventDefault();document.execCommand('insertText',false,e.clipboardData.getData('text/plain'));});
  }
  el.addEventListener('pointerdown',e=>{if(e.target.classList.contains('object-grip')||e.target.classList.contains('resize-handle'))return;S.sel=o.id;S.block=null;markSelections();inspector();});
  q('.object-grip',el).addEventListener('pointerdown',e=>dragStart(e,o,el,false));q('.resize-handle',el).addEventListener('pointerdown',e=>dragStart(e,o,el,true));return el;
}
function markSelections(){
  qa('.page-object').forEach(el=>el.classList.toggle('selected',el.dataset.id===S.sel));
  qa('[data-block-id]').forEach(el=>el.classList.toggle('selected',el.dataset.blockId===S.block&&!S.sel));
}
function snapPct(v,axis){const step=S.doc.snapPt||0;if(!step)return v;const total=axis==='x'?612:792;return Math.round((v/100*total)/step)*step/total*100;}
function dragStart(e,o,el,resize){
  e.preventDefault();e.stopPropagation();S.sel=o.id;S.block=null;markSelections();begin();const r=q('#opsPage').getBoundingClientRect();
  S.drag={o,el,resize,sx:e.clientX,sy:e.clientY,x:o.x,y:o.y,w:o.w,h:o.h,r};document.addEventListener('pointermove',dragMove);document.addEventListener('pointerup',dragEnd,{once:true});
}
function dragMove(e){
  const d=S.drag;if(!d)return;const dx=(e.clientX-d.sx)/d.r.width*100,dy=(e.clientY-d.sy)/d.r.height*100;
  if(d.resize){d.o.w=Math.max(4,Math.min(100-d.o.x,snapPct(d.w+dx,'x')));d.o.h=Math.max(3,Math.min(100-d.o.y,snapPct(d.h+dy,'y')));d.el.style.width=d.o.w+'%';d.el.style.height=d.o.h+'%';}
  else{d.o.x=Math.max(0,Math.min(100-d.o.w,snapPct(d.x+dx,'x')));d.o.y=Math.max(0,Math.min(100-d.o.h,snapPct(d.y+dy,'y')));d.el.style.left=d.o.x+'%';d.el.style.top=d.o.y+'%';}
}
function dragEnd(){if(!S.drag)return;const label=S.drag.resize?'Resize page object':'Move page object';S.drag=null;document.removeEventListener('pointermove',dragMove);commit(label);renderPage();inspector();}

function maybeRebalance(){
  if(!S.active||S.doc.kind==='pdf'||S.mode!=='page')return;
  const sheet=q('#semanticSheet'),p=curPage();if(!sheet||!p||p.flowBlockIds.length<2)return;
  if(sheet.scrollHeight<=sheet.clientHeight+2)return;
  const moveId=p.flowBlockIds[p.flowBlockIds.length-1];let idx=S.doc.pages.indexOf(p),next=S.doc.pages[idx+1];
  const before=state();
  if(!next){next=mkPage(S.doc.pages.length+1,[]);S.doc.pages.push(next);}
  p.flowBlockIds.pop();next.flowBlockIds.unshift(moveId);record('Auto-flow paragraph to next page');S.undo.push(before);S.redo=[];persist();renderAll();toast('Text flowed to the next page.');
}
function renderFlow(){
  const host=q('#flowCanvas');if(!host||!S.active)return;host.classList.add('ops-flow');
  if(S.doc.kind==='pdf'){host.innerHTML='<div class="flow-head"><div><div class="page-kicker">Representation boundary</div><h1>'+esc(S.doc.name)+'</h1></div><span class="source-pill">PDF authority</span></div><div class="flow-empty">This PDF has not been promoted into semantic Flow truth.<br><br>Page editing remains attached to the PDF source until an explicit extraction/conversion operation is authorized.</div>';return;}
  host.innerHTML='<div class="flow-head"><div><div class="page-kicker">Same semantic document</div><h1>'+esc(S.doc.name)+'</h1></div><span class="source-pill">Native semantic authority</span></div><div id="opsBlocks"></div>';
  const out=q('#opsBlocks');
  S.doc.pages.forEach((p,i)=>{
    const group=document.createElement('section');group.className='flow-page-group';group.innerHTML='<div class="flow-page-label">Page '+(i+1)+'</div>';
    p.flowBlockIds.map(id=>S.doc.flow.find(b=>b.id===id)).filter(Boolean).forEach(b=>group.appendChild(semanticBlockEl(b,'flow')));
    if(p.objects.length){const n=document.createElement('div');n.className='flow-layout-note';n.textContent=p.objects.length+' positioned Page Mode object'+(p.objects.length===1?'':'s')+' on this page.';group.appendChild(n);}
    out.appendChild(group);
  });
}
function renderStructure(){
  const host=q('#structurePane');if(!host||!S.active)return;host.innerHTML='';
  if(S.doc.kind==='pdf'){host.innerHTML='<div class="structure-row"><span class="tag">PDF</span>Page authority only</div>';return;}
  S.doc.pages.forEach((p,i)=>{
    const pg=document.createElement('div');pg.className='structure-row';pg.innerHTML='<span class="tag">P'+(i+1)+'</span>'+esc(p.label);host.appendChild(pg);
    p.flowBlockIds.map(id=>S.doc.flow.find(b=>b.id===id)).filter(Boolean).forEach(b=>{const r=document.createElement('div');r.className='structure-row';r.style.paddingLeft='18px';r.innerHTML='<span class="tag">'+(b.type==='heading'?'H2':'¶')+'</span>'+esc((b.text||'Blank paragraph').slice(0,34));r.onclick=()=>{S.doc.currentPageId=p.id;S.block=b.id;S.sel=null;setMode('flow');renderFlow();setTimeout(()=>focusSemantic(b.id),20);};host.appendChild(r);});
  });
}
function renderHistory(){
  const host=q('.history-list');if(!host||!S.active)return;host.innerHTML='';
  if(!S.doc.history.length){host.innerHTML='<div class="history-item active"><div class="row"><strong>r0</strong><span>current</span></div><p>Fresh document state.</p></div>';return;}
  S.doc.history.forEach((h,i)=>{const e=document.createElement('div');e.className='history-item'+(i===0?' active':'');e.innerHTML='<div class="row"><strong>r'+h.revision+'</strong><span>'+new Date(h.at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+'</span></div><p>'+esc(h.label)+'</p>';host.appendChild(e);});
}
function renderComments(){
  const panel=q('#reviewPanel'),btn=q('#addComment');if(!panel||!btn||!S.active)return;panel.querySelectorAll('.comment').forEach(x=>x.remove());
  S.doc.comments.forEach(c=>{const e=document.createElement('div');e.className='comment';e.innerHTML='<strong>'+esc(c.author||'You')+' · r'+c.revision+'</strong><p>'+esc(c.text)+'</p>';btn.before(e);});
}
function authority(){
  if(!S.active)return;const rows=qa('#authorityPanel .authority-row');
  const m={Source:S.doc.kind==='pdf'?'LOCAL PDF':'NATIVE SEMANTIC','Page deltas':S.doc.kind==='pdf'?(S.pdfStaged.length+' staged G5I delta'+(S.pdfStaged.length===1?'':'s')):(S.doc.pages.reduce((n,p)=>n+p.objects.length,0)+' objects'),Flow:S.doc.kind==='pdf'?'Not promoted':S.doc.flow.length+' blocks',Assets:S.doc.pages.flatMap(p=>p.objects).filter(o=>o.type==='image').length+' local',Checkpoint:'r'+S.doc.revision};
  rows.forEach(r=>{const k=q('span',r)?.textContent;if(k&&m[k]!=null)q('strong',r).textContent=m[k];});
}
function status(){
  if(!S.active)return;q('#docName').textContent=S.doc.name;q('#sourceStatus').textContent=S.doc.kind==='pdf'?'Local PDF source preserved':'Native semantic document';q('#pageCountStatus').textContent=S.doc.pages.length+' page'+(S.doc.pages.length===1?'':'s');q('#revisionLabel').textContent='r'+S.doc.revision;q('#snapLabel').textContent=S.doc.snapPt?S.doc.snapPt+' pt':'Off';q('#buildMarker').textContent=BUILD;
}
function target(){
  if(S.sel)return {kind:'object',value:curObj()};
  if(S.block)return {kind:'block',value:curBlock()};
  return null;
}
function inspector(){
  if(!S.active)return;const t=target(),v=t?.value,st=v?(v.style||v):textStyle();
  q('#objectType').textContent=v?(t.kind==='object'?(v.type==='image'?'Image':'Text frame'):blockLabel(v.type)):(S.mode==='page'?'Page':'Document');
  const styleSelect=q('#styleSelect');if(styleSelect){styleSelect.disabled=!v||t?.kind!=='block'||v.type==='table';if(t?.kind==='block'&&v.type!=='table')styleSelect.value=blockType(v.type);}
  q('#fontFamily')&&(q('#fontFamily').value=st.fontFamily||'Georgia, Times New Roman, serif');
  q('#fontSize')&&(q('#fontSize').value=st.fontSize||12);q('#sizeLabel').textContent=(st.fontSize||12)+' pt';
  const op=t?.kind==='object'?(v.opacity??100):(st.opacity??100);q('#opacityRange').value=op;q('#opacityLabel').textContent=op+'%';
  qa('.alignBtn').forEach(b=>b.classList.toggle('active',(st.align||'left')===b.dataset.align));qa('.format-btn').forEach(b=>b.classList.toggle('active',!!st[b.dataset.format]));
}
function need(label){if(S.active)return true;toast(label+': use File → New → Document or File → Open → PDF.');openBackstage('new');return false;}

function pdfBridge(){return window.PublisherStudioPdfBridge||null;}
function pdfBridgeState(){return pdfBridge()?.status?.()||{status:'HOLD',reason:'bridge_script_unavailable',capabilities:{},source:null};}
function pdfBridgeHold(tool='PDF editing'){
  const st=pdfBridgeState();
  modal('PDF engine connection · HOLD','<div class="proof-grid"><div class="proof-item"><strong class="hold">HOLD · '+esc(tool)+'</strong><small>No native PDF mutation was attempted.</small></div><div class="proof-item"><strong>Public bridge contract</strong><small>'+esc(window.PublisherStudioPdfBridge?.CONTRACT||'unavailable')+'</small></div><div class="proof-item"><strong>Adapter state</strong><small>'+esc(st.status)+' · '+esc(st.reason||'not connected')+'</small></div><div class="proof-item"><strong class="pass">Source authority preserved</strong><small>The local PDF remains authoritative until a registered adapter returns engine evidence.</small></div></div>');
}
function updatePdfBridgeUi(){
  const st=pdfBridgeState(),pill=q('#pdfEngineStatus');
  if(pill){const connected=st.status==='CONNECTED';pill.textContent='PDF engine · '+(connected?'CONNECTED':st.status||'HOLD');pill.classList.toggle('gold',connected);pill.title=st.reason||st.adapterId||'';}
  qa('.pdf-engine-tool').forEach(btn=>{
    const tool=btn.dataset.pdfTool;
    const allowed=!!S.active&&S.doc?.kind==='pdf'&&pdfBridge()?.readyFor?.(tool)&&st.source!=null;
    btn.disabled=!allowed;btn.classList.toggle('disabled-tool',!allowed);btn.title=allowed?'Connected PDF engine capability':'Requires a connected G5I-compatible PDF adapter';
  });
}
async function connectPdfSource(file){
  S.pdfFile=file;S.pdfInspection=null;S.pdfStaged=[];S.lastPdfReceipt=null;const b=pdfBridge();
  if(!b){updatePdfBridgeUi();return {status:'HOLD',reason:'bridge_script_unavailable'};}
  try{
    const result=await b.openSource(file,{documentName:S.doc?.name||file.name,sourceAuthority:'LOCAL_PDF_SOURCE'});
    const inspection=result?.result?.manifest||null;S.pdfInspection=inspection;
    if(inspection?.pageCount){
      S.doc.pages=(inspection.pages||[]).map((meta,i)=>({id:uid('page'),label:'PDF page '+(i+1),kind:'pdf-source',flowBlockIds:[],objects:[],sourceUrl:S.pdfUrl,pdfPage:i+1}));
      if(!S.doc.pages.length)S.doc.pages=[{id:uid('page'),label:'PDF source',kind:'pdf-source',flowBlockIds:[],objects:[],sourceUrl:S.pdfUrl,pdfPage:1}];
      S.doc.currentPageId=S.doc.pages[0].id;S.doc.source.sourceSha256=inspection.sourceSha256;S.doc.source.transport=inspection.transport;
    }
    renderAll();updatePdfBridgeUi();toast('G5I inspected '+(inspection?.pageCount||1)+' PDF page(s). Source remains frozen.');return result;
  }catch(error){updatePdfBridgeUi();toast('PDF source opened locally; public G5I transport remains on HOLD.');return {status:'HOLD',reason:String(error)};}
}
function openPdfTextReplacementPicker(){
  const pageNo=Number(curPage()?.pdfPage||1),meta=S.pdfInspection?.pages?.find(x=>Number(x.page)===pageNo);
  if(!meta?.blocks?.length){modal('Edit PDF text','<div class="proof-item"><strong class="hold">NO NATIVE TEXT BLOCKS</strong><small>G5I found no native text blocks on this page. OCR transport is not promoted.</small></div>');return;}
  const rows=meta.blocks.map(b=>'<button class="pdf-block-choice" data-block="'+esc(b.id)+'"><strong>'+esc(b.text.slice(0,120))+'</strong><small>Page '+pageNo+' · '+b.bbox.map(v=>Number(v).toFixed(1)).join(', ')+'</small></button>').join('');
  modal('Edit existing PDF text','<p class="pdf-tool-note">Choose one G5I-detected native text block. Replacement is bounded to the same PDF box, removes text only so underlying non-text content survives, and uses a builtin Helvetica fallback in this checkpoint.</p><div class="pdf-block-list">'+rows+'</div>');
  qa('.pdf-block-choice').forEach(btn=>btn.onclick=async()=>{
    const block=meta.blocks.find(x=>x.id===btn.dataset.block);if(!block)return;
    const next=prompt('Replacement text for this exact PDF block:',block.text);if(next==null||!next.trim())return;
    try{
      const b=pdfBridge();const result=await b.invoke('replaceText',{page:pageNo,bbox:block.bbox,oldText:block.text,newText:next,backgroundMode:'preserve',fontSize:10,color:'#000000',align:'left'});
      S.pdfStaged.push(result.operation);record('Stage bounded PDF text replacement');q('#modalBg').classList.remove('open');renderAll();toast('PDF text replacement staged. Undo removes it before export.');
      window.dispatchEvent(new CustomEvent('publisherstudio:pdfcommand',{detail:{tool:'replaceText',result}}));
    }catch(error){modal('PDF text replacement failed','<div class="proof-item"><strong class="hold">EDIT TEXT · FAIL</strong><small>'+esc(error?.message||error)+'</small></div>');}
  });
}

function openPdfLinkPicker(){
  const pageNo=Number(curPage()?.pdfPage||1),meta=S.pdfInspection?.pages?.find(x=>Number(x.page)===pageNo);
  if(!meta?.blocks?.length){modal('Add PDF link','<div class="proof-item"><strong class="hold">NO NATIVE TEXT BLOCKS</strong><small>G5I found no native text blocks on this page. Link insertion in this checkpoint attaches a URI to an existing detected text box.</small></div>');return;}
  const rows=meta.blocks.map(b=>'<button class="pdf-block-choice" data-block="'+esc(b.id)+'"><strong>'+esc(b.text.slice(0,120))+'</strong><small>Page '+pageNo+' · '+b.bbox.map(v=>Number(v).toFixed(1)).join(', ')+'</small></button>').join('');
  modal('Add link to existing PDF content','<p class="pdf-tool-note">Choose one G5I-detected native text block. Publisher Studio will stage a URI link over that exact authorized box without changing the visible text.</p><div class="pdf-block-list">'+rows+'</div>');
  qa('.pdf-block-choice').forEach(btn=>btn.onclick=async()=>{
    const block=meta.blocks.find(x=>x.id===btn.dataset.block);if(!block)return;
    const uri=prompt('URI for this PDF link:','https://');if(uri==null||!uri.trim())return;
    if(!/^(https?:|mailto:)/i.test(uri.trim())){modal('PDF link rejected','<div class="proof-item"><strong class="hold">URI · HOLD</strong><small>G6J accepts http:, https:, or mailto: links only.</small></div>');return;}
    try{
      const b=pdfBridge();const result=await b.invoke('links',{page:pageNo,bbox:block.bbox,uri:uri.trim()});
      S.pdfStaged.push(result.operation);record('Stage bounded PDF URI link');q('#modalBg').classList.remove('open');renderAll();toast('PDF link staged. Undo removes it before export.');
      window.dispatchEvent(new CustomEvent('publisherstudio:pdfcommand',{detail:{tool:'links',result}}));
    }catch(error){modal('PDF link failed','<div class="proof-item"><strong class="hold">LINK · FAIL</strong><small>'+esc(error?.message||error)+'</small></div>');}
  });
}

function openPdfRedactionPicker(){
  const pageNo=Number(curPage()?.pdfPage||1),meta=S.pdfInspection?.pages?.find(x=>Number(x.page)===pageNo);
  if(!meta?.blocks?.length){modal('Redact PDF text','<div class="proof-item"><strong class="hold">NO TEXT BLOCKS</strong><small>G5I found no native text blocks on this page. OCR transport is not yet promoted.</small></div>');return;}
  const rows=meta.blocks.map(b=>'<button class="pdf-block-choice" data-block="'+esc(b.id)+'"><strong>'+esc(b.text.slice(0,120))+'</strong><small>Page '+pageNo+' · '+b.bbox.map(v=>Number(v).toFixed(1)).join(', ')+'</small></button>').join('');
  modal('Stage true redaction','<p class="pdf-tool-note">Choose one G5I-detected text block. The source PDF remains unchanged; this stages a destructive redaction delta for verified export.</p><div class="pdf-block-list">'+rows+'</div>');
  qa('.pdf-block-choice').forEach(btn=>btn.onclick=async()=>{
    const block=meta.blocks.find(x=>x.id===btn.dataset.block);if(!block)return;
    const ok=confirm('Stage true redaction for this exact text block?\n\n'+block.text);if(!ok)return;
    try{
      const st=pdfBridgeState(),b=pdfBridge();const result=await b.invoke('redact',{page:pageNo,bbox:block.bbox,oldText:block.text,fill:'#000000'});
      S.pdfStaged.push(result.operation);record('Stage true PDF redaction');q('#modalBg').classList.remove('open');renderAll();toast('True redaction staged. Undo removes it before export.');
      window.dispatchEvent(new CustomEvent('publisherstudio:pdfcommand',{detail:{tool:'redact',result}}));
    }catch(error){modal('PDF redaction failed','<div class="proof-item"><strong class="hold">REDACT · FAIL</strong><small>'+esc(error?.message||error)+'</small></div>');}
  });
}
async function runPdfTool(tool){
  if(!need('PDF '+tool))return;
  if(S.doc.kind!=='pdf'){toast('Open a PDF source before using native PDF tools.');return;}
  const b=pdfBridge(),st=pdfBridgeState();
  if(!b?.readyFor?.(tool)||st.source==null){pdfBridgeHold(tool);return;}
  if(tool==='replaceText'){openPdfTextReplacementPicker();return;}
  if(tool==='redact'){openPdfRedactionPicker();return;}
  if(tool==='links'){openPdfLinkPicker();return;}
  modal('PDF tool boundary','<div class="proof-item"><strong class="hold">'+esc(tool.toUpperCase())+' · NOT PROMOTED</strong><small>The current public transport checkpoint proves bounded Edit Text, true redaction, URI link insertion, and isolated page reorder only. This tool remains disabled until its interaction and verification path is independently proven.</small></div>');
}

function addTextFrame(){
  if(!need('Insert'))return;setMode('page');mutate('Insert text frame',()=>{const p=curPage(),o={id:uid('obj'),type:'text',x:14,y:15,w:52,h:10,z:Math.max(10,...p.objects.map(x=>x.z||10))+1,text:'Type here',style:textStyle(),opacity:100};p.objects.push(o);S.sel=o.id;S.block=null;});setTimeout(()=>q('.page-object.selected .object-content')?.focus(),25);
}
function addPage(){
  if(!need('New page'))return;if(S.doc.kind==='pdf'){toast('Native PDF page insertion is pending the connected PDF engine.');return;}
  mutate('Insert page',()=>{const b=mkBlock('paragraph',''),p=mkPage(S.doc.pages.length+1,[b.id]);S.doc.flow.push(b);S.doc.pages.push(p);S.doc.currentPageId=p.id;S.block=b.id;S.sel=null;});setMode('page');setTimeout(()=>focusSemantic(S.block),30);
}
function deleteCurrentPage(){
  if(!need('Delete page'))return;if(S.doc.kind==='pdf'){toast('Native PDF page deletion is pending the connected PDF engine.');return;}
  if(S.doc.pages.length===1){toast('A native document keeps at least one page.');return;}
  const p=curPage();if(!p)return;
  mutate('Delete page',()=>{
    const idx=S.doc.pages.indexOf(p),owned=new Set(p.flowBlockIds||[]);
    S.doc.pages.splice(idx,1);S.doc.flow=S.doc.flow.filter(b=>!owned.has(b.id));
    const next=S.doc.pages[Math.min(idx,S.doc.pages.length-1)];S.doc.currentPageId=next.id;S.block=next.flowBlockIds[0]||null;S.sel=null;
  });
}
async function movePage(dir){
  if(!need('Move page'))return;
  const p=curPage(),i=S.doc.pages.indexOf(p),j=i+dir;if(!p||j<0||j>=S.doc.pages.length){toast('Page is already at that edge.');return;}
  if(S.doc.kind==='pdf'){
    const b=pdfBridge(),st=pdfBridgeState();
    if(!b?.readyFor?.('pageReorder')||st.source==null){pdfBridgeHold('Page reorder');return;}
    if(S.pdfStaged.length){modal('Page reorder is isolated','<div class="proof-item"><strong class="hold">G5I SEQUENCE TRANSACTION</strong><small>Undo or export the current staged PDF delta before reordering pages. Page identity stays unambiguous by keeping sequence edits isolated.</small></div>');return;}
    const before=S.doc.pages.map(pg=>Number(pg.pdfPage)),next=S.doc.pages.slice(),[moved]=next.splice(i,1);next.splice(j,0,moved),pageList=next.map(pg=>Number(pg.pdfPage));
    try{
      const result=await b.invoke('pageReorder',{pageList,previousPageList:before});
      S.pdfStaged.push(result.operation);S.doc.pages=next;record(dir<0?'Stage PDF page earlier':'Stage PDF page later');renderAll();toast('PDF page order staged · '+pageList.join(', ')+' · Undo restores source order.');
      window.dispatchEvent(new CustomEvent('publisherstudio:pdfcommand',{detail:{tool:'pageReorder',result}}));
    }catch(error){modal('PDF page reorder failed','<div class="proof-item"><strong class="hold">PAGE REORDER · FAIL</strong><small>'+esc(error?.message||error)+'</small></div>');}
    return;
  }
  mutate(dir<0?'Move page earlier':'Move page later',()=>{const [x]=S.doc.pages.splice(i,1);S.doc.pages.splice(j,0,x);S.doc.pages.forEach((pg,k)=>pg.label='Page '+(k+1));});
}
function addBlock(type){
  if(!need('Insert semantic block'))return;if(S.doc.kind==='pdf'){toast('PDF source cannot silently become Flow truth.');return;}
  const p=blockPage(S.block)||curPage();const after=S.block&&p.flowBlockIds.includes(S.block)?p.flowBlockIds.indexOf(S.block):p.flowBlockIds.length-1;
  mutate('Insert '+type,()=>{const b=mkBlock(type,'');const gi=S.block?S.doc.flow.findIndex(x=>x.id===S.block):-1;p.flowBlockIds.splice(after+1,0,b.id);S.doc.flow.splice(gi>=0?gi+1:S.doc.flow.length,0,b);S.block=b.id;S.sel=null;});setMode(S.mode);setTimeout(()=>focusSemantic(S.block),30);
}
function addTable(){
  if(!need('Insert table'))return;if(S.doc.kind==='pdf'){toast('PDF tables require the connected PDF engine.');return;}
  const p=blockPage(S.block)||curPage(),after=S.block&&p.flowBlockIds.includes(S.block)?p.flowBlockIds.indexOf(S.block):p.flowBlockIds.length-1;
  mutate('Insert 2×2 table',()=>{const b=mkBlock('table');const gi=S.block?S.doc.flow.findIndex(x=>x.id===S.block):-1;p.flowBlockIds.splice(after+1,0,b.id);S.doc.flow.splice(gi>=0?gi+1:S.doc.flow.length,0,b);S.block=b.id;S.sel=null;});
  setTimeout(()=>q('[data-block-id="'+CSS.escape(S.block)+'"] td')?.focus(),30);
}
function applyParagraphStyle(type){
  if(!need('Paragraph style'))return;const b=curBlock();if(!b||b.type==='table'){toast('Select a text paragraph first.');return;}
  type=blockType(type);mutate('Apply '+blockLabel(type)+' style',()=>{b.type=type;b.style=textStyle(type);});
}
function activeRichEditor(){
  const el=document.activeElement;if(!el)return null;
  if(el.classList.contains('semantic-content')){const root=el.closest('[data-block-id]'),b=root&&S.doc.flow.find(x=>x.id===root.dataset.blockId);return b?{el,kind:'block',value:b}:null;}
  if(el.classList.contains('object-content')){const root=el.closest('.page-object'),o=root&&curPage()?.objects.find(x=>x.id===root.dataset.id);return o&&o.type==='text'?{el,kind:'object',value:o}:null;}
  return null;
}
function toggleInline(cmd,key){
  if(!need('Format'))return;
  const rich=activeRichEditor(),sel=window.getSelection();
  if(rich&&sel&&sel.rangeCount&&!sel.isCollapsed&&rich.el.contains(sel.anchorNode)&&rich.el.contains(sel.focusNode)){
    begin();document.execCommand(cmd,false,null);
    rich.value.html=sanitizeInline(rich.el.innerHTML);rich.value.text=plainFromHtml(rich.value.html||esc(rich.el.innerText||''));
    commit('Format selection '+key);inspector();return;
  }
  const t=target();format(key,!t?.value?.style?.[key]);
}
function insertPageBreakAt(block=curBlock(),el=null){
  if(!need('Page break'))return;if(S.doc.kind==='pdf'){toast('Native PDF page breaks require the connected PDF engine.');return;}
  if(!block){toast('Select a paragraph or table first.');return;}
  const p=blockPage(block.id);if(!p)return;
  let parts=null;if(el&&block.type!=='table')parts=splitInlineAtCaret(el);
  mutate('Insert page break',()=>{
    const pIndex=S.doc.pages.indexOf(p),bIndex=p.flowBlockIds.indexOf(block.id),gIndex=S.doc.flow.findIndex(x=>x.id===block.id);
    let cut=bIndex+1;
    if(parts){
      block.html=parts.beforeHtml;block.text=parts.beforeText;
      const nb=mkBlock('paragraph',parts.afterText);nb.html=parts.afterHtml;nb.style=clone(block.style||textStyle(block.type));nb.type='paragraph';
      p.flowBlockIds.splice(bIndex+1,0,nb.id);S.doc.flow.splice(gIndex+1,0,nb);cut=bIndex+1;
    }
    let moved=p.flowBlockIds.splice(cut);
    if(!moved.length){const nb=mkBlock('paragraph','');S.doc.flow.splice(Math.max(0,gIndex+1),0,nb);moved=[nb.id];}
    const np=mkPage(S.doc.pages.length+1,moved);S.doc.pages.splice(pIndex+1,0,np);S.doc.pages.forEach((pg,i)=>pg.label='Page '+(i+1));S.doc.currentPageId=np.id;S.block=moved[0];S.sel=null;
  });
  setMode('page');setTimeout(()=>focusSemantic(S.block),30);
}
function replacePlain(str,needle,repl,all=true){
  str=String(str??'');if(!needle)return str;const flags=all?'gi':'i';const escaped=needle.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&');return str.replace(new RegExp(escaped,flags),repl);
}
function replaceHtmlText(html,needle,repl,all=true){
  const d=document.createElement('div');d.innerHTML=html||'';const walker=document.createTreeWalker(d,NodeFilter.SHOW_TEXT);let n,done=false;
  while((n=walker.nextNode())){if(done)break;const before=n.nodeValue,after=replacePlain(before,needle,repl,all);if(after!==before){n.nodeValue=after;if(!all)done=true;}}
  return sanitizeInline(d.innerHTML);
}
function allFindHits(term){
  const low=String(term||'').toLowerCase();if(!low)return [];
  const hits=[];
  S.doc.flow.forEach(b=>{
    if(b.type==='table'){b.cells.forEach((row,r)=>row.forEach((cell,c)=>{if(String(cell).toLowerCase().includes(low))hits.push({kind:'table',blockId:b.id,row:r,col:c,page:blockPage(b.id)?.id});}));}
    else if(String(b.text||'').toLowerCase().includes(low))hits.push({kind:'block',blockId:b.id,page:blockPage(b.id)?.id});
  });
  S.doc.pages.forEach(p=>p.objects.filter(o=>o.type==='text'&&String(o.text||'').toLowerCase().includes(low)).forEach(o=>hits.push({kind:'object',objectId:o.id,page:p.id})));
  return hits;
}
function focusHit(hit){
  if(hit.page)S.doc.currentPageId=hit.page;
  if(hit.kind==='object'){S.sel=hit.objectId;S.block=null;setMode('page');renderAll();setTimeout(()=>q('.page-object.selected')?.scrollIntoView({block:'center',behavior:'smooth'}),20);return;}
  S.block=hit.blockId;S.sel=null;setMode('flow');renderAll();
  setTimeout(()=>{const root=q('[data-block-id="'+CSS.escape(hit.blockId)+'"]');if(hit.kind==='table')q('td[data-row="'+hit.row+'"][data-col="'+hit.col+'"]',root)?.focus();else q('.semantic-content',root)?.focus();root?.scrollIntoView({block:'center',behavior:'smooth'});},20);
}
function replaceAllDoc(term,repl){
  let changed=0;
  mutate('Replace all "'+term+'"',()=>{
    S.doc.flow.forEach(b=>{
      if(b.type==='table'){b.cells=b.cells.map(row=>row.map(cell=>{const next=replacePlain(cell,term,repl,true);if(next!==cell)changed++;return next;}));}
      else{const before=b.text||'',html=b.html||'';if(before.toLowerCase().includes(term.toLowerCase())){b.html=html?replaceHtmlText(html,term,repl,true):'';b.text=html?plainFromHtml(b.html):replacePlain(before,term,repl,true);changed++;}}
    });
    S.doc.pages.forEach(p=>p.objects.filter(o=>o.type==='text').forEach(o=>{const before=o.text||'';if(before.toLowerCase().includes(term.toLowerCase())){o.html=o.html?replaceHtmlText(o.html,term,repl,true):'';o.text=o.html?plainFromHtml(o.html):replacePlain(before,term,repl,true);changed++;}}));
  });
  toast(changed?changed+' content item(s) updated.':'No matches found.');
}
function openFindReplace(){
  if(!need('Find / Replace'))return;
  modal('Find / Replace','<div class="find-grid"><label>Find<input id="findInput" autocomplete="off"></label><label>Replace with<input id="replaceInput" autocomplete="off"></label></div><div class="find-actions"><button id="findNextAction" class="primary">Find next</button><button id="replaceAllAction">Replace all</button></div><div class="find-count" id="findCount">Enter text to search this document.</div>');
  const fi=q('#findInput'),ri=q('#replaceInput'),count=q('#findCount');let cursor=0;
  const refresh=()=>{const hits=allFindHits(fi.value);count.textContent=fi.value?(hits.length+' match location'+(hits.length===1?'':'s')):'Enter text to search this document.';cursor=Math.min(cursor,Math.max(0,hits.length-1));return hits;};
  fi.addEventListener('input',refresh);
  q('#findNextAction').onclick=()=>{const hits=refresh();if(!hits.length){toast('No matches found.');return;}focusHit(hits[cursor%hits.length]);cursor=(cursor+1)%hits.length;};
  q('#replaceAllAction').onclick=()=>{if(!fi.value)return;replaceAllDoc(fi.value,ri.value);refresh();};
  setTimeout(()=>fi.focus(),20);
}

function removeSelected(){
  if(!need('Delete'))return;
  if(S.sel){mutate('Delete page object',()=>{const p=curPage();p.objects=p.objects.filter(o=>o.id!==S.sel);S.sel=null;});return;}
  const b=curBlock(),p=b&&blockPage(b.id);if(!b||!p){toast('Select content first.');return;}
  if(p.flowBlockIds.length===1&&S.doc.pages.length===1){mutate('Clear paragraph',()=>b.text='');setTimeout(()=>focusSemantic(b.id),20);return;}
  mutate('Delete semantic block',()=>{const idx=p.flowBlockIds.indexOf(b.id),prev=p.flowBlockIds[Math.max(0,idx-1)]||S.doc.flow.find(x=>x.id!==b.id)?.id||null;p.flowBlockIds.splice(idx,1);S.doc.flow=S.doc.flow.filter(x=>x.id!==b.id);if(!p.flowBlockIds.length&&S.doc.kind!=='pdf'){const nb=mkBlock('paragraph','');S.doc.flow.push(nb);p.flowBlockIds=[nb.id];S.block=nb.id;}else S.block=prev;});
}
function duplicate(){
  if(!need('Duplicate'))return;
  if(S.sel){const o=curObj();mutate('Duplicate page object',()=>{const c=clone(o);c.id=uid('obj');c.x=Math.min(100-c.w,c.x+3);c.y=Math.min(100-c.h,c.y+3);c.z=(o.z||10)+1;curPage().objects.push(c);S.sel=c.id;S.block=null;});return;}
  const b=curBlock(),p=b&&blockPage(b.id);if(!b||!p){toast('Select content first.');return;}
  mutate('Duplicate semantic block',()=>{const c=clone(b);c.id=uid('block');const pi=p.flowBlockIds.indexOf(b.id),gi=S.doc.flow.findIndex(x=>x.id===b.id);p.flowBlockIds.splice(pi+1,0,c.id);S.doc.flow.splice(gi+1,0,c);S.block=c.id;});
}
function format(key,val){
  if(!need('Format'))return;const t=target(),v=t?.value;if(!v){toast('Select text, a paragraph, or a layout object first.');return;}
  if((t.kind==='object'&&v.type==='image')||(t.kind==='block'&&v.type==='table')){if(key!=='opacity'){toast('That text format does not apply to this selection.');return;}}
  mutate('Format '+key,()=>{v.style=v.style||textStyle(v.type);if(key==='opacity'){if(t.kind==='object')v.opacity=Number(val);else v.style.opacity=Number(val);}else v.style[key]=val;});
}
function z(dir){if(!need('Arrange'))return;const o=curObj();if(!o){toast('Select a positioned Page Mode object first.');return;}mutate(dir>0?'Bring object forward':'Send object backward',()=>o.z=Math.max(1,(o.z||10)+dir));}

function capture(id,handler){
  const el=q(id);if(!el)return;
  el.addEventListener('click',async e=>{
    e.preventDefault();e.stopImmediatePropagation();
    try{await handler(e);}
    catch(error){console.error('Publisher Studio command failed',id,error);toast('Command failed · '+(error?.message||error));}
  },true);
}
capture('#undo',undo);capture('#redo',redo);capture('#duplicateBtn',duplicate);capture('#deleteBtn',removeSelected);capture('#addTextFrame',addTextFrame);capture('#addPageBtn',addPage);capture('#addHeadingBtn',()=>addBlock('heading2'));capture('#addParagraphBtn',()=>addBlock('paragraph'));capture('#bringFrontBtn',()=>z(1));capture('#sendBackBtn',()=>z(-1));
qa('.format-btn').forEach(b=>b.addEventListener('mousedown',e=>e.preventDefault()));
capture('#boldBtn',()=>toggleInline('bold','bold'));capture('#italicBtn',()=>toggleInline('italic','italic'));capture('#underlineBtn',()=>toggleInline('underline','underline'));capture('#findReplaceBtn',openFindReplace);capture('#addTableBtn',addTable);capture('#pageBreakBtn',()=>insertPageBreakAt(curBlock()));q('#styleSelect')?.addEventListener('change',e=>applyParagraphStyle(e.target.value));
q('#fontFamily')?.addEventListener('change',e=>format('fontFamily',e.target.value));q('#fontSize')?.addEventListener('change',e=>format('fontSize',Math.max(6,Math.min(144,Number(e.target.value)||12))));
q('#opacityRange')?.addEventListener('input',e=>q('#opacityLabel').textContent=e.target.value+'%');q('#opacityRange')?.addEventListener('change',e=>format('opacity',e.target.value));qa('.alignBtn').forEach(b=>b.addEventListener('click',()=>format('align',b.dataset.align)));
capture('#guideBtn',()=>mutate('Toggle page guides',()=>S.doc.guides=!S.doc.guides));capture('#snapBtn',()=>mutate('Toggle snap',()=>S.doc.snapPt=S.doc.snapPt?0:8));capture('#marginBtn',()=>mutate('Change margin guide',()=>S.doc.marginPct=S.doc.marginPct===9.4?5.9:9.4));capture('#deletePageBtn',deleteCurrentPage);capture('#movePageUpBtn',()=>movePage(-1));capture('#movePageDownBtn',()=>movePage(1));

const imageInput=document.createElement('input');imageInput.type='file';imageInput.accept='image/*';imageInput.hidden=true;document.body.appendChild(imageInput);
q('#imageBtn')?.addEventListener('click',()=>{if(need('Insert image'))imageInput.click();});
imageInput.addEventListener('change',()=>{const f=imageInput.files?.[0];if(!f)return;const r=new FileReader();r.onload=()=>mutate('Insert image',()=>{const p=curPage(),o={id:uid('obj'),type:'image',x:18,y:18,w:40,h:28,z:Math.max(10,...p.objects.map(x=>x.z||10))+1,src:r.result,alt:f.name,opacity:100};p.objects.push(o);S.sel=o.id;S.block=null;});r.readAsDataURL(f);imageInput.value='';});

q('#openPdfBtn')?.addEventListener('click',()=>q('#pdfFileInput').click());
q('#pdfFileInput')?.addEventListener('change',async()=>{const f=q('#pdfFileInput').files?.[0];if(!f)return;const url=URL.createObjectURL(f);activate(pdfDoc(f,url),url,{focus:false});await connectPdfSource(f);q('#pdfFileInput').value='';});
q('#openProjectBtn')?.addEventListener('click',()=>q('#projectFileInput').click());
q('#projectFileInput')?.addEventListener('change',async()=>{const f=q('#projectFileInput').files?.[0];if(!f)return;try{const d=migrate(JSON.parse(await f.text()));activate(d,null,{focus:false});if(d.kind==='pdf')toast('Project opened without source PDF bytes; reconnect the PDF source to continue.');}catch(e){toast('Could not open that project file.');}q('#projectFileInput').value='';});

function saveLocal(){
  if(!need('Save'))return;if(S.doc.kind==='pdf'){toast('PDF source bytes remain session-local; use project download for overlay state.');return;}
  try{localStorage.setItem('publisherStudioDemoDoc',JSON.stringify(S.doc));refreshResume();toast('Saved in this browser.');}catch(e){toast('Browser storage is unavailable.');}
}
function download(name,text,type='application/json'){const b=new Blob([text],{type}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),500);}
function project(){
  if(!need('Download project'))return;const d=clone(S.doc);d.pages.forEach(p=>{if(p.kind==='pdf-source')delete p.sourceUrl;});download(S.doc.name.replace(/[^a-z0-9_-]+/gi,'_')+'.psdemo.json',JSON.stringify(d,null,2));toast('Project snapshot downloaded.');
}
function blockHtml(b){
  if(b.type==='table'){const rows=b.cells.map(row=>'<tr>'+row.map(cell=>'<td>'+esc(cell)+'</td>').join('')+'</tr>').join('');return '<table style="width:100%;border-collapse:collapse;margin:8pt 0">'+rows.replaceAll('<td>','<td style="border:1px solid #bbb;padding:5pt">')+'</table>';}
  const st=b.style||textStyle(b.type),tag=b.type==='heading1'?'h1':b.type==='heading2'?'h2':b.type==='quote'?'blockquote':'p';
  const prefix=b.type==='bullet'?'• ':b.type==='number'?'1. ':'';
  return '<'+tag+' style="font-family:'+esc(st.fontFamily)+';font-size:'+st.fontSize+'px;text-align:'+st.align+';font-weight:'+(st.bold?700:400)+';font-style:'+(st.italic?'italic':'normal')+';text-decoration:'+(st.underline?'underline':'none')+';opacity:'+((st.opacity??100)/100)+'">'+prefix+(b.html||esc(b.text||''))+'</'+tag+'>';
}
function objectHtml(o){
  if(o.type==='image')return '<div style="position:absolute;left:'+o.x+'%;top:'+o.y+'%;width:'+o.w+'%;height:'+o.h+'%;opacity:'+((o.opacity??100)/100)+'"><img src="'+o.src+'" alt="'+esc(o.alt||'')+'" style="width:100%;height:100%;object-fit:contain"></div>';
  const st=o.style||textStyle();return '<div style="position:absolute;left:'+o.x+'%;top:'+o.y+'%;width:'+o.w+'%;min-height:'+o.h+'%;font-family:'+esc(st.fontFamily)+';font-size:'+st.fontSize+'px;text-align:'+st.align+';font-weight:'+(st.bold?700:400)+';font-style:'+(st.italic?'italic':'normal')+';text-decoration:'+(st.underline?'underline':'none')+';opacity:'+((o.opacity??100)/100)+'">'+esc(o.text||'')+'</div>';
}
function exportHtml(){
  if(!need('Download HTML'))return;if(S.doc.kind==='pdf'){toast('HTML export does not embed PDF source bytes.');return;}
  const pages=S.doc.pages.map(p=>'<section class="page"><div class="body">'+p.flowBlockIds.map(id=>S.doc.flow.find(b=>b.id===id)).filter(Boolean).map(blockHtml).join('')+'</div>'+p.objects.map(objectHtml).join('')+'</section>').join('');
  download(S.doc.name.replace(/[^a-z0-9_-]+/gi,'_')+'.html','<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#ddd}.page{position:relative;width:8.5in;height:11in;margin:18px auto;background:white;page-break-after:always;overflow:hidden}.body{position:absolute;inset:.8in}.body p,.body h2{white-space:pre-wrap;margin:0 0 8pt}@media print{body{background:white}.page{margin:0}}</style>'+pages,'text/html');toast('HTML exported.');
}
function buildPrintDeck(){
  q('#opsPrintDeck')?.remove();const deck=document.createElement('div');deck.id='opsPrintDeck';deck.className='print-deck';
  S.doc.pages.forEach(p=>{const pg=document.createElement('section');pg.className='print-page';const sem=document.createElement('div');sem.className='print-semantic';p.flowBlockIds.map(id=>S.doc.flow.find(b=>b.id===id)).filter(Boolean).forEach(b=>{const wrap=document.createElement('div');wrap.innerHTML=blockHtml(b);const el=wrap.firstElementChild;el.classList.add('print-block');sem.appendChild(el);});pg.appendChild(sem);p.objects.forEach(o=>{const wrap=document.createElement('div');wrap.className='print-object';Object.assign(wrap.style,{left:o.x+'%',top:o.y+'%',width:o.w+'%',height:o.h+'%',opacity:(o.opacity??100)/100});if(o.type==='image'){const im=document.createElement('img');im.src=o.src;im.alt=o.alt||'';Object.assign(im.style,{width:'100%',height:'100%',objectFit:'contain'});wrap.appendChild(im);}else{wrap.textContent=o.text||'';applyTextStyle(wrap,o.style||textStyle());}pg.appendChild(wrap);});deck.appendChild(pg);});document.body.appendChild(deck);return deck;
}
async function printPdf(){
  if(!need('Print / PDF'))return;
  if(S.doc.kind==='pdf'){
    const b=pdfBridge(),st=pdfBridgeState();
    if(!b?.readyFor?.('exportPdf')||st.source==null){pdfBridgeHold('Export PDF');return;}
    try{
      const result=await b.exportPdf({preset:'screen',document:{name:S.doc.name,revision:S.doc.revision}});
      const blob=result instanceof Blob?result:result?.blob;
      if(!(blob instanceof Blob))throw new Error('Adapter exportPdf() did not return a Blob.');
      S.lastPdfReceipt=result?.receipt||null;
      const name=result?.filename||S.doc.name.replace(/\.pdf$/i,'')+'-edited.pdf';
      const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);
      record('Export verified PDF');renderAll();
      toast('G5I verified PDF exported · '+(result?.receipt?.verification?.outputSha256||'proof receipt returned').slice(0,16)+'…');
    }catch(error){modal('PDF export failed','<div class="proof-item"><strong class="hold">EXPORT · FAIL</strong><small>'+esc(error?.message||error)+'</small></div>');}
    return;
  }
  const deck=buildPrintDeck(),cleanup=()=>deck.remove();window.addEventListener('afterprint',cleanup,{once:true});window.print();setTimeout(()=>{if(document.body.contains(deck))cleanup();},5000);
}
q('#saveLocalBtn')?.addEventListener('click',saveLocal);q('#downloadProjectBtn')?.addEventListener('click',project);q('#downloadProjectBtn2')?.addEventListener('click',project);q('#downloadHtmlBtn')?.addEventListener('click',exportHtml);q('#fileDownloadHtml')?.addEventListener('click',exportHtml);q('#printPdfBtn')?.addEventListener('click',printPdf);q('#filePrintPdf')?.addEventListener('click',printPdf);
capture('#exportBtn',()=>openBackstage('export'));

function modal(title,html){q('#modalTitle').textContent=title;q('#modalBody').innerHTML=html;q('#modalBg').classList.add('open');}
capture('#preflightBtn',()=>{
  if(!need('Preflight'))return;
  const all=S.doc.pages.flatMap(p=>p.objects),bad=all.filter(o=>o.x<0||o.y<0||o.x+o.w>100||o.y+o.h>100),emptyBlocks=S.doc.flow.filter(b=>b.type==='table'?b.cells.flat().every(x=>!String(x).trim()):!String(b.text||'').trim()),orphan=S.doc.flow.filter(b=>!blockPage(b.id));
  modal('Document Preflight','<div class="proof-grid"><div class="proof-item"><strong class="pass">PASS · Document state</strong><small>'+S.doc.pages.length+' page(s), r'+S.doc.revision+'</small></div><div class="proof-item"><strong class="'+(bad.length?'hold':'pass')+'">'+(bad.length?'CHECK':'PASS')+' · Page bounds</strong><small>'+bad.length+' out-of-bounds positioned object(s)</small></div><div class="proof-item"><strong class="'+(orphan.length?'hold':'pass')+'">'+(orphan.length?'CHECK':'PASS')+' · Semantic mapping</strong><small>'+orphan.length+' orphan semantic block(s)</small></div><div class="proof-item"><strong class="'+(emptyBlocks.length?'hold':'pass')+'">'+(emptyBlocks.length?'CHECK':'PASS')+' · Empty paragraphs</strong><small>'+emptyBlocks.length+' empty semantic block(s)</small></div><div class="proof-item"><strong class="'+(S.doc.kind==='pdf'?'hold':'pass')+'">'+(S.doc.kind==='pdf'?'BOUNDARY':'PASS')+' · Source authority</strong><small>'+esc(S.doc.source.claim)+'</small></div><div class="proof-item"><strong class="hold">UNKNOWN · PDF/X certification</strong><small>Not inferred by this public slice</small></div></div>');
});
capture('#proofBtn',()=>modal('Proof State','<div class="proof-grid"><div class="proof-item"><strong class="pass">G5I kernel · controlled PASS</strong><small>Engineering reference remains frozen</small></div><div class="proof-item"><strong class="pass">G6D native authoring · deepened</strong><small>Shared Page/Flow state + range formatting + styles + tables + find/replace + page breaks</small></div><div class="proof-item"><strong class="pass">Save / reopen path</strong><small>Browser save + portable project snapshot</small></div><div class="proof-item"><strong class="pass">G6I PDF Edit Text · CANDIDATE</strong><small>Bounded existing-PDF text replacement inherits G5I text-only removal, same-box insertion, staged Undo and verified export. Builtin Helvetica fallback only; source-font-perfect replacement and reflow remain outside this checkpoint.</small></div></div>'));
capture('#historyBtn',()=>{renderHistory();q('#historyPanel').classList.toggle('open');});
q('#addComment')?.addEventListener('click',e=>{if(!S.active)return;e.preventDefault();e.stopImmediatePropagation();const text=prompt('Review note');if(!text)return;mutate('Add review comment',()=>S.doc.comments.push({author:'You',text,revision:S.doc.revision+1}));},true);

function disablePending(){
  const ids=['#trackBtn'];ids.forEach(id=>{const b=q(id);if(b){b.disabled=true;b.classList.add('disabled-tool');b.title='Pending deeper kernel connection';}});
  qa('.tab-tools[data-for="review"] .rbtn').forEach(b=>{if((b.textContent||'').trim()==='Compare'){b.disabled=true;b.classList.add('disabled-tool');b.title='Pending deeper kernel connection';}});
  updatePdfBridgeUi();
}
document.addEventListener('keydown',e=>{
  const meta=e.ctrlKey||e.metaKey;
  if(e.key==='Escape'){closeBackstage();return;}
  if(meta&&e.key.toLowerCase()==='n'){e.preventDefault();openBackstage('new');}
  else if(meta&&e.key.toLowerCase()==='s'){e.preventDefault();saveLocal();}
  else if(meta&&e.key.toLowerCase()==='z'&&!e.shiftKey){e.preventDefault();undo();}
  else if((meta&&e.key.toLowerCase()==='y')||(meta&&e.shiftKey&&e.key.toLowerCase()==='z')){e.preventDefault();redo();}
  else if(meta&&e.key.toLowerCase()==='d'){e.preventDefault();duplicate();}
  else if(meta&&e.key.toLowerCase()==='f'){e.preventDefault();openFindReplace();}
  else if(meta&&e.key.toLowerCase()==='b'){e.preventDefault();toggleInline('bold','bold');}
  else if(meta&&e.key.toLowerCase()==='i'){e.preventDefault();toggleInline('italic','italic');}
  else if(meta&&e.key.toLowerCase()==='u'){e.preventDefault();toggleInline('underline','underline');}
  else if((e.key==='Delete'||e.key==='Backspace')&&S.active&&document.activeElement?.contentEditable!=='true'&&(S.sel||S.block)){e.preventDefault();removeSelected();}
});
window.addEventListener('publisherstudio:pdfbridgechange',updatePdfBridgeUi);qa('.pdf-engine-tool').forEach(b=>capture('#'+b.id,()=>runPdfTool(b.dataset.pdfTool)));
disablePending();refreshResume();updatePdfBridgeUi();q('#buildMarker')&&(q('#buildMarker').textContent=BUILD);
})();
