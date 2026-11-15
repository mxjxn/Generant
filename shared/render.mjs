// Render timeline, WAV helpers, offline preview synth, and audio analysis for share videos.
import {compileSong} from './song.mjs';

export const RENDER_STYLES=['pulse','ribbons','lattice','bars'];
export const RENDER_ASPECTS={
 vertical:{id:'vertical',label:'9:16',width:1080,height:1920},
 square:{id:'square',label:'1:1',width:1080,height:1080},
 landscape:{id:'landscape',label:'16:9',width:1920,height:1080}
};
export const AUDIO_FORMATS=['wav','mp3','aac'];
export const VIDEO_FORMATS=['mp4'];
export const OVERLAY_PLACEMENTS=['auto','top-left','top','bottom-left','bottom','safe'];
export const COVER_MODES=['auto','frame','backdrop','off'];

const finite=v=>typeof v==='number'&&Number.isFinite(v);
const text=v=>typeof v==='string'&&v.length>0&&v.length<=240;

export function sanitizeName(name='render'){
 return String(name||'render').replace(/[^a-z0-9._-]+/gi,'_').replace(/^_+|_+$/g,'').slice(0,80)||'render';
}

/** Social-safe margins as fractions of width/height. */
export function safeMargins(aspect='vertical'){
 if(aspect==='square')return{top:.1,bottom:.1,left:.08,right:.08};
 if(aspect==='landscape')return{top:.1,bottom:.12,left:.08,right:.08};
 return{top:.12,bottom:.18,left:.06,right:.06}; // vertical / Reels / Shorts
}

export function defaultPlacement(aspect='vertical'){
 return aspect==='landscape'?'bottom-left':'top-left';
}

export function defaultCoverMode(style='pulse'){
 return style==='lattice'||style==='bars'?'frame':'backdrop';
}

/** Pull title/artist defaults from project when fields are blank. */
export function projectRenderMeta(project={}){
 const title=String(project.name||'').slice(0,80);
 const artist=String(project.artist||project.meta?.artist||project.meta?.author||'Generant').slice(0,80);
 const coverPath=project.coverPath||project.meta?.coverPath||null;
 return{title,artist,coverPath};
}

export function parseRenderOptions(raw={},project=null){
 const mode=raw.mode==='pattern'?'pattern':'song';
 const format=AUDIO_FORMATS.includes(raw.format)?raw.format:'wav';
 const videoFormat=VIDEO_FORMATS.includes(raw.videoFormat)?raw.videoFormat:'mp4';
 const style=RENDER_STYLES.includes(raw.style)?raw.style:'pulse';
 const aspect=RENDER_ASPECTS[raw.aspect]?raw.aspect:'vertical';
 const fps=finite(raw.fps)?Math.max(12,Math.min(60,Math.round(raw.fps))):30;
 const tail=finite(raw.tail)?Math.max(0,Math.min(8,raw.tail)):1.5;
 const sampleRate=finite(raw.sampleRate)?Math.round(raw.sampleRate):48000;
 if(sampleRate<22050||sampleRate>96000)throw Error('Sample rate must be 22050–96000.');
 const meta=project?projectRenderMeta(project):{title:'',artist:'',coverPath:null};
 const title=(typeof raw.title==='string'&&raw.title.length)?raw.title.slice(0,80):(meta.title||'');
 const artist=(typeof raw.artist==='string'&&raw.artist.length)?raw.artist.slice(0,80):(meta.artist||'');
 const placement=OVERLAY_PLACEMENTS.includes(raw.placement)?raw.placement:'auto';
 const coverMode=COVER_MODES.includes(raw.coverMode)?raw.coverMode:'auto';
 const overlay=raw.overlay===false||raw.overlay===0||raw.overlay==='0'?false:true;
 const out={
  mode,format,videoFormat,style,aspect,fps,tail,sampleRate,
  patternId:text(raw.patternId)?raw.patternId:null,
  pattern:text(raw.pattern)?raw.pattern:null,
  bankLane:text(raw.bankLane)?raw.bankLane:null,
  title,artist,
  overlay,placement,
  coverPath:text(raw.coverPath)?raw.coverPath:(text(meta.coverPath)?meta.coverPath:null),
  coverMode,
  outDir:text(raw.outDir)?raw.outDir:null,
  outBase:text(raw.outBase)?sanitizeName(raw.outBase):null,
  stems:!!raw.stems,
  video:raw.video!==false,
  normalize:raw.normalize!==false,
  preview:!!raw.preview,
  maxSeconds:finite(raw.maxSeconds)?Math.max(1,Math.min(600,raw.maxSeconds)):null,
  previewFrames:finite(raw.previewFrames)?Math.max(0,Math.min(12,Math.round(raw.previewFrames))):4
 };
 return out;
}

