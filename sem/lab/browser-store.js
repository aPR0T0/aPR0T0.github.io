/** Private, browser-local workspace for the explicitly built public demo. */
import {DEFAULTS} from './physics.js';
import {StoreError, validateParameters, presentBom, ROLES, STATUSES} from './bom-model.js';
import {getSpecimen, SPECIMENS} from './specimens.js';

const copy = value => structuredClone(value);
const checkedText = (value, name, max=12000) => {
  if(typeof value!=='string'||value.length>max||value.includes('\0'))throw new StoreError(400,`${name} must be text below ${max} characters.`);
  return value;
};
const object = value => value && typeof value==='object' && !Array.isArray(value);
const hash = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(n=>n.toString(16).padStart(2,'0')).join('');
const sourceHash = value => value ? hash(JSON.stringify(value)) : Promise.resolve('');
export const BROWSER_STORAGE_KEY = 'beam-lab-public-workspace-v1';

export function createBrowserStore({seed,storage,key=BROWSER_STORAGE_KEY,locks=globalThis.navigator?.locks}) {
  let queue=Promise.resolve();
  const serial=fn=>{const run=()=>locks?locks.request(key,fn):fn(),next=queue.then(run,run);queue=next.catch(()=>{});return next;};
  function read(){
    let text;
    try{text=storage.getItem(key);}catch{throw new StoreError(503,'Browser storage is unavailable. Allow site storage to save BOM edits and setups.');}
    if(!text)return {schema:1,seedRevision:seed.bom.revision,files:copy(seed.bom.files),setups:[]};
    try{const value=JSON.parse(text);if(value.schema!==1||!Array.isArray(value.files)||!Array.isArray(value.setups))throw new Error();return value;}
    catch{throw new StoreError(422,'The saved browser workspace could not be read. Export any open setup before clearing this site’s browser storage.');}
  }
  function write(value){
    try{storage.setItem(key,JSON.stringify(value));}
    catch{throw new StoreError(507,'Browser storage is full or disabled. Export your current setup; this change was not saved.');}
  }
  async function present(state){
    const raw={files:state.files.map(file=>({...file,rows:file.rows.map(row=>row.values)}))};
    raw.revision=await hash(JSON.stringify(raw.files));
    const fingerprints=new Map();
    await Promise.all(raw.files.flatMap(file=>file.rows.map(async row=>fingerprints.set(row,await sourceHash(row)))));
    return presentBom(raw,row=>fingerprints.get(row)||'');
  }
  async function checkedState(revision){const state=read(),bom=await present(state);if(revision!==bom.revision)throw new StoreError(409,'The browser BOM changed. Reload before saving.');return state;}
  function mapping(row,files){
    if(!ROLES.includes(row.Role)||!STATUSES.includes(row.Status))throw new StoreError(400,'Choose a valid component role and specification status.');
    try{validateParameters(JSON.parse(row.Parameters));}catch(error){throw new StoreError(400,`Invalid component parameters: ${error.message}`);}
    if(Boolean(row.SourceFile)!==Boolean(row.SourceRef))throw new StoreError(400,'SourceFile and SourceRef must both be set, or both empty.');
    if(row.SourceFile&&!files.some(file=>file.id===row.SourceFile&&file.id!=='simulation'))throw new StoreError(400,'Select an existing source BOM file.');
  }
  async function getBom(){return present(read());}
  async function updateComponent(id,body){return serial(async()=>{
    const state=await checkedState(body.revision),row=state.files.find(file=>file.id==='simulation')?.rows.find(row=>row.values.Id===id)?.values;
    if(!row)throw new StoreError(404,'Component not found.');
    if(!object(body.values))throw new StoreError(400,'Provide component values as an object.');
    const fields={reference:'Reference',role:'Role',name:'Name',manufacturer:'Manufacturer',mpn:'MPN',datasheet:'Datasheet',status:'Status',parameters:'Parameters',notes:'Notes',sourceFile:'SourceFile',sourceRef:'SourceRef'};
    for(const [field,value] of Object.entries(body.values)){
      if(!Object.hasOwn(fields,field))throw new StoreError(400,`Unknown component field: ${field}.`);
      row[fields[field]]=field==='parameters'?JSON.stringify(validateParameters(value)):checkedText(value,field);
    }
    mapping(row,state.files);
    if(row.SourceRef){
      const file=state.files.find(file=>file.id===row.SourceFile),source=file.rows.find(row2=>row2.values.Reference===row.SourceRef)?.values;
      if(!source)throw new StoreError(400,'Linked source reference does not exist.');
      const before=await sourceHash(source);
      for(const field of ['manufacturer','mpn','datasheet'])if(field in body.values){
        const column=field==='mpn'&&file.columns.includes('MPN_or_procurement_spec')?'MPN_or_procurement_spec':fields[field];
        if(!file.columns.includes(column))file.columns.push(column);
        source[column]=row[fields[field]];
      }
      const after=await sourceHash(source);
      if(before!==after&&!('status' in body.values))row.Status='needs-research';
      if('parameters' in body.values||'status' in body.values||before!==after)row.SourceFingerprint=after;
    }else row.SourceFingerprint='';
    const result=await present(state);write(state);return result;
  });}
  async function updateRow(fileId,rowId,body){return serial(async()=>{
    const state=await checkedState(body.revision),file=state.files.find(file=>file.id===fileId),row=file?.rows.find(row=>row.id===rowId);
    if(!row)throw new StoreError(404,'BOM row not found.');
    if(!object(body.values))throw new StoreError(400,'Provide BOM columns and values.');
    for(const [field,value] of Object.entries(body.values)){
      if(!file.columns.includes(field))throw new StoreError(400,`Unknown BOM column: ${field}.`);
      if(['Reference','Id','SourceFingerprint'].includes(field)&&value!==row.values[field])throw new StoreError(400,`${field} is a stable identity and cannot be edited.`);
      row.values[field]=checkedText(value,field);
    }
    if(fileId==='simulation')mapping(row.values,state.files);
    const result=await present(state);write(state);return result;
  });}
  async function resolveBom({allowAssumptions=false}={}){
    if(typeof allowAssumptions!=='boolean')throw new StoreError(400,'allowAssumptions must be boolean.');
    const bom=await getBom(),parameters={...DEFAULTS};
    for(const component of bom.components)Object.assign(parameters,component.parameters);
    return {...bom,parameters,ready:!bom.issues.some(issue=>issue.severity==='error'||!allowAssumptions),usedAssumptions:allowAssumptions&&bom.issues.some(issue=>issue.severity!=='error')};
  }
  async function listSetups(){return {setups:[...read().setups.slice().reverse().sort((a,b)=>b.createdAt.localeCompare(a.createdAt)),...copy(seed.setups)]};}
  async function getSetup(id){const found=[...seed.setups,...read().setups].find(setup=>setup.id===id);if(!found)throw new StoreError(404,'Saved setup not found.');return copy(found);}
  async function saveSetup(body){return serial(async()=>{
    const parameters=validateParameters(body.parameters,{complete:true}),name=checkedText(body.name||'Untitled setup','name',100).trim();
    if(!name)throw new StoreError(400,'Name cannot be blank.');
    const setup={id:crypto.randomUUID(),name,createdAt:new Date().toISOString(),parameters,immutable:true,source:checkedText(body.source||'browser','source',120),bomRevision:body.bomRevision==null?null:checkedText(body.bomRevision,'bomRevision',128)};
    for(const [field,max] of [['trajectoryCode',24000],['trajectoryDraft',24000],['firmwareCode',200000],['firmwareAppliedCode',200000]])if(body[field]!==undefined)setup[field]=checkedText(body[field],field,max);
    if(body.specimenId!==undefined){if(!SPECIMENS.some(specimen=>specimen.id===body.specimenId))throw new StoreError(400,'Choose an available specimen.');setup.specimenId=getSpecimen(body.specimenId).id;}
    if(body.operatingState!==undefined){if(!object(body.operatingState))throw new StoreError(400,'Operating state must be an object.');setup.operatingState={};for(const field of ['requestedBeam','roughing','turbo'])if(field in body.operatingState){if(typeof body.operatingState[field]!=='boolean')throw new StoreError(400,`${field} must be boolean.`);setup.operatingState[field]=body.operatingState[field];}}
    const state=read();state.setups.push(setup);write(state);return copy(setup);
  });}
  return {getBom,updateComponent,updateRow,resolveBom,listSetups,getSetup,saveSetup};
}
