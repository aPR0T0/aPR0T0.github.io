const f=x=>Number.isFinite(x)?Number(x.toFixed(2)):'—';
export function updateMountView(root,p,bse) {
  const g=bse.placement, s=6, originX=90,base=238, angle=g.tilt*Math.PI/180;
  const x=originX+g.offset*s,y=base-g.height*s;
  const point=(u,v=0)=>[x+s*(u*Math.cos(angle)-v*Math.sin(angle)),y+s*(u*Math.sin(angle)+v*Math.cos(angle))];
  const points=(a,b,t)=>[point(a,-t),point(b,-t),point(b,t),point(a,t)].map(q=>q.join(',')).join(' ');
  const left=originX+(g.scan.minX-g.beamAllowance)*s,right=originX+(g.scan.maxX+g.beamAllowance)*s;
  const beamX=originX+g.scan.centre*s,colour=g.side&&!g.mountClear?'#f1aa79':'#76d9c6';
  // Auto-fit extreme control values; text remains a schematic annotation.
  const extra=Math.max(0,x+90-490),top=Math.min(0,y-100);
  root.querySelector('svg').setAttribute('viewBox',`0 ${top} ${500+extra} ${290-top}`);
  root.querySelector('svg').innerHTML=`
    <defs><marker id="mount-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0L6 3L0 6" fill="none" stroke="#e6bd7b"/></marker></defs>
    <g font-family="system-ui,sans-serif" font-size="11" fill="#b8d0d5">
      <path d="M30 ${base}H${480+extra}" stroke="#829399" stroke-width="2"/><text x="30" y="${base+18}">SPECIMEN PLANE</text>
      <rect x="${left}" y="${top+24}" width="${Math.max(1,right-left)}" height="${base-top-24}" fill="#6ee6d632" stroke="#6ee6d677" stroke-dasharray="3 3"/>
      <path d="M${originX} ${top+20}V${base}" stroke="#71e9d7"/><text x="20" y="${top+13}">Primary beam envelope</text><text x="${300+extra}" y="${top+13}" fill="#e6bd7b">Gold: electron-sensitive face</text>
      <polygon points="${points(-12.5-g.margin,12.5+g.margin,.5+g.margin)}" fill="${colour}0d" stroke="${colour}" stroke-dasharray="4 4"/>
      <polygon points="${points(-12.5,-1,.5)}" fill="#5c6b7c" stroke="#a5b2c2"/><polygon points="${points(1,12.5,.5)}" fill="#5c6b7c" stroke="#a5b2c2"/>
      <path d="M${point(-5,.65)}L${point(-1,.65)}M${point(1,.65)}L${point(5,.65)}" stroke="#e6bd7b" stroke-width="3"/>
      <path d="M${beamX} ${base-2}L${point(-3,1)}" fill="none" stroke="#e6bd7b" stroke-dasharray="4 4" marker-end="url(#mount-arrow)"/>
      <circle cx="${x}" cy="${y}" r="2" fill="#f5dfb4"/>
      <path d="M${x} ${y}h70" stroke="#65838e"/><text x="${x+75}" y="${y-8}">S11141-10</text><text x="${x+75}" y="${y+9}">tilt ${f(g.tilt)}°</text>
      <path d="M${originX} ${base+32}H${x}" stroke="#65838e"/><text x="${(originX+x)/2}" y="${base+47}" text-anchor="middle">offset ${f(g.offset)} mm</text>
      <path d="M${380+extra} ${y}h8M${384+extra} ${y}V${base}M${380+extra} ${base}h8" fill="none" stroke="#65838e"/><text x="${390+extra}" y="${(y+base)/2}">${f(g.height)} mm</text>
      <text x="${300+extra}" y="${base+17}" fill="${colour}">${g.side?'Dashed box: mount allowance':'Hole route needs its own check'}</text>
    </g>`;
  root.querySelector('#mount-range').textContent=`${f(g.range)} mm`;
  root.querySelector('#mount-clearance').textContent=g.side?`${f(g.clearance)} mm`:'Through hole';
  root.querySelector('#mount-aim').textContent=`${f(g.aimError)}°`;
  root.querySelector('#mount-note').textContent=g.side
    ? `Inside the vacuum chamber. ${g.status}. ${g.mountClear?'Primary beam bypasses the detector; the hole only removes collection area.':'Adjust the mount before treating this geometry as usable.'}`
    : 'Inside the vacuum chamber. Centred comparison: the primary beam uses the 2 mm hole. Finite beam clipping through that hole is not simulated.';
  root.classList.toggle('mount-warning',g.side&&!g.mountClear||!g.valid);
}
