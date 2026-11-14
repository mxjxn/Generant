// Bank lane strip — inline performance surface in the rack device panel
// (the Renoise phrase-selector lesson: live pattern switching lives on the
// instrument, not in another workspace). Pattern chips per lane bound to
// this device: click = queue to next bar while playing / immediate when
// stopped, FIRE applies a pending queue now. Setup (defs, modifiers) stays
// in the Banks workspace.
import {laneSwap} from './bank-panel.mjs';
export function bankStrip(root,store,engine,deviceId,report){
 root.className='bank-lane-strip';root.hidden=true;
 const devOf=()=>typeof deviceId==='function'?deviceId():deviceId;
 const swap=laneSwap(store,engine,()=>update(),report);
 function update(){
  const dId=devOf();
  const p=store.project,lanes=dId?(p.banks?.lanes??[]).filter(l=>l.deviceId===dId):[];
  if(!lanes.length){root.hidden=true;root.innerHTML='';return;}
  root.innerHTML=lanes.map(lane=>{
   const def=(p.banks?.defs??[]).find(b=>b.id===lane.bankId);
   if(!def)return '';
   const q=swap.queueOf(lane.id);
   const chips=def.patterns.map(pt=>`<button class="bank-chip ${lane.patternId===pt.id?'active':''} ${q&&q.patternId===pt.id?'queued':''}" data-lane="${lane.id}" data-pat="${pt.id}" title="${pt.name}${lane.enabled?'':' · lane off'}" ${lane.enabled?'':'disabled'}>${pt.id}</button>`).join('');
   return `<strong>BANK</strong><span class="bank-name" title="${def.name}">${def.name}</span>${chips}<span class="bank-t">T${lane.transpose>=0?'+':''}${lane.transpose}</span>${q?`<button class="bank-fire" data-fire="${lane.id}">FIRE</button><span class="bank-q">→ bar ${q.bar}</span>`:''}${lane.enabled?'':'<span class="bank-q">lane off</span>'}`;
  }).join('<span class="bank-sep">·</span>');
  root.hidden=false;
  root.querySelectorAll('.bank-chip').forEach(b=>b.onclick=()=>{const lane=(store.project.banks?.lanes??[]).find(l=>l.id===b.dataset.lane);if(!lane)return;if(!lane.enabled)return report('Lane is off — enable it in the Banks tab.',true);swap.queue(lane.id,b.dataset.pat);});
  root.querySelectorAll('.bank-fire').forEach(b=>b.onclick=()=>{const q=swap.queueOf(b.dataset.fire);if(q)swap.apply(b.dataset.fire,q.patternId);});
 }
 return{update};
}
