/** Check the robot-learning node map: files, script parse, graph data, theme, entry points and links. Runs without a server. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=name=>fs.readFile(path.join(root,name),'utf8');
const page='robot-learning/index.html';
const html=await read(page);
const app=await read('robot-learning/app.js');
new vm.Script(app,{filename:'robot-learning/app.js'});

// the page loads its stylesheet and script, and every element app.js looks up exists
assert.deepEqual([...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/g)].map(m=>m[1]),['app.js'],'Node map loads app.js');
assert.match(html,/href="style\.css"/,'Node map loads style.css');
for(const id of new Set([...app.matchAll(/\$\("#([\w-]+)"\)/g)].map(m=>m[1])))
  assert.match(html,new RegExp(`id="${id}"`),`app.js expects #${id}`);

// graph data: eight stages in blog order, components point at listed files, pipelines are consistent
const graph=JSON.parse(await read('robot-learning/graph.json'));
JSON.parse(await read('robot-learning/results.json'));
assert.deepEqual(graph.stages.map(s=>s.id),['vlm','data','vla','post_train','rl','eval','edge','deploy'],'Eight stages in pipeline order');
const files=new Set(graph.files);
const keys=new Set(graph.components.map(c=>c.key));
for(const c of graph.components){
  assert.ok(files.has(c.file),`${c.key}: ${c.file} is in the file tree`);
  assert.ok(c.stage===null||graph.stages.some(s=>s.id===c.stage),`${c.key}: known stage ${c.stage}`);
}
for(const s of graph.stages){
  assert.ok(s.components.length>0,`Stage ${s.id} has implementations`);
  for(const f of s.files)assert.ok(files.has(f),`Stage ${s.id}: ${f} is in the file tree`);
}
assert.ok(graph.pipelines.length>0,'At least one pipeline');
for(const p of graph.pipelines){
  assert.ok(files.has(p.file),`Pipeline ${p.name}: ${p.file} is in the file tree`);
  const ids=new Set(p.nodes.map(n=>n.id));
  for(const e of p.edges)assert.ok(ids.has(e.from)&&ids.has(e.to),`Pipeline ${p.name}: edge ${e.from} -> ${e.to}`);
  for(const n of p.nodes)for(const u of n.uses)assert.ok(keys.has(u),`Pipeline ${p.name}/${n.id} uses unknown ${u}`);
}
for(const [stage,rows] of Object.entries(graph.papers))
  assert.ok(graph.stages.some(s=>s.id===stage)&&rows.every(r=>['native','lerobot','planned'].includes(r.status)),`Paper catalogue for ${stage}`);

// theme matches the main site and shares its saved choice
assert.match(html,/localStorage\.getItem\("theme"\)/,'Node map reads the site theme');
assert.match(app,/localStorage\.setItem\("theme"/,'Node map saves the site theme');
assert.match(html,/IBM\+Plex\+Mono/,'Node map uses the site typeface');

// entry points: homepage nav, project page, the VLA post and the 3D page
assert.match(await read('index.html'),/href="\.\/robot-learning\/"/,'Main navigation includes ./robot-learning');
const portfolio=vm.createContext({window:{}});
vm.runInContext(await read('content.js'),portfolio);
const project=vm.runInContext('getProject("robot-learning")',portfolio);
assert.ok(project?.links?.some(l=>l.href==='/robot-learning/'),'Project entry links to the node map');
for(const m of project.media||[])await fs.access(path.join(root,m.src));
const pc=vm.createContext({window:{}});
vm.runInContext(await read('posts.js'),pc);
assert.ok(pc.window.BLOG_POSTS.find(p=>p.slug==='vla').body.some(b=>b.includes('](/robot-learning/)')),'VLA post links to the node map');
assert.match(await read('vla/index.html'),/href="\/robot-learning\/"/,'VLA page links to the node map');

// every local link on the page resolves
let links=0;
const origin='https://portfolio.invalid';
for(const match of html.matchAll(/\b(?:href|src)=["']([^"']+)["']/g)){
  const url=new URL(match[1],origin+'/'+page);
  if(url.origin!==origin)continue;
  const filename=decodeURIComponent(url.pathname).replace(/^\//,'');
  const stat=await fs.stat(path.join(root,filename)).catch(()=>assert.fail(`${page}: missing ${match[1]}`));
  if(stat.isDirectory())await fs.access(path.join(root,filename,'index.html'));
  links++;
}
console.log(`robot-learning node map: ${graph.components.length} components, ${graph.pipelines.length} pipelines, ${graph.files.length} files, ${links} local links verified.`);
