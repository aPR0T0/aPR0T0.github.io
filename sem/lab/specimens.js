/** Fast, deterministic teaching specimens in physical x/y coordinates (µm).
 * Intensities are illustrations, not measured yields, heights or material data.
 * Detector response, beam blur, grain and acquisition noise belong to the caller.
 */
export const DEFAULT_SPECIMEN_ID = 'calibration';

export const SPECIMENS = Object.freeze([
  { id:'calibration', name:'Calibration grid', category:'Reference pattern',
    description:'The original synthetic grid of rotated squares and circles.',
    featureHint:'Compare edges, repeated features and scan distortion. This is an illustrative target, not a certified calibration standard.', fieldWidthUm:350 },
  { id:'butterfly-wing', name:'Butterfly wing', category:'Biology inspired',
    description:'Synthetic overlapping scale shapes with longitudinal ridges and cross-ribs, inspired by butterfly wings.',
    featureHint:'Fit the scale array, then narrow the field to inspect its ridges. Geometry and intensity are illustrative, not measurements of a species.', fieldWidthUm:240 },
  { id:'spheres', name:'Spherical particles', category:'Particle pattern',
    description:'A synthetic layer of differently sized, shaded circular particles.',
    featureHint:'Inspect particle boundaries and gaps. Shading suggests curved surfaces but does not simulate particle height or electron yield.', fieldWidthUm:160 },
  { id:'diatom', name:'Porous diatom disc', category:'Biology inspired',
    description:'A synthetic circular shell with a rim, radial ribs and a regular pore array, inspired by diatoms.',
    featureHint:'Compare the bright rim, pores and central region. This is an invented pattern, not a measured diatom or depth map.', fieldWidthUm:190 },
  { id:'metal-grains', name:'Metal grains', category:'Material inspired',
    description:'Synthetic polygonal grains with distinct intensities, boundaries and oriented polishing-like lines.',
    featureHint:'Inspect grain boundaries and within-grain texture. Intensities do not encode composition, crystal orientation or a specific alloy.', fieldWidthUm:220 },
  { id:'microchip', name:'Microchip traces', category:'Fabricated pattern',
    description:'A synthetic chip-like pattern with a central cell array, narrow tracks and terminal pads.',
    featureHint:'Follow the tracks and compare neighboring cells. This is illustrative geometry, not a circuit layout or a manufactured device.', fieldWidthUm:120 },
  { id:'fibers', name:'Fiber mesh', category:'Material inspired',
    description:'Synthetic curved strands crossing in several directions with visible gaps and overlap.',
    featureHint:'Inspect strand edges, crossings and open spaces. Width and shading are illustrative, not measured fibers or surface heights.', fieldWidthUm:220 },
].map(Object.freeze));

const BY_ID = new Map(SPECIMENS.map(specimen => [specimen.id,specimen]));
export function getSpecimen(id) { return BY_ID.get(id) || BY_ID.get(DEFAULT_SPECIMEN_ID); }