export function resolvePatternId(project,options={}){
 if(options.patternId&&project.song?.patterns.some(p=>p.id===options.patternId))return options.patternId;
 if(options.pattern){
  const hit=project.song?.patterns.find(p=>p.id===options.pattern||p.name===options.pattern);
  if(hit)return hit.id;
  throw Error('Pattern was not found.');
 }
 return project.song?.editPatternId??null;
}

export function buildRenderTimeline(project,options={}){
 const opts=parseRenderOptions(options);
 const patternId=resolvePatternId(project,opts);
 const compiled=compileSong(project,{
  mode:opts.mode,
  loop:false,
  patternId:opts.mode==='pattern'?patternId:undefined
 });
 const bpm=compiled.bpm;
 const totalBeats=compiled.playback?.total??compiled.bars*4;
 const durationSeconds=totalBeats*60/bpm;
 const segments=(compiled.playback?.segments??[]).map(s=>({
  entryId:s.entryId,patternId:s.patternId,startBeat:s.start,beats:s.beats,
  startSeconds:s.start*60/bpm,durationSeconds:s.beats*60/bpm,
  section:project.song?.order.find(e=>e.id===s.entryId)?.section||'',
  patternName:project.song?.patterns.find(p=>p.id===s.patternId)?.name||s.patternId
 }));
 const tracks=[];
 const pushNotes=(deviceId,name,type,notes)=>{
  tracks.push({
   deviceId,name,type,
   notes:(notes??[]).map(n=>({
    beat:n.beat,seconds:n.beat*60/bpm,pitch:n.pitch,duration:n.duration,
    durationSeconds:n.duration*60/bpm,velocity:n.velocity??.75,column:n.column??0
   }))
  });
 };
 pushNotes('keys',project.studio?.devices.find(d=>d.id==='keys')?.name||'Keys','keys',compiled.notes);
 for(const d of (compiled.studio?.devices??[]).filter(d=>['keys','kit','clip'].includes(d.type)&&d.id!=='keys')){
  const track=compiled.studio.tracks.find(t=>t.deviceId===d.id);
  const clip=compiled.studio.clips.find(c=>c.id===track?.clipId);
  pushNotes(d.id,d.name,d.type,clip?.notes??[]);
 }
 const drums=(compiled.drumEvents??[]).map(e=>({
  beat:e.beat,seconds:e.beat*60/bpm,pad:e.pad,velocity:e.velocity
 }));
 const oscEvents=[];
 for(const t of compiled.studio?.oscTracks??[]){
  for(const e of t.events??[]){
   oscEvents.push({
    trackId:t.id,beat:e.beat,seconds:e.beat*60/bpm,
    address:e.address,args:e.args,kind:e.kind
   });
  }
 }
 const patternChanges=segments.map(s=>({
  beat:s.startBeat,seconds:s.startSeconds,patternId:s.patternId,
  patternName:s.patternName,section:s.section,entryId:s.entryId
 }));
 return {
  format:'generant-render-timeline',
  version:1,
  name:project.name,
  mode:opts.mode,
  patternId:opts.mode==='pattern'?patternId:null,
  bpm,
  bars:compiled.bars,
  totalBeats,
  durationSeconds,
  sampleRate:opts.sampleRate,
  segments,
  patternChanges,
  tracks,
  drums,
  oscEvents,
  options:{style:opts.style,aspect:opts.aspect,fps:opts.fps,title:opts.title,artist:opts.artist}
 };
}

