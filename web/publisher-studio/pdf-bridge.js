(()=>{
'use strict';
const CONTRACT='publisher-studio-pdf-bridge-g6e-1';
const TOOLS=['redact','ocr','forms','links','undo','exportPdf'];
let adapter=null;
let state={contract:CONTRACT,status:'HOLD',reason:'adapter_not_registered',adapterId:null,capabilities:{},source:null,lastError:null};
const copy=()=>JSON.parse(JSON.stringify(state));
const normalizeCaps=v=>{const src=v&&typeof v==='object'?v:{};const out={};TOOLS.forEach(k=>out[k]=src[k]===true);return out;};
const emit=()=>window.dispatchEvent(new CustomEvent('publisherstudio:pdfbridgechange',{detail:copy()}));
const setState=patch=>{state={...state,...patch};emit();return copy();};
const fail=(reason,error=null)=>setState({status:'HOLD',reason,lastError:error?String(error):null,source:null});
async function refresh(){
  if(!adapter)return fail('adapter_not_registered');
  try{
    const caps=normalizeCaps(await adapter.capabilities());
    return setState({status:'READY',reason:null,adapterId:adapter.id||adapter.name||'registered-adapter',capabilities:caps,lastError:null});
  }catch(error){return fail('capability_probe_failed',error);}
}
function validateAdapter(candidate){
  if(!candidate||typeof candidate!=='object')throw new TypeError('PDF adapter must be an object.');
  ['capabilities','openSource','invoke','exportPdf'].forEach(name=>{if(typeof candidate[name]!=='function')throw new TypeError('PDF adapter missing '+name+'().');});
}
async function register(candidate){
  validateAdapter(candidate);adapter=candidate;
  state={contract:CONTRACT,status:'REGISTERED',reason:null,adapterId:candidate.id||candidate.name||'registered-adapter',capabilities:{},source:null,lastError:null};emit();
  return refresh();
}
function unregister(){adapter=null;state={contract:CONTRACT,status:'HOLD',reason:'adapter_not_registered',adapterId:null,capabilities:{},source:null,lastError:null};emit();return copy();}
function status(){return copy();}
function readyFor(tool){return !!adapter&&['READY','CONNECTED'].includes(state.status)&&state.capabilities[tool]===true;}
async function openSource(file,context={}){
  if(!adapter)return fail('adapter_not_registered');
  if(!(file instanceof File))throw new TypeError('openSource requires a browser File.');
  if(state.status==='HOLD')await refresh();
  try{
    const result=await adapter.openSource({file,context,contract:CONTRACT});
    const source=result?.source??result?.sourceId??result?.id??null;
    if(source==null)return fail('adapter_open_returned_no_source');
    setState({status:'CONNECTED',reason:null,source,lastError:null});
    return {status:'CONNECTED',source,result};
  }catch(error){fail('adapter_open_failed',error);throw error;}
}
async function invoke(tool,payload={}){
  if(!TOOLS.includes(tool)||tool==='exportPdf')throw new Error('Unsupported bridge tool: '+tool);
  if(!readyFor(tool))throw new Error('PDF bridge capability not ready: '+tool);
  if(state.source==null)throw new Error('No PDF source is connected.');
  return adapter.invoke({tool,source:state.source,payload,contract:CONTRACT});
}
async function undo(payload={}){
  if(!readyFor('undo'))throw new Error('PDF bridge capability not ready: undo');
  if(state.source==null)throw new Error('No PDF source is connected.');
  if(typeof adapter.undo==='function')return adapter.undo({source:state.source,payload,contract:CONTRACT});
  return adapter.invoke({tool:'undo',source:state.source,payload,contract:CONTRACT});
}
async function exportPdf(payload={}){
  if(!readyFor('exportPdf'))throw new Error('PDF bridge capability not ready: exportPdf');
  if(state.source==null)throw new Error('No PDF source is connected.');
  return adapter.exportPdf({source:state.source,payload,contract:CONTRACT});
}
window.PublisherStudioPdfBridge={CONTRACT,TOOLS:[...TOOLS],register,unregister,refresh,status,readyFor,openSource,invoke,undo,exportPdf};
emit();
})();