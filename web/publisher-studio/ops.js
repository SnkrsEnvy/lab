
(()=>{
'use strict';
const BUILD='PS-PUBLIC-DEMO-G6B-v003';
const q=(s,r=document)=>r.querySelector(s), qa=(s,r=document)=>[...r.querySelectorAll(s)];
const clone=v=>JSON.parse(JSON.stringify(v));
const uid=(p='id')=>p+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const say=msg=>{const t=q('#toast');if(!t)return;t.textContent=msg;t.classList.add('show');clearTimeout(window.__opsToast);window.__opsToast=setTimeout(()=>t.classList.remove('show'),2200);};
const S={active:false,mode:'page',doc:null,sel:null,block:null,undo:[],redo:[],baseline:null,pdfUrl:null,count:1,drag:null};

function textStyle(){return{fontFamily:'Georgia, Times New Roman, serif',fontSize:28,align:'left',bold:false,italic:false,underline:false,opacity:100};}
function page(n){return{id:uid('page'),label:'Page '+n,kind:'native',objects:[]};}
function block(type='paragraph'){return{id:uid('block'),type,text:'',style:{fontFamily:'Georgia, Times New Roman, serif',fontSize:type==='heading'?24:12,align:'left',bold:type==='heading',italic:false,underline:false,opacity:100}};}
function freshDoc(){
  const p=page(1);return{schema:'psdemo-1',id:uid('doc'),name:'Untitled-'+S.count++,kind:'native',revision:0,snapPt:8,guides:true,marginPct:9.4,pages:[p],currentPageId:p.id,flow:[block('paragraph')],comments:[],history:[],source:{authority:'NATIVE_DOCUMENT',claim:'Fresh native document'}};
}
function pdfDoc(file,url){
  const p={id:uid('page'),label:'PDF source',kind:'pdf-source',objects:[],sourceUrl:url};
  return{schema:'psdemo-1',id:uid('doc'),name:file.name,kind:'pdf',revision:0,snapPt:8,guides:false,marginPct:9.4,pages:[p],currentPageId:p.id,flow:[],comments:[],history:[],source:{authority:'LOCAL_PDF_SOURCE',claim:'Local PDF view + overlay deltas',fileName:file.name,size:file.size,type:file.type}};
}
function curPage(){return S.doc&&S.doc.pages.find(p=>p.id===S.doc.currentPageId)||S.doc&&S.doc.pages[0]||null;}
function curObj(){const p=curPage();return p&&p.objects.find(o=>o.id===S.sel)||null;}
function curBlock(){return S.doc&&S.doc.flow.find(b=>b.id===S.block)||null;}
function state(){return JSON.stringify(S.doc);}
function history(label){S.doc.revision=(S.doc.revision||0)+1;S.doc.history.unshift({revision:S.doc.revision,label,at:new Date().toISOString()});S.doc.history=S.doc.history.slice(0,40);}
function saveLocal(){if(!S.active||!S.doc)return;if(S.doc.kind==='pdf'){say('PDF source bytes stay session-local in this public slice.');return;}try{localStorage.setItem('publisherStudioDemoDoc',JSON.stringify(S.doc));say('Saved in this browser.');}catch(e){say('Browser storage is unavailable.');}}
function mutate(label,fn){if(!S.active)return;const before=state();fn();if(state()===before)return;S.undo.push(before);if(S.undo.length>60)S.undo.shift();S.redo=[];history(label);if(S.doc.kind!=='pdf'){try{localStorage.setItem('publisherStudioDemoDoc',JSON.stringify(S.doc));}catch(e){}}renderAll();}
function begin(){if(S.active&&!S.baseline)S.baseline=state();}
function commit(label){if(!S.baseline)return;const b=S.baseline;S.baseline=null;if(state()===b)return;S.undo.push(b);S.redo=[];history(label);renderHistory();status();}
function undo(){if(!S.active||!S.undo.length){say('Nothing to undo.');return;}const cur=state();S.doc=JSON.parse(S.undo.pop());S.redo.push(cur);repair();renderAll();say('Undo');}
function redo(){if(!S.active||!S.redo.length){say('Nothing to redo.');return;}const cur=state();S.doc=JSON.parse(S.redo.pop());S.undo.push(cur);repair();renderAll();say('Redo');}
function repair(){if(!S.doc.pages.some(p=>p.id===S.doc.currentPageId))S.doc.currentPageId=S.doc.pages[0]?.id||null;if(!curPage()?.objects.some(o=>o.id===S.sel))S.sel=null;if(!S.doc.flow.some(b=>b.id===S.block))S.block=S.doc.flow[0]?.id||null;}

function openBackstage(view='new'){const el=q('#fileBackstage');el.classList.add('open');el.setAttribute('aria-hidden','false');showFile(view);}
function closeBackstage(){const el=q('#fileBackstage');el.classList.remove('open');el.setAttribute('aria-hidden','true');}
function showFile(view){qa('.file-nav[data-file-view]').forEach(b=>b.classList.toggle('active',b.dataset.fileView===view));qa('.file-view').forEach(p=>p.classList.toggle('hidden',p.dataset.filePanel!==view));}
qa('.file-nav[data-file-view]').forEach(b=>b.addEventListener('click',()=>showFile(b.dataset.fileView)));
q('#fileClose').addEventListener('click',closeBackstage);
q('#fileTab').addEventListener('click',()=>openBackstage('new'));

function activate(doc,pdfUrl=null){
  if(S.pdfUrl&&S.pdfUrl!==pdfUrl){try{URL.revokeObjectURL(S.pdfUrl)}catch(e){}}
  S.pdfUrl=pdfUrl;S.doc=doc;S.active=true;S.sel=null;S.block=doc.flow[0]?.id||null;S.undo=[];S.redo=[];closeBackstage();setMode('page');renderAll();say(doc.kind==='pdf'?'PDF opened in local overlay mode.':'New blank document created.');
}
q('#newDocumentBtn').addEventListener('click',()=>activate(freshDoc()));

function setMode(m){
  S.mode=m;q('#pageMode').classList.toggle('active',m==='page');q('#flowMode').classList.toggle('active',m==='flow');
  if(S.active){q('#pageCanvas').style.display=m==='page'?'block':'none';q('#flowCanvas').classList.toggle('active',m==='flow');}
  q('#modeStatus').textContent=m==='page'?'Page Mode':'Flow Mode';inspector();
}
q('#pageMode').addEventListener('click',()=>S.active&&setMode('page'));
q('#flowMode').addEventListener('click',()=>S.active&&setMode('flow'));

function renderAll(){if(!S.active)return;thumbs();renderPage();renderFlow();structure();renderHistory();comments();authority();status();inspector();}
function thumbs(){
  const host=q('#pagesPane');host.innerHTML='<button class="ops-new-page" id="opsNewPage">+ New page</button><div id="opsThumbs"></div>';
  const t=q('#opsThumbs');S.doc.pages.forEach((p,i)=>{const el=document.createElement('div');el.className='thumb'+(p.id===S.doc.currentPageId?' active':'');el.innerHTML='<div class="thumb-page '+(p.kind==='pdf-source'?'pdf-thumb':'blank-thumb')+'">'+(p.kind==='pdf-source'?'PDF':'')+'</div><div class="thumb-label"><strong>'+(i+1)+'</strong><small>'+esc(p.label)+'</small></div>';el.onclick=()=>{S.doc.currentPageId=p.id;S.sel=null;setMode('page');renderAll();};t.appendChild(el);});
  q('#opsNewPage').onclick=addPage;
}
function renderPage(){
  const p=curPage(),host=q('#pageCanvas');if(!p){host.innerHTML='';return;}
  const pdf=p.kind==='pdf-source'&&S.pdfUrl?'<div class="pdf-source"><embed src="'+esc(S.pdfUrl)+'#toolbar=0&navpanes=0" type="application/pdf"><div class="pdf-source-note">PDF source · local view + bounded overlays</div></div>':'';
  host.innerHTML='<article class="paper native-page '+(S.doc.guides?'guides ':'')+((p.objects.length||p.kind==='pdf-source')?'has-objects':'')+'" id="opsPage" style="--margin-guide:'+(S.doc.marginPct||9.4)+'%"><div class="paper-inner"></div>'+pdf+'<div class="blank-placeholder"><span>Blank page<small>Insert a text frame or switch to Flow Mode</small></span></div><div class="object-layer" id="opsLayer"></div></article>';
  const layer=q('#opsLayer');p.objects.slice().sort((a,b)=>(a.z||10)-(b.z||10)).forEach(o=>layer.appendChild(objectEl(o)));
  q('#opsPage').addEventListener('pointerdown',e=>{if(e.target.id==='opsPage'||e.target.id==='opsLayer'){S.sel=null;selection();inspector();}});
}
function objectEl(o){
  const el=document.createElement('div');el.className='page-object '+(o.type==='image'?'image-object':'text-object')+(o.id===S.sel?' selected':'');el.dataset.id=o.id;
  Object.assign(el.style,{left:o.x+'%',top:o.y+'%',width:o.w+'%',height:o.h+'%',zIndex:o.z||10,opacity:(o.opacity??100)/100});
  const st=o.style||textStyle();
  if(o.type==='image')el.innerHTML='<div class="object-grip">MOVE</div><div class="object-content"><img src="'+o.src+'" alt="'+esc(o.alt||'Inserted image')+'"></div><span class="object-badge">IMAGE</span><span class="resize-handle"></span>';
  else{el.innerHTML='<div class="object-grip">MOVE</div><div class="object-content" contenteditable="true" spellcheck="true"></div><span class="object-badge">TEXT</span><span class="resize-handle"></span>';const c=q('.object-content',el);c.textContent=o.text||'';Object.assign(c.style,{fontFamily:st.fontFamily,fontSize:(st.fontSize||18)+'px',textAlign:st.align||'left',fontWeight:st.bold?'700':'400',fontStyle:st.italic?'italic':'normal',textDecoration:st.underline?'underline':'none'});c.onfocus=()=>{S.sel=o.id;begin();selection();inspector();};c.oninput=()=>o.text=c.innerText;c.onblur=()=>commit('Edit text frame');}
  el.addEventListener('pointerdown',e=>{if(e.target.classList.contains('object-grip')||e.target.classList.contains('resize-handle'))return;S.sel=o.id;selection();inspector();});
  q('.object-grip',el).addEventListener('pointerdown',e=>dragStart(e,o,el,false));q('.resize-handle',el).addEventListener('pointerdown',e=>dragStart(e,o,el,true));return el;
}
function selection(){qa('.page-object').forEach(el=>el.classList.toggle('selected',el.dataset.id===S.sel));}
function snapPct(v,axis){const step=S.doc.snapPt||0;if(!step)return v;const total=axis==='x'?612:792;return Math.round((v/100*total)/step)*step/total*100;}
function dragStart(e,o,el,resize){e.preventDefault();e.stopPropagation();S.sel=o.id;selection();begin();const r=q('#opsPage').getBoundingClientRect();S.drag={o,el,resize,sx:e.clientX,sy:e.clientY,x:o.x,y:o.y,w:o.w,h:o.h,r};document.addEventListener('pointermove',dragMove);document.addEventListener('pointerup',dragEnd,{once:true});}
function dragMove(e){const d=S.drag;if(!d)return;const dx=(e.clientX-d.sx)/d.r.width*100,dy=(e.clientY-d.sy)/d.r.height*100;if(d.resize){d.o.w=Math.max(4,Math.min(100-d.o.x,snapPct(d.w+dx,'x')));d.o.h=Math.max(3,Math.min(100-d.o.y,snapPct(d.h+dy,'y')));d.el.style.width=d.o.w+'%';d.el.style.height=d.o.h+'%';}else{d.o.x=Math.max(0,Math.min(100-d.o.w,snapPct(d.x+dx,'x')));d.o.y=Math.max(0,Math.min(100-d.o.h,snapPct(d.y+dy,'y')));d.el.style.left=d.o.x+'%';d.el.style.top=d.o.y+'%';}}
function dragEnd(){if(!S.drag)return;const label=S.drag.resize?'Resize page object':'Move page object';S.drag=null;document.removeEventListener('pointermove',dragMove);commit(label);renderPage();inspector();}

function renderFlow(){
  const host=q('#flowCanvas');host.classList.add('ops-flow');
  if(S.doc.kind==='pdf'){host.innerHTML='<div class="flow-head"><div><div class="page-kicker">Representation boundary</div><h1>'+esc(S.doc.name)+'</h1></div><span class="source-pill">PDF authority</span></div><div class="flow-empty">This PDF has not been converted into semantic Flow truth.<br><br>Publisher Studio keeps PDF Page Mode and semantic Flow Mode separate until an explicit extraction/conversion operation is authorized.</div>';return;}
  host.innerHTML='<div class="flow-head"><div><div class="page-kicker">Semantic document</div><h1>'+esc(S.doc.name)+'</h1></div><span class="source-pill">Native semantic authority</span></div><div id="opsBlocks"></div>';
  const bHost=q('#opsBlocks');if(!S.doc.flow.length)bHost.innerHTML='<div class="flow-empty">Blank semantic document. Use Insert → Heading or Paragraph.</div>';
  S.doc.flow.forEach(b=>{const el=document.createElement('div');el.className='ops-block'+(b.id===S.block?' selected':'');el.dataset.id=b.id;el.innerHTML='<span class="handle">⋮⋮</span><span class="type">'+(b.type==='heading'?'H2':'P')+'</span><'+(b.type==='heading'?'h3':'p')+' class="ops-content" contenteditable="true"></'+(b.type==='heading'?'h3':'p')+'>';const c=q('.ops-content',el);c.textContent=b.text||'';const st=b.style||{};Object.assign(c.style,{fontFamily:st.fontFamily||'Georgia, Times New Roman, serif',fontSize:(st.fontSize||12)+'px',textAlign:st.align||'left',fontWeight:st.bold?'700':'400',fontStyle:st.italic?'italic':'normal',textDecoration:st.underline?'underline':'none',opacity:(st.opacity??100)/100});el.onclick=()=>{S.block=b.id;qa('.ops-block').forEach(x=>x.classList.toggle('selected',x.dataset.id===b.id));inspector();};c.onfocus=()=>{S.block=b.id;begin();};c.oninput=()=>b.text=c.innerText;c.onblur=()=>commit('Edit semantic block');bHost.appendChild(el);});
}
function structure(){const host=q('#structurePane');host.innerHTML='';if(S.doc.kind==='pdf'){host.innerHTML='<div class="structure-row"><span class="tag">PDF</span>Page authority only</div>';return;}S.doc.flow.forEach(b=>{const r=document.createElement('div');r.className='structure-row';r.innerHTML='<span class="tag">'+(b.type==='heading'?'H2':'P')+'</span>'+esc((b.text||'Blank block').slice(0,34));r.onclick=()=>{S.block=b.id;setMode('flow');renderFlow();inspector();};host.appendChild(r);});}
function renderHistory(){const host=q('.history-list');if(!host)return;host.innerHTML='';if(!S.doc.history.length){host.innerHTML='<div class="history-item active"><div class="row"><strong>r0</strong><span>current</span></div><p>Fresh document state.</p></div>';return;}S.doc.history.forEach((h,i)=>{const e=document.createElement('div');e.className='history-item'+(i===0?' active':'');e.innerHTML='<div class="row"><strong>r'+h.revision+'</strong><span>'+new Date(h.at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})+'</span></div><p>'+esc(h.label)+'</p>';host.appendChild(e);});}
function comments(){const panel=q('#reviewPanel'),btn=q('#addComment');if(!panel||!btn)return;panel.querySelectorAll('.comment').forEach(x=>x.remove());S.doc.comments.forEach(c=>{const e=document.createElement('div');e.className='comment';e.innerHTML='<strong>'+esc(c.author||'You')+' · r'+c.revision+'</strong><p>'+esc(c.text)+'</p>';btn.before(e);});}
function authority(){const rows=qa('#authorityPanel .authority-row'),m={Source:S.doc.kind==='pdf'?'LOCAL PDF':'NATIVE DOCUMENT','Page deltas':S.doc.pages.reduce((n,p)=>n+p.objects.length,0)+' objects',Flow:S.doc.kind==='pdf'?'Not promoted':S.doc.flow.length+' blocks',Assets:S.doc.pages.flatMap(p=>p.objects).filter(o=>o.type==='image').length+' local',Checkpoint:'r'+S.doc.revision};rows.forEach(r=>{const k=q('span',r)?.textContent;if(k&&m[k]!=null)q('strong',r).textContent=m[k];});}
function status(){q('#docName').textContent=S.doc.name;q('#sourceStatus').textContent=S.doc.kind==='pdf'?'Local PDF source preserved':'Native document';q('#pageCountStatus').textContent=S.doc.pages.length+' page'+(S.doc.pages.length===1?'':'s');q('#revisionLabel').textContent='r'+S.doc.revision;q('#snapLabel').textContent=S.doc.snapPt?S.doc.snapPt+' pt':'Off';q('#buildMarker').textContent=BUILD;}
function inspector(){let t=S.active?(S.mode==='page'?curObj():curBlock()):null;q('#objectType').textContent=t?(S.mode==='page'?(t.type==='image'?'Image':'Text frame'):(t.type==='heading'?'Heading':'Paragraph')):(S.active?(S.mode==='page'?'Page':'Document'):'Page');const st=t?Object.assign({},t.style||t,{opacity:t.opacity??t.style?.opacity??100}):textStyle();if(q('#fontFamily'))q('#fontFamily').value=st.fontFamily||'Georgia, Times New Roman, serif';if(q('#fontSize'))q('#fontSize').value=st.fontSize||18;q('#sizeLabel').textContent=(st.fontSize||18)+' pt';q('#opacityRange').value=st.opacity??100;q('#opacityLabel').textContent=(st.opacity??100)+'%';qa('.alignBtn').forEach(b=>b.classList.toggle('active',(st.align||'left')===b.dataset.align));qa('.format-btn').forEach(b=>b.classList.toggle('active',!!st[b.dataset.format]));}
function need(label){if(S.active)return true;say(label+': use File → New → Document or File → Open → PDF.');openBackstage('new');return false;}

function addText(){if(!need('Insert'))return;setMode('page');mutate('Insert text frame',()=>{const p=curPage(),o={id:uid('obj'),type:'text',x:14,y:15,w:52,h:10,z:Math.max(10,...p.objects.map(x=>x.z||10))+1,text:'Type here',style:textStyle(),opacity:100};p.objects.push(o);S.sel=o.id;});setTimeout(()=>q('.page-object.selected .object-content')?.focus(),20);}
function addPage(){if(!need('New page'))return;if(S.doc.kind==='pdf'){say('PDF page insertion belongs to the connected PDF engine.');return;}mutate('Insert page',()=>{const p=page(S.doc.pages.length+1);S.doc.pages.push(p);S.doc.currentPageId=p.id;S.sel=null;});setMode('page');}
function addBlock(type){if(!need('Insert semantic block'))return;if(S.doc.kind==='pdf'){say('PDF source cannot silently become Flow truth.');return;}mutate('Insert '+type,()=>{const b=block(type);S.doc.flow.push(b);S.block=b.id;});setMode('flow');setTimeout(()=>q('.ops-block.selected .ops-content')?.focus(),20);}
function del(){if(!need('Delete'))return;if(S.mode==='page'){if(!S.sel){say('Select a page object first.');return;}mutate('Delete page object',()=>{const p=curPage();p.objects=p.objects.filter(o=>o.id!==S.sel);S.sel=null;});}else{if(!S.block){say('Select a semantic block first.');return;}mutate('Delete semantic block',()=>{S.doc.flow=S.doc.flow.filter(b=>b.id!==S.block);S.block=S.doc.flow[0]?.id||null;});}}
function dup(){if(!need('Duplicate'))return;if(S.mode!=='page'){say('Page-object duplicate is active in this slice.');return;}const o=curObj();if(!o){say('Select a page object first.');return;}mutate('Duplicate page object',()=>{const c=clone(o);c.id=uid('obj');c.x=Math.min(100-c.w,c.x+3);c.y=Math.min(100-c.h,c.y+3);c.z=(o.z||10)+1;curPage().objects.push(c);S.sel=c.id;});}
function format(key,val){if(!need('Format'))return;const t=S.mode==='page'?curObj():curBlock();if(!t){say('Select text or a semantic block first.');return;}if(S.mode==='page'&&t.type==='image'&&key!=='opacity'){say('That text format does not apply to an image.');return;}mutate('Format '+key,()=>{t.style=t.style||textStyle();if(key==='opacity'){if(S.mode==='page')t.opacity=Number(val);else t.style.opacity=Number(val);}else t.style[key]=val;});}
function z(dir){if(!need('Arrange'))return;const o=curObj();if(!o){say('Select a page object first.');return;}mutate(dir>0?'Bring object forward':'Send object backward',()=>o.z=Math.max(1,(o.z||10)+dir));}

function capture(id,handler){const el=q(id);if(!el)return;el.addEventListener('click',e=>{if(!S.active&&id!=='#fileTab')return;e.stopImmediatePropagation();handler(e);},true);}
capture('#undo',undo);capture('#redo',redo);capture('#duplicateBtn',dup);capture('#deleteBtn',del);capture('#addTextFrame',addText);capture('#addPageBtn',addPage);capture('#addHeadingBtn',()=>addBlock('heading'));capture('#addParagraphBtn',()=>addBlock('paragraph'));capture('#bringFrontBtn',()=>z(1));capture('#sendBackBtn',()=>z(-1));
capture('#boldBtn',()=>format('bold',!(S.mode==='page'?curObj()?.style?.bold:curBlock()?.style?.bold)));capture('#italicBtn',()=>format('italic',!(S.mode==='page'?curObj()?.style?.italic:curBlock()?.style?.italic)));capture('#underlineBtn',()=>format('underline',!(S.mode==='page'?curObj()?.style?.underline:curBlock()?.style?.underline)));
q('#fontFamily')?.addEventListener('change',e=>format('fontFamily',e.target.value));q('#fontSize')?.addEventListener('change',e=>format('fontSize',Math.max(6,Math.min(144,Number(e.target.value)||12))));q('#opacityRange')?.addEventListener('input',e=>q('#opacityLabel').textContent=e.target.value+'%');q('#opacityRange')?.addEventListener('change',e=>format('opacity',e.target.value));qa('.alignBtn').forEach(b=>b.addEventListener('click',()=>format('align',b.dataset.align)));
capture('#guideBtn',()=>mutate('Toggle page guides',()=>S.doc.guides=!S.doc.guides));capture('#snapBtn',()=>mutate('Toggle snap',()=>S.doc.snapPt=S.doc.snapPt?0:8));capture('#marginBtn',()=>mutate('Change margin guide',()=>S.doc.marginPct=S.doc.marginPct===9.4?5.9:9.4));

const img=document.createElement('input');img.type='file';img.accept='image/*';img.hidden=true;document.body.appendChild(img);q('#imageBtn')?.addEventListener('click',e=>{if(need('Insert image'))img.click();});img.addEventListener('change',()=>{const f=img.files?.[0];if(!f)return;const r=new FileReader();r.onload=()=>mutate('Insert image',()=>{const p=curPage(),o={id:uid('obj'),type:'image',x:18,y:18,w:40,h:28,z:Math.max(10,...p.objects.map(x=>x.z||10))+1,src:r.result,alt:f.name,opacity:100};p.objects.push(o);S.sel=o.id;});r.readAsDataURL(f);img.value='';});

q('#openPdfBtn').addEventListener('click',()=>q('#pdfFileInput').click());q('#pdfFileInput').addEventListener('change',()=>{const f=q('#pdfFileInput').files?.[0];if(!f)return;const u=URL.createObjectURL(f);activate(pdfDoc(f,u),u);q('#pdfFileInput').value='';});
q('#openProjectBtn').addEventListener('click',()=>q('#projectFileInput').click());q('#projectFileInput').addEventListener('change',async()=>{const f=q('#projectFileInput').files?.[0];if(!f)return;try{const d=JSON.parse(await f.text());if(d.schema!=='psdemo-1')throw 0;activate(d,null);if(d.kind==='pdf')say('Project opened without PDF source bytes; reconnect the PDF to continue.');}catch(e){say('Could not open that project file.');}q('#projectFileInput').value='';});

function download(name,text,type='application/json'){const b=new Blob([text],{type}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),500);}
function project(){if(!need('Download project'))return;const d=clone(S.doc);d.pages.forEach(p=>{if(p.kind==='pdf-source')delete p.sourceUrl;});download(S.doc.name.replace(/[^a-z0-9_-]+/gi,'_')+'.psdemo.json',JSON.stringify(d,null,2));say('Project snapshot downloaded.');}
function exportHtml(){if(!need('Download HTML'))return;if(S.doc.kind==='pdf'){say('HTML export does not embed PDF source bytes. Use the connected PDF engine for PDF export.');return;}const pages=S.doc.pages.map(p=>'<section class="page">'+p.objects.map(o=>o.type==='image'?'<div style="position:absolute;left:'+o.x+'%;top:'+o.y+'%;width:'+o.w+'%;height:'+o.h+'%"><img src="'+o.src+'" style="width:100%;height:100%;object-fit:contain"></div>':'<div style="position:absolute;left:'+o.x+'%;top:'+o.y+'%;width:'+o.w+'%;min-height:'+o.h+'%;font-family:'+esc((o.style||textStyle()).fontFamily)+';font-size:'+((o.style||textStyle()).fontSize)+'px;text-align:'+((o.style||textStyle()).align)+';font-weight:'+((o.style||textStyle()).bold?700:400)+';font-style:'+((o.style||textStyle()).italic?'italic':'normal')+';text-decoration:'+((o.style||textStyle()).underline?'underline':'none')+'">'+esc(o.text||'')+'</div>').join('')+'</section>').join('');download(S.doc.name.replace(/[^a-z0-9_-]+/gi,'_')+'.html','<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#ddd}.page{position:relative;width:8.5in;height:11in;margin:18px auto;background:white;page-break-after:always}@media print{body{background:white}.page{margin:0}}</style>'+pages,'text/html');}
function printPdf(){if(!need('Print / PDF'))return;if(S.doc.kind==='pdf')say('This prints the visible source + overlay only; native PDF rewrite belongs to the connected PDF engine.');window.print();}
q('#saveLocalBtn').addEventListener('click',saveLocal);q('#downloadProjectBtn')?.addEventListener('click',project);q('#downloadProjectBtn2').addEventListener('click',project);q('#downloadHtmlBtn')?.addEventListener('click',exportHtml);q('#fileDownloadHtml').addEventListener('click',exportHtml);q('#printPdfBtn')?.addEventListener('click',printPdf);q('#filePrintPdf').addEventListener('click',printPdf);