export function encodePcm16Wav(left,right,sampleRate=48000){
 if(!(left instanceof Float32Array)||!(right instanceof Float32Array))throw Error('Stereo Float32 channels required.');
 const frames=Math.min(left.length,right.length);
 const bytes=44+frames*4;
 const buffer=new ArrayBuffer(bytes);
 const v=new DataView(buffer);
 const str=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i));};
 str(0,'RIFF');v.setUint32(4,bytes-8,true);str(8,'WAVE');str(12,'fmt ');
 v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,2,true);
 v.setUint32(24,sampleRate,true);v.setUint32(28,sampleRate*4,true);
 v.setUint16(32,4,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,frames*4,true);
 let o=44;
 for(let i=0;i<frames;i++){
  const L=Math.max(-1,Math.min(1,left[i]||0));
  const R=Math.max(-1,Math.min(1,right[i]||0));
  v.setInt16(o,(L*32767)|0,true);v.setInt16(o+2,(R*32767)|0,true);o+=4;
 }
 return buffer;
}

export function normalizeStereo(left,right,peakTarget=.97){
 let peak=1e-9;
 for(let i=0;i<left.length;i++){peak=Math.max(peak,Math.abs(left[i]||0),Math.abs(right[i]||0));}
 const gain=peak>1e-6?peakTarget/peak:1;
 if(gain>=.999&&gain<=1.001)return {left,right,gain:1,peak};
 const L=new Float32Array(left.length),R=new Float32Array(right.length);
 for(let i=0;i<left.length;i++){L[i]=(left[i]||0)*gain;R[i]=(right[i]||0)*gain;}
 return {left:L,right:R,gain,peak};
}

export function decodeWavPcm(buffer){
 const bytes=buffer instanceof ArrayBuffer?buffer:buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength);
 const v=new DataView(bytes);
 if(String.fromCharCode(...new Uint8Array(bytes,0,4))!=='RIFF'||String.fromCharCode(...new Uint8Array(bytes,8,4))!=='WAVE')throw Error('Not a WAV file.');
 let offset=12,fmt=null,dataOffset=0,dataSize=0;
 while(offset+8<=bytes.byteLength){
  const id=String.fromCharCode(...new Uint8Array(bytes,offset,4));
  const size=v.getUint32(offset+4,true);offset+=8;
  if(id==='fmt '){
   fmt={audioFormat:v.getUint16(offset,true),channels:v.getUint16(offset+2,true),sampleRate:v.getUint32(offset+4,true),bits:v.getUint16(offset+14,true)};
  }else if(id==='data'){dataOffset=offset;dataSize=size;break;}
  offset+=size+(size&1);
 }
 if(!fmt||!dataSize)throw Error('WAV missing fmt/data.');
 const frames=Math.floor(dataSize/(fmt.channels*(fmt.bits/8)));
 const left=new Float32Array(frames),right=new Float32Array(frames);
 if(fmt.audioFormat===1&&fmt.bits===16){
  for(let i=0;i<frames;i++){
   left[i]=v.getInt16(dataOffset+i*fmt.channels*2,true)/32768;
   right[i]=fmt.channels>1?v.getInt16(dataOffset+i*fmt.channels*2+2,true)/32768:left[i];
  }
 }else if(fmt.audioFormat===3&&fmt.bits===32){
  for(let i=0;i<frames;i++){
   left[i]=v.getFloat32(dataOffset+i*fmt.channels*4,true);
   right[i]=fmt.channels>1?v.getFloat32(dataOffset+i*fmt.channels*4+4,true):left[i];
  }
 }else throw Error('Only PCM16 or float32 WAV supported.');
 return {left,right,sampleRate:fmt.sampleRate,channels:fmt.channels};
}

