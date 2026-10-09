import {kitGroup,kitParams} from './kit.mjs';
import {effectLayout,isEffect,controlTypes,routingParams} from './devices.mjs';
import {synthParams} from './fm.mjs';
import {specs,drumParams} from './model.mjs';
import {deviceOf,engineLayout} from './studio.mjs';
import {sequence,effectiveParams} from './tracker.mjs';
const newVoice=new Set(['attack','decay','sustain','release','modAttack','modDecay','modSustain','modRelease']);
export function automationMessages(p,beat){const audio=[],osc=[],layout=engineLayout(p);for(const d of p.studio.devices){const s=sequence(p,d.id),params=effectiveParams(p,d.id,beat,specs),l=layout.find(l=>l.deviceId===d.id);if(d.type==='osc'){osc.push(['/rack/control',d.oscName,params.value]);continue;}if(!s.enabled||!s.fx.length)continue;
 if(d.type==='kit')for(let i=0;i<16;i++){const values=kitParams(p,d.id,i,params);if(values)audio.push(['/n_set',kitGroup(p,d.id,i),'kitLength',params.length,'kitFade',params.fade,'kitLevel',params.level]);}
 if(d.type==='keys')audio.push(['/n_set',l.group,...Object.entries(synthParams(p,d.id,params)).filter(([k])=>!newVoice.has(k)&&!/Attack|Decay|Sustain|Release/.test(k)).flat()]);
 if(isEffect(d)){const f=effectLayout(p).find(f=>f.id===d.id);if(f)audio.push(['/n_set',f.node,...Object.entries({...params,...routingParams(p,d.id)}).filter(([k])=>k!=='target').flat()]);}
 if(controlTypes.includes(d.type))audio.push(['/n_set',800+p.studio.devices.indexOf(d),...Object.entries({...params,...routingParams(p,d.id)}).flat()]);
 if(d.type==='motion')audio.push(['/n_set',200,'rate',params.rate]);
 if(d.type==='drums'){const effective={...p,params:{...p.params,drums:params}};for(let pad=0;pad<4;pad++)audio.push(['/n_set',110+pad,...Object.entries(drumParams(effective,pad)).filter(([k])=>!['start','end','decay'].includes(k)).flat()]);}
 }return{audio,osc};}