const TAU = Math.PI * 2;
const wrap = value => ((value % 1) + 1) % 1;
const clamp = (value,lo,hi) => Math.max(lo,Math.min(hi,value));
// Integer hashing varies feature placement, never per-sample acquisition noise.
function cellHash(x,y,seed=0) {
  let value = Math.imul(x,374761393) ^ Math.imul(y,668265263) ^ Math.imul(seed+1,1442695041);
  value = Math.imul(value ^ (value >>> 13),1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

function calibration(x,y,enhanceEdges) {
  const px=x/350,py=y/350,a=px*.97+py*.24,b=py*.97-px*.24;
  const gx=wrap(a*5+.5)-.5,gy=wrap(b*5+.5)-.5;
  const radius=Math.hypot(gx,gy),square=Math.max(Math.abs(gx),Math.abs(gy));
  const isCircle=Math.floor((a+1)*5)%3===0;
  const edge=Math.abs((isCircle?radius:square)-.28);
  let value=32+((isCircle?radius:square)<.28?95:0);
  if(enhanceEdges)value+=Math.exp(-edge*100)*75;
  if(Math.abs(gy)<.027&&Math.abs(gx)>.3)value+=25;
  return value;
}

function butterflyWing(x,y,enhanceEdges) {
  const px=x*.985+y*.174,py=y*.985-x*.174;
  const row=Math.floor(py/60);
  // Frontmost row is considered first so neighboring scale ellipses overlap.
  for(let r=row+1;r>=row-1;r--) {
    const stagger=(r&1)*.5,column=Math.round(px/54-stagger);
    for(let c=column-1;c<=column+1;c++) {
      const dx=px-(c+stagger)*54,dy=py-r*60;
      const halfWidth=23+cellHash(c,r)*3,halfLength=44;
      const u=dx/halfWidth,v=dy/halfLength,d2=u*u+v*v;
      if(d2>=1)continue;
      const body=Math.sqrt(1-d2);
      const ridge=Math.max(0,Math.cos((dx+1.3*Math.sin(dy/32))*TAU/3.4));
      const rib=Math.abs(wrap((dy+dx*.1)/8.5+.5)-.5)<.075;
      const edge=Math.abs(1-Math.sqrt(d2));
      let value=45+92*body+28*ridge**6-(rib?11:0)+(cellHash(c,r,8)-.5)*20;
      if(edge<.055)value-=18;
      if(enhanceEdges)value+=36*Math.exp(-edge*24);
      return value;
    }
  }
  return 26;
}

function spheres(x,y,enhanceEdges) {
  const cellX=Math.floor(x/33),cellY=Math.floor(y/31);
  let value=27,bestDepth=-1;
  for(let cy=cellY-1;cy<=cellY+1;cy++)for(let cx=cellX-1;cx<=cellX+1;cx++) {
    const px=(cx+.5)*33+(cellHash(cx,cy,1)-.5)*10;
    const py=(cy+.5)*31+(cellHash(cx,cy,2)-.5)*9;
    const radius=8+cellHash(cx,cy,3)*8,dx=(x-px)/radius,dy=(y-py)/radius;
    const d2=dx*dx+dy*dy;
    if(d2>=1)continue;
    const depth=Math.sqrt(1-d2);
    if(depth<bestDepth)continue;
    bestDepth=depth;
    value=56+112*depth-32*dx-27*dy;
    if(enhanceEdges)value+=55*Math.exp(-(1-Math.sqrt(d2))*28);
  }
  return value;
}

function diatom(x,y,enhanceEdges) {
  const radius=Math.hypot(x,y),outer=77;
  if(radius>outer)return 25;
  let value=112+10*Math.cos(radius*.35);
  if(radius>outer-7) {
    value=130+48*Math.sin((outer-radius)*Math.PI/7);
    if(enhanceEdges)value+=30*Math.exp(-(outer-radius)*.6);
    return value;
  }
  if(radius<9)return 160+18*Math.cos(radius*Math.PI/18);
  const angle=Math.atan2(y,x);
  if(Math.abs(Math.sin(angle*12))<.075)value+=25;
  const pitch=9.7,rowPitch=pitch*Math.sqrt(3)/2,row=Math.round(y/rowPitch);
  let nearest=Infinity;
  for(let r=row-1;r<=row+1;r++) {
    const c=Math.round(x/pitch-(r&1)*.5),cx=(c+(r&1)*.5)*pitch,cy=r*rowPitch;
    const centerRadius=Math.hypot(cx,cy);
    if(centerRadius<13||centerRadius>outer-12)continue;
    const dx=x-cx,dy=y-cy;
    nearest=Math.min(nearest,dx*dx+dy*dy);
  }
  if(nearest<2.45**2)return 25+10*nearest/(2.45**2);
  if(nearest<3.35**2)value+=35;
  if(enhanceEdges&&nearest<4.5**2)value+=28*Math.exp(-Math.abs(Math.sqrt(nearest)-2.6)*2);
  return value;
}

function metalGrains(x,y,enhanceEdges) {
  const pitch=34,gx=Math.floor(x/pitch),gy=Math.floor(y/pitch);
  let first=Infinity,second=Infinity,firstX=0,firstY=0,secondX=0,secondY=0,grainX=0,grainY=0;
  for(let cy=gy-1;cy<=gy+1;cy++)for(let cx=gx-1;cx<=gx+1;cx++) {
    const sx=(cx+.5+(cellHash(cx,cy,4)-.5)*.74)*pitch;
    const sy=(cy+.5+(cellHash(cx,cy,5)-.5)*.74)*pitch;
    const d2=(x-sx)**2+(y-sy)**2;
    if(d2<first) {
      second=first;secondX=firstX;secondY=firstY;
      first=d2;firstX=sx;firstY=sy;grainX=cx;grainY=cy;
    }else if(d2<second){second=d2;secondX=sx;secondY=sy;}
  }
  const boundary=(second-first)/(2*Math.hypot(secondX-firstX,secondY-firstY));
  const angle=cellHash(grainX,grainY,6)*Math.PI;
  let value=68+cellHash(grainX,grainY,7)*100+7*Math.cos((x*Math.cos(angle)+y*Math.sin(angle))*TAU/5.6);
  if(boundary<.7)value=27+boundary*32;
  if(enhanceEdges)value+=40*Math.exp(-boundary*1.8);
  return value;
}

function microchip(x,y,enhanceEdges) {
  const ax=Math.abs(x),ay=Math.abs(y),edge=Math.max(ax,ay);
  if(edge<22) {
    if(edge>20)return enhanceEdges?188:145;
    const gx=Math.abs(wrap(x/4+.5)-.5),gy=Math.abs(wrap(y/4+.5)-.5);
    if(ax<1.2||ay<1.2)return 50;
    return gx<.105||gy<.105?58:(enhanceEdges?169:147);
  }
  let value=27;
  for(let side=0;side<4;side++) {
    const normal=side===0?x:side===1?-x:side===2?y:-y;
    const tangent=side<2?y:x;
    const track=Math.round(tangent/5),delta=Math.abs(tangent-track*5);
    if(Math.abs(track)>3||normal<22)continue;
    const end=43+(Math.abs(track)%2)*5;
    if(normal<=end&&delta<.85)value=Math.max(value,enhanceEdges?198:164);
    if(Math.abs(normal-end)<2.2&&delta<2.1)value=Math.max(value,enhanceEdges?215:184);
  }
  const cornerX=ax-43,cornerY=ay-43;
  if(Math.abs(cornerX)<7&&Math.abs(cornerY)<7) {
    const rim=Math.max(Math.abs(cornerX),Math.abs(cornerY));
    value=rim>5?(enhanceEdges?207:169):91;
  }
  return value;
}

const FIBER_DIRECTIONS=Object.freeze([[.88,.475,32,4.3],[.78,-.626,39,5.4],[.08,.997,61,3.3]]);
function fibers(x,y,enhanceEdges) {
  let value=25;
  for(let family=0;family<FIBER_DIRECTIONS.length;family++) {
    const [cos,sin,pitch,halfWidth]=FIBER_DIRECTIONS[family];
    const along=x*cos+y*sin,across=-x*sin+y*cos;
    const bent=across+2*Math.sin(along/37+family*1.9);
    const distance=Math.abs(wrap(bent/pitch+.5)-.5)*pitch;
    if(distance>=halfWidth)continue;
    const cross=distance/halfWidth;
    // Fixed family ordering gives an explicit illustrated overlap, not depth data.
    value=70+94*Math.sqrt(1-cross*cross)+8*Math.cos(bent*TAU/1.7);
    if(enhanceEdges)value+=42*Math.exp(-(halfWidth-distance)*1.8);
  }
  return value;
}

const SAMPLERS=Object.freeze({calibration,'butterfly-wing':butterflyWing,spheres,diatom,'metal-grains':metalGrains,microchip,fibers});

/** Sample ideal intensity at micrometer coordinates, independent of raster size. */
export function createSpecimenSampler(id=DEFAULT_SPECIMEN_ID) {
  const sample=SAMPLERS[getSpecimen(id).id];
  return (xUm,yUm,enhanceEdges=false) => {
    if(!Number.isFinite(xUm)||!Number.isFinite(yUm))return 25;
    return clamp(sample(xUm,yUm,Boolean(enhanceEdges)),20,220);
  };
}
