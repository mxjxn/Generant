import {Controls,parameter,units} from './controls.mjs';
import {specs} from '/shared/model.mjs';
import {deviceOf} from '/shared/studio.mjs';
export function wavePanel(root,store,engine,report){
 const controls=new Controls(store,engine,report);root.innerHTML='<div class="wave-source"><strong>Envelope wavetable</strong><span></span><button>Edit waveform ↗</button></div><div class="sound-controls"></div>';
 const fields=[['wavePosition','Position'],['waveDetune','Detune'],['waveEnv','Env → position'],['waveDepth','CV → position'],['transpose','Transpose'],['cutoff','Cutoff'],['resonance','Resonance'],['width','Width'],['level','Output'],['attack','Attack'],['decay','Decay'],['sustain','Sustain'],['release','Release'],['modAttack','Shape attack'],['modDecay','Shape decay'],['modSustain','Shape sustain'],['modRelease','Shape release']];
 for(const [key,name]of fields){const time=/attack|decay|release/i.test(key);parameter(controls,root.querySelector('.sound-controls'),'keys',key,specs.keys.params[key],{name,format:time?units.seconds:key==='cutoff'?units.hz:units.number,log:time||key==='cutoff'});}
 root.querySelector('button').onclick=()=>window.dispatchEvent(new CustomEvent('edit-wavetable',{detail:{id:deviceOf(store.project,engine.deviceId).wavetableId}}));
 function update(){controls.update();const id=deviceOf(store.project,engine.deviceId)?.wavetableId;root.querySelector('.wave-source span').textContent=store.project.studio.wavetables?.find(w=>w.id===id)?.name??'Missing source';}
 update();return{update,animate(){}};
}
