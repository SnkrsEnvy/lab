(()=>{
'use strict';
const EXPECTED_VERSION='0.35.0-g5i';
const EXPECTED_GATE='G5I Distributed Page Delta Lifecycle + Conflict-Safe Undo';
const CONTRACT='publisher-studio-g5i-http-adapter-v1';

function trimBase(value){return String(value||'').trim().replace(/\/+$/,'');}
function uid(prefix='op'){return prefix+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,9);}
function clone(v){return JSON.parse(JSON.stringify(v));}
function ensureOk(response,label){if(response.ok)return response;const err=new Error(label+' failed: HTTP '+response.status);err.status=response.status;throw err;}
function endpoint(base,path){return base+path;}
function normalizeBBox(v){if(!Array.isArray(v)||v.length!==4)throw new Error('PDF operation requires bbox [x0,y0,x1,y1].');return v.map(Number);}
function normalizePage(payload){const page=Number(payload?.page ?? (Number(payload?.pageIndex)+1));if(!Number.isInteger(page)||page<1)throw new Error('PDF operation requires a 1-based page number.');return page;}

function operationFor(tool,payload={}){
  if(payload.operation&&typeof payload.operation==='object') return clone(payload.operation);
  const page=normalizePage(payload);
  const base={id:payload.id||uid(tool),page,bbox:Array.isArray(payload.bbox)?normalizeBBox(payload.bbox):[0,0,1,1]};
  if(tool==='ocr') return {...base,type:'ocr_searchable',ocrLanguage:payload.ocrLanguage||'eng',ocrDpi:Number(payload.ocrDpi||200),ocrForce:!!payload.ocrForce};
  if(tool==='redact') return {...base,type:'redact',bbox:normalizeBBox(payload.bbox),fill:payload.fill||'#000000'};
  if(tool==='links'){
    const action=payload.action||'add';
    if(action==='add') return {...base,type:'add_link',bbox:normalizeBBox(payload.bbox),uri:String(payload.uri||'')};
    if(action==='update') return {...base,type:'update_link',bbox:normalizeBBox(payload.bbox),uri:String(payload.uri||''),linkXref:Number(payload.linkXref)};
    if(action==='remove') return {...base,type:'remove_link',bbox:normalizeBBox(payload.bbox),oldUri:payload.oldUri??null,linkXref:Number(payload.linkXref)};
    throw new Error('Unsupported link action: '+action);
  }
  if(tool==='forms'){
    const action=payload.action||'fill';
    if(action==='fill') return {...base,type:'set_form_value',bbox:normalizeBBox(payload.bbox),fieldXref:Number(payload.fieldXref),fieldName:payload.fieldName??null,fieldValue:payload.fieldValue};
    if(action==='create') return {...base,type:'add_form_field',bbox:normalizeBBox(payload.bbox),fieldName:String(payload.fieldName||'Field'),fieldValue:payload.fieldValue??'',fieldType:payload.fieldType||'text',fieldChoices:Array.isArray(payload.fieldChoices)?payload.fieldChoices:[]};
    throw new Error('Unsupported form action: '+action);
  }
  throw new Error('Unsupported PDF tool: '+tool);
}

function create(options={}){
  const baseUrl=trimBase(options.baseUrl);
  if(!baseUrl) throw new Error('G5I adapter requires baseUrl.');
  const fetchImpl=options.fetch||globalThis.fetch;
  if(typeof fetchImpl!=='function') throw new Error('G5I adapter requires fetch().');
  const credentials=options.credentials||'include';
  const staged=new Map(),manifests=new Map();
  let capabilitySnapshot=null;
  async function request(path,init={},label){
    const next={...init,credentials:init.credentials||credentials};
    return ensureOk(await fetchImpl(endpoint(baseUrl,path),next),label||path);
  }
  async function capabilities(){
    const r=await request('/api/capabilities',{},'G5I capabilities');
    const body=await r.json();
    if(body.version!==EXPECTED_VERSION) throw new Error('Unexpected G5I version: '+body.version);
    if(body.gate!==EXPECTED_GATE) throw new Error('Unexpected G5I gate: '+body.gate);
    const editing=Array.isArray(body.editing)?body.editing:[];
    const has=fragment=>editing.some(x=>String(x).toLowerCase().includes(fragment));
    capabilitySnapshot={raw:body,redact:has('true redaction'),ocr:has('searchable ocr layer'),forms:has('form fill/update'),links:has('link add/update/remove'),undo:true,exportPdf:true};
    return {redact:capabilitySnapshot.redact,ocr:capabilitySnapshot.ocr,forms:capabilitySnapshot.forms,links:capabilitySnapshot.links,undo:true,exportPdf:true};
  }
  async function openSource({file}){
    if(!(file instanceof File)) throw new TypeError('G5I openSource requires File.');
    const fd=new FormData();fd.append('file',file,file.name||'document.pdf');
    const r=await request('/api/document/upload',{method:'POST',body:fd},'G5I PDF upload');
    const manifest=await r.json();
    if(!manifest.documentId||manifest.sourceState!=='FROZEN') throw new Error('G5I upload did not return frozen document authority.');
    staged.set(manifest.documentId,[]);manifests.set(manifest.documentId,manifest);
    return {source:manifest.documentId,manifest};
  }
  async function invoke({tool,source,payload={}}){
    if(!source||!staged.has(source)) throw new Error('Unknown G5I source token.');
    if(tool==='undo') return undo({source,payload});
    const op=operationFor(tool,payload),list=staged.get(source);
    list.push(op);
    return {status:'STAGED',source,tool,operation:clone(op),operationCount:list.length};
  }
  async function undo({source}){
    if(!source||!staged.has(source)) throw new Error('Unknown G5I source token.');
    const list=staged.get(source),operation=list.pop()||null;
    return {status:operation?'UNDONE':'NOOP',source,operation,operationCount:list.length};
  }
  async function exportPdf({source,payload={}}){
    if(!source||!staged.has(source)) throw new Error('Unknown G5I source token.');
    const operations=payload.operations?clone(payload.operations):clone(staged.get(source));
    const preset=payload.preset||'screen';
    const r=await request('/api/document/'+encodeURIComponent(source)+'/export',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operations,preset,label:payload.label||'G6G real adapter export'})},'G5I PDF export');
    const receipt=await r.json();
    if(!receipt?.verification?.pass) throw new Error('G5I export verification failed.');
    const dl=await request(receipt.downloadUrl,{},'G5I PDF download');
    const blob=await dl.blob();
    const sourceName=manifests.get(source)?.name||'PublisherStudio.pdf';
    const filename=String(sourceName).replace(/\.pdf$/i,'')+'-edited.pdf';
    return {blob,filename,receipt,operations};
  }
  async function inspectText(source,page=1){
    const r=await request('/api/document/'+encodeURIComponent(source)+'/page/'+Number(page)+'/text',{},'G5I page text');return r.json();
  }
  async function inspectObjects(source,page=1){
    const r=await request('/api/document/'+encodeURIComponent(source)+'/page/'+Number(page)+'/objects',{},'G5I page objects');return r.json();
  }
  async function preflight(source,preset='screen'){
    const r=await request('/api/document/'+encodeURIComponent(source)+'/preflight?preset='+encodeURIComponent(preset),{},'G5I preflight');return r.json();
  }
  function state(source){return {baseUrl,contract:CONTRACT,manifest:source?clone(manifests.get(source)||null):null,stagedOperations:source?clone(staged.get(source)||[]):[],capabilities:capabilitySnapshot?clone(capabilitySnapshot):null};}
  return {id:'g5i-http-'+EXPECTED_VERSION,name:'Publisher Studio G5I HTTP Adapter',contract:CONTRACT,baseUrl,capabilities,openSource,invoke,undo,exportPdf,inspectText,inspectObjects,preflight,state};
}
function configuredBaseUrl(){
  if(globalThis.PUBLISHER_STUDIO_G5I_BASE_URL)return trimBase(globalThis.PUBLISHER_STUDIO_G5I_BASE_URL);
  if(typeof document!=='undefined'){const meta=document.querySelector('meta[name="publisher-studio-g5i-base-url"]');if(meta?.content)return trimBase(meta.content);}
  return '';
}
async function autoRegister(){
  const baseUrl=configuredBaseUrl();
  if(!baseUrl||!globalThis.PublisherStudioPdfBridge?.register)return {status:'HOLD',reason:'g5i_base_url_not_configured'};
  const adapter=create({baseUrl});
  const state=await globalThis.PublisherStudioPdfBridge.register(adapter);
  return {status:state.status,adapter,bridge:state};
}
globalThis.PublisherStudioG5IHttpAdapter={EXPECTED_VERSION,EXPECTED_GATE,CONTRACT,create,autoRegister,configuredBaseUrl};
if(typeof window!=='undefined')window.addEventListener('DOMContentLoaded',()=>{autoRegister().catch(err=>console.error('G5I adapter registration failed',err));},{once:true});
})();