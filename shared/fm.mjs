import {extendedKeys,grainBuffer,cvRoute,cvMap} from './devices.mjs';
import {waveParams,waveLabels,waveBuffer} from './wavetable.mjs';
// Stable parameter order also defines appended tracker indexes and CV destinations.
export const fmParams={fmMode:[0,4,0],transpose:[-48,48,0],cutoff:[30,20000,14000],resonance:[0,.95,0],pitchAttack:[.001,20,.01],pitchDecay:[.001,30,.3],pitchAmount:[-48,48,0]};
export const fmLabels={transpose:'Transpose',cutoff:'Cutoff',resonance:'Resonance',pitchAttack:'Pitch attack',pitchDecay:'Pitch decay',pitchAmount:'Pitch envelope'};
for(let i=1;i<=4;i++)for(const [key,spec,label] of [['Ratio',[.125,32,i===2?2:1],'Ratio'],['Fixed',[0,1,0],'Fixed Hz mode'],['Hz',[.1,16000,220],'Frequency'],['Fine',[-100,100,0],'Fine cents'],['Pitch',[-48,48,0],'Pitch semitones'],['Level',[0,1,i===1?1:0],'Output'],['Index',[0,8,1],'Modulator gain'],['Attack',[.001,30,.005],'Attack'],['Decay',[.001,30,i===2?1.5:1],'Decay'],['Sustain',[0,1,i===2?.1:.7],'Sustain'],['Release',[.005,60,1],'Release'],['Velocity',[0,1,.5],'Velocity'],['Pan',[-1,1,0],'Pan']]){fmParams['op'+i+key]=spec;fmLabels['op'+i+key]='Op '+i+' '+label;}
for(let from=1;from<=4;from++)for(let to=1;to<=4;to++){const k='m'+from+to;fmParams[k]=[0,32,from===2&&to===1?2:0];fmLabels[k]=`Op ${from} → ${to}`;}
export const fmTargets=Object.keys(fmParams).filter(k=>k!=='fmMode'&&!k.endsWith('Fixed')&&!/Attack|Decay|Sustain|Release/.test(k));
export const cvSources=['External CV','Velocity','Mod envelope','Op 1 envelope','Op 2 envelope','Op 3 envelope','Op 4 envelope','Random per note'];
for(let i=1;i<=8;i++){fmParams['cv'+i+'Target']=[0,fmTargets.length,0];fmParams['cv'+i+'Source']=[0,7,0];fmParams['cv'+i+'Depth']=[-20000,20000,0];fmParams['cv'+i+'Bipolar']=[0,1,1];fmParams['cv'+i+'Smooth']=[0,2,.02];}
Object.assign(fmParams,waveParams,extendedKeys);Object.assign(fmLabels,waveLabels);
export const defaults=()=>Object.fromEntries(Object.entries(fmParams).map(([k,v])=>[k,v[2]]));
export function migrateFM(params){for(const [k,v]of Object.entries(fmParams))params[k]??=v[2];return params;}
export function fmDiscrete(key){return key==='fmMode'||key==='oscShape'||key==='grainRandom'||key==='grainRoot'||key.endsWith('Fixed')||/Target|Source|Bipolar$/.test(key);}
export function validateFM(params){for(const [k,[lo,hi]]of Object.entries(fmParams)){const v=params[k];if(!Number.isFinite(v)||v<lo||v>hi||(fmDiscrete(k)&&!Number.isInteger(v)))throw Error('Invalid FM control '+k);}}
export function synthName(params){return params.fmMode===3?'rackCloud':params.fmMode===4?'rackVCO':params.fmMode===2?'rackWavetable':params.fmMode===1?'rackFM':'rackGlass';}
export function synthParams(p,id,params){if(params.fmMode>=3){const out={...params,buf:grainBuffer(p,id)};for(const input of ['pitch','filter','amp','position','density']){const c=cvRoute(p,id,input);out[input+'Bus']=c.bus;out[input+'Connected']=c.connected;out[input+'Amount']=c.amount;}return out;}if(params.fmMode===2){const d=p.studio.devices.find(d=>d.id===id),c=p.connections.find(c=>c.to===id+'.wave');return{...Object.fromEntries(['transpose','cutoff','resonance','width','level','attack','decay','sustain','release','modAttack','modDecay','modSustain','modRelease',...Object.keys(waveParams)].map(k=>[k,params[k]])),buf:waveBuffer(p,d.wavetableId),waveCV:cvMap(p,id,'wave'),waveConnected:c?1:0,waveDepth:params.waveDepth*(c?.amount??1)};}const out={...params};for(let i=1;i<=8;i++){const cable=p.connections.find(c=>c.to===id+'.cv'+i);out['cv'+i+'Bus']=cvRoute(p,id,'cv'+i).bus;out['cv'+i+'Connected']=cable?1:0;out['cv'+i+'Cable']=cable?.amount??1;}return out;}
export function cvDepthSpec(key){if(key==='cutoff')return[-8,8,'oct'];if(key.includes('Pitch')||key==='transpose'||key==='pitchAmount')return[-48,48,'st'];if(key.endsWith('Fine'))return[-100,100,'ct'];const [lo,hi]=fmParams[key];return[-(hi-lo),hi-lo,key.endsWith('Hz')?'Hz':''];}
export function cvResult(base,key,slots){let offset=0;for(const s of slots)offset+=(s.bipolar?s.value*2-1:s.value)*s.depth;const [lo,hi]=fmParams[key];return Math.max(lo,Math.min(hi,key==='cutoff'?base*2**offset:base+offset));}
export function factoryPatches(base){const init={...base,...defaults(),fmMode:1,attack:.005,decay:1,sustain:.7,release:1,envAmount:0,level:.15};return[
 {name:'Init — sine',params:{...init,m21:0}},
 {name:'Glass Keys',params:{...init,m21:3.5,op2Ratio:2.001,op2Decay:2,op2Sustain:0,op1Release:3,release:3}},
 {name:'Bent alloy',params:{...init,m21:8,m32:5,m43:4,m14:1.5,op2Ratio:1.414,op3Ratio:3.17,op4Ratio:.51,op2Sustain:.5,op3Sustain:.6,op4Sustain:.4,op1Pan:-.4,op3Level:.25,op3Pan:.4,cutoff:9000,release:4}},
 {name:'Rubber circuit',params:{...init,m21:12,m22:2,op2Ratio:1,op2Decay:.2,op2Sustain:.05,op1Sustain:.6,transpose:-12,pitchAmount:12,pitchDecay:.04,cutoff:7000}},
 {name:'Slow fracture',params:{...init,m21:6,m31:4,m42:3,m33:.8,op2Ratio:2.71,op3Ratio:.501,op4Fixed:1,op4Hz:3,op2Attack:4,op3Attack:7,op4Attack:2,op3Level:.3,op3Pan:.6,op1Pan:-.6,attack:3,release:8,op1Release:8,op3Release:8,cv1Target:fmTargets.indexOf('m21')+1,cv1Source:2,cv1Depth:5,cv1Bipolar:0}}
 ];}
