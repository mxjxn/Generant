import fs from 'node:fs/promises';
import path from 'node:path';
import {dialog} from 'electron';
import {sanitizeName,decodeWavPcm,analyzeAudio,RENDER_ASPECTS} from '../shared/render.mjs';
import {iterateFrames} from '../shared/visualizer.mjs';
import {encodeAudio,encodeVideoFromFrames,writePpmFrame,saveBinary,probeFfmpeg} from './ffmpeg.mjs';

function wavBytes(payload){
 if(payload.wav instanceof Uint8Array)return Buffer.from(payload.wav);
 if(payload.wav instanceof ArrayBuffer)return Buffer.from(payload.wav);
 if(Array.isArray(payload.wav))return Buffer.from(payload.wav);
 if(Buffer.isBuffer(payload.wav))return payload.wav;
 throw Error('Render payload missing wav bytes.');
}

export async function writeRenderBundle(payload,onProgress=()=>{}){
 const options=payload.options||{};
 const timeline=payload.timeline;
 if(!timeline||timeline.format!=='generant-render-timeline')throw Error('Invalid render timeline.');
 const base=sanitizeName(options.outBase||timeline.name||'render');
 const dir=options.outDir||payload.outDir;
 if(!dir)throw Error('outDir required.');
 await fs.mkdir(dir,{recursive:true});
 const wav=wavBytes(payload);
 const wavPath=path.join(dir,base+'.wav');
 const timelinePath=path.join(dir,base+'.timeline.json');
 onProgress({progress:.62,message:'Writing WAV…'});
 await saveBinary(wavPath,wav);
 await fs.writeFile(timelinePath,JSON.stringify(timeline,null,2));
 const files={wav:wavPath,timeline:timelinePath,dir};
 const format=options.format||'wav';
 if(format==='mp3'||format==='aac'){
  onProgress({progress:.7,message:`Encoding ${format.toUpperCase()}…`});
  const probe=await probeFfmpeg();
  if(!probe.ok)throw Error(probe.error);
  files.audio=await encodeAudio(wavPath,path.join(dir,base+'.'+format),{format});
 }else files.audio=wavPath;

 if(options.video!==false){
  const probe=await probeFfmpeg();
  if(!probe.ok)throw Error(probe.error);
  onProgress({progress:.75,message:'Analyzing audio for visualizer…'});
  const decoded=decodeWavPcm(wav);
  const analysis=analyzeAudio(decoded.left,decoded.right,decoded.sampleRate);
  const aspect=options.aspect||'vertical';
  const style=options.style||'pulse';
  const fps=options.fps||30;
  const dim=RENDER_ASPECTS[aspect]||RENDER_ASPECTS.vertical;
  const videoPath=path.join(dir,`${base}-${style}-${aspect}.mp4`);
  const frameLimit=options.previewFrames??4;
  const savedFrames=[];
  async function* frames(){
   for(const frame of iterateFrames(timeline,analysis,{
    style,aspect,fps,title:options.title||timeline.name||'',artist:options.artist||'',maxSeconds:options.maxSeconds
   })){
    if(savedFrames.length<frameLimit)savedFrames.push({index:frame.index,pixels:Uint8Array.from(frame.pixels),width:frame.width,height:frame.height});
    onProgress({progress:.75+.24*(frame.index/Math.max(1,frame.total-1)),message:`Video frame ${frame.index+1}/${frame.total}`});
    yield frame;
   }
  }
  await encodeVideoFromFrames({wavPath,outPath:videoPath,width:dim.width,height:dim.height,fps,frames:frames()});
  files.video=videoPath;
  files.frames=[];
  for(const f of savedFrames){
   const file=path.join(dir,`${base}-frame-${String(f.index).padStart(3,'0')}.ppm`);
   await writePpmFrame(file,f.pixels,f.width,f.height);
   files.frames.push(file);
  }
 }
 onProgress({progress:1,message:'Render saved'});
 return {ok:true,dir,files,duration:timeline.durationSeconds};
}

export async function saveRenderBundle(win,payload,onProgress=()=>{}){
 const options=payload.options||{};
 const base=sanitizeName(options.outBase||payload.timeline?.name||'render');
 const choice=await dialog.showOpenDialog(win,{
  title:'Choose folder for render output',
  buttonLabel:'Render here',
  properties:['openDirectory','createDirectory']
 });
 if(choice.canceled||!choice.filePaths?.[0])return null;
 const outDir=path.join(choice.filePaths[0],base);
 await fs.mkdir(outDir,{recursive:true});
 return writeRenderBundle({...payload,options:{...options,outDir,outBase:base}},onProgress);
}
