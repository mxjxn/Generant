import {RENDER_STYLES,RENDER_ASPECTS,AUDIO_FORMATS,OVERLAY_PLACEMENTS,COVER_MODES,sanitizeName} from '/shared/render.mjs';
import {escape} from './studio-shell.mjs';
import {getRenderHost} from './render-host.mjs';

export function renderPanel({store,engine,report,audioAction}){
 const host=getRenderHost({store,engine,report});
 const dialog=document.createElement('dialog');
 dialog.id='renderShareDialog';
 dialog.innerHTML=`<form method="dialog" class="settings-heading"><strong>Render &amp; Share</strong><button value="cancel" aria-label="Close render dialog">Close</button></form>
 <form class="render-form">
  <label>Source <select data-mode><option value="song">Whole song</option><option value="pattern">Current pattern</option></select></label>
  <label>Audio <select data-format>${AUDIO_FORMATS.map(f=>`<option value="${f}">${f.toUpperCase()}</option>`).join('')}</select></label>
  <label><input type="checkbox" data-video checked> Also render share video (MP4)</label>
  <label>Style <select data-style>${RENDER_STYLES.map(s=>`<option value="${s}">${s}</option>`).join('')}</select></label>
  <label>Aspect <select data-aspect>${Object.entries(RENDER_ASPECTS).map(([id,a])=>`<option value="${id}">${a.label} · ${a.width}×${a.height}</option>`).join('')}</select></label>
  <label>Title <input data-title maxlength="80" placeholder="Track title"></label>
  <label>Artist <input data-artist maxlength="80" placeholder="Artist"></label>
  <label><input type="checkbox" data-overlay checked> Text overlay</label>
  <label>Placement <select data-placement>${OVERLAY_PLACEMENTS.map(p=>`<option value="${p}">${p}</option>`).join('')}</select></label>
  <label>Cover mode <select data-cover-mode>${COVER_MODES.map(p=>`<option value="${p}">${p}</option>`).join('')}</select></label>
  <div class="render-cover-row"><button type="button" data-cover>Choose cover…</button><small data-cover-path class="muted">No cover</small></div>
  <label>Tail (sec) <input data-tail type="number" min="0" max="8" step="0.1" value="1.5"></label>
  <p class="muted" data-status>Jobs queue: one SuperSonic bounce at a time; ffmpeg encodes can overlap.</p>
  <div class="render-actions">
   <button type="button" data-run class="primary">Enqueue</button>
   <button type="button" data-folder>Output folder…</button>
   <button type="button" data-clear>Clear finished</button>
  </div>
 </form>
 <section class="render-queue" aria-label="Render queue">
  <strong>Queue</strong>
  <div data-queue-list class="render-queue-list"><p class="muted">No jobs yet.</p></div>
 </section>`;
 document.body.append(dialog);
 const $=s=>dialog.querySelector(s);
 let coverPath=null;

 function fillMeta(){
  const meta=host.meta();
  if(!$('[data-title]').value)$('[data-title]').value=meta.title||store.project.name||'';
  if(!$('[data-artist]').value)$('[data-artist]').value=meta.artist||'Generant';
 }

 function optionsFromForm(){
  return{
   mode:$('[data-mode]').value,
   format:$('[data-format]').value,
   video:$('[data-video]').checked,
   style:$('[data-style]').value,
   aspect:$('[data-aspect]').value,
   title:$('[data-title]').value,
   artist:$('[data-artist]').value,
   overlay:$('[data-overlay]').checked,
   placement:$('[data-placement]').value,
   coverMode:$('[data-cover-mode]').value,
   coverPath,
   tail:+$('[data-tail]').value,
   outBase:sanitizeName(($('[data-title]').value||store.project.name||'render')+'-'+$('[data-mode]').value)
  };
 }

 function renderQueue(jobs){
  const box=$('[data-queue-list]');
  if(!jobs?.length){box.innerHTML='<p class="muted">No jobs yet.</p>';return;}
  box.innerHTML=jobs.slice().reverse().map(j=>{
   const file=j.result?.files?.video||j.result?.files?.audio||j.result?.dir||'';
   const pct=Math.round((j.progress||0)*100);
   return `<article class="render-job" data-job="${escape(j.id)}">
    <header><code>${escape(j.id)}</code><span class="badge">${escape(j.status)}</span></header>
    <div class="render-job-title">${escape(j.title||j.mode||'render')} · ${escape(j.style||'')} · ${escape(j.aspect||'')}</div>
    <div class="muted">${escape(j.message||'')}</div>
    <progress max="1" value="${j.progress||0}"></progress>
    <div class="render-job-actions">
     ${j.status==='queued'||j.status==='bouncing'||j.status==='encoding'?`<button type="button" data-cancel="${escape(j.id)}">Cancel</button>`:''}
     ${file?`<button type="button" data-reveal="${escape(file)}">Reveal</button>`:''}
     <span class="muted">${pct}%</span>
    </div>
   </article>`;
  }).join('');
  box.querySelectorAll('[data-cancel]').forEach(b=>b.onclick=()=>{try{host.cancel(b.dataset.cancel);}catch(e){report(e.message,true);}});
  box.querySelectorAll('[data-reveal]').forEach(b=>b.onclick=()=>host.reveal(b.dataset.reveal)?.catch(e=>report(e.message,true)));
 }

 host.subscribe(payload=>renderQueue(payload.jobs||host.list()));

 async function enqueue(){
  const status=$('[data-status]');
  try{
   status.textContent='Enqueueing…';
   const result=await host.enqueue(optionsFromForm());
   status.textContent='Queued '+result.jobId+(host.lastOutParent?' → '+host.lastOutParent:'');
   report('Render queued: '+result.jobId);
  }catch(e){
   if(e?.canceled){status.textContent='Canceled.';return;}
   status.textContent=e.message;report(e.message,true);
  }
 }

 $('[data-run]').onclick=e=>{e.preventDefault();enqueue();};
 $('[data-clear]').onclick=e=>{e.preventDefault();host.clearFinished();};
 $('[data-folder]').onclick=async e=>{
  e.preventDefault();
  try{
   if(!window.desktop?.pickRenderFolder)throw Error('Desktop folder picker unavailable.');
   const folder=await window.desktop.pickRenderFolder();
   if(folder){host.setOutParent(folder);$('[data-status]').textContent='Output folder: '+folder;}
  }catch(err){report(err.message,true);}
 };
 $('[data-cover]').onclick=async e=>{
  e.preventDefault();
  try{
   const path=await host.pickCover();
   if(path){coverPath=path;$('[data-cover-path]').textContent=path.split(/[/\\]/).pop();}
  }catch(err){report(err.message,true);}
 };

 function open(preset={}){
  if(preset.mode)$('[data-mode]').value=preset.mode;
  fillMeta();
  renderQueue(host.list());
  if(!dialog.open)dialog.showModal();
 }
 return {open,host};
}
