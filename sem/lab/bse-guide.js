import {request} from './workspace.js';
import { DEFAULTS } from './physics.js';
import { calculateBSE } from './bse.js';
import { updateMountView } from './mount-view.js';
const status=document.querySelector('#bse-bom-status');
try{const data=await request('/api/bom'),part=data.components.find(item=>item.id==='detector');const parameters=Object.assign({...DEFAULTS},...data.components.map(item=>item.parameters||{}));updateMountView(document.querySelector('#mounting'),parameters,calculateBSE(parameters));status.textContent=part?`Workspace BOM · ${part.mpn||part.name} · ${part.status} · amplifier and collection assumptions require validation.`:'No detector mapping found in the local BOM.';}catch{status.textContent='Local BOM unavailable. Run the Beam Lab server to load the selected part.';}
