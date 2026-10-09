import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mime={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm','.json':'application/json','.scsyndef':'application/octet-stream','.wav':'audio/wav'};
export async function serve(port=0){
 const server=http.createServer(async(req,res)=>{
  res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('Cross-Origin-Resource-Policy','same-origin');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; worker-src 'self' blob:; connect-src 'self' data: blob:; img-src 'self' data:; media-src 'self' blob: data:");
  try{const url=decodeURIComponent(new URL(req.url,'http://localhost').pathname);let base=path.join(root,'public'),rel=url==='/'?'index.html':url.slice(1);
   for(const [prefix,dir]of [['/vendor/sonic/','node_modules/supersonic-scsynth/dist'],['/vendor/core/','node_modules/supersonic-scsynth-core'],['/shared/','shared']])if(url.startsWith(prefix)){base=path.join(root,dir);rel=url.slice(prefix.length);break;}
   if(url.startsWith('/library/')){base=process.resourcesPath?path.join(process.resourcesPath,'sample-library'):path.join(root,'sample-library');if(!await fs.stat(base).catch(()=>null))base=path.join(root,'sample-library');rel=url.slice('/library/'.length);}
   const file=path.resolve(base,rel);if(!file.startsWith(base+path.sep))throw Error();const data=await fs.readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(data);
  }catch{res.writeHead(404);res.end('Not found');}
 });await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve)});return server;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const s=await serve(Number(process.env.PORT||4315));console.log(`Generant http://127.0.0.1:${s.address().port}`);}
