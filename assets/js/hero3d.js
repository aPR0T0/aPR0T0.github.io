/* =====================================================================
   hero3d.js — the WebGL volumetric cloudscape backdrop (DESKTOP ONLY).
   Loaded via dynamic import so touch/mobile devices never download three.js
   or pay the GPU cost. The hero NAME is now a pure-CSS glossy title with a
   toss-&-catch juggle reveal (see nameSlot.js); this module just paints the
   sky behind it and drives the reveal/parallax/boot timing.
   ===================================================================== */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { buildSlots, runSlots } from './nameSlot.js';

export function initHero3d(){
  const REDUCED = matchMedia('(prefers-reduced-motion:reduce)').matches;
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));

  /* build the toss-&-catch "juggle" cells now (animated later, on reveal);
     dataset.name on each .nl preserves the real text for accessibility */
  const heroNameEl=document.getElementById('heroName');
  const nameCells=buildSlots(heroNameEl);

  const bg=document.getElementById('bg');
  const renderer=new THREE.WebGLRenderer({canvas:bg,antialias:false,powerPreference:'high-performance'});
  const DPR_HERO=Math.min(devicePixelRatio,1.5);
  renderer.setPixelRatio(DPR_HERO);
  renderer.setSize(innerWidth,innerHeight);
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.06;

  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,0.1,100);
  camera.position.set(0,0,7);

  const CLOUD_STEPS=24;
  const cloudUniforms={ uTime:{value:0}, uRes:{value:new THREE.Vector2(innerWidth,innerHeight)}, uDir:{value:new THREE.Vector2(0,0)}, uReveal:{value:0} };
  const cloudMat=new THREE.ShaderMaterial({
    uniforms:cloudUniforms, depthTest:false, depthWrite:false,
    vertexShader:`varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }`,
    fragmentShader:`precision highp float; varying vec2 vUv;
      uniform float uTime,uReveal; uniform vec2 uRes,uDir;
      float hash(vec3 p){ p=fract(p*0.3183099+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
      float noise(vec3 x){ vec3 i=floor(x),f=fract(x); f=f*f*(3.0-2.0*f);
        return mix(mix(mix(hash(i+vec3(0,0,0)),hash(i+vec3(1,0,0)),f.x),
                       mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
                       mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z); }
      float fbm(vec3 p){ float v=0.0,a=0.5; for(int i=0;i<4;i++){ v+=a*noise(p); p=p*2.02; a*=0.5; } return v; }
      float dens(vec3 p){ return clamp(fbm(p*0.38)*2.7-1.25,0.0,1.0); }
      void main(){
        vec2 uv=vUv*2.0-1.0; uv.x*=uRes.x/uRes.y;
        vec3 ldir=normalize(vec3(0.55,0.66,0.30));
        vec3 fwd=normalize(vec3(uDir.x*0.40, uDir.y*0.26, 1.0));
        vec3 right=normalize(cross(vec3(0.0,1.0,0.0),fwd));
        vec3 up=cross(fwd,right);
        float roll=-uDir.x*0.20;
        vec3 r2=right*cos(roll)+up*sin(roll);
        vec3 u2=up*cos(roll)-right*sin(roll);
        float focal=mix(1.6,1.25,smoothstep(0.0,1.0,uReveal));
        vec3 rd=normalize(r2*uv.x + u2*uv.y + fwd*focal);
        vec3 ro=vec3(0.0,0.0,uTime*2.2);
        float h=clamp(rd.y*0.5+0.5,0.0,1.0);
        vec3 sky=mix(vec3(0.71,0.86,0.99), vec3(0.10,0.40,0.92), pow(h,0.62));
        vec3 col=sky; float trans=1.0; float t=1.0;
        for(int i=0;i<${CLOUD_STEPS};i++){
          vec3 p=ro+rd*t;
          float d=dens(p);
          if(d>0.01){
            float sh=dens(p+ldir*0.30)*1.0 + dens(p+ldir*0.70)*0.6 + dens(p+ldir*1.30)*0.35;
            float shadow=exp(-sh*1.7);
            float powder=1.0-exp(-d*3.0);
            vec3 shade=vec3(0.26,0.36,0.55);
            vec3 lit=mix(shade, vec3(1.04,1.04,1.06), shadow);
            lit*=mix(0.7,1.0,powder);
            float a=d*0.72;
            col=mix(col, lit, a*trans);
            trans*=1.0-a;
            if(trans<0.02) break;
          }
          t+=0.24*(1.0+t*0.05);
        }
        col=mix(col, sky, smoothstep(22.0,42.0,t)*0.4);
        gl_FragColor=vec4(col,1.0);
      }`
  });
  const cloudQuad=new THREE.Mesh(new THREE.PlaneGeometry(2,2), cloudMat);
  cloudQuad.frustumCulled=false; cloudQuad.renderOrder=-1; scene.add(cloudQuad);

  const composer=new EffectComposer(renderer);
  composer.setPixelRatio(DPR_HERO); composer.setSize(innerWidth,innerHeight);
  composer.addPass(new RenderPass(scene,camera));
  const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight), 0.5, 0.7, 0.82);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  /* reveal + scroll + parallax + boot */
  let revealT=0, started=false, scrollProg=0, revealStart=0;
  let parX=0,parY=0,parXt=0,parYt=0;
  const heroCopy=document.getElementById('heroCopy'), descend=document.getElementById('descend'), veil=document.getElementById('veil');
  function startReveal(){ if(started) return; started=true; revealStart=performance.now();
    heroCopy.classList.add('live');               // copy fades in as the letters toss
    runSlots(nameCells,{reduced:REDUCED});         // toss-&-catch the name in
    setTimeout(()=>descend.classList.add('live'), REDUCED?0:1500); }
  addEventListener('scroll',()=>{ scrollProg=Math.min(scrollY/(innerHeight*0.95),1); if(veil) veil.style.opacity=(scrollProg*0.96).toFixed(3); },{passive:true});
  addEventListener('pointermove',e=>{ if(e.pointerType==='touch')return; parXt=(e.clientX/innerWidth-0.5); parYt=(e.clientY/innerHeight-0.5); });

  const clock=new THREE.Clock(); let heroVisible=true,paused=false;
  new IntersectionObserver(es=>{heroVisible=es[0].isIntersecting;},{threshold:0.01}).observe(document.querySelector('.hero'));
  document.addEventListener('visibilitychange',()=>paused=document.hidden);

  function tick(){
    requestAnimationFrame(tick);
    if(paused||!heroVisible) return;
    const t=clock.getElapsedTime();
    if(started&&!REDUCED) revealT=clamp((performance.now()-revealStart)/2600,0,1);
    parX+=(parXt-parX)*0.03; parY+=(parYt-parY)*0.03;
    cloudUniforms.uTime.value=t; cloudUniforms.uDir.value.set(parX,-parY); cloudUniforms.uReveal.value=revealT;
    composer.render();
  }
  tick();
  let rzT; addEventListener('resize',()=>{
    camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth,innerHeight); composer.setSize(innerWidth,innerHeight);
    bloom.setSize(innerWidth,innerHeight); cloudUniforms.uRes.value.set(innerWidth,innerHeight);
    clearTimeout(rzT);
  });

  const boot=document.getElementById('boot'),bootLine=document.getElementById('bootLine');
  const bootMsgs=['Boarding…','Climbing through the deck…','Cruising altitude'];
  let bi=0; const bootInt=setInterval(()=>{bi=Math.min(bi+1,bootMsgs.length-1); if(bootLine) bootLine.textContent=bootMsgs[bi];},700);
  let revealed=false;
  function reveal(){ if(revealed) return; revealed=true; clearInterval(bootInt); if(boot) boot.classList.add('gone'); startReveal(); }
  if(REDUCED) startReveal();
  setTimeout(reveal, 900);
  setTimeout(()=>{ if(!revealed) reveal(); },9000);
}
