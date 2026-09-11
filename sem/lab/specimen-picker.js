import {SPECIMENS, getSpecimen, createSpecimenSampler} from './specimens.js';

/** Specimen thumbnails show an ideal pattern; only the acquisition canvas scans it. */
export function mountSpecimenPicker({onSelect, onFit}) {
  const select=document.querySelector('#specimen-select');
  const dialog=document.querySelector('#specimen-library');
  const grid=document.querySelector('#specimen-library-grid');
  let selectedId=null, detectorMode=null;
  for(const item of SPECIMENS){
    const option=document.createElement('option');option.value=item.id;option.textContent=item.name;select.append(option);
    const card=document.createElement('button');card.type='button';card.className='specimen-card';card.dataset.specimen=item.id;
    card.setAttribute('aria-label',`Scan ${item.name}`);card.setAttribute('aria-pressed','false');
    const canvas=document.createElement('canvas');canvas.width=200;canvas.height=160;canvas.setAttribute('aria-hidden','true');
    const ctx=canvas.getContext('2d'),image=ctx.createImageData(canvas.width,canvas.height),sample=createSpecimenSampler(item.id);
    // The same physical coordinate sampler supplies thumbnails and the live scan.
    for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
      const v=sample((x/(canvas.width-1)-.5)*item.fieldWidthUm,(y/(canvas.height-1)-.5)*item.fieldWidthUm*canvas.height/canvas.width,true);
      const i=(y*canvas.width+x)*4;image.data[i]=v;image.data[i+1]=v;image.data[i+2]=v;image.data[i+3]=255;
    }
    ctx.putImageData(image,0,0);
    const body=document.createElement('div');body.className='specimen-card-body';
    const category=document.createElement('span');category.className='specimen-card-category';category.textContent=item.category;
    const title=document.createElement('strong');title.textContent=item.name;
    const description=document.createElement('p');description.textContent=item.description;
    const footer=document.createElement('span');footer.className='specimen-card-footer';footer.textContent=`${item.fieldWidthUm} µm preview width · Select →`;
    body.append(category,title,description,footer);card.append(canvas,body);
    card.addEventListener('click',()=>{onSelect(item.id);dialog.close();select.focus();});grid.append(card);
  }
  select.addEventListener('change',()=>onSelect(select.value));
  document.querySelector('#fit-specimen').addEventListener('click',onFit);
  document.querySelector('#browse-specimens').textContent=`Browse all ${SPECIMENS.length} ↗`;
  document.querySelector('#browse-specimens').addEventListener('click',()=>{dialog.showModal();dialog.scrollTop=0;});
  document.querySelector('#close-specimen-library').addEventListener('click',()=>dialog.close());
  return {sync(id,mode){
    if(id===selectedId&&mode===detectorMode)return;
    const item=getSpecimen(id);selectedId=item.id;detectorMode=mode;select.value=item.id;
    document.querySelector('#specimen-description').textContent=item.description;
    document.querySelector('#specimen-fit-width').textContent=`Overview field: ${item.fieldWidthUm} µm`;
    document.querySelector('.specimen-label').textContent=item.name.toUpperCase();
    document.querySelector('#specimen-canvas').setAttribute('aria-label',`Synthetic ${mode==='current'?'specimen-current':mode==='bse'?'backscattered-electron':'secondary-electron'} scan of ${item.name}. Illustrative contrast; not measured specimen data.`);
    for(const card of grid.querySelectorAll('[data-specimen]')){const active=card.dataset.specimen===item.id;card.classList.toggle('selected',active);card.setAttribute('aria-pressed',String(active));}
  }};
}