/** Lightweight offline mix from timeline notes — CLI/preview only, not SuperSonic quality. */
export function previewSynthFromTimeline(timeline,{sampleRate=48000,maxSeconds=null}={}){
 const duration=Math.min(timeline.durationSeconds+(timeline.options?.tail??1.5),maxSeconds??600);
 const frames=Math.max(1,Math.floor(duration*sampleRate));
 const left=new Float32Array(frames),right=new Float32Array(frames);
 const writeTone=(startSec,durSec,freq,amp,pan=0)=>{
  const start=Math.max(0,Math.floor(startSec*sampleRate));
  const end=Math.min(frames,Math.floor((startSec+durSec)*sampleRate));
  const L=.707*(1-pan),R=.707*(1+pan);
  for(let i=start;i<end;i++){
   const t=(i-start)/sampleRate;
   const env=Math.min(1,t*40)*Math.exp(-t*3.2);
   const s=Math.sin(2*Math.PI*freq*t)*amp*env;
   left[i]+=s*L;right[i]+=s*R;
  }
 };
 for(const track of timeline.tracks??[]){
  const pan=track.type==='kit'?-.2:track.type==='clip'?.25:0;
  for(const n of track.notes){
   const freq=440*2**((n.pitch-69)/12);
   const amp=(n.velocity??.7)*.18*(track.type==='kit'?.9:.55);
   writeTone(n.seconds,Math.max(.05,n.durationSeconds||.2),freq,amp,pan+(n.column||0)*.05);
  }
 }
 for(const d of timeline.drums??[]){
  const freq=[55,180,6000,220][d.pad%4];
  writeTone(d.seconds,.18+(d.pad===0?.2:0),freq,(d.velocity??.7)*.28,d.pad%2?-.35:.35);
 }
 return normalizeStereo(left,right);
}

export function analyzeAudio(left,right,sampleRate,{hop=1024,bands=8}={}){
 const frames=Math.min(left.length,right.length);
 const windows=Math.max(1,Math.floor((frames-hop)/hop));
 const energy=new Float32Array(windows);
 const bandEnergy=Array.from({length:bands},()=>new Float32Array(windows));
 const onsets=[];
 let prev=0;
 for(let w=0;w<windows;w++){
  let sum=0,bass=0,mid=0,high=0;
  const start=w*hop;
  for(let i=0;i<hop;i++){
   const s=((left[start+i]||0)+(right[start+i]||0))*.5;
   sum+=s*s;
   const phase=i/hop;
   // Cheap spectral proxy via differencing / zero-cross density.
   if(i>0){
    const d=s-((left[start+i-1]||0)+(right[start+i-1]||0))*.5;
    const ad=Math.abs(d);
    if(phase<.2)bass+=ad;else if(phase<.6)mid+=ad;else high+=ad;
   }
  }
  const e=Math.sqrt(sum/hop);
  energy[w]=e;
  const parts=[bass,bass*.6+mid*.4,mid,mid*.5+high*.5,high,high*.7,e,e*.5+high*.5];
  for(let b=0;b<bands;b++)bandEnergy[b][w]=parts[b%parts.length]/hop;
  if(e>prev*1.55+0.02)onsets.push(w*hop/sampleRate);
  prev=e*.85+prev*.15;
 }
 return {energy,bandEnergy,onsets,hop,sampleRate,duration:frames/sampleRate};
}

export function eventsAtTime(timeline,seconds,window=.05){
 const notes=[];
 for(const track of timeline.tracks??[])for(const n of track.notes){
  if(n.seconds<=seconds&&n.seconds+Math.max(.05,n.durationSeconds)>seconds-window)notes.push({...n,deviceId:track.deviceId,type:track.type});
 }
 const drums=(timeline.drums??[]).filter(d=>Math.abs(d.seconds-seconds)<=window);
 const change=(timeline.patternChanges??[]).filter(c=>Math.abs(c.seconds-seconds)<=window);
 return {notes,drums,change};
}
