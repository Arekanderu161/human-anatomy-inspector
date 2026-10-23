import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {resolve,sep,extname,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('./dist/',import.meta.url));
const port=Number(process.argv[2]??4176);
if(!Number.isInteger(port)||port<0||port>65535)throw new Error('Use a port from 0 to 65535');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.md':'text/plain; charset=utf-8','.txt':'text/plain; charset=utf-8','.webp':'image/webp','.png':'image/png','.gif':'image/gif','.mp4':'video/mp4','.glb':'model/gltf-binary','.wasm':'application/wasm'};
const server=createServer(async(req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD'});res.end();return}
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    let filename=resolve(root,pathname.replace(/^\/+/,''));
    if(filename!==resolve(root)&&!filename.startsWith(resolve(root)+sep)){res.writeHead(403);res.end();return}
    let info=await stat(filename);
    if(info.isDirectory()){filename=join(filename,'index.html');info=await stat(filename)}
    if(!info.isFile()){res.writeHead(404);res.end();return}
    let start=0,end=info.size-1,status=200;
    const headers={'Content-Type':types[extname(filename)]||'application/octet-stream','Accept-Ranges':'bytes','Cache-Control':'no-cache'};
    if(req.headers.range){
      const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if(!match||(!match[1]&&!match[2])){res.writeHead(416,{'Content-Range':`bytes */${info.size}`});res.end();return}
      if(!match[1])start=Math.max(0,info.size-Number(match[2]));
      else{start=Number(match[1]);if(match[2])end=Math.min(end,Number(match[2]))}
      if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>end||start>=info.size){res.writeHead(416,{'Content-Range':`bytes */${info.size}`});res.end();return}
      status=206;headers['Content-Range']=`bytes ${start}-${end}/${info.size}`;
    }
    headers['Content-Length']=String(Math.max(0,end-start+1));res.writeHead(status,headers);
    if(req.method==='HEAD'||info.size===0){res.end();return}
    createReadStream(filename,{start,end}).on('error',()=>res.destroy()).pipe(res);
  }catch(error){res.writeHead(error instanceof URIError?400:404);res.end()}
});
server.listen(port,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${server.address().port}`));
