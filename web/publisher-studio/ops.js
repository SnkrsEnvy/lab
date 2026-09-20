
(()=>{
'use strict';
const BUILD='PS-PUBLIC-DEMO-G6C-v004';
const SCHEMA='psdemo-2';
const q=(s,r=document)=>r.querySelector(s), qa=(s,r=document)=>[...r.querySelectorAll(s)];
const clone=v=>JSON.parse(JSON.stringify(v));
const uid=(p='id')=>p+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const toast=msg=>{const t=q('#toast');if(!t)return;t.textContent=msg;t.classList.add('show');clearTimeout(window.__opsToast);window.__opsToast=setTimeout(()=>t.classList.remove('show'),2300);};
const S={active:false,mode:'page',doc:null,sel:null,block:null,undo:[],redo:[],baseline:null,pdfUrl:null,count:1,drag:null,focusAfter:null};

function textStyle(type='paragraph'){
  return {fontFamily:'Georgia, Times New Roman, serif',fontSize:type==='heading'?24:12,align:'left',bold:type==='heading',italic:false,underline:false,opacity:100};
}
function mkBlock(type='paragraph',text=''){
  return {id:uid('block'),type,text,style:textStyle(type)};
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
function undo(){
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
  S.pdfUrl=pdfUrl;S.doc=migrate(doc);S.active=true;S.sel=null;S.block=S.doc.flow[0]?.id||null;S.undo=[];S.redo=[];S.baseline=null;closeBackstage();
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
function semanticBlockEl(block,context='page'){
  const el=document.createElement('div');el.className=(context==='page'?'page-semantic-block ':'ops-block ')+(block.type==='heading'?'heading':'paragraph')+(block.id===S.block?' selected':'');el.dataset.blockId=block.id;
  if(context==='flow')el.innerHTML='<span class="handle">⋮⋮</span><span class="type">'+(block.type==='heading'?'H2':'P')+'</span><'+(block.type==='heading'?'h3':'p')+' class="semantic-content" contenteditable="true" spellcheck="true"></'+(block.type==='heading'?'h3':'p')+'>';
  else el.innerHTML='<span class="semantic-block-tag">'+(block.type==='heading'?'HEADING':'PARAGRAPH')+'</span><div class="semantic-content" contenteditable="true" spellcheck="true"></div>';
  const c=q('.semantic-content',el);c.textContent=block.text||'';applyTextStyle(c,block.style||textStyle(block.type));
  el.addEventListener('pointerdown',()=>{S.block=block.id;S.sel=null;markSelections();inspector();});
  c.addEventListener('focus',()=>{S.block=block.id;S.sel=null;begin();markSelections();inspector();});
  c.addEventListener('input',()=>{block.text=c.innerText.replace(/\r/g,'');});
  c.addEventListener('blur',()=>{commit('Edit '+(block.type==='heading'?'heading':'paragraph'));maybeRebalance();});
  c.addEventListener('keydown',e=>semanticKeys(e,block,c));
  return el;
}
function applyTextStyle(el,st){
  Object.assign(el.style,{fontFamily:st.fontFamily||'Georgia, Times New Roman, serif',fontSize:(st.fontSize||12)+'px',textAlign:st.align||'left',fontWeight:st.bold?'700':'400',fontStyle:st.italic?'italic':'normal',textDecoration:st.underline?'underline':'none',opacity:(st.opacity??100)/100});
}
function semanticKeys(e,block,el){
  if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();splitBlockAtCaret(block,el);return;}
  if(e.key==='Backspace'&&!el.innerText&&blockPage(block.id)?.flowBlockIds.length>1){e.preventDefault();const p=blockPage(block.id),idx=p.flowBlockIds.indexOf(block.id),prev=p.flowBlockIds[Math.max(0,idx-1)];mutate('Remove empty paragraph',()=>{p.flowBlockIds.splice(idx,1);S.doc.flow=S.doc.flow.filter(b=>b.id!==block.id);S.block=prev;});setTimeout(()=>focusSemantic(prev,true),30);}
}
function caretOffset(el){
  const sel=window.getSelection();if(!sel||!sel.rangeCount)return (el.innerText||'').length;
  const r=sel.getRangeAt(0);if(!el.contains(r.startContainer))return (el.innerText||'').length;
  const pre=r.cloneRange();pre.selectNodeContents(el);pre.setEnd(r.startContainer,r.startOffset);return pre.toString().length;
}
function splitBlockAtCaret(block,el){
  const pos=caretOffset(el),txt=el.innerText.replace(/\r/g,'');block.text=txt.slice(0,pos);
  const nb=mkBlock('paragraph',txt.slice(pos));nb.style=clone(block.style||textStyle(block.type));nb.type='paragraph';
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
  const pdf=p.kind==='pdf-source'&&S.pdfUrl?'<div class="pdf-source"><embed src="'+esc(S.pdfUrl)+'#toolbar=0&navpanes=0" type="application/pdf"><div class="pdf-source-note">PDF source · local view + bounded overlays</div></div>':'';
  const semantic=S.doc.kind==='pdf'?'':'<div class="semantic-sheet '+(p.flowBlockIds.length?'':'empty')+'" id="semanticSheet"></div>';
  host.innerHTML='<article class="paper native-page '+(S.doc.guides?'guides ':'')+((p.objects.length||p.flowBlockIds.length||p.kind==='pdf-source')?'has-objects has-semantic':'')+'" id="opsPage" style="--margin-guide:'+(S.doc.marginPct||9.4)+'%"><div class="paper-inner"></div>'+pdf+semantic+'<div class="blank-placeholder"><span>Blank page<small>Start typing or insert a layout object</small></span></div><div class="object-layer" id="opsLayer"></div></article>';
  if(S.doc.kind!=='pdf'){
    const sheet=q('#semanticSheet');p.flowBlockIds.map(id=>S.doc.flow.find(b=>b.id===id)).filter(Boolean).forEach(b=>sheet.appendChild(semanticBlockEl(b,'page')));
  }
  const layer=q('#opsLayer');p.objects.slice().sort((a,b)=>(a.z||10)-(b.z||10)).forEach(o=>layer.appendChild(objectEl(o)));
  q('#opsPage').addEventListener('pointerdown',e=>{if(e.target.id==='opsPage'||e.target.id==='opsLayer'){S.sel=null;markSelections();inspector();}});
}
function objectEl(o){
  const el=document.createElement('div');el.className='page-object '+(o.type==='image'?'image-object':'text-object')+(o.id===S.sel?' selected':'');el.dataset.id=o.id;
  Object.assign(el.style,{left:o.x+'%',top:o.y+'%',width:o.w+'%',height:o.h+'%',zIndex:o.z||10,opacity:(o.opacity??100)/100});
  const st=o.style||textStyle();
  if(o.type==='image')el.innerHTML='<div class="object-grip">MOVE</div><div class="object-content"><img src="'+o.src+'" alt="'+esc(o.alt||'Inserted image')+'"></div><span class="object-badge">IMAGE</span><span class="resize-handle"></span>';
  else{
    el.innerHTML='<div class="object-grip">MOVE</div><div class="object-content" contenteditable="true" spellcheck="true"></div><span class="object-badge">TEXT FRAME</span><span class="resize-handle"></span>';
    const c=q('.object-content',el);c.textContent=o.text||'';applyTextStyle(c,st);
    c.onfocus=()=>{S.sel=o.id;S.block=null;begin();markSelections();inspector();};c.oninput=()=>o.text=c.innerText;c.onblur=()=>commit('Edit text frame');
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
  const m={Source:S.doc.kind==='pdf'?'LOCAL PDF':'NATIVE SEMANTIC','Page deltas':S.doc.pages.reduce((n,p)=>n+p.objects.length,0)+' objects',Flow:S.doc.kind==='pdf'?'Not promoted':S.doc.flow.length+' blocks',Assets:S.doc.pages.flatMap(p=>p.objects).filter(o=>o.type==='image').length+' local',Checkpoint:'r'+S.doc.revision};
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
  q('#objectType').textContent=v?(t.kind==='object'?(v.type==='image'?'Image':'Text frame'):(v.type==='heading'?'Heading':'Paragraph')):(S.mode==='page'?'Page':'Document');
  q('#fontFamily')&&(q('#fontFamily').value=st.fontFamily||'Georgia, Times New Roman, serif');
  q('#fontSize')&&(q('#fontSize').value=st.fontSize||12);q('#sizeLabel').textContent=(st.fontSize||12)+' pt';
  const op=t?.kind==='object'?(v.opacity??100):(st.opacity??100);q('#opacityRange').value=op;q('#opacityLabel').textContent=op+'%';
  qa('.alignBtn').forEach(b=>b.classList.toggle('active',(st.align||'left')===b.dataset.align));qa('.format-btn').forEach(b=>b.classList.toggle('active',!!st[b.dataset.format]));
}
function need(label){if(S.active)return true;toast(label+': use File → New → Document or File → Open → PDF.');openBackstage('new');return false;}

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
function movePage(dir){
  if(!need('Move page'))return;if(S.doc.kind==='pdf'){toast('Native PDF page reorder is pending the connected PDF engine.');return;}
  const p=curPage(),i=S.doc.pages.indexOf(p),j=i+dir;if(!p||j<0||j>=S.doc.pages.length){toast('Page is already at that edge.');return;}
  mutate(dir<0?'Move page earlier':'Move page later',()=>{const [x]=S.doc.pages.splice(i,1);S.doc.pages.splice(j,0,x);S.doc.pages.forEach((pg,k)=>pg.label='Page '+(k+1));});
}
function addBlock(type){
  if(!need('Insert semantic block'))return;if(S.doc.kind==='pdf'){toast('PDF source cannot silently become Flow truth.');return;}
  const p=blockPage(S.block)||curPage();const after=S.block&&p.flowBlockIds.includes(S.block)?p.flowBlockIds.indexOf(S.block):p.flowBlockIds.length-1;
  mutate('Insert '+type,()=>{const b=mkBlock(type,'');const gi=S.block?S.doc.flow.findIndex(x=>x.id===S.block):-1;p.flowBlockIds.splice(after+1,0,b.id);S.doc.flow.splice(gi>=0?gi+1:S.doc.flow.length,0,b);S.block=b.id;S.sel=null;});setMode(S.mode);setTimeout(()=>focusSemantic(S.block),30);
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
  if(t.kind==='object'&&v.type==='image'&&key!=='opacity'){toast('That text format does not apply to an image.');return;}
  mutate('Format '+key,()=>{v.style=v.style||textStyle(v.type);if(key==='opacity'){if(t.kind==='object')v.opacity=Number(val);else v.style.opacity=Number(val);}else v.style[key]=val;});
}
function z(dir){if(!need('Arrange'))return;const o=curObj();if(!o){toast('Select a positioned Page Mode object first.');return;}mutate(dir>0?'Bring object forward':'Send object backward',()=>o.z=Math.max(1,(o.z||10)+dir));}

function capture(id,handler){const el=q(id);if(!el)return;el.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();handler(e);},true);}
capture('#undo',undo);capture('#redo',redo);capture('#duplicateBtn',duplicate);capture('#deleteBtn',removeSelected);capture('#addTextFrame',addTextFrame);capture('#addPageBtn',addPage);capture('#addHeadingBtn',()=>addBlock('heading'));capture('#addParagraphBtn',()=>addBlock('paragraph'));capture('#bringFrontBtn',()=>z(1));capture('#sendBackBtn',()=>z(-1));
capture('#boldBtn',()=>{const t=target();format('bold',!t?.value?.style?.bold);});capture('#italicBtn',()=>{const t=target();format('italic',!t?.value?.style?.italic);});capture('#underlineBtn',()=>{const t=target();format('underline',!t?.value?.style?.underline);});
q('#fontFamily')?.addEventListener('change',e=>format('fontFamily',e.target.value));q('#fontSize')?.addEventListener('change',e=>format('fontSize',Math.max(6,Math.min(144,Number(e.target.value)||12))));
q('#opacityRange')?.addEventListener('input',e=>q('#opacityLabel').textContent=e.target.value+'%');q('#opacityRange')?.addEventListener('change',e=>format('opacity',e.target.value));qa('.alignBtn').forEach(b=>b.addEventListener('click',()=>format('align',b.dataset.align)));
capture('#guideBtn',()=>mutate('Toggle page guides',()=>S.doc.guides=!S.doc.guides));capture('#snapBtn',()=>mutate('Toggle snap',()=>S.doc.snapPt=S.doc.snapPt?0:8));capture('#marginBtn',()=>mutate('Change margin guide',()=>S.doc.marginPct=S.doc.marginPct===9.4?5.9:9.4));capture('#deletePageBtn',deleteCurrentPage);capture('#movePageUpBtn',()=>movePage(-1));capture('#movePageDownBtn',()=>movePage(1));

const imageInput=document.createElement('input');imageInput.type='file';imageInput.accept='image/*';imageInput.hidden=true;document.body.appendChild(imageInput);
q('#imageBtn')?.addEventListener('click',()=>{if(need('Insert image'))imageInput.click();});
imageInput.addEventListener('change',()=>{const f=imageInput.files?.[0];if(!f)return;const r=new FileReader();r.onload=()=>mutate('Insert image',()=>{const p=curPage(),o={id:uid('obj'),type:'image',x:18,y:18,w:40,h:28,z:Math.max(10,...p.objects.map(x=>x.z||10))+1,src:r.result,alt:f.name,opacity:100};p.objects.push(o);S.sel=o.id;S.block=null;});r.readAsDataURL(f);imageInput.value='';});

q('#openPdfBtn')?.addEventListener('click',()=>q('#pdfFileInput').click());
q('#pdfFileInput')?.addEventListener('change',()=>{const f=q('#pdfFileInput').files?.[0];if(!f)return;const url=URL.createObjectURL(f);activate(pdfDoc(f,url),url,{focus:false});q('#pdfFileInput').value='';});
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
  const st=b.style||textStyle(b.type),tag=b.type==='heading'?'h2':'p';
  return '<'+tag+' style="font-family:'+esc(st.fontFamily)+';font-size:'+st.fontSize+'px;text-align:'+st.align+';font-weight:'+(st.bold?700:400)+';font-style:'+(st.italic?'italic':'normal')+';text-decoration:'+(st.underline?'underline':'none')+';opacity:'+((st.opacity??100)/100)+'">'+esc(b.text||'')+'</'+tag+'>';
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
  S.doc.pages.forEach(p=>{const pg=document.createElement('section');pg.className='print-page';const sem=document.createElement('div');sem.className='print-semantic';p.flowBlockIds.map(id=>S.doc.flow.find(b=>b.id===id)).filter(Boolean).forEach(b=>{const el=document.createElement(b.type==='heading'?'h2':'p');el.className='print-block';el.textContent=b.text||'';applyTextStyle(el,b.style||textStyle(b.type));sem.appendChild(el);});pg.appendChild(sem);p.objects.forEach(o=>{const wrap=document.createElement('div');wrap.className='print-object';Object.assign(wrap.style,{left:o.x+'%',top:o.y+'%',width:o.w+'%',height:o.h+'%',opacity:(o.opacity??100)/100});if(o.type==='image'){const im=document.createElement('img');im.src=o.src;im.alt=o.alt||'';Object.assign(im.style,{width:'100%',height:'100%',objectFit:'contain'});wrap.appendChild(im);}else{wrap.textContent=o.text||'';applyTextStyle(wrap,o.style||textStyle());}pg.appendChild(wrap);});deck.appendChild(pg);});document.body.appendChild(deck);return deck;
}
function printPdf(){
  if(!need('Print / PDF'))return;if(S.doc.kind==='pdf'){toast('Native PDF rewrite/export is pending the connected PDF engine.');return;}
  const deck=buildPrintDeck(),cleanup=()=>deck.remove();window.addEventListener('afterprint',cleanup,{once:true});window.print();setTimeout(()=>{if(document.body.contains(deck))cleanup();},5000);
}
q('#saveLocalBtn')?.addEventListener('click',saveLocal);q('#downloadProjectBtn')?.addEventListener('click',project);q('#downloadProjectBtn2')?.addEventListener('click',project);q('#downloadHtmlBtn')?.addEventListener('click',exportHtml);q('#fileDownloadHtml')?.addEventListener('click',exportHtml);q('#printPdfBtn')?.addEventListener('click',printPdf);q('#filePrintPdf')?.addEventListener('click',printPdf);
capture('#exportBtn',()=>openBackstage('export'));

function modal(title,html){q('#modalTitle').textContent=title;q('#modalBody').innerHTML=html;q('#modalBg').classList.add('open');}
capture('#preflightBtn',()=>{
  if(!need('Preflight'))return;
  const all=S.doc.pages.flatMap(p=>p.objects),bad=all.filter(o=>o.x<0||o.y<0||o.x+o.w>100||o.y+o.h>100),emptyBlocks=S.doc.flow.filter(b=>!String(b.text||'').trim()),orphan=S.doc.flow.filter(b=>!blockPage(b.id));
  modal('Document Preflight','<div class="proof-grid"><div class="proof-item"><strong class="pass">PASS · Document state</strong><small>'+S.doc.pages.length+' page(s), r'+S.doc.revision+'</small></div><div class="proof-item"><strong class="'+(bad.length?'hold':'pass')+'">'+(bad.length?'CHECK':'PASS')+' · Page bounds</strong><small>'+bad.length+' out-of-bounds positioned object(s)</small></div><div class="proof-item"><strong class="'+(orphan.length?'hold':'pass')+'">'+(orphan.length?'CHECK':'PASS')+' · Semantic mapping</strong><small>'+orphan.length+' orphan semantic block(s)</small></div><div class="proof-item"><strong class="'+(emptyBlocks.length?'hold':'pass')+'">'+(emptyBlocks.length?'CHECK':'PASS')+' · Empty paragraphs</strong><small>'+emptyBlocks.length+' empty semantic block(s)</small></div><div class="proof-item"><strong class="'+(S.doc.kind==='pdf'?'hold':'pass')+'">'+(S.doc.kind==='pdf'?'BOUNDARY':'PASS')+' · Source authority</strong><small>'+esc(S.doc.source.claim)+'</small></div><div class="proof-item"><strong class="hold">UNKNOWN · PDF/X certification</strong><small>Not inferred by this public slice</small></div></div>');
});
capture('#proofBtn',()=>modal('Proof State','<div class="proof-grid"><div class="proof-item"><strong class="pass">G5I kernel · controlled PASS</strong><small>Engineering reference remains frozen</small></div><div class="proof-item"><strong class="pass">G6C native path · unified</strong><small>Page and Flow now edit the same semantic blocks</small></div><div class="proof-item"><strong class="pass">Save / reopen path</strong><small>Browser save + portable project snapshot</small></div><div class="proof-item"><strong class="hold">PDF public shell</strong><small>Source view + bounded overlays; native PDF-object engine connection remains next</small></div></div>'));
capture('#historyBtn',()=>{renderHistory();q('#historyPanel').classList.toggle('open');});
q('#addComment')?.addEventListener('click',e=>{if(!S.active)return;e.preventDefault();e.stopImmediatePropagation();const text=prompt('Review note');if(!text)return;mutate('Add review comment',()=>S.doc.comments.push({author:'You',text,revision:S.doc.revision+1}));},true);

function disablePending(){
  const ids=['#trackBtn'];ids.forEach(id=>{const b=q(id);if(b){b.disabled=true;b.classList.add('disabled-tool');b.title='Pending deeper kernel connection';}});
  qa('.tab-tools[data-for="review"] .rbtn').forEach(b=>{if((b.textContent||'').trim()==='Compare'){b.disabled=true;b.classList.add('disabled-tool');b.title='Pending deeper kernel connection';}});
  qa('.tab-tools[data-for="pdf"] .rbtn').forEach(b=>{if(b.id!=='preflightBtn'){b.disabled=true;b.classList.add('disabled-tool');b.title='Pending G5I PDF engine connection';}});
}
document.addEventListener('keydown',e=>{
  const meta=e.ctrlKey||e.metaKey;
  if(e.key==='Escape'){closeBackstage();return;}
  if(meta&&e.key.toLowerCase()==='n'){e.preventDefault();openBackstage('new');}
  else if(meta&&e.key.toLowerCase()==='s'){e.preventDefault();saveLocal();}
  else if(meta&&e.key.toLowerCase()==='z'&&!e.shiftKey){e.preventDefault();undo();}
  else if((meta&&e.key.toLowerCase()==='y')||(meta&&e.shiftKey&&e.key.toLowerCase()==='z')){e.preventDefault();redo();}
  else if(meta&&e.key.toLowerCase()==='d'){e.preventDefault();duplicate();}
  else if(meta&&e.key.toLowerCase()==='b'){e.preventDefault();const t=target();format('bold',!t?.value?.style?.bold);}
  else if(meta&&e.key.toLowerCase()==='i'){e.preventDefault();const t=target();format('italic',!t?.value?.style?.italic);}
  else if(meta&&e.key.toLowerCase()==='u'){e.preventDefault();const t=target();format('underline',!t?.value?.style?.underline);}
  else if((e.key==='Delete'||e.key==='Backspace')&&S.active&&document.activeElement?.contentEditable!=='true'&&(S.sel||S.block)){e.preventDefault();removeSelected();}
});
disablePending();refreshResume();q('#buildMarker')&&(q('#buildMarker').textContent=BUILD);
})();
