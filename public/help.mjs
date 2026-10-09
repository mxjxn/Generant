import {programPreset} from '/shared/presets.mjs';
import {deviceFx} from '/shared/tracker.mjs';
import {specs} from '/shared/model.mjs';
import {escape} from './studio-shell.mjs';
export function helpUI(store,getDevice,insert,isSequencer){
 const legend=document.createElement('section');legend.id='fxReference';document.querySelector('#deviceNav').after(legend);
 const button=document.createElement('button');button.id='helpToggle';button.textContent='?';button.setAttribute('aria-label','Toggle contextual help');document.querySelector('header').append(button);
 const panel=document.createElement('section');panel.id='contextHelp';panel.hidden=true;panel.innerHTML='<strong>Help</strong><p>Point at a control or focus it with the keyboard to see its explanation here.</p>';document.body.append(panel);
 button.onclick=()=>{panel.hidden=!panel.hidden;button.setAttribute('aria-pressed',!panel.hidden);};
 // Only inspect added elements / changed titles. Meter text updates must not
 // trigger a whole-document scan (including every hidden rack control).
 const watched=new WeakSet();
 function inspect(el){if(el.nodeType!==1)return;if(el.title){el.dataset.help=el.title;el.removeAttribute('title');}if(el.shadowRoot)watch(el.shadowRoot);}
 function scan(root){inspect(root);for(const el of root.querySelectorAll?.('*')??[])inspect(el);}
 function watch(root){if(watched.has(root))return;watched.add(root);scan(root);new MutationObserver(records=>{for(const r of records){if(r.type==='attributes')inspect(r.target);else for(const node of r.addedNodes)if(node.nodeType===1)scan(node);}}).observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['title']});}
 watch(document);
 function explain(e){const path=e.composedPath(),el=path.find(el=>el.dataset?.help)||path.find(el=>el.getAttribute?.('aria-label'));if(el&&!panel.hidden)panel.querySelector('p').textContent=el.dataset?.help||el.getAttribute('aria-label');}
 document.addEventListener('pointerover',explain);document.addEventListener('focusin',explain);let key='';
 function update(){legend.hidden=!isSequencer();if(legend.hidden)return;const d=getDevice();if(!d)return;const next=d.id+':'+d.name+':'+(d.params??store.project.params[d.id])?.fmMode+JSON.stringify([d.programs,d.presets]);if(next===key)return;key=next;legend.innerHTML='<strong>FX</strong><small>Index · hex value 00–FF</small>'+ deviceFx(store.project,d.id).map(([code,param,label,desc])=>`<button data-code="${code}" data-help="${escape(param?desc+' Value 00 = '+specs[d.type].params[param][0]+', FF = '+specs[d.type].params[param][1]+'.':desc)}" ><code>${code}</code><span>${escape(label)}</span></button>`).join('');if(d.type==='keys'){const refs=Object.keys(d.programs??{}).map(slot=>`<small>PR ${(+slot).toString(16).toUpperCase().padStart(2,'0')} · ${escape(programPreset(store.project,d.id,+slot)?.name??'')}</small>`).join('');legend.insertAdjacentHTML('beforeend',refs); }legend.querySelectorAll('button').forEach(b=>{b.onmousedown=e=>e.preventDefault();b.onclick=()=>insert(b.dataset.code);});}
 return{update};
}
