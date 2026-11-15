import {RENDER_STYLES,RENDER_ASPECTS,AUDIO_FORMATS,sanitizeName} from '/shared/render.mjs';
import {escape} from './studio-shell.mjs';

export function renderPanel({store,engine,report,audioAction}){
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
  <label>Tail (sec) <input data-tail type="number" min="0" max="8" step="0.1" value="1.5"></label>
  <p class="muted" data-status>Realtime SuperSonic bounce → WAV/MP3, then ffmpeg visualizer MP4.</p>
  <div class="render-actions"><button type="button" data-run class="primary">Render</button><progress data-progress max="1" value="0" hidden></progress></div>
 </form>`;
 document.body.append(dialog);
 const $=s=>dialog.querySelector(s);
 $('[data-title]').value=store.project.name||'';
 async function run(){
  const btn=$('[data-run]'),progress=$('[data-progress]'),status=$('[data-status]');
  if(btn.disabled)return;
  btn.disabled=true;progress.hidden=false;progress.value=0;
  const options={
   mode:$('[data-mode]').value,
   format:$('[data-format]').value,
   video:$('[data-video]').checked,
   style:$('[data-style]').value,
   aspect:$('[data-aspect]').value,
   title:$('[data-title]').value,
   artist:$('[data-artist]').value,
   tail:+$('[data-tail]').value,
   outBase:sanitizeName(($('[data-title]').value||store.project.name||'render')+'-'+$('[data-mode]').value)
  };
  try{
   await audioAction(async()=>{
    status.textContent='Bouncing audio…';
    const result=await engine.render(store.project,options,(p,msg)=>{progress.value=p*.55;status.textContent=msg;});
    status.textContent='Writing files…';progress.value=.6;
    if(!window.desktop?.exportRender){
     const blob=new Blob([result.wav],{type:'audio/wav'});
     const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=options.outBase+'.wav';a.click();
     const side=new Blob([JSON.stringify(result.timeline,null,2)],{type:'application/json'});
     const b=document.createElement('a');b.href=URL.createObjectURL(side);b.download=options.outBase+'.timeline.json';b.click();
     status.textContent='Downloaded WAV + timeline (desktop app required for MP3/MP4).';
     report('Render downloaded: '+options.outBase+'.wav');
     return;
    }
    const payload={
     options,
     timeline:result.timeline,
     wav:Array.from(new Uint8Array(result.wav)),
     sampleRate:result.sampleRate
    };
    const saved=await window.desktop.exportRender(payload,(p,msg)=>{progress.value=.6+p*.4;status.textContent=msg;});
    if(!saved){status.textContent='Render canceled.';return;}
    status.textContent='Saved '+Object.values(saved.files||{}).filter(Boolean).join(', ');
    report('Render complete: '+(saved.files?.video||saved.files?.audio||saved.dir));
   });
  }catch(e){status.textContent=e.message;report(e.message,true);}
  finally{btn.disabled=false;}
 }
 $('[data-run]').onclick=e=>{e.preventDefault();run();};
 function open(preset={}){
  if(preset.mode)$('[data-mode]').value=preset.mode;
  $('[data-title]').value=store.project.name||'';
  if(!dialog.open)dialog.showModal();
 }
 return {open};
}
