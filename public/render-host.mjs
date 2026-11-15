import {createRenderQueue} from '/shared/render-queue.mjs';
import {parseRenderOptions,sanitizeName,projectRenderMeta} from '/shared/render.mjs';

/** Singleton render queue that survives dialog close. */
let host=null;

export function getRenderHost({engine,store,report=()=>{}}={}){
 if(host){
  if(engine)host.engine=engine;
  if(store)host.store=store;
  if(report)host.report=report;
  return host;
 }

 const listeners=new Set();
 const notify=(payload)=>{for(const fn of listeners)try{fn(payload);}catch{}};

 const queue=createRenderQueue({
  maxEncode:2,
  onUpdate:payload=>{
   notify(payload);
   if(window.desktop?.renderEvent)window.desktop.renderEvent(payload);
  },
  async bounce(job,onProgress){
   const project=host.store.project;
   const options=parseRenderOptions(job.options,project);
   const result=await host.engine.render(project,options,onProgress);
   return {wav:result.wav,timeline:result.timeline,sampleRate:result.sampleRate,duration:result.duration,options};
  },
  async encode(job,bounceResult,onProgress){
   const options=parseRenderOptions({...bounceResult.options,...job.options},host.store.project);
   if(!options.outBase)options.outBase=sanitizeName((options.title||host.store.project.name||'render')+'-'+options.mode);
   if(!options.outDir){
    if(!host.lastOutParent)throw Error('No render output folder selected.');
    options.outDir=`${host.lastOutParent}/${options.outBase}`;
   }
   const payload={
    options,
    timeline:bounceResult.timeline,
    wav:Array.from(new Uint8Array(bounceResult.wav)),
    sampleRate:bounceResult.sampleRate
   };
   const progress=(info,msg)=>{
    if(typeof info==='object'&&info)onProgress(info.progress??0,info.message||msg||'');
    else onProgress(info,msg);
   };
   if(!window.desktop?.exportRenderTo){
    const blob=new Blob([bounceResult.wav],{type:'audio/wav'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=options.outBase+'.wav';a.click();
    const side=new Blob([JSON.stringify(bounceResult.timeline,null,2)],{type:'application/json'});
    const b=document.createElement('a');b.href=URL.createObjectURL(side);b.download=options.outBase+'.timeline.json';b.click();
    progress(1,'Downloaded WAV + timeline');
    return {ok:true,dir:null,files:{wav:options.outBase+'.wav',timeline:options.outBase+'.timeline.json'}};
   }
   // exportRenderTo expects progress via IPC events on desktop; invoke returns final result.
   // Hook progress through a temporary listener when available.
   let unsub=null;
   if(window.desktop?.onRenderProgress){
    unsub=window.desktop.onRenderProgress(msg=>progress(msg?.progress??0,msg?.message));
   }
   try{
    const saved=await window.desktop.exportRenderTo(payload);
    if(!saved)throw Object.assign(Error('Canceled'),{canceled:true});
    progress(1,'Saved');
    host.report?.('Render complete: '+(saved.files?.video||saved.files?.audio||saved.dir));
    return saved;
   }finally{if(typeof unsub==='function')unsub();}
  }
 });

 async function ensureOutParent(){
  if(host.lastOutParent)return host.lastOutParent;
  if(!window.desktop?.pickRenderFolder){
   host.lastOutParent='/tmp/generant-renders';
   return host.lastOutParent;
  }
  const folder=await window.desktop.pickRenderFolder();
  if(!folder)throw Object.assign(Error('Canceled'),{canceled:true});
  host.lastOutParent=folder;
  return folder;
 }

 host={
  engine,store,report,queue,lastOutParent:null,
  subscribe(fn){listeners.add(fn);fn({jobs:queue.list(),event:'sync'});return()=>listeners.delete(fn);},
  list:()=>queue.list(),
  meta(){return projectRenderMeta(store.project);},
  async enqueue(raw={},{wait=false}={}){
   const options=parseRenderOptions(raw,store.project);
   if(!options.outBase)options.outBase=sanitizeName((options.title||store.project.name||'render')+'-'+options.mode);
   if(!options.outDir){
    await ensureOutParent();
    options.outDir=`${host.lastOutParent}/${options.outBase}`;
   }
   const id=queue.add(options);
   if(wait){
    const result=await queue.wait(id);
    return {jobId:id,result};
   }
   return {jobId:id,queued:true};
  },
  cancel:id=>queue.cancel(id),
  clearFinished:()=>queue.clearFinished(),
  wait:id=>queue.wait(id),
  setOutParent(path){host.lastOutParent=path;},
  async pickCover(){return window.desktop?.pickCoverImage?window.desktop.pickCoverImage():null;},
  reveal(path){return window.desktop?.revealPath?.(path);}
 };
 return host;
}
