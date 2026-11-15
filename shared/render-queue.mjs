// Serial SuperSonic bounce + overlapping ffmpeg encode pipeline.
export const RENDER_JOB_STATUSES=['queued','bouncing','encoding','done','failed','canceled'];

const uid=()=>'rj-'+Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);

export function createRenderQueue({
 bounce,          // async (job, onProgress) => {wav, timeline, sampleRate, duration?}
 encode,          // async (job, bounceResult, onProgress) => {ok, dir, files, duration?}
 onUpdate=()=>{},
 maxEncode=2,
 maxHistory=40
}={}){
 if(typeof bounce!=='function'||typeof encode!=='function')throw Error('bounce and encode handlers required.');
 const jobs=[];
 let bounceBusy=false;
 let encodeBusy=0;

 function snapshot(){
  return jobs.map(j=>({
   id:j.id,status:j.status,progress:j.progress,message:j.message,
   mode:j.options?.mode,style:j.options?.style,aspect:j.options?.aspect,
   title:j.options?.title||'',artist:j.options?.artist||'',
   createdAt:j.createdAt,startedAt:j.startedAt||null,finishedAt:j.finishedAt||null,
   result:j.result||null,error:j.error||null
  }));
 }

 function emit(extra={}){onUpdate({jobs:snapshot(),...extra});}

 function trim(){
  const active=jobs.filter(j=>!['done','failed','canceled'].includes(j.status));
  const finished=jobs.filter(j=>['done','failed','canceled'].includes(j.status)).slice(-maxHistory);
  jobs.length=0;jobs.push(...active,...finished);
 }

 function add(options={},meta={}){
  const job={
   id:meta.id||uid(),
   status:'queued',progress:0,message:'Queued',
   options:{...options},
   createdAt:Date.now(),startedAt:null,finishedAt:null,
   result:null,error:null,cancelRequested:false,
   bounceResult:null,encodeStarted:false
  };
  jobs.push(job);
  emit({event:'queued',jobId:job.id});
  queueMicrotask(pump);
  return job.id;
 }

 function get(id){return jobs.find(j=>j.id===id)||null;}

 function cancel(id){
  const job=get(id);
  if(!job)throw Error('Render job not found.');
  if(job.status==='done'||job.status==='failed'||job.status==='canceled')return snapshot().find(j=>j.id===id);
  job.cancelRequested=true;
  if(job.status==='queued'){
   job.status='canceled';job.progress=1;job.message='Canceled';job.finishedAt=Date.now();
   emit({event:'canceled',jobId:job.id});
  }else{
   job.message='Cancel requested…';
   emit({event:'progress',jobId:job.id,progress:job.progress,message:job.message,status:job.status});
  }
  return snapshot().find(j=>j.id===id);
 }

 function clearFinished(){
  for(let i=jobs.length-1;i>=0;i--)if(['done','failed','canceled'].includes(jobs[i].status))jobs.splice(i,1);
  emit({event:'cleared'});
 }

 function progress(job,p,message,status=job.status){
  job.progress=Math.max(0,Math.min(1,p));
  if(message)job.message=message;
  job.status=status;
  emit({event:'progress',jobId:job.id,progress:job.progress,message:job.message,status:job.status});
 }

 function failOrCancel(job,error){
  job.finishedAt=Date.now();
  job.bounceResult=null;
  if(error?.canceled||job.cancelRequested){
   job.status='canceled';job.message='Canceled';job.progress=1;job.error=null;
   emit({event:'canceled',jobId:job.id});
  }else{
   job.status='failed';job.error=error.message||String(error);job.message=job.error;job.progress=1;
   emit({event:'failed',jobId:job.id,error:job.error});
  }
  trim();
 }

 async function runBounce(job){
  bounceBusy=true;job.startedAt=Date.now();
  try{
   if(job.cancelRequested)throw Object.assign(Error('Canceled'),{canceled:true});
   progress(job,0.02,'Starting bounce…','bouncing');
   const result=await bounce(job,(p,msg)=>progress(job,0.02+p*0.55,msg,'bouncing'));
   if(job.cancelRequested)throw Object.assign(Error('Canceled'),{canceled:true});
   job.bounceResult=result;
   progress(job,0.58,'Bounce complete — encoding…','encoding');
  }catch(error){failOrCancel(job,error);}
  finally{bounceBusy=false;queueMicrotask(pump);}
 }

 async function runEncode(job){
  encodeBusy++;
  try{
   if(job.cancelRequested)throw Object.assign(Error('Canceled'),{canceled:true});
   const saved=await encode(job,job.bounceResult,(p,msg)=>progress(job,0.58+p*0.4,msg,'encoding'));
   if(job.cancelRequested)throw Object.assign(Error('Canceled'),{canceled:true});
   job.result=saved;job.status='done';job.progress=1;job.message='Done';job.finishedAt=Date.now();
   job.bounceResult=null;
   emit({event:'complete',jobId:job.id,result:saved});
   trim();
  }catch(error){failOrCancel(job,error);}
  finally{encodeBusy--;queueMicrotask(pump);}
 }

 function pump(){
  if(!bounceBusy){
   const next=jobs.find(j=>j.status==='queued');
   if(next)runBounce(next);
  }
  for(const job of jobs){
   if(encodeBusy>=maxEncode)break;
   if(job.status==='encoding'&&job.bounceResult&&!job.encodeStarted){
    job.encodeStarted=true;
    runEncode(job);
   }
  }
 }

 return {
  add,cancel,clearFinished,get,list:()=>snapshot(),
  get size(){return jobs.length;},
  wait(id){
   const job=get(id);if(!job)return Promise.reject(Error('Render job not found.'));
   if(job.status==='done')return Promise.resolve(job.result);
   if(job.status==='failed')return Promise.reject(Error(job.error||'Render failed'));
   if(job.status==='canceled')return Promise.reject(Object.assign(Error('Canceled'),{canceled:true}));
   return new Promise((resolve,reject)=>{
    const timer=setInterval(()=>{
     if(job.status==='done'){clearInterval(timer);resolve(job.result);}
     else if(job.status==='failed'){clearInterval(timer);reject(Error(job.error||'Render failed'));}
     else if(job.status==='canceled'){clearInterval(timer);reject(Object.assign(Error('Canceled'),{canceled:true}));}
    },40);
   });
  }
 };
}
