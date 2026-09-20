(()=>{
'use strict';
const EXPECTED_VERSION='0.35.0-g5i';
const EXPECTED_GATE='G5I Distributed Page Delta Lifecycle + Conflict-Safe Undo';
const CONTRACT='publisher-studio-g5i-stateless-adapter-v1';
const DEFAULT_ENDPOINT='/api/publisher-studio-g5i';
function uid(prefix='source'){return prefix+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,9);}
function clone(v){return JSON.parse(JSON.stringify(v));}
function ensureOk(response,label){if(response.ok)return response;const err=new Error(label+' failed: HTTP '+response.status);err.status=response.status;return response.text().then(t=>{err.detail=t;throw err;});}
function filenameFromDisposition(value,fallback){const m=String(value||'').match(/filename="?([^";]+)"?/i);return m?.[1]||fallback;}
function normalizeCaps(body){const caps=body?.capabilities||{};return {replaceText:caps.replaceText===true,redact:caps.redact===true,ocr:caps.ocr===true,forms:caps.forms===true,links:caps.links===true,pageReorder:caps.pageReorder===true,undo:caps.undo===true,exportPdf:caps.exportPdf===true};}
function operationFor(tool,payload={}){
  if(payload.operation&&typeof payload.operation==='object')return clone(payload.operation);
  if(tool==='pageReorder'){
    const pageList=Array.isArray(payload.pageList)?payload.pageList.map(Number):[];
    if(!pageList.length||pageList.some(x=>!Number.isInteger(x)||x<1))throw new Error('Page reorder requires a complete 1-based page sequence.');
    if(new Set(pageList).size!==pageList.length)throw new Error('Page reorder cannot duplicate source pages.');
    const previousPageList=Array.isArray(payload.previousPageList)?payload.previousPageList.map(Number):[];
    return {id:payload.id||uid(tool),type:'reorder_pages',page:1,bbox:[0,0,0,0],pageList,previousPageList};
  }
  const page=Number(payload.page ?? (Number(payload.pageIndex)+1));
  if(!Number.isInteger(page)||page<1)throw new Error('PDF operation requires a 1-based page number.');
  const base={id:payload.id||uid(tool),page,bbox:Array.isArray(payload.bbox)?payload.bbox.map(Number):null};
  if(tool==='replaceText'){
    if(!base.bbox||base.bbox.length!==4)throw new Error('Text replacement requires a bounded text block or bbox.');
    const newText=String(payload.newText??'');
    if(!newText.trim())throw new Error('Replacement text cannot be blank.');
    return {...base,type:'replace_text',oldText:String(payload.oldText||''),newText,backgroundMode:payload.backgroundMode||'preserve',fontSize:Number(payload.fontSize||10),color:payload.color||'#000000',align:payload.align||'left'};
  }
  if(tool==='redact'){
    if(!base.bbox||base.bbox.length!==4)throw new Error('Redaction requires a bounded text block or bbox.');
    return {...base,type:'redact',oldText:String(payload.oldText||''),fill:payload.fill||'#000000'};
  }
  if(tool==='links'){
    if(!base.bbox||base.bbox.length!==4)throw new Error('Link creation requires bbox.');
    const uri=String(payload.uri||'').trim();if(!uri)throw new Error('Link creation requires URI.');
    return {...base,type:'add_link',uri};
  }
  throw new Error('Stateless public transport does not expose '+tool+' yet.');
}
function create(options={}){
  const endpoint=String(options.endpoint||DEFAULT_ENDPOINT).trim()||DEFAULT_ENDPOINT;
  const fetchImpl=options.fetch||globalThis.fetch;if(typeof fetchImpl!=='function')throw new Error('Stateless G5I adapter requires fetch().');
  const sources=new Map();let capabilitySnapshot=null;
  async function capabilities(){
    const r=await ensureOk(await fetchImpl(endpoint,{cache:'no-store'}),'G5I stateless capabilities');
    const body=await r.json();
    if(body.version!==EXPECTED_VERSION)throw new Error('Unexpected G5I version: '+body.version);
    if(body.gate!==EXPECTED_GATE)throw new Error('Unexpected G5I gate: '+body.gate);
    const caps=normalizeCaps(body);capabilitySnapshot={...body,capabilities:caps};return caps;
  }
  async function openSource({file}){
    if(!(file instanceof File))throw new TypeError('G5I openSource requires File.');
    const fd=new FormData();fd.append('file',file,file.name||'document.pdf');fd.append('mode','inspect');
    const r=await ensureOk(await fetchImpl(endpoint,{method:'POST',body:fd,cache:'no-store'}),'G5I stateless inspect');
    const manifest=await r.json();
    if(manifest.version!==EXPECTED_VERSION||manifest.gate!==EXPECTED_GATE||manifest.sourceState!=='FROZEN_CLIENT_SOURCE')throw new Error('Stateless inspection did not return frozen G5I source authority.');
    const source=uid('g5i');sources.set(source,{file,manifest,operations:[]});return {source,manifest};
  }
  function requireSource(source){const rec=sources.get(source);if(!rec)throw new Error('Unknown stateless G5I source token.');return rec;}
  async function invoke({tool,source,payload={}}){
    const rec=requireSource(source);if(tool==='undo')return undo({source});
    const operation=operationFor(tool,payload),isSequence=operation.type==='reorder_pages',hasSequence=rec.operations.some(op=>op.type==='reorder_pages');
    if((isSequence&&rec.operations.length)||(hasSequence&&!isSequence))throw new Error('G5I page-sequence edits are isolated transactions. Undo or export the current PDF delta before reordering pages.');
    rec.operations.push(operation);return {status:'STAGED',source,tool,operation:clone(operation),operationCount:rec.operations.length};
  }
  async function undo({source}){const rec=requireSource(source),operation=rec.operations.pop()||null;return {status:operation?'UNDONE':'NOOP',source,operation:clone(operation),operationCount:rec.operations.length};}
  async function exportPdf({source,payload={}}){
    const rec=requireSource(source);const operations=payload.operations?clone(payload.operations):clone(rec.operations);if(!operations.length)throw new Error('No PDF operations are staged.');
    const fd=new FormData();fd.append('file',rec.file,rec.file.name||'document.pdf');fd.append('mode','export');fd.append('operations',JSON.stringify(operations));fd.append('preset',payload.preset||'screen');
    const r=await ensureOk(await fetchImpl(endpoint,{method:'POST',body:fd,cache:'no-store'}),'G5I stateless export');
    const blob=await r.blob();
    const receipt={
      transport:r.headers.get('x-publisher-transport'),engineVersion:r.headers.get('x-publisher-g5i-version'),operationCount:Number(r.headers.get('x-publisher-operation-count')||operations.length),
      verification:{pass:r.headers.get('x-publisher-verification-pass')==='true',renderPass:r.headers.get('x-publisher-render-pass')==='true',structural:{pass:r.headers.get('x-publisher-structural-pass')==='true'},sourceSha256:r.headers.get('x-publisher-source-sha256'),outputSha256:r.headers.get('x-publisher-output-sha256')},
      proofSha256:r.headers.get('x-publisher-proof-sha256'),claim:'Header-bounded receipt for the stateless public G5I checkpoint; the full engine receipt exists only inside the single invocation.'
    };
    if(!receipt.verification.pass)throw new Error('Stateless G5I export did not return verification PASS.');
    return {blob,filename:filenameFromDisposition(r.headers.get('content-disposition'),String(rec.file.name||'PublisherStudio').replace(/\.pdf$/i,'')+'-edited.pdf'),receipt,operations};
  }
  function inspection(source){return clone(requireSource(source).manifest);}
  function state(source){const rec=source?sources.get(source):null;return {endpoint,contract:CONTRACT,capabilities:capabilitySnapshot?clone(capabilitySnapshot):null,manifest:rec?clone(rec.manifest):null,stagedOperations:rec?clone(rec.operations):[]};}
  return {id:'g5i-stateless-'+EXPECTED_VERSION,name:'Publisher Studio G5I Stateless Same-Origin Adapter',contract:CONTRACT,endpoint,capabilities,openSource,invoke,undo,exportPdf,inspection,state};
}
async function autoRegister(){if(!globalThis.PublisherStudioPdfBridge?.register)return {status:'HOLD',reason:'bridge_unavailable'};const adapter=create();const bridge=await globalThis.PublisherStudioPdfBridge.register(adapter);return {status:bridge.status,adapter,bridge};}
globalThis.PublisherStudioG5IStatelessAdapter={EXPECTED_VERSION,EXPECTED_GATE,CONTRACT,DEFAULT_ENDPOINT,create,autoRegister};
if(typeof window!=='undefined')window.addEventListener('DOMContentLoaded',()=>{autoRegister().catch(err=>console.error('Stateless G5I adapter registration failed',err));},{once:true});
})();
