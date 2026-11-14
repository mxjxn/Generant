// Pattern Banks — ReBirth-style performance panel (banks step 4).
// Load bank defs from JSON, attach lanes to keys/clip devices, perform:
// pattern swaps queue to the next bar while playing (queued), FIRE applies
// immediately (the scheduler runs ~120 ms ahead, so a fire lands within a
// 16th). Transpose is the scale-locked CV lane value; held-transpose is a
// later layer, this is a drag slider.
import {validateBankDef,newBankLane} from '/shared/banks.mjs';
// Shared lane-swap semantics (Banks tab + rack lane strip both use this):
// pattern swaps queue to the next bar while playing, FIRE/immediate applies
// now (the scheduler runs ~120 ms ahead, so a fire lands within a 16th).
const queues={};   // laneId -> {patternId, timer, bar}
export function laneSwap(store,engine,refresh,report){
 function apply(laneId,patternId){
  const q=queues[laneId];if(q){clearTimeout(q.timer);delete queues[laneId];}
  try{store.edit(p=>{const l=p.banks?.lanes?.find(l=>l.id===laneId);if(!l)return;l.patternId=patternId;});}catch(e){report?.(e.message,true);}
  refresh?.();
 }
 function queue(laneId,patternId){
  const old=queues[laneId];if(old)clearTimeout(old.timer);
  if(!engine.playing){apply(laneId,patternId);return;}
  const bpm=store.project.bpm,beat=Math.max(0,engine.beat||0),bar=Math.floor(beat/4)+1,dt=(bar*4-beat)*60/bpm*1000;
  queues[laneId]={patternId,bar,timer:setTimeout(()=>apply(laneId,patternId),dt)};
  refresh?.();
 }
 return{apply,queue,queueOf:laneId=>queues[laneId],cancel:laneId=>{const q=queues[laneId];if(q){clearTimeout(q.timer);delete queues[laneId];}}};
}
export function bankUI(root,store,engine,report){
 const h=(tag,cls,html)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(html!=null)el.innerHTML=html;return el;};
 const swap=laneSwap(store,engine,()=>render(),report);
 root.id='bankRoot';
 root.innerHTML=`<div class="section-head"><div><span class="eyebrow">PATTERN BANKS</span><h1>Banks</h1></div>
  <span class="muted" style="font-size:10px;max-width:360px">ReBirth-style pattern banks per instrument. Load a bank JSON, attach a lane to a keys or clip device, perform: pattern clicks queue to the next bar while playing, FIRE applies within a 16th. Transpose follows the bank scale when scale-lock is on.</span></div>`;
 const bar=h('div');bar.style.cssText='display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px';
 const file=h('input');file.type='file';file.accept='.json,application/json';file.style.cssText='font-size:11px';
 const loadHint=h('span','muted','Load a bank def JSON (banks/<genre>/<instrument>.json)');
 bar.append(file,loadHint);
 const defsBox=h('div');defsBox.style.cssText='margin-bottom:14px';
 const lanesBox=h('div');
 const newBox=h('div');newBox.style.cssText='display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:12px;border-top:1px solid #4a5b4e;padding-top:10px';
 root.append(bar,defsBox,lanesBox,newBox);
 const project=()=>store.project;
 const devices=()=>project().studio.devices.filter(d=>['keys','clip'].includes(d.type));
 const devName=id=>{const d=project().studio.devices.find(d=>d.id===id);return d?d.name:'?'};
 const opts=(list,sel)=>list.map(o=>`<option value="${o.v}" ${o.v===sel?'selected':''}>${o.t}</option>`).join('');

 function loadFile(f){
  const r=new FileReader();
  r.onload=()=>{try{
   const def=JSON.parse(r.result);validateBankDef(def);
   store.edit(p=>{p.banks??={defs:[],lanes:[]};const i=p.banks.defs.findIndex(x=>x.id===def.id);if(i>=0)p.banks.defs[i]=def;else p.banks.defs.push(def);});
   report(`Bank loaded: ${def.name} (${def.patterns.length} patterns)`);
  }catch(e){report('Bank load failed: '+e.message,true);}};
  r.readAsText(f);
 }
 file.onchange=()=>{if(file.files[0])loadFile(file.files[0]);file.value='';};

 function editLane(id,fn){try{store.edit(p=>{const l=p.banks?.lanes?.find(l=>l.id===id);if(!l)return;fn(l);});}catch(e){report(e.message,true);}}
 const applySwap=(laneId,patternId)=>swap.apply(laneId,patternId);
 const queueSwap=(laneId,patternId)=>swap.queue(laneId,patternId);

 function defRow(def){
  const d=h('div');d.style.cssText='border:1px solid #3a453e;border-radius:4px;padding:8px 10px;margin-bottom:6px;background:#1a201d';
  const pats=def.patterns.map(p=>`<span style="display:inline-block;border:1px solid #4a5b4e;border-radius:3px;padding:1px 6px;margin:2px 4px 2px 0;font-size:10px">${p.id} · ${p.name}</span>`).join('');
  d.innerHTML=`<b>${def.name}</b> <span class="muted" style="font-size:10px">${def.instrument} · ${def.scale} · ${def.bpm} bpm · ${def.patterns.length} patterns</span><div style="margin-top:4px">${pats}</div>`;
  return d;
 }
 function laneCard(lane){
  const defs=project().banks?.defs??[];
  const def=defs.find(b=>b.id===lane.bankId);
  const card=h('div');card.style.cssText='border:1px solid #4a5b4e;border-radius:4px;padding:8px 10px;margin-bottom:8px;background:#171b1a';
  const q=swap.queueOf(lane.id);
  card.innerHTML=`
   <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
    <b style="min-width:90px">${devName(lane.deviceId)}</b>
    <select data-k="bankId" style="max-width:180px">${opts(defs.map(b=>({v:b.id,t:b.name})),lane.bankId)}</select>
    <select data-k="patternId" style="max-width:180px">${opts((def?.patterns??[]).map(p=>({v:p.id,t:p.id+' · '+p.name})),lane.patternId)}</select>
    <button data-fire title="Apply the queued swap immediately">FIRE</button>
    <span data-q class="muted" style="font-size:10px;min-width:70px">${q?`→ bar ${q.bar}`:''}</span>
    <span style="flex:1"></span>
    <label style="font-size:10px"><input type="checkbox" data-k="enabled" ${lane.enabled?'checked':''}> on</label>
    <button data-del title="Remove this lane">✕</button>
   </div>
   <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:6px;font-size:10px;color:var(--muted)">
    <label>transpose <input type="number" data-k="transpose" value="${lane.transpose}" min="-24" max="24" step="1" style="width:58px"></label>
    <label><input type="checkbox" data-k="scaleLock" ${lane.scaleLock?'checked':''}> scale-lock (degrees)</label>
    <label>gate <select data-k="gateMode"><option value="hard" ${lane.gateMode==='hard'?'selected':''}>hard</option><option value="env" ${lane.gateMode==='env'?'selected':''}>env</option></select></label>
    <label>gate×<input type="number" data-k="gateScale" value="${lane.gateScale}" min="0" max="8" step="0.05" style="width:52px"></label>
    <label>vel×<input type="number" data-k="velocityScale" value="${lane.velocityScale}" min="0" max="8" step="0.05" style="width:52px"></label>
    <label>decay×<input type="number" data-k="decayMul" value="${lane.decayMul}" min="0" max="8" step="0.05" style="width:52px"></label>
    <label>release×<input type="number" data-k="releaseMul" value="${lane.releaseMul}" min="0" max="8" step="0.05" style="width:52px"></label>
   </div>`;
  card.querySelector('[data-del]').onclick=()=>{try{store.edit(p=>{const i=p.banks.lanes.findIndex(l=>l.id===lane.id);if(i>=0)p.banks.lanes.splice(i,1);});swap.cancel(lane.id);render();}catch(e){report(e.message,true);}};
  card.querySelector('[data-fire]').onclick=()=>{const q=swap.queueOf(lane.id);if(!q){report('Nothing queued for this lane — change the pattern first.');return;}applySwap(lane.id,q.patternId);};
  card.querySelectorAll('[data-k]').forEach(el=>{
   const k=el.dataset.k;
   const handler=()=>{
    let v=el.type==='checkbox'?el.checked:(['transpose','gateScale','velocityScale','decayMul','releaseMul'].includes(k)?parseFloat(el.value):el.value);
    if(k==='transpose')v=Math.max(-24,Math.min(24,v));
    if(k==='patternId'){queueSwap(lane.id,v);return;}
    editLane(lane.id,l=>{l[k]=v;});
    render();
   };
   el.onchange=handler;
  });
  return card;
 }

 function render(){
  const p=project();p.banks??={defs:[],lanes:[]};
  defsBox.innerHTML='';
  if(!p.banks.defs.length){defsBox.append(h('div','muted','No bank defs loaded — load a bank JSON above (e.g. banks/dub-techno/bass.json).'));}
  else{defsBox.append(h('div','muted','Bank defs'));p.banks.defs.forEach(def=>defsBox.append(defRow(def)));}
  lanesBox.innerHTML='';
  if(p.banks.lanes.length){lanesBox.append(h('div','muted','Lanes'));p.banks.lanes.forEach(l=>lanesBox.append(laneCard(l)));}
  const ds=devices(),dfs=p.banks.defs;
  newBox.innerHTML='';
  if(ds.length&&dfs.length){
   newBox.append(h('span','muted','New lane:'));
   const devSel=h('select');devSel.innerHTML=opts(ds.map(d=>({v:d.id,t:`${d.name} (${d.type})`})),ds[0].id);
   const bankSel=h('select');bankSel.innerHTML=opts(dfs.map(b=>({v:b.id,t:b.name})),dfs[0].id);
   const patSel=h('select');patSel.innerHTML=opts((dfs[0].patterns??[]).map(pt=>({v:pt.id,t:pt.id+' · '+pt.name})));
   bankSel.onchange=()=>{patSel.innerHTML=opts((dfs.find(b=>b.id===bankSel.value)?.patterns??[]).map(pt=>({v:pt.id,t:pt.id+' · '+pt.name})));};
   const add=h('button',null,'Add lane');
   add.onclick=()=>{try{store.edit(pp=>{const id='lane-'+crypto.randomUUID().slice(0,8);pp.banks.lanes.push(newBankLane(id,devSel.value,bankSel.value,patSel.value));});render();}catch(e){report(e.message,true);}};
   newBox.append(devSel,bankSel,patSel,add);
  }else newBox.append(h('span','muted',ds.length?'Load a bank def JSON to attach lanes.':'Add a keys or clip device, then load a bank def to attach lanes.'));
 }
 return{render};
}
