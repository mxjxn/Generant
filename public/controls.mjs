export const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export function toPosition(v,min,max,log=false){return clamp(log?Math.log(v/min)/Math.log(max/min):(v-min)/(max-min));}
export function fromPosition(n,min,max,log=false){return log?min*(max/min)**clamp(n):min+(max-min)*clamp(n);}
export function dragPosition(n,delta,fine){return clamp(n+delta/(fine?1600:160));}
export const units={percent:v=>`${Math.round(v*100)}%`,seconds:v=>v<1?`${Math.round(v*1000)} ms`:`${v.toFixed(2)} s`,hz:v=>v>=1000?`${(v/1000).toFixed(2)} kHz`:`${Math.round(v)} Hz`,db:v=>`${v>0?'+':''}${v.toFixed(1)} dB`,gain:v=>v===0?'−∞ dB':`${(20*Math.log10(v)).toFixed(1)} dB`,number:v=>Number(v.toFixed(3)).toString()};
export class Controls{
 constructor(store,engine,report){this.store=store;this.engine=engine;this.report=report;this.items=[];this.draft=null;this.changed=()=>{};}
 preview(set,v){const p=structuredClone(this.store.project);set(p,v);this.draft=p;this.engine.update(p);this.update();this.changed();}
 commit(set,v){this.draft=null;try{this.store.edit(p=>set(p,v));}catch(e){this.report(e.message,true);}this.engine.update(this.store.project);this.update();this.changed();}
 update(){this.items=this.items.filter(c=>c.root.isConnected);this.items.forEach(c=>c.update());}
 add(parent,o){o={...o};if(!o.parse){if(o.format===units.seconds)o.parse=s=>{const m=String(s).trim().match(/^([\d.+-]+)\s*(ms|s)?$/i);return m?Number(m[1])*(m[2]?.toLowerCase()==='ms'?.001:1):NaN;};if(o.format===units.hz)o.parse=s=>{const m=String(s).trim().match(/^([\d.+-]+)\s*(khz|k|hz)?$/i);return m?Number(m[1])*(m[2]?.toLowerCase().startsWith('k')?1000:1):NaN;};if(o.format===units.db)o.parse=s=>Number(String(s).replace(/\s*dB$/i,''));if(o.format===units.gain){o.editValue=v=>v?20*Math.log10(v):-60;o.parse=s=>10**(Number(String(s).replace(/\s*dB$/i,''))/20);}if(o.format===units.percent){o.editValue=v=>Math.round(v*100)+'%';o.parse=s=>Number(String(s).replace('%',''))/100;}}const c=new Control(this,o);parent.append(c.root);this.items.push(c);c.update();return c;}
}
class Control{
 constructor(manager,o){this.m=manager;this.o=o;this.drag=null;this.root=document.createElement('div');this.root.className='instrument-control '+(o.slider?'fader-control':'knob-control');
 this.root.innerHTML=`<span class="control-label"></span><div class="control-surface" role="slider" tabindex="0"><span class="knob-pointer"></span><span class="mod-pointer"></span><span class="fader-track"></span><span class="fader-thumb"></span></div><button class="control-readout" title="Double-click to type a value"></button><input class="exact-editor" type="text" hidden>`;
 this.root.querySelector('.control-label').textContent=o.name;this.surface=this.root.querySelector('.control-surface');this.surface.setAttribute('aria-label',o.name);this.surface.setAttribute('aria-valuemin',o.min);this.surface.setAttribute('aria-valuemax',o.max);this.surface.title='Drag vertically · Shift = fine · Ctrl/Cmd-click = reset · double-click value = type';
 this.readout=this.root.querySelector('.control-readout');this.input=this.root.querySelector('input');this.input.setAttribute('aria-label',o.name+' exact value');
 this.surface.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();this.surface.focus();if(e.ctrlKey||e.metaKey){manager.commit(o.set,o.initial);return;}this.drag={y:e.clientY,n:toPosition(o.get(manager.store.project),o.min,o.max,o.log)};this.surface.setPointerCapture(e.pointerId);};
 this.surface.onpointermove=e=>{if(!this.drag)return;this.drag.n=dragPosition(this.drag.n,this.drag.y-e.clientY,e.shiftKey);this.drag.y=e.clientY;this.value=fromPosition(this.drag.n,o.min,o.max,o.log);if(o.step)this.value=Math.round(this.value/o.step)*o.step;this.value=clamp(this.value,o.min,o.max);manager.preview(o.set,this.value);this.paint(this.value);};
 this.surface.onpointerup=()=>{if(!this.drag)return;const v=this.value??o.get(manager.store.project);this.drag=null;this.value=null;manager.commit(o.set,v);};
 this.surface.onpointercancel=()=>{this.drag=null;this.value=null;manager.draft=null;manager.engine.update(manager.store.project);manager.update();manager.changed();};
 this.surface.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();this.edit();return;}if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const sign=['ArrowUp','ArrowRight'].includes(e.key)?1:-1;let n=toPosition(o.get(manager.store.project),o.min,o.max,o.log);n=e.key==='Home'?0:e.key==='End'?1:clamp(n+sign*(e.shiftKey?.001:.01));manager.commit(o.set,fromPosition(n,o.min,o.max,o.log));};
 this.readout.ondblclick=()=>this.edit();this.surface.ondblclick=()=>this.edit();this.input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();this.finish(true);}if(e.key==='Escape'){e.preventDefault();e.stopPropagation();this.finish(false);}};this.input.onblur=()=>{if(!this.input.hidden)this.finish(true);};
 }
 edit(){this.input.value=(this.o.editValue??(v=>Number(v.toFixed(5))))(this.o.get(this.m.store.project));this.input.hidden=false;this.readout.hidden=true;this.input.focus();this.input.select();}
 finish(commit){let v;if(commit){v=(this.o.parse??Number)(this.input.value);if(!Number.isFinite(v)){this.m.report('Enter a numeric value.',true);return;}v=clamp(v,this.o.min,this.o.max);}this.input.hidden=true;this.readout.hidden=false;if(commit)this.m.commit(this.o.set,v);else this.update();this.surface.focus();}
 paint(v){const n=toPosition(v,this.o.min,this.o.max,this.o.log);this.root.style.setProperty('--position',n);this.root.style.setProperty('--angle',`${-135+n*270}deg`);this.surface.setAttribute('aria-valuenow',v);const text=(this.o.format??units.number)(v);this.surface.setAttribute('aria-valuetext',text);this.readout.textContent=text;}
 update(){if(!this.drag)this.paint(this.o.get(this.m.draft??this.m.store.project));}
 modulation(v){this.root.style.setProperty('--mod-angle',`${-135+clamp(v)*270}deg`);this.root.classList.add('has-modulation');}
}
export function parameter(manager,parent,id,key,spec,options={}){const [min,max,initial]=spec;return manager.add(parent,{name:key,min,max,initial,get:p=>p.params[id][key],set:(p,v)=>p.params[id][key]=v,...options});}
