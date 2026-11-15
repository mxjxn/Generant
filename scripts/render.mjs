#!/usr/bin/env node
/**
 * Generant render CLI — timeline sidecar, preview/offline WAV, and share MP4.
 *
 *   node scripts/render.mjs song demos/Sideways\ Bloom.rack.json --out /tmp/bloom --aspect vertical --style pulse
 *   node scripts/render.mjs pattern path/to.rack.json --pattern "Pattern 00" --video --aspect square
 *   node scripts/render.mjs video --wav audio.wav --timeline t.json --out out.mp4 --style bars
 *   node scripts/render.mjs song project.rack.json --via-remote   # asks running Generant over WS
 *
 * Audio quality: --preview uses a lightweight oscillator mix (no SuperSonic).
 * Real engine bounce needs the desktop app (UI / remote API / --via-remote).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {upgrade} from '../shared/model.mjs';
import {
 buildRenderTimeline,encodePcm16Wav,parseRenderOptions,previewSynthFromTimeline,
 sanitizeName,decodeWavPcm,analyzeAudio
} from '../shared/render.mjs';
import {iterateFrames} from '../shared/visualizer.mjs';
import {encodeAudio,encodeVideoFromFrames,findFfmpeg,probeFfmpeg,saveBinary,writePpmFrame} from '../app/ffmpeg.mjs';

function usage(){
 console.log(`Usage:
  node scripts/render.mjs <song|pattern|video|probe> [project.rack.json] [options]

Options:
  --out <dir|file>     Output directory or video path
  --format wav|mp3|aac Audio container (default wav)
  --style pulse|ribbons|lattice|bars
  --aspect vertical|square|landscape
  --title --artist     Overlay text
  --tail <sec>         Release pad after bounce (default 1.5)
  --max-seconds <n>    Clamp duration (useful for smoke tests)
  --pattern <id|name>  Pattern mode selection
  --preview            Offline preview synth (no SuperSonic)
  --no-video           Skip MP4
  --wav <file>         Existing WAV for video-only / as audio source
  --timeline <file>    Existing timeline JSON for video-only
  --via-remote         Ask running Generant (ws://127.0.0.1:57143)
  --fps <n>            Video frame rate (default 30)
  --frames <n>         Also write first N PPM preview frames
`);
}

function args(){
 const a=process.argv.slice(2),out={_:[]};
 for(let i=0;i<a.length;i++){
  const t=a[i];
  if(t==='--out')out.out=a[++i];
  else if(t==='--format')out.format=a[++i];
  else if(t==='--style')out.style=a[++i];
  else if(t==='--aspect')out.aspect=a[++i];
  else if(t==='--title')out.title=a[++i];
  else if(t==='--artist')out.artist=a[++i];
  else if(t==='--tail')out.tail=+a[++i];
  else if(t==='--max-seconds')out.maxSeconds=+a[++i];
  else if(t==='--pattern')out.pattern=a[++i];
  else if(t==='--preview')out.preview=true;
  else if(t==='--no-video')out.video=false;
  else if(t==='--wav')out.wav=a[++i];
  else if(t==='--timeline')out.timeline=a[++i];
  else if(t==='--via-remote')out.viaRemote=true;
  else if(t==='--fps')out.fps=+a[++i];
  else if(t==='--frames')out.frames=+a[++i];
  else if(t==='--help'||t==='-h')out.help=true;
  else out._.push(t);
 }
 return out;
}

async function loadProject(file){
 const text=await fs.readFile(file,'utf8');
 return upgrade(JSON.parse(text));
}

async function viaRemote(command,payload){
 const {default:WebSocket}=await import('ws');
 const port=Number(process.env.GENERANT_WS_PORT)||57143;
 const socket=new WebSocket('ws://127.0.0.1:'+port);
 await new Promise((res,rej)=>{socket.once('open',res);socket.once('error',rej);});
 const id=Math.floor(Math.random()*1e9);
 socket.send(JSON.stringify({id,address:'/generant/v1/'+command,args:payload}));
 const reply=await new Promise((res,rej)=>{
  const timer=setTimeout(()=>rej(Error('Remote render timed out (is Generant running?)')),Math.max(120000,(payload.maxSeconds||120)*1000+30000));
  socket.on('message',data=>{
   const msg=JSON.parse(String(data));
   if(msg.id!==id)return;
   if(msg.event==='progress'){process.stdout.write(`\r[${Math.round((msg.progress||0)*100)}%] ${msg.message||''}   `);return;}
   clearTimeout(timer);res(msg);
  });
 });
 socket.close();
 process.stdout.write('\n');
 if(!reply.ok)throw Error(reply.error||'Remote render failed');
 return reply.result;
}

async function writeAudioArtifacts(dir,base,timeline,wavBuffer,options){
 await fs.mkdir(dir,{recursive:true});
 const wavPath=path.join(dir,base+'.wav');
 const timelinePath=path.join(dir,base+'.timeline.json');
 await saveBinary(wavPath,wavBuffer);
 await fs.writeFile(timelinePath,JSON.stringify(timeline,null,2));
 const files={wav:wavPath,timeline:timelinePath};
 if(options.format==='mp3'||options.format==='aac'){
  const audioPath=path.join(dir,base+'.'+options.format);
  await encodeAudio(wavPath,audioPath,{format:options.format});
  files.audio=audioPath;
 }else files.audio=wavPath;
 return files;
}

async function renderVideo(dir,base,timeline,wavPath,options){
 await findFfmpeg();
 const {left,right,sampleRate}=decodeWavPcm(await fs.readFile(wavPath));
 const analysis=analyzeAudio(left,right,sampleRate);
 const frames=iterateFrames(timeline,analysis,{
  style:options.style,aspect:options.aspect,fps:options.fps,
  title:options.title,artist:options.artist,maxSeconds:options.maxSeconds
 });
 const first=[];
 async function* gated(){
  for(const frame of frames){
   if(options.frames&&first.length<options.frames){
    const copy=Uint8Array.from(frame.pixels);
    first.push({...frame,pixels:copy});
   }
   yield frame;
   process.stdout.write(`\r[video ${frame.index+1}/${frame.total}]`);
  }
 }
 const videoPath=path.join(dir,base+'-'+options.style+'-'+options.aspect+'.mp4');
 const dim=(await import('../shared/render.mjs')).RENDER_ASPECTS[options.aspect];
 await encodeVideoFromFrames({
  wavPath,outPath:videoPath,width:dim.width,height:dim.height,fps:options.fps,frames:gated()
 });
 process.stdout.write('\n');
 for(let i=0;i<first.length;i++){
  await writePpmFrame(path.join(dir,`${base}-frame-${String(i).padStart(3,'0')}.ppm`),first[i].pixels,first[i].width,first[i].height);
 }
 return videoPath;
}

async function main(){
 const cli=args();
 if(cli.help||!cli._.length){usage();process.exit(cli.help?0:1);}
 const cmd=cli._[0];
 if(cmd==='probe'){
  console.log(JSON.stringify(await probeFfmpeg(),null,2));
  return;
 }
 const options=parseRenderOptions({
  mode:cmd==='pattern'?'pattern':'song',
  format:cli.format||'wav',
  style:cli.style||'pulse',
  aspect:cli.aspect||'vertical',
  title:cli.title||'',
  artist:cli.artist||'',
  tail:cli.tail,
  maxSeconds:cli.maxSeconds,
  pattern:cli.pattern,
  video:cli.video!==false,
  preview:!!cli.preview,
  fps:cli.fps||30
 });

 if(cmd==='video'){
  if(!cli.wav||!cli.timeline)throw Error('video mode needs --wav and --timeline');
  const timeline=JSON.parse(await fs.readFile(cli.timeline,'utf8'));
  const out=cli.out||path.join(path.dirname(cli.wav),sanitizeName(timeline.name||'render')+'.mp4');
  const dir=path.extname(out)?path.dirname(out):out;
  const base=path.extname(out)?path.basename(out,'.mp4'):sanitizeName(timeline.name||'render');
  options.frames=cli.frames||3;
  const video=await renderVideo(dir,base,timeline,cli.wav,options);
  console.log(JSON.stringify({ok:true,video},null,2));
  return;
 }

 if(cmd!=='song'&&cmd!=='pattern')throw Error('Unknown command '+cmd);
 const projectPath=cli._[1];
 if(!projectPath)throw Error('Provide a .rack.json path');
 const outRoot=cli.out||path.join(process.cwd(),'render-out');
 const project=await loadProject(projectPath);
 options.title=options.title||project.name||'';
 options.outBase=sanitizeName((options.title||'render')+'-'+options.mode);
 const dir=path.join(outRoot,options.outBase);
 await fs.mkdir(dir,{recursive:true});

 if(cli.viaRemote){
  const result=await viaRemote('render/'+options.mode,[
   options.format,options.style,options.aspect,options.title,options.artist,
   options.video?1:0,options.maxSeconds??0,dir
  ]);
  console.log(JSON.stringify({ok:true,...result},null,2));
  return;
 }

 const timeline=buildRenderTimeline(project,options);
 if(options.maxSeconds)timeline.durationSeconds=Math.min(timeline.durationSeconds,options.maxSeconds);
 let wavBuffer,wavPath=cli.wav;
 if(wavPath){
  wavBuffer=await fs.readFile(wavPath);
 }else{
  if(!options.preview){
   console.warn('No SuperSonic in CLI — using --preview oscillator mix. For engine bounce use UI, remote API, or --via-remote.');
  }
  const mix=previewSynthFromTimeline(timeline,{sampleRate:options.sampleRate,maxSeconds:options.maxSeconds});
  wavBuffer=Buffer.from(encodePcm16Wav(mix.left,mix.right,options.sampleRate));
 }
 const files=await writeAudioArtifacts(dir,options.outBase,timeline,wavBuffer,options);
 wavPath=files.wav;
 let video=null;
 if(options.video!==false){
  options.frames=cli.frames||4;
  video=await renderVideo(dir,options.outBase,timeline,wavPath,options);
  files.video=video;
 }
 console.log(JSON.stringify({ok:true,dir,files,duration:timeline.durationSeconds,mode:options.mode},null,2));
}

main().catch(err=>{console.error(err.message||err);process.exit(1);});
