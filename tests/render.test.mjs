import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {upgrade,demoProject} from '../shared/model.mjs';
import {
 buildRenderTimeline,encodePcm16Wav,decodeWavPcm,normalizeStereo,parseRenderOptions,
 previewSynthFromTimeline,analyzeAudio,projectRenderMeta,safeMargins,defaultCoverMode,
 RENDER_STYLES,RENDER_ASPECTS
} from '../shared/render.mjs';
import {createRenderQueue} from '../shared/render-queue.mjs';
import {iterateFrames,renderFrame} from '../shared/visualizer.mjs';
import {remoteCommand,REMOTE_PREFIX} from '../shared/remote.mjs';
import {probeFfmpeg,encodeVideoFromFrames,writePpmFrame,saveBinary} from '../app/ffmpeg.mjs';

test('parseRenderOptions validates styles, aspects, overlays and formats',()=>{
 assert.equal(parseRenderOptions({style:'bars',aspect:'square'}).style,'bars');
 assert.equal(parseRenderOptions({aspect:'landscape'}).aspect,'landscape');
 assert.equal(parseRenderOptions({overlay:false}).overlay,false);
 assert.equal(parseRenderOptions({placement:'bottom'}).placement,'bottom');
 assert.equal(parseRenderOptions({coverMode:'backdrop'}).coverMode,'backdrop');
 assert.throws(()=>parseRenderOptions({sampleRate:100}));
 const project=upgrade(demoProject());
 project.artist='Studio X';
 const opts=parseRenderOptions({title:'',artist:''},project);
 assert.equal(opts.title,project.name);
 assert.equal(opts.artist,'Studio X');
 assert.equal(projectRenderMeta(project).artist,'Studio X');
 assert.equal(defaultCoverMode('pulse'),'backdrop');
 assert.equal(defaultCoverMode('bars'),'frame');
 assert.ok(safeMargins('vertical').bottom>=.15);
});

test('buildRenderTimeline exports song and pattern sidecars with notes',()=>{
 const project=upgrade(demoProject());
 const song=buildRenderTimeline(project,{mode:'song'});
 assert.equal(song.format,'generant-render-timeline');
 assert.ok(song.durationSeconds>0);
 assert.ok(song.tracks.length>=1);
 assert.ok(song.segments.length>=1);
 const pattern=buildRenderTimeline(project,{mode:'pattern',patternId:project.song.editPatternId});
 assert.equal(pattern.mode,'pattern');
 assert.ok(pattern.durationSeconds<=song.durationSeconds+1e-6);
});

test('WAV encode/decode roundtrip and preview synth produce audible energy',()=>{
 const left=new Float32Array(4800),right=new Float32Array(4800);
 for(let i=0;i<left.length;i++){left[i]=Math.sin(i/20)*.5;right[i]=Math.cos(i/17)*.4;}
 const wav=encodePcm16Wav(left,right,48000);
 const decoded=decodeWavPcm(wav);
 assert.equal(decoded.sampleRate,48000);
 assert.ok(Math.abs(decoded.left[100]-left[100])<0.01);
 const project=upgrade(demoProject());
 const timeline=buildRenderTimeline(project,{mode:'pattern',maxSeconds:2});
 timeline.durationSeconds=Math.min(timeline.durationSeconds,2);
 const mix=previewSynthFromTimeline(timeline,{sampleRate:24000,maxSeconds:2});
 const norm=normalizeStereo(mix.left,mix.right);
 assert.ok(norm.peak>0.01);
 const analysis=analyzeAudio(norm.left,norm.right,24000);
 assert.ok(analysis.energy.length>0);
 assert.equal(analysis.bandEnergy.length,8);
});

