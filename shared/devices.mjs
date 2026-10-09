// Device definitions and routing primitives; no engine/UI dependencies.
const cv=(label)=>({type:'cv',label});
const fx=(name,params,inputs={})=>({name,kind:'Audio effect',color:'#8dbacb',params:{...params,output:[-24,24,0],bypass:[0,1,0]},inputs,outputs:{}});
export const extraSpecs={
 gain:fx('Gain / Trim',{gain:[-60,24,0],pan:[-1,1,0],width:[0,2,1],invert:[0,1,0]}),
 vca:fx('VCA',{gain:[-60,24,0],base:[0,1,1],depth:[-1,1,1],curve:[.25,4,1]},{control:cv('Amplitude')}),
 filter:fx('Multimode Filter',{mode:[0,4,0],cutoff:[20,20000,8000],resonance:[0,.94,.1],drive:[0,24,0],mix:[0,1,1],depth:[-8,8,0]},{control:cv('Cutoff')}),
 reverb:fx('FreeVerb',{room:[0,1,.7],damp:[0,1,.45],predelay:[0,.2,.02],mix:[0,1,.25]}),
 hall:fx('GVerb Hall',{size:[5,100,35],decay:[.2,20,4],damp:[0,1,.5],bandwidth:[0,1,.8],spread:[0,30,15],mix:[0,1,.22]}),
 chorus:fx('Chorus',{rate:[.02,8,.35],depth:[0,.015,.004],delay:[.005,.04,.015],mix:[0,1,.35]}),
 phaser:fx('Phaser',{rate:[.02,8,.25],center:[80,8000,900],depth:[0,3,1.5],mix:[0,1,.5]}),
 delay:fx('Stereo Delay',{time:[.005,2,.375],sync:[0,1,1],beats:[.125,4,.75],feedback:[0,.9,.35],tone:[200,18000,6500],pingpong:[0,1,1],mix:[0,1,.25]}),
 lfo:{name:'LFO',kind:'CV source',color:'#aba1ed',params:{rate:[.01,40,.5],sync:[0,1,0],beats:[.0625,32,4],shape:[0,5,0],width:[.01,.99,.5],depth:[-1,1,1],offset:[0,1,.5]},inputs:{},outputs:{cv:cv('Modulation')}},
 envelope:{name:'Envelope',kind:'CV source',color:'#aba1ed',params:{attack:[.001,20,.05],decay:[.001,20,.3],sustain:[0,1,.5],hold:[.001,20,.2],release:[.005,30,.6],curve:[-8,8,-4],loop:[0,1,0],gate:[0,1,0],depth:[0,1,1]},inputs:{gate:cv('Gate / trigger')},outputs:{cv:cv('Envelope')}},
 cvmath:{name:'CV Scale / Mix',kind:'CV processor',color:'#aba1ed',params:{a:[-2,2,1],b:[-2,2,0],offset:[-1,1,0],mode:[0,3,0],smooth:[0,2,.01]},inputs:{a:cv('A'),b:cv('B')},outputs:{cv:cv('Result')}}
};
export const effectTypes=['shaper','gain','vca','filter','reverb','hall','chorus','phaser','delay'];
export const controlTypes=['lfo','envelope','cvmath'];
export const isEffect=d=>effectTypes.includes(d?.type);
export const chain=c=>c.inserts??(c.insert?[c.insert]:[]);
export function writeChain(c,ids){c.inserts=ids;c.insert=ids[0]??null;}
export const cvBus=(p,id,port='cv')=>id==='motion'?0:128+p.studio.devices.findIndex(d=>d.id===id)*2+(port==='gate'?1:0);
export function cvRoute(p,id,input){const c=p.connections.find(c=>c.to===id+'.'+input);if(!c)return{bus:0,connected:0,amount:0};const [source,port]=c.from.split('.');return{bus:cvBus(p,source,port),connected:1,amount:c.amount};}
export const cvMap=(p,id,input,fallback=.5)=>{const c=cvRoute(p,id,input);return c.connected?'c'+c.bus:fallback;};
export function controlOrder(p){const ds=p.studio.devices.filter(d=>controlTypes.includes(d.type)),done=new Set(),active=new Set(),out=[];function visit(d){if(done.has(d.id))return;if(active.has(d.id))throw Error('CV feedback requires a delay; this connection makes a cycle.');active.add(d.id);for(const c of p.connections.filter(c=>c.to.startsWith(d.id+'.'))){const src=ds.find(x=>c.from.startsWith(x.id+'.'));if(src)visit(src);}active.delete(d.id);done.add(d.id);out.push(d);}ds.forEach(visit);return out;}
export function effectLayout(p){return p.studio.channels.flatMap((c,i)=>chain(c).map((id,j)=>({id,channel:i,slot:j,node:j===0?400+i:600+i*8+j,input:j?128+i*16+(j-1)*2:c.deviceId==='keys'?16:c.deviceId==='drums'?18:40+i*4,output:128+i*16+j*2,meter:4+i})));}
export const effectSynth={shaper:'rackDrive',gain:'rackGain',vca:'rackVCA',filter:'rackFilter',reverb:'rackFreeVerb',hall:'rackGVerb',chorus:'rackChorus',phaser:'rackPhaser',delay:'rackDelay'};
export const controlSynth={lfo:'rackLFO',envelope:'rackEnvelope',cvmath:'rackCVMath'};
export function routingParams(p,id){const d=p.studio.devices.find(d=>d.id===id),out={bpm:p.bpm};for(const input of Object.keys(extraSpecs[d?.type]?.inputs??{})){const c=cvRoute(p,id,input);out[input+'Bus']=c.bus;out[input+'Connected']=c.connected;out[input+'Amount']=c.amount;}return out;}
export const cloudParams={grainPosition:[0,1,.4],grainSpread:[0,1,.15],grainDuration:[.01,1,.12],grainOverlap:[.25,24,5],grainRandom:[0,1,1],grainJitter:[0,.9,.2],grainPitchRange:[0,24,.4],grainPan:[0,1,.8],grainScan:[-1,1,.03],grainRoot:[0,127,60],grainPositionDepth:[-1,1,0],grainDensityDepth:[-4,4,0]};
export const vcoParams={oscShape:[0,4,0],oscPulse:[.02,.98,.5],oscDetune:[0,30,3],pitchDepth:[-4,4,0],filterDepth:[-8,8,0],ampDepth:[-1,1,0]};
export const extendedKeys={...cloudParams,...vcoParams};
export const paramLabels={gain:'Gain',base:'Base amplitude',depth:'CV depth',output:'Output trim',invert:'Invert polarity',cutoff:'Cutoff',resonance:'Resonance',predelay:'Pre-delay',size:'Room size',decay:'Decay',bandwidth:'Input bandwidth',time:'Delay time',beats:'Beats',pingpong:'Ping-pong',grainPosition:'Position',grainSpread:'Position range',grainDuration:'Grain duration',grainOverlap:'Overlap',grainRandom:'Random distribution',grainJitter:'Duration randomness',grainPitchRange:'Pitch randomness (st)',grainPan:'Pan spread',grainScan:'Scan / sec',grainRoot:'Source root MIDI',grainPositionDepth:'Position CV depth',grainDensityDepth:'Density CV octaves',oscShape:'Wave shape',oscPulse:'Pulse width',oscDetune:'Detune cents',pitchDepth:'Pitch CV octaves',filterDepth:'Filter CV octaves',ampDepth:'Amplitude CV depth'};
export function validateDevices(p){controlOrder(p);for(const d of p.studio.devices){for(const key of ['sync','loop','gate','shape','mode','invert','pingpong'])if(key in (d.params??{})&&!Number.isInteger(d.params[key]))throw Error('Invalid device switch '+key);if(d.grainSample&&(d.type!=='keys'||typeof d.grainSample.name!=='string'||d.grainSample.name.length>255||typeof d.grainSample.data!=='string'||d.grainSample.data.length>28000000||!/^data:audio\/[\w.+-]+;base64,[A-Za-z0-9+/=]+$/.test(d.grainSample.data)))throw Error('Invalid granular sample.');}}
export const grainBuffer=(p,id)=>7600+p.studio.devices.filter(d=>d.type==='keys').findIndex(d=>d.id===id);
