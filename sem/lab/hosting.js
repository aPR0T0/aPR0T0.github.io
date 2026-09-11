/** The normal checkout stays local; only the publishing build declares static mode. */
export const STATIC_HOSTING = typeof document!=='undefined' && document.documentElement.dataset.hosting==='static';
export const APP_BASE = new URL('./',import.meta.url);
export const appURL = path => new URL(path.replace(/^\//,''),APP_BASE).href;
let storePromise;
export async function browserRequest(path,data,method='GET'){
  if(!storePromise)storePromise=(async()=>{
    const response=await fetch(appURL('public-seed.json'),{cache:'no-cache'});
    if(!response.ok)throw new Error('The published component library could not load. Reload this page.');
    const seed=await response.json(),{createBrowserStore}=await import('./browser-store.js');
    return createBrowserStore({seed,storage:localStorage});
  })();
  const store=await storePromise,parts=path.split('/').filter(Boolean).map(decodeURIComponent);
  if(parts.join('/')==='api/research/status')return {available:false,reason:'Component research needs the localhost Node server and your own Codex session. This public demo keeps BOM edits and setups only in this browser.'};
  if(parts[0]!=='api')throw new Error('This resource is not available in browser storage.');
  if(parts[1]==='bom'&&parts.length===2&&method==='GET')return store.getBom();
  if(parts[1]==='bom'&&parts.length===4&&method==='PUT')return store.updateRow(parts[2],parts[3],data);
  if(parts[1]==='components'&&parts.length===3&&method==='PUT')return store.updateComponent(parts[2],data);
  if(parts[1]==='resolve-bom'&&method==='POST')return store.resolveBom(data);
  if(parts[1]==='setups'&&parts.length===2&&method==='GET')return store.listSetups();
  if(parts[1]==='setups'&&parts.length===3&&method==='GET')return store.getSetup(parts[2]);
  if(parts[1]==='setups'&&parts.length===2&&method==='POST')return store.saveSetup(data);
  throw new Error('This action needs the localhost edition. See “Run locally” for setup instructions.');
}
