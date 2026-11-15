import {spawn,execFile} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {Readable} from 'node:stream';

let cachedPath=null;

export async function findFfmpeg(){
 if(cachedPath)return cachedPath;
 const candidates=[
  process.env.FFMPEG_PATH,
  process.env.GENERANT_FFMPEG,
  'ffmpeg',
  '/usr/bin/ffmpeg',
  '/usr/local/bin/ffmpeg',
  '/opt/homebrew/bin/ffmpeg'
 ].filter(Boolean);
 for(const bin of candidates){
  try{
   await new Promise((resolve,reject)=>{
    execFile(bin,['-version'],{timeout:5000},(err,stdout)=>{
     if(err)reject(err);else if(/ffmpeg version/i.test(stdout))resolve();else reject(Error('not ffmpeg'));
    });
   });
   cachedPath=bin;return bin;
  }catch{/* try next */}
 }
 throw Error('ffmpeg not found. Install ffmpeg or set FFMPEG_PATH. See docs/render.md.');
}

function run(bin,args,{input=null}={}){
 return new Promise((resolve,reject)=>{
  const child=spawn(bin,args,{stdio:input?['pipe','pipe','pipe']:['ignore','pipe','pipe']});
  let err='',out='';
  child.stderr.on('data',d=>err+=d);
  child.stdout.on('data',d=>out+=d);
  child.on('error',reject);
  child.on('close',code=>code===0?resolve({out,err}):reject(Error('ffmpeg failed ('+code+'): '+(err.slice(-800)||out.slice(-400)))));
  if(input){Readable.from(input).pipe(child.stdin);child.stdin.on('error',()=>{});}
 });
}

export async function encodeAudio(wavPath,outPath,{format='mp3',bitrate='192k'}={}){
 const bin=await findFfmpeg();
 const args=['-y','-i',wavPath,'-vn'];
 if(format==='mp3')args.push('-codec:a','libmp3lame','-b:a',bitrate);
 else if(format==='aac')args.push('-codec:a','aac','-b:a',bitrate);
 else throw Error('Unsupported audio format '+format);
 args.push(outPath);
 await run(bin,args);
 return outPath;
}

/** Pipe raw RGBA frames + WAV into an H.264/AAC MP4. */
export async function encodeVideoFromFrames({
 wavPath,outPath,width,height,fps=30,frames,
 coverPath=null,onProgress=()=>{}
}){
 const bin=await findFfmpeg();
 await fs.mkdir(path.dirname(outPath),{recursive:true});
 const args=[
  '-y',
  '-f','rawvideo','-pix_fmt','rgba','-s',`${width}x${height}`,'-r',String(fps),'-i','pipe:0',
  '-i',wavPath
 ];
 if(coverPath)args.push('-loop','1','-t','0.05','-i',coverPath);
 args.push(
  '-map','0:v:0','-map','1:a:0',
  '-c:v','libx264','-pix_fmt','yuv420p','-preset','veryfast','-crf','23',
  '-c:a','aac','-b:a','192k',
  '-shortest',
  '-movflags','+faststart',
  outPath
 );
 return new Promise((resolve,reject)=>{
  const child=spawn(bin,args,{stdio:['pipe','ignore','pipe']});
  let err='';
  child.stderr.on('data',d=>err+=d);
  child.on('error',reject);
  child.on('close',code=>code===0?resolve(outPath):reject(Error('ffmpeg video failed ('+code+'): '+err.slice(-1000))));
  (async()=>{
   try{
    let i=0;
    for await(const frame of frames){
     const ok=child.stdin.write(Buffer.from(frame.pixels));
     if(!ok)await new Promise(r=>child.stdin.once('drain',r));
     i++;
     if(i%15===0||i===frame.total)onProgress(i/frame.total,`frame ${i}/${frame.total}`);
    }
    child.stdin.end();
   }catch(e){child.kill('SIGKILL');reject(e);}
  })();
 });
}

export async function writePpmFrame(file,pixels,width,height){
 const {frameToPpm}=await import('../shared/visualizer.mjs');
 await fs.mkdir(path.dirname(file),{recursive:true});
 await fs.writeFile(file,frameToPpm(pixels,width,height));
 return file;
}

export async function saveBinary(file,buffer){
 await fs.mkdir(path.dirname(file),{recursive:true});
 await fs.writeFile(file,Buffer.from(buffer));
 return file;
}

export async function probeFfmpeg(){
 try{const bin=await findFfmpeg();return {ok:true,path:bin};}
 catch(e){return {ok:false,error:e.message};}
}