function modal(title,html){q('#modalTitle').textContent=title;q('#modalBody').innerHTML=html;q('#modalBg').classList.add('open');}
capture('#preflightBtn',()=>{if(!need('Preflight'))return;const all=S.doc.pages.flatMap(p=>p.objects),bad=all.filter(o=>o.x<0||o.y<0||o.x+o.w>100||o.y+o.h>100),empty=all.filter(o=>o.type==='text'&&!String(o.text||'').trim());modal('Document Preflight','<div class="proof-grid"><div class="proof-item"><strong class="pass">PASS · Document state</strong><small>'+S.doc.pages.length+' page(s), r'+S.doc.revision+'</small></div><div class="proof-item"><strong class="'+(bad.length?'hold':'pass')+'">'+(bad.length?'CHECK':'PASS')+' · Page bounds</strong><small>'+bad.length+' out-of-bounds object(s)</small></div><div class="proof-item"><strong class="'+(empty.length?'hold':'pass')+'">'+(empty.length?'CHECK':'PASS')+' · Text frames</strong><small>'+empty.length+' empty frame(s)</small></div><div class="proof-item"><strong class="'+(S.doc.kind==='pdf'?'hold':'pass')+'">'+(S.doc.kind==='pdf'?'BOUNDARY':'PASS')+' · Source authority</strong><small>'+esc(S.doc.source.claim)+'</small></div><div class="proof-item"><strong class="hold">UNKNOWN · PDF/X certification</strong><small>Not inferred by this public slice</small></div></div>');});
capture('#proofBtn',()=>modal('Proof State','<div class="proof-grid"><div class="proof-item"><strong class="pass">G5I kernel · controlled PASS</strong><small>Engineering reference remains frozen</small></div><div class="proof-item"><strong class="pass">G6B native slice · operational</strong><small>New document, text/image objects, format, undo/history, save/download</small></div><div class="proof-item"><strong class="hold">PDF public shell</strong><small>Local source view + bounded overlays; native PDF-object engine is not connected yet</small></div><div class="proof-item"><strong class="hold">Cloud HA</strong><small>Not implied by this demo</small></div></div>'));
capture('#historyBtn',()=>{renderHistory();q('#historyPanel').classList.toggle('open');});
capture('#trackBtn',()=>say('Tracked-change authoring remains a Flow-kernel connection in this operational slice.'));
q('#addComment')?.addEventListener('click',e=>{if(!S.active)return;e.stopImmediatePropagation();const text=prompt('Review note');if(!text)return;mutate('Add review comment',()=>S.doc.comments.push({author:'You',text,revision:S.doc.revision+1}));},true);

document.addEventListener('keydown',e=>{const meta=e.ctrlKey||e.metaKey;if(e.key==='Escape'){closeBackstage();return;}if(meta&&e.key.toLowerCase()==='n'){e.preventDefault();openBackstage('new');}else if(meta&&e.key.toLowerCase()==='s'){e.preventDefault();saveLocal();}else if(meta&&e.key.toLowerCase()==='z'&&!e.shiftKey){e.preventDefault();undo();}else if((meta&&e.key.toLowerCase()==='y')||(meta&&e.shiftKey&&e.key.toLowerCase()==='z')){e.preventDefault();redo();}else if(meta&&e.key.toLowerCase()==='d'){e.preventDefault();dup();}else if((e.key==='Delete'||e.key==='Backspace')&&S.active&&document.activeElement?.contentEditable!=='true'&&S.sel){e.preventDefault();del();}});

q('#buildMarker').textContent=BUILD;
})();