test('visualizer renders distinct frames for each style and aspect',()=>{
 const project=upgrade(demoProject());
 const timeline=buildRenderTimeline(project,{mode:'pattern'});
 timeline.durationSeconds=Math.min(timeline.durationSeconds,1);
 const mix=previewSynthFromTimeline(timeline,{sampleRate:22050,maxSeconds:1});
 const analysis=analyzeAudio(mix.left,mix.right,22050);
 for(const style of RENDER_STYLES){
  const w=160,h=280;
  const buf=new Uint8Array(w*h*4);
  renderFrame(buf,w,h,{style,timeline,analysis,seconds:0.2,title:'TEST',artist:'GEN'});
  assert.ok(buf.some(v=>v>20),style+' should paint pixels');
 }
 const frames=[...iterateFrames(timeline,analysis,{style:'pulse',aspect:'vertical',fps:10,maxSeconds:0.3,scale:.25})];
 assert.ok(frames.length>=3);
 assert.equal(frames[0].width,Math.floor(1080*.25/2)*2);
 assert.equal(frames[0].height,Math.floor(1920*.25/2)*2);
});

test('visualizer title overlay and cover frame/backdrop change pixels',()=>{
 const project=upgrade(demoProject());
 const timeline=buildRenderTimeline(project,{mode:'pattern'});
 timeline.durationSeconds=1;
 const mix=previewSynthFromTimeline(timeline,{sampleRate:22050,maxSeconds:1});
 const analysis=analyzeAudio(mix.left,mix.right,22050);
 const w=120,h=200;
 const base=new Uint8Array(w*h*4);
 renderFrame(base,w,h,{style:'pulse',timeline,analysis,seconds:0.15,overlay:false});
 const withText=new Uint8Array(w*h*4);
 renderFrame(withText,w,h,{style:'pulse',timeline,analysis,seconds:0.15,title:'SONG',artist:'ART',placement:'top-left'});
 assert.ok(withText.some((v,i)=>v!==base[i]),'text overlay should change pixels');
 const cover={width:32,height:32,pixels:new Uint8Array(32*32*4)};
 for(let i=0;i<cover.pixels.length;i+=4){cover.pixels[i]=220;cover.pixels[i+1]=40;cover.pixels[i+2]=60;cover.pixels[i+3]=255;}
 const framed=new Uint8Array(w*h*4);
 renderFrame(framed,w,h,{style:'bars',timeline,analysis,seconds:0.15,overlay:false,cover,coverMode:'frame',aspect:'square'});
 assert.ok(framed.some((v,i)=>v!==base[i]),'framed cover should change pixels');
 const back=new Uint8Array(w*h*4);
 renderFrame(back,w,h,{style:'pulse',timeline,analysis,seconds:0.15,overlay:false,cover,coverMode:'backdrop'});
 assert.ok(back.some((v,i)=>v!==base[i]),'backdrop cover should change pixels');
});

test('remote parser accepts render, queue, and overlay args',()=>{
 assert.deepEqual(remoteCommand(REMOTE_PREFIX+'/render/song',['wav','pulse','vertical','Title','Artist',1,8,'/tmp/out']),{
  type:'render',mode:'song',format:'wav',style:'pulse',aspect:'vertical',title:'Title',artist:'Artist',
  video:true,maxSeconds:8,outDir:'/tmp/out',pattern:null,overlay:true,placement:'auto',coverPath:null,coverMode:'auto'
 });
 assert.equal(remoteCommand(REMOTE_PREFIX+'/render/pattern',['mp3','bars','square','','',0,4,null,'Pattern 00']).mode,'pattern');
 assert.equal(remoteCommand(REMOTE_PREFIX+'/render/video',[]).mode,'video');
 const queued=remoteCommand(REMOTE_PREFIX+'/render/queue/add',['song','wav','ribbons','landscape','T','A',1,6,'/tmp',null,1,'bottom','/tmp/c.png','frame']);
 assert.equal(queued.type,'renderQueueAdd');
 assert.equal(queued.placement,'bottom');
 assert.equal(queued.coverMode,'frame');
 assert.equal(queued.coverPath,'/tmp/c.png');
 assert.deepEqual(remoteCommand(REMOTE_PREFIX+'/render/queue/list',[]),{type:'renderQueueList'});
 assert.equal(remoteCommand(REMOTE_PREFIX+'/render/queue/cancel',['rj-abc']).jobId,'rj-abc');
 assert.deepEqual(remoteCommand(REMOTE_PREFIX+'/render/queue/clear',[]),{type:'renderQueueClear'});
 assert.throws(()=>remoteCommand(REMOTE_PREFIX+'/render/song',['flac']));
 assert.throws(()=>remoteCommand(REMOTE_PREFIX+'/render/song',['wav','neon']));
 assert.throws(()=>remoteCommand(REMOTE_PREFIX+'/render/queue/add',['song','wav','pulse','vertical','','',1,2,null,null,1,'corner']));
});

