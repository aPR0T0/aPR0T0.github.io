/** BOM and immutable run snapshots, backed by localhost or private browser storage. */
import {getSpecimen} from './specimens.js';
import {STATIC_HOSTING, browserRequest} from './hosting.js';
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const labels = {
  dacModel:'Scan DAC model',dacBits:'DAC resolution',dacReference:'DAC full-scale range',amplifierGain:'External scan amplifier gain',
  currentRf:'LMC662 feedback resistance',currentCf:'LMC662 feedback capacitance',currentADCRange:'ADS1115 PGA full scale',currentADCRate:'ADS1115 rate',currentSamples:'ADC samples per pixel',currentBseYield:'Escaped BSE yield',currentNoiseFloor:'Assumed additional RMS noise',detectorMode:'Detector architecture',detectorOffset:'Detector lateral offset',detectorTilt:'Detector face tilt',detectorMargin:'Mounting allowance',detectorBeamAllowance:'Beam and alignment allowance',detectorDistance:'Detector centre height',detectorBias:'Diode reverse bias',bseYield:'Assumed BSE yield',bseEnergyFraction:'Mean BSE energy fraction',bseAcceptance:'Unobstructed acceptance',tiaResistance:'Feedback resistance',tiaCapacitance:'Feedback capacitance',tiaInputNoise:'Amplifier current noise',tiaVoltageNoise:'Amplifier voltage noise',adcFullScale:'ADC full scale',
  gunGap:'Cathode–anode gap',anodeApertureGap:'Anode–aperture gap',apertureBias:'Aperture potential',heaterResistance:'Hot filament resistance',lensResistance:'Lens coil resistance',
  voltage:'Acceleration voltage',heaterPower:'Filament heating',aperture:'Aperture diameter',wehnelt:'Wehnelt bias',lensCurrent:'Lens current',plateVoltage:'X alignment offset',plateGap:'Plate gap',plateLength:'Plate length',workingDistance:'Post-plate drift',chamberVolume:'Chamber volume',pumpSpeed:'Turbo speed',conductance:'Line conductance',gasLoad:'Gas load',pressure:'Starting pressure',dwell:'Pixel dwell',resolution:'Pixels per side',scanAmplitude:'Scan amplitude',pmtVoltage:'PMT voltage',collectionBias:'Cage bias',scanMode:'Scan pattern',ambientTemperature:'Ambient temperature',emissivity:'Emissivity',radiatingArea:'Radiating area',thermalConductance:'Support conduction',emittingArea:'Effective emitting area',workFunction:'Work function',richardsonConstant:'Richardson constant',apertureBeamSigma:'Beam spread at aperture',lensTurns:'Coil turns',lensLength:'Coil length',sourceDiameter:'Source diameter',demagnification:'Demagnification',energySpread:'Energy spread',chromaticCoefficient:'Chromatic coefficient',sphericalCoefficient:'Spherical coefficient',gasDiameter:'Gas molecule diameter',electronCrossSection:'Electron cross section',columnLength:'Column length',secondaryYield:'Secondary yield',photonYield:'Scintillator photon yield',opticalEfficiency:'Light guide efficiency',quantumEfficiency:'Quantum efficiency',pmtReferenceGain:'PMT reference gain',pmtGainExponent:'Gain exponent',excessNoiseFactor:'Excess noise factor',darkRate:'Dark count rate',readNoiseElectrons:'Read noise',flyback:'Retrace interval',settleTime:'Settling interval',roughingSpeed:'Roughing speed',roughingBase:'Roughing pressure floor',turboBase:'Turbo pressure floor',turboCrossover:'Turbo crossover'
};
const partNames = {gun:'Electron gun',heater:'Filament supply',acceleration:'Acceleration',aperture:'Beam aperture',lens:'Magnetic lens',scan:'Scan plates',vacuum:'Vacuum system',detector:'Imaging detector',controller:'ESP32 / scan DAC'};
const statusLabels = {'assumed':'Model assumption','needs-research':'Needs research','verified':'Verified sources','user-defined':'User specified'};
const safeLink = url => {try {const parsed=new URL(url);return ['https:','http:'].includes(parsed.protocol)?parsed.href:null;}catch{return null;}};
const shortDate = value => value ? new Date(value).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : 'Preserved baseline';
function element(tag,className,text){const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;}
function researchSummary(result){
  const paragraph=element('p','research-summary'),value=result.summary||'Component research completed.',sources=new Set((result.citations||[]).map(source=>source.url));let offset=0;
  for(const match of value.matchAll(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g)){
    paragraph.append(document.createTextNode(value.slice(offset,match.index)));
    if(sources.has(match[2])&&safeLink(match[2])){const link=element('a','',match[1]);link.href=match[2];link.target='_blank';link.rel='noopener noreferrer';paragraph.append(link);}else paragraph.append(document.createTextNode(match[1]));
    offset=match.index+match[0].length;
  }
  paragraph.append(document.createTextNode(value.slice(offset)));return paragraph;
}
export async function request(path, data, method = data ? 'POST' : 'GET') {
  if(STATIC_HOSTING)return browserRequest(path,data,method);
  const response = await fetch(path,{method,cache:'no-store',headers:data?{'Content-Type':'application/json','X-Beam-Lab':'1'}:{},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(15000)});
  let result;try{result=await response.json();}catch{throw new Error('The local server needs to be running with Beam Lab v4. Your base version is still available.');}
  if(!response.ok){const error=new Error(result.error?.message||result.error||result.message||`Request failed (${response.status}).`);error.status=response.status;throw error;}
  return result;
}
export function mountWorkspace(api) {
  let bom=null,selectedPart='aperture',fileId='external',rowEditing=null,partDirty=false,history=[],previous=null;
  let codex={available:false},runningJob=null,busyRun=false,activeSource='previous',activeName='Previous setup',activeRevision='',runDirty=false;
  let pollingTimer=null,closed=false,localFallback=false,partRevision='';
  const part = () => bom?.components.find(component=>component.id===selectedPart);
  const message=(text,error=false)=>{$('#part-save-status').textContent=text;$('#part-save-status').classList.toggle('error',error);};
  function markDirty(){runDirty=true;$('.run-strip').classList.add('is-dirty');$('#active-run-source').textContent='Working copy changed · save a snapshot to keep it.';}
  document.addEventListener('beam-parameters-changed',markDirty);
  function setActive(name,source,revision=''){
    activeName=name;activeSource=source;activeRevision=revision;runDirty=false;
    $('#active-run-name').textContent=name;$('#active-run-source').textContent=source==='bom'?`Loaded from BOM · revision ${revision.slice(0,8)}`:source==='preset'?'Built-in imaging preset · save a snapshot to keep your changes':'Saved parameters · independent of later BOM edits';$('.run-strip').classList.remove('is-dirty');
  }
  function partsView(name){
    $$('.parts-view').forEach(el=>el.hidden=el.id!==`parts-${name}`);
    $$('[data-parts-view]').forEach(el=>{el.classList.toggle('active',el.dataset.partsView===name);el.setAttribute('aria-pressed',el.dataset.partsView===name);});
    if(name==='history')loadHistory().catch(error=>api.toast(error.message));
  }
  function openParts(id){api.showPage('parts');partsView('components');if(id){selectedPart=id==='anode'?'acceleration':id==='specimen'?'scan':id;renderParts();}window.scrollTo({top:0,behavior:'smooth'});}
  function renderParts(){
    if(!bom)return;
    $('[data-parts-view=components] span').textContent=String(bom.components.length).padStart(2,'0');
    $('#part-list').replaceChildren();
    bom.components.forEach((component,index)=>{
      const button=element('button',`part-select${component.id===selectedPart?' active':''}`);button.type='button';button.setAttribute('aria-pressed',component.id===selectedPart);
      const text=element('span');text.append(element('strong','',partNames[component.id]||component.name),element('small','',`${component.reference} · ${statusLabels[component.status]||component.status}`));
      button.append(element('span','',String(index+1).padStart(2,'0')),text,element('span',`part-dot${['verified','user-defined'].includes(component.status)?' ready':''}`));
      button.addEventListener('click',()=>{selectedPart=component.id;partDirty=false;renderParts();message('');});$('#part-list').append(button);
    });
    const component=part();if(!component)return;partRevision=bom.revision;
    $('#part-reference').textContent=`${component.reference} / ${component.role.toUpperCase()}`;
    $('#part-heading').textContent=component.name;$('#part-status').textContent=statusLabels[component.status]||component.status;$('#part-status').className=`part-badge${['verified','user-defined'].includes(component.status)?' ready':''}`;
    $('#part-name').value=component.name||'';$('#part-manufacturer').value=component.manufacturer||'';$('#part-mpn').value=component.mpn||'';$('#part-datasheet').value=component.datasheet||'';$('#part-certainty').value=component.status||'needs-research';$('#part-notes').value=component.notes||'';
    $('#part-parameters').replaceChildren();
    for(const [key,value] of Object.entries(component.parameters||{})){
      const rule=bom.parameterSchema?.[key]||{},wrapper=element('div','part-parameter'),label=element('label'),input=element(rule.choices?'select':'input');
      label.append(element('span','',labels[key]||key),element('span','param-unit',rule.unit||''));input.dataset.modelParameter=key;input.id=`model-param-${key}`;label.htmlFor=input.id;input.setAttribute('aria-label',`${labels[key]||key} BOM value`);
      if(rule.choices){rule.choices.forEach(choice=>{const option=element('option','',choice);option.value=choice;input.append(option);});}
      else{input.type='number';input.step=rule.integer?'1':'any';if(rule.min!==undefined)input.min=rule.min;if(rule.max!==undefined)input.max=rule.max;input.required=true;}
      input.value=value;wrapper.append(label,input);if(rule.hint)wrapper.append(element('small','',rule.hint));$('#part-parameters').append(wrapper);
    }
    $('#part-file-hint').textContent=STATIC_HOSTING?'Your private browser copy; published CSV and PCB design files are unchanged.':component.sourceFile?`Identity → ${component.sourceFile} / ${component.sourceRef}. Model parameters → bom/simulation_parts.csv.`:'Source → bom/simulation_parts.csv. Values remain labeled until a component is specified.';
    $('#research-part').disabled=!codex.available||!!runningJob;$('#research-part').title=codex.available?'Research the saved component using Codex':codex.message||codex.reason||'Codex is not currently available.';
    renderIssues();
  }
  function renderIssues(){
    $('#bom-issues').replaceChildren();const issues=bom?.issues||[];$('#issue-count').textContent=issues.length;
    if(!issues.length)$('#bom-issues').append(element('p','bom-ready','All mapped parameters are ready to resolve.'));
    const seen=new Set();
    for(const issue of issues){const key=`${issue.componentId}:${issue.code}`;if(seen.has(key))continue;seen.add(key);const row=element('div','bom-issue'),body=element('div','',issue.message);row.append(element('span','','!'),body);if(issue.componentId){const btn=element('button','',`Inspect ${partNames[issue.componentId]||issue.componentId} →`);btn.type='button';btn.addEventListener('click',()=>{selectedPart=issue.componentId;partDirty=false;renderParts();message('');});body.append(btn);}$('#bom-issues').append(row);}
    $('#resolve-all').disabled=busyRun||!!runningJob;$('#run-assumptions').disabled=busyRun;
  }
  function renderFiles(){
    const selected=fileId;$('#bom-file').replaceChildren();for(const file of bom.files){const option=element('option','',file.label);option.value=file.id;$('#bom-file').append(option);}$('#bom-file').value=selected;renderRows();
  }
  function renderRows(){
    if(!bom)return;const file=bom.files.find(file=>file.id===fileId);if(!file)return;
    const filter=$('#bom-search').value.toLowerCase().trim();const rows=file.rows.filter(row=>!filter||Object.values(row.values).join(' ').toLowerCase().includes(filter));
    $('#bom-row-count').textContent=`${rows.length} / ${file.rows.length} rows`;$('#bom-table-body').replaceChildren();
    for(const row of rows){const v=row.values,tr=element('tr'),description=v.Value||v.Name||v.Requirement||v.Function||'';const partCell=element('td','',v.MPN||v.MPN_or_procurement_spec||v.Name||v.Value||'Not specified');if(description&&description!==partCell.textContent)partCell.append(element('span','part-description',description.slice(0,125)));tr.append(element('td','',row.reference),partCell,element('td','',v.Manufacturer||'—'),element('td','',v.Quantity||'1'),element('td','',v.Status||v.Assembly||'Recorded BOM row'));const action=element('td'),button=element('button','button button-small','Edit');button.setAttribute('aria-label',`Edit BOM row ${row.reference}`);button.addEventListener('click',()=>openRow(file,row));action.append(button);tr.append(action);$('#bom-table-body').append(tr);}
    if(!rows.length){const row=element('tr'),cell=element('td','empty-row','No matching parts in this BOM.');cell.colSpan=6;row.append(cell);$('#bom-table-body').append(row);}
  }
  async function loadBOM({preserveEdits=false}={}){
    const result=await request('/api/bom');const changed=!!bom&&bom.revision!==result.revision;const oldRevision=bom?.revision;bom=result;
    $('#bom-file-status').textContent=`${bom.files.reduce((n,file)=>n+file.rows.length,0)} rows · ${bom.files.length} CSV files · revision ${bom.revision.slice(0,8)} · loaded ${new Date().toLocaleTimeString()}`;
    if(preserveEdits&&partDirty){if(changed){message('The BOM changed on disk. Your unsaved form is retained; reload before saving.',true);bom.editRevision=oldRevision;}}else if(!preserveEdits||changed){renderParts();renderFiles();}
    if(changed&&activeSource==='bom')$('#active-run-source').textContent='BOM changed on disk · read BOM & run to apply it.';
    return bom;
  }
  async function loadHistory(){
    const result=await request('/api/setups');history=Array.isArray(result)?result:(result.setups||result.snapshots||[]);
    $('#setup-history').replaceChildren();
    for(const setup of history){const p=setup.parameters||{},card=element('article','setup-card'),top=element('div','setup-card-top');top.append(element('span','',setup.source==='v1-session'?'YOUR PRESERVED V1 SESSION':setup.id==='base-v1'?'UNTOUCHED BASE PARAMETERS':(setup.source||'SAVED SETUP').toUpperCase()),element('span','snapshot-mark','↶'));card.append(top,element('h3','',setup.name),element('p','setup-date',shortDate(setup.createdAt||setup.capturedAt)));const stats=element('div','setup-stats');for(const [value,label] of [[`${p.voltage??'—'} kV`,'acceleration'],[`${p.aperture??'—'} µm`,'aperture'],[p.detectorMode==='current'?'LMC662 current':p.detectorMode==='bse'?'Silicon BSE':p.scanMode||'—',['bse','current'].includes(p.detectorMode)?'detector':'scan']]){const span=element('span','',value);span.append(element('small','',label));stats.append(span);}card.append(stats,element('p','setup-specimen',`Specimen · ${getSpecimen(setup.specimenId).name}`));const button=element('button','button','Start this setup →');button.setAttribute('aria-label',`Start setup ${setup.name}`);button.addEventListener('click',()=>loadSetup(setup.id));card.append(button);const details=element('details'),summary=element('summary','','Inspect saved parameters');details.append(summary,element('pre','',JSON.stringify(p,null,2)));card.append(details);$('#setup-history').append(card);}
    if(!history.length)$('#setup-history').append(element('div','empty-history','No saved runs yet. Save the current setup to begin a history.'));
    return history;
  }
  async function loadSetup(id){
    try{const setup=await request(`/api/setups/${encodeURIComponent(id)}`);await api.applySnapshot(setup);setActive(setup.name,setup.source||'snapshot',setup.bomRevision||'');$('#startup-dialog').close();api.showPage(new URLSearchParams(location.search).get('view')==='electrical'?'electrical':'lab');api.toast(`Restored ${setup.name}.`);}catch(error){api.toast(error.message);$('#startup-status').textContent=error.message;}
  }
  function openSave(){const p=api.getSnapshot().parameters;$('#setup-name').value=`${p.voltage} kV · ${p.aperture} µm · ${p.scanMode}`;$('#save-dialog-status').textContent='';$('#save-dialog').showModal();$('#setup-name').select();}
  async function saveCurrent(name,source=activeSource,revision=activeRevision){
    const snapshot=api.getSnapshot();return request('/api/setups',{...snapshot,name,source,bomRevision:revision});
  }
  function openRow(file,row){
    rowEditing={fileId:file.id,rowId:row.id,revision:bom.revision};$('#row-source').textContent=file.path;$('#row-title').textContent=`Edit ${row.reference}`;$('#row-status').textContent='';$('#row-fields').replaceChildren();
    for(const column of file.columns){const value=row.values[column]||'',large=value.length>110||['Notes','Parameters','Requirement','Function'].includes(column),label=element('label',large?'wide':'',column),input=element(large?'textarea':'input');input.dataset.csvColumn=column;input.value=value;input.setAttribute('aria-label',`${column} for ${row.reference}`);if(['Reference','Id','SourceFingerprint'].includes(column)){input.readOnly=true;input.title='Stable row identity is preserved.';}label.append(input);$('#row-fields').append(label);}
    $('#row-dialog').showModal();
  }
  function showResearch(job){
    const out=$('#research-output');out.replaceChildren();const state=job.status||'running';out.append(element('div',`research-state${['queued','running'].includes(state)?' running':''}`,`${partNames[job.componentId]||job.componentId||'Component'} · ${state.replaceAll('_',' ')}`));
    const logs=(job.events||[]).slice(-4).map(event=>typeof event==='string'?event:event.message||event.type||'').filter(Boolean);if(logs.length)out.append(element('div','research-progress-log',logs.join('\n')));
    if(['queued','running','pending'].includes(state)){const cancel=element('button','button','Cancel research');cancel.addEventListener('click',async()=>{cancel.disabled=true;try{await request(`/api/research/${encodeURIComponent(job.id)}/cancel`,{});}catch(error){api.toast(error.message);}});out.append(cancel);}
    if(job.error)out.append(element('p','research-unknowns',typeof job.error==='string'?job.error:job.error.message));
    const result=job.result;if(!result)return;
    out.append(researchSummary(result));
    for(const finding of result.findings||[]){const item=element('div','research-finding');item.append(element('strong','',`${labels[finding.parameter]||finding.parameter}: ${finding.value} ${finding.unit||''}`),element('small','',`${finding.confidence||'unrated'} confidence · ${finding.evidence||''}`));const link=safeLink(finding.sourceUrl);if(link){const a=element('a','',`${finding.sourceTitle||'Source'} ↗`);a.href=link;a.target='_blank';a.rel='noopener noreferrer';item.append(a);}out.append(item);}
    if(result.unknowns?.length)out.append(element('p','research-unknowns',`Still unknown: ${result.unknowns.join(' ')}`));
    for(const source of result.citations||[]){const url=safeLink(source.url);if(url){const a=element('a','research-source',`${source.title||'Primary source'} ↗`);a.href=url;a.target='_blank';a.rel='noopener noreferrer';out.append(a);}}
    if(state==='completed'&&result.findings?.some(f=>f.confidence==='high')){
      const apply=element('button','button','Apply supported findings to BOM');apply.addEventListener('click',async()=>{apply.disabled=true;try{const result=await request(`/api/research/${encodeURIComponent(job.id)}/apply`,{revision:bom.revision});await loadBOM();showResearch(job);api.toast(result.message||'Supported findings saved. Unresolved specifications remain explicit.');}catch(error){out.append(element('p','research-unknowns',error.message));apply.disabled=false;}});out.append(apply);
    }
  }
  async function researchComponent(id,{autoApply=false}={}){
    if(!codex.available)throw new Error(codex.message||codex.reason||'Codex research is unavailable. Use a previous setup or specify reviewed values.');
    if(runningJob)throw new Error('A component is already being researched. Wait for its result.');
    if(partDirty&&selectedPart===id)throw new Error('Save your part edits to the BOM before researching it.');
    const component=bom.components.find(x=>x.id===id);if(!component?.mpn?.trim())throw new Error('Enter an exact part number and save it first. Codex cannot identify an unspecified component.');
    runningJob='pending';$('#research-part').disabled=true;renderIssues();
    try{
      let job=await request('/api/research',{componentId:id});job=job.job||job;const jobId=job.id;runningJob=jobId;showResearch(job);
      const deadline=Date.now()+240000;
      while(['queued','running','pending'].includes(job.status)&&Date.now()<deadline){await new Promise(resolve=>setTimeout(resolve,1100));if(closed)return null;job=await request(`/api/research/${encodeURIComponent(jobId)}`);job=job.job||job;showResearch(job);}
      if(['queued','running','pending'].includes(job.status))throw new Error('Research is still queued. Check the component result before starting from its specifications.');
      if(job.status!=='completed')throw new Error(typeof job.error==='string'?job.error:job.error?.message||'Codex could not resolve this component. Your saved parameters remain available.');
      if(autoApply&&job.result?.findings?.length){await request(`/api/research/${encodeURIComponent(job.id)}/apply`,{revision:bom.revision});await loadBOM();}
      return job;
    }finally{runningJob=null;$('#research-part').disabled=!codex.available;renderIssues();}
  }
  async function runBOM({allowAssumptions=false,research=true}={}){
    if(partDirty){openParts();message('Save your part edits before starting from the BOM.',true);return;}
    if(busyRun)return;busyRun=true;$('#run-bom').disabled=true;$('#parts-run-bom').disabled=true;renderIssues();$('#startup-dialog').close();api.pause(true);
    try{
      await loadBOM();let resolved=await request('/api/resolve-bom',{allowAssumptions});
      if(!resolved.ready&&research&&!allowAssumptions){
        openParts();const ids=[...new Set((resolved.issues||[]).map(issue=>issue.componentId).filter(Boolean))];
        const candidates=ids.map(id=>bom.components.find(c=>c.id===id)).filter(c=>c?.mpn?.trim()&&['needs-research','assumed'].includes(c.status));
        if(candidates.length&&codex.available){for(const component of candidates){message(`Researching ${component.name} before starting…`);await researchComponent(component.id,{autoApply:true});}resolved=await request('/api/resolve-bom',{allowAssumptions:false});}
      }
      if(!resolved.ready){openParts();message('The BOM still contains unspecified or assumed values. Choose exact parts, enter your reviewed parameters, run explicitly with recorded assumptions, or restore a previous setup.',true);api.toast('BOM needs specifications. The simulation is paused; previous setups are available.');return;}
      const mode=allowAssumptions?'BOM · recorded assumptions':'BOM · reviewed parameters';
      const programs=api.getSnapshot();await api.applySnapshot({...programs,operatingState:{requestedBeam:true,roughing:true,turbo:true},parameters:resolved.parameters,name:mode,source:'bom',bomRevision:resolved.revision});setActive(mode,'bom',resolved.revision);api.showPage(new URLSearchParams(location.search).get('view')==='electrical'?'electrical':'lab');
      await saveCurrent(`${mode} · ${new Date().toLocaleTimeString()}`,'bom',resolved.revision);api.toast(allowAssumptions?'Started from the current BOM using its recorded model assumptions.':'Current BOM parameters applied. Simulation started.');
    }catch(error){openParts();message(error.message,true);api.toast(error.message);}
    finally{busyRun=false;$('#run-bom').disabled=false;$('#parts-run-bom').disabled=false;renderIssues();}
  }
  $('#part-editor').addEventListener('input',()=>{partDirty=true;message('Unsaved part edits. Save to update the source BOM.');});
  $('#part-editor').addEventListener('submit',async event=>{
    event.preventDefault();if(!part())return;const button=event.submitter;button.disabled=true;
    try{
      const parameters=Object.fromEntries($$('[data-model-parameter]').map(input=>[input.dataset.modelParameter,input.tagName==='SELECT'?input.value:Number(input.value)]));
      const values={name:$('#part-name').value.trim(),manufacturer:$('#part-manufacturer').value.trim(),mpn:$('#part-mpn').value.trim(),datasheet:$('#part-datasheet').value.trim(),status:$('#part-certainty').value,parameters,notes:$('#part-notes').value};
      bom=await request(`/api/components/${encodeURIComponent(selectedPart)}`,{revision:partRevision,values},'PUT');partDirty=false;await loadBOM();message(STATIC_HOSTING?'Saved to your browser BOM. Read BOM & run applies it to the simulation.':'Saved to the BOM on disk. Read BOM & run applies this part to the simulation.');api.toast(STATIC_HOSTING?'Part saved in this browser. Published files are unchanged.':'Part saved to its source BOM. A backup was retained.');
    }catch(error){message(error.message,true);}finally{button.disabled=false;}
  });
  $('#row-form').addEventListener('submit',async event=>{event.preventDefault();if(!rowEditing)return;event.submitter.disabled=true;try{const values=Object.fromEntries($$('[data-csv-column]').map(input=>[input.dataset.csvColumn,input.value]));await request(`/api/bom/${encodeURIComponent(rowEditing.fileId)}/${encodeURIComponent(rowEditing.rowId)}`,{revision:rowEditing.revision,values},'PUT');partDirty=false;await loadBOM();$('#row-dialog').close();api.toast('BOM row saved. Linked component identity reloaded.');}catch(error){$('#row-status').textContent=error.message;}finally{event.submitter.disabled=false;}});
  $('#save-dialog-form').addEventListener('submit',async event=>{event.preventDefault();const button=event.submitter;button.disabled=true;try{const setup=await saveCurrent($('#setup-name').value.trim());setActive(setup.name,activeSource,activeRevision);$('#save-dialog').close();await loadHistory();api.toast('Setup saved. You can start it again even after the BOM changes.');}catch(error){$('#save-dialog-status').textContent=error.message;}finally{button.disabled=false;}});
  $$('[data-close-dialog]').forEach(button=>button.addEventListener('click',()=>document.getElementById(button.dataset.closeDialog).close()));
  $$('[data-parts-view]').forEach(button=>button.addEventListener('click',()=>partsView(button.dataset.partsView)));
  $('#bom-file').addEventListener('change',event=>{fileId=event.target.value;renderRows();});$('#bom-search').addEventListener('input',renderRows);
  $('#reload-bom').addEventListener('click',()=>{partDirty=false;loadBOM().then(()=>{message(STATIC_HOSTING?'Reloaded your saved browser BOM.':'Reloaded the latest CSV files from disk.');api.toast(STATIC_HOSTING?'Browser BOM reloaded.':'BOM reloaded from disk.');}).catch(error=>message(error.message,true));});
  $('#research-part').addEventListener('click',()=>researchComponent(selectedPart).catch(error=>{message(error.message,true);api.toast(error.message);}));
  $('#run-bom').addEventListener('click',()=>runBOM());$('#parts-run-bom').addEventListener('click',()=>runBOM());$('#resolve-all').addEventListener('click',()=>runBOM());$('#run-assumptions').addEventListener('click',()=>runBOM({allowAssumptions:true,research:false}));
  $('#start-from-bom').addEventListener('click',()=>runBOM());$('#start-previous').addEventListener('click',async()=>{if(!previous)return api.toast('Previous parameters are not yet available.');if(localFallback){await api.applySnapshot(previous);setActive(previous.name,'v1-session');$('#startup-dialog').close();}else await loadSetup(previous.id);});
  $('#load-saved').addEventListener('click',()=>{api.showPage('parts');partsView('history');window.scrollTo({top:0,behavior:'smooth'});});
  $('#save-setup').addEventListener('click',openSave);$('#history-save').addEventListener('click',openSave);
  async function initialize(){
    api.pause(true);$('#startup-dialog').showModal();$('#start-previous').disabled=true;
    const results=await Promise.allSettled([loadBOM(),loadHistory(),request('/api/research/status')]);
    if(results[2].status==='fulfilled')codex=results[2].value;else codex={available:false,message:results[2].reason.message};
    $('#codex-connection').textContent=STATIC_HOSTING?'Browser edition · research available in localhost edition':codex.available?'Codex connected · component research ready':'Codex unavailable · previous setups remain usable';$('#codex-connection').className=`connection-state ${codex.available?'connected':'unavailable'}`;
    if(results[0].status==='rejected'){$('#bom-file-status').textContent=results[0].reason.message;$('#startup-status').textContent=results[0].reason.message;}
    if(results[1].status==='fulfilled'){
      previous=history.find(s=>s.id==='previous-v1-session')||history[0];
      // Once user-created runs exist, prefer the newest actual saved run over migration.
      const saved=history.filter(s=>!['base-v1','previous-v1-session'].includes(s.id));if(saved.length)previous=saved[0];
      if(previous){$('#startup-previous strong').textContent=previous.name;$('#startup-summary').textContent=`${previous.parameters.voltage} kV · ${previous.parameters.aperture} µm aperture · ${previous.parameters.scanMode}`;$('#start-previous').disabled=false;}
    }else{
      $('#startup-status').textContent=STATIC_HOSTING?'Browser history could not load. Allow site storage, or use an imaging preset.':'Local history could not load. Start the v2 server to use the BOM and saved runs.';
      try{previous=await request('/previous-session.json');localFallback=true;$('#startup-previous strong').textContent=previous.name;$('#startup-summary').textContent=`${previous.parameters.voltage} kV · ${previous.parameters.aperture} µm · ${previous.parameters.scanMode}`;$('#start-previous').disabled=false;}catch{}
    }
    if(STATIC_HOSTING){$('#startup-status').textContent='Saved only in this browser. Export a setup to keep a separate copy.';$('#resolve-all').textContent='Review BOM & run';$('#research-output').replaceChildren(element('p','research-summary','Component research needs the localhost server and your own Codex session. This public demo cannot call an authenticated Codex session.'));const local=element('a','research-source','Run locally →');local.href='run-locally.html';$('#research-output').append(local);}
    if(bom)renderParts();
    pollingTimer=setInterval(()=>{if(!closed&&!document.hidden&&!runningJob&&!busyRun)loadBOM({preserveEdits:true}).catch(()=>{});},15000);
  }
  initialize().catch(error=>{$('#startup-status').textContent=error.message;api.toast(error.message);});
  async function usePreset(snapshot){
    if(runDirty)await saveCurrent(`Before ${snapshot.name}`);
    await api.applySnapshot(snapshot);setActive(snapshot.name,'preset');$('#startup-dialog').close();api.showPage('lab');
  }
  return {openPart:openParts,markDirty,usePreset,refresh:()=>loadBOM(),destroy(){closed=true;clearInterval(pollingTimer);document.removeEventListener('beam-parameters-changed',markDirty);}};
}
