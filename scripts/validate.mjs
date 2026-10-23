import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url)),dist=join(root,'dist');
assert.ok(!existsSync(join(root,'.openai','hosting.json')),'No hosted Site was registered');
const data=JSON.parse(await readFile(join(dist,'assets','illustration.json'),'utf8'));
assert.equal(data.frames.length,3);assert.equal(data.parts.length,5);assert.equal(data.duration,15);assert.equal(data.fps,15);
assert.ok(Math.abs(data.palette.reduce((s,c)=>s+c.percentage,0)-100)<.01);
const manifest=JSON.parse(await readFile(join(dist,'assets','models','manifest.json'),'utf8'));
let meshes=0;
for(const entry of Object.values(manifest.models)){
  const bytes=await readFile(join(dist,'assets','models',entry.file));assert.equal(bytes.toString('ascii',0,4),'glTF');assert.equal(bytes.readUInt32LE(4),2);
  assert.equal(bytes.length,bytes.readUInt32LE(8));assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256);
  const length=bytes.readUInt32LE(12),gltf=JSON.parse(bytes.toString('utf8',20,20+length));
  assert.ok(gltf.extensionsUsed.includes('KHR_draco_mesh_compression'));meshes+=gltf.nodes.filter(n=>n.mesh!==undefined).length;
}
assert.equal(Object.keys(manifest.models).length,5);
for(const file of ['app.js','model-viewer.js','anatomy-motion.js','CREDITS.html','Z-ANATOMY-NOTICE.txt','ANATOMY-LICENSE.txt','PROMPT.md','vendor/three/LICENSE','vendor/three/build/three.module.js','vendor/three/build/three.core.js','vendor/three/examples/jsm/utils/SkeletonUtils.js','vendor/three/examples/jsm/libs/draco/gltf/draco_decoder.wasm'])assert.ok((await stat(join(dist,file))).size>0,file);
const child=spawn(process.execPath,['serve.mjs','0'],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});let stderr='';child.stderr.on('data',b=>{stderr+=b});
try{
  const base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Server timeout '+stderr)),8000);child.once('error',reject);child.stdout.on('data',b=>{const m=String(b).match(/Local: (http:\/\/127\.0\.0\.1:\d+)/);if(m){clearTimeout(timer);resolve(m[1])}})});
  const request=(p,options={})=>fetch(base+p,{...options,signal:AbortSignal.timeout(5000)});
  const html=await request('/');assert.equal(html.status,200);assert.match(await html.text(),/Human Anatomy/);
  for(const[path,type]of[['/assets/models/skeleton.glb','model/gltf-binary'],['/vendor/three/examples/jsm/libs/draco/gltf/draco_decoder.wasm','application/wasm'],['/model-viewer.js','text/javascript']]){const r=await request(path,{method:'HEAD'});assert.equal(r.status,200);assert.ok(r.headers.get('content-type').startsWith(type));assert.ok(Number(r.headers.get('content-length'))>100)}
  const range=await request('/assets/human-anatomy.mp4',{headers:{Range:'bytes=0-15'}});assert.equal(range.status,206);assert.equal((await range.arrayBuffer()).byteLength,16);
  for(const path of ['/PROMPT.md','/CREDITS.html','/assets/illustration.json']){const r=await request(path);assert.equal(r.status,200);await r.arrayBuffer()}
  console.log(JSON.stringify({result:'passed',systems:5,sourceViews:3,regions:5,modelMeshes:meshes,glbHashes:'verified',wasmAndGlbMime:'passed',videoRange:'passed',remoteHosting:false},null,2));
}finally{child.kill()}
