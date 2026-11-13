/** Check the VLA pipeline page: vendored three.js, script order, the nine scenes, theme, entry points and links. Runs without a server. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=name=>fs.readFile(path.join(root,name),'utf8');
const page='vla/index.html';
const html=await read(page);

// three.js r128 (global build) + OrbitControls, same bytes as the Phased Array Bench copy
const VENDOR={
  'vla/vendor/three.min.js':'9274bbcec8d96168626c732b5d31c775aa8cfb7eaa0599bec0c175908a2c1ce2',
  'vla/vendor/OrbitControls.js':'02bb4ade710f3e607329e37a21f098bc3ac70eb6e33daf8a65e79f4db785e7b2',
};
for(const [file,sha] of Object.entries(VENDOR)){
  const bytes=await fs.readFile(path.join(root,file));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),sha,`Hash mismatch: ${file}`);
}
const ORDER=['vendor/three.min.js','vendor/OrbitControls.js','engine.js','robots.js','scenes-train.js','scenes-deploy.js','page.js'];
const scripts=[...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/g)].map(m=>m[1]);
assert.deepEqual(scripts,ORDER,'VLA page loads its scripts in dependency order');

// every script parses; the scene files register all nine scenes with a camera, caption and build()
const sources={};
for(const s of ORDER.slice(2)){sources[s]=await read('vla/'+s);new vm.Script(sources[s],{filename:'vla/'+s});}
const ctx=vm.createContext({window:{THREE:{}},document:{documentElement:{getAttribute:()=> 'light'}},THREE:{}});
ctx.window.VLA=undefined; ctx.VLA=undefined;
vm.runInContext('window.VLA = {}; var VLA = window.VLA;',ctx);
for(const s of ['robots.js','scenes-train.js','scenes-deploy.js'])vm.runInContext(sources[s],ctx,{filename:s});
const scenes=vm.runInContext('VLA.scenes',ctx);
assert.equal(scenes.length,9,'Nine scenes: overview + eight stages');
const ids=['overview','vlm','data','vla','post','rl','eval','edge','deploy'];
scenes.forEach((s,i)=>{
  assert.ok(s,`Scene ${i} is registered`);
  assert.equal(s.id,ids[i],`Scene ${i} is ${ids[i]}`);
  assert.equal(typeof s.build,'function',`Scene ${s.id} has build()`);
  assert.ok(s.caption&&s.title&&s.sub,`Scene ${s.id} has a title, subtitle and caption`);
  assert.ok(Array.isArray(s.cam.pos)&&Array.isArray(s.cam.target),`Scene ${s.id} has a camera`);
});
assert.equal(vm.runInContext('VLA.STAGES.length',ctx),8,'Eight pipeline stages');

// the article has a step for every scene, and the stage strip and map point at real scenes
const steps=[...html.matchAll(/<section class="step" id="([^"]+)" data-scene="(\d+)"/g)];
assert.deepEqual(steps.map(m=>+m[2]),[0,1,2,3,4,5,6,7,8],'One article step per scene, in order');
for(const m of html.matchAll(/data-go="(\d+)"/g))assert.ok(+m[1]>=0&&+m[1]<9,`data-go=${m[1]} points at a scene`);
for(const id of ['stage','view','gl','stageNo','stageName','stageCap','strip','pauseBtn','resetBtn','orbitBtn','lblHost','hudHost','insetHost','themeBtn'])
  assert.match(html,new RegExp(`id="${id}"`),`Missing #${id}`);

// theme matches the main site and shares its saved choice
assert.match(html,/localStorage\.getItem\("theme"\)/,'Page reads the site theme');
assert.match(sources['page.js'],/localStorage\.setItem\('theme'/,'Page saves the site theme');
assert.match(html,/IBM\+Plex\+Mono/,'Page uses the site typeface');

// entry points: homepage nav and the blog post
const pc=vm.createContext({window:{}});
vm.runInContext(await read('posts.js'),pc);
const posts=pc.window.BLOG_POSTS;
const post=posts.find(p=>p.slug==='vla');
assert.ok(post,'VLA post is registered');
assert.ok(post.body.some(b=>b.includes('](/vla/)')),'Post links to the 3D page');
const anchors=new Set(steps.map(m=>m[1]));
for(const b of post.body)for(const m of b.matchAll(/\]\(\/vla\/#([\w-]+)\)/g))assert.ok(anchors.has(m[1]),`Post links to a missing step: #${m[1]}`);
assert.match(await read('index.html'),/href="\.\/vla\/"/,'Main navigation includes ./vla');

// every local link on the page resolves
let links=0;
const origin='https://portfolio.invalid';
for(const match of html.matchAll(/\b(?:href|src)=["']([^"']+)["']/g)){
  const url=new URL(match[1],origin+'/'+page);
  if(url.origin!==origin)continue;
  if(url.hash.startsWith('#blogs/'))assert.ok(posts.some(p=>url.hash==='#blogs/'+p.slug),`Missing article: ${match[1]}`);
  const filename=decodeURIComponent(url.pathname).replace(/^\//,'');
  const stat=await fs.stat(path.join(root,filename)).catch(()=>assert.fail(`${page}: missing ${match[1]}`));
  if(stat.isDirectory())await fs.access(path.join(root,filename,'index.html'));
  links++;
}
console.log(`VLA page passed: vendored three.js r128 verified, ${ORDER.length - 2} scripts parse, ${scenes.length} scenes, ${links} internal links.`);