test('render queue serializes bounce and overlaps encode; failures are isolated',async()=>{
 const log=[];
 const queue=createRenderQueue({
  maxEncode:2,
  onUpdate:p=>log.push(p.event),
  async bounce(job){
   await new Promise(r=>setTimeout(r,20));
   if(job.options.failBounce)throw Error('bounce failed');
   return {wav:new ArrayBuffer(8),timeline:{format:'generant-render-timeline'},sampleRate:48000};
  },
  async encode(job){
   await new Promise(r=>setTimeout(r,30));
   if(job.options.failEncode)throw Error('encode failed');
   return {ok:true,dir:'/tmp/'+job.id,files:{wav:'/tmp/'+job.id+'.wav'}};
  }
 });
 const a=queue.add({title:'A'});
 const b=queue.add({title:'B',failEncode:true});
 const c=queue.add({title:'C'});
 const doneA=await queue.wait(a);
 assert.equal(doneA.ok,true);
 await assert.rejects(()=>queue.wait(b),/encode failed/);
 const doneC=await queue.wait(c);
 assert.equal(doneC.ok,true);
 const jobs=queue.list();
 assert.equal(jobs.find(j=>j.id===a).status,'done');
 assert.equal(jobs.find(j=>j.id===b).status,'failed');
 assert.equal(jobs.find(j=>j.id===c).status,'done');
 const d=queue.add({title:'D'});
 queue.cancel(d);
 await assert.rejects(()=>queue.wait(d),e=>e.canceled);
 assert.ok(log.includes('queued'));
 assert.ok(log.includes('complete'));
 assert.ok(log.includes('failed'));
});

test('CLI preview pipeline writes WAV, timeline, frames and MP4 in two aspects',async t=>{
 const ffmpeg=await probeFfmpeg();
 if(!ffmpeg.ok){t.skip(ffmpeg.error);return;}
 const project=upgrade(demoProject());
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'generant-render-'));
 for(const [mode,aspect,style] of [['song','vertical','pulse'],['pattern','square','bars']]){
  const timeline=buildRenderTimeline(project,{mode,aspect,style,maxSeconds:0.8});
  timeline.durationSeconds=0.8;
  const mix=previewSynthFromTimeline(timeline,{sampleRate:22050,maxSeconds:0.8});
  const wavPath=path.join(dir,`${mode}-${aspect}.wav`);
  await saveBinary(wavPath,encodePcm16Wav(mix.left,mix.right,22050));
  await fs.writeFile(path.join(dir,`${mode}-${aspect}.timeline.json`),JSON.stringify(timeline));
  const analysis=analyzeAudio(mix.left,mix.right,22050);
  const cover={width:48,height:48,pixels:new Uint8Array(48*48*4)};
  for(let i=0;i<cover.pixels.length;i+=4){cover.pixels[i]=30+i%200;cover.pixels[i+1]=80;cover.pixels[i+2]=160;cover.pixels[i+3]=255;}
  const frameList=[...iterateFrames(timeline,analysis,{
   style,aspect,fps:8,maxSeconds:0.8,scale:.25,title:'Generant',artist:'Demo',
   overlay:true,placement:'auto',cover,coverMode:style==='bars'?'frame':'backdrop'
  })];
  const {width,height}=frameList[0];
  const videoPath=path.join(dir,`${mode}-${aspect}.mp4`);
  await encodeVideoFromFrames({
   wavPath,outPath:videoPath,width,height,fps:8,
   frames:(async function*(){for(const f of frameList)yield f;})()
  });
  await writePpmFrame(path.join(dir,`${mode}-${aspect}-frame.ppm`),frameList[0].pixels,width,height);
  assert.ok((await fs.stat(videoPath)).size>500);
 }
 assert.equal(Object.keys(RENDER_ASPECTS).length,3);
});
