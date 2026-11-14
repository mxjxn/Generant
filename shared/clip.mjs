// Clip Player: chromatic one-sample instrument. One embedded clip, played
// through the rackKitSample voice (tune/fine resample pitch, reverse, start/end
// trim, env modes, filter, drive, pitch envelope). Notes on MIDI 0-127
// transpose relative to the root note; note duration drives the gate.
export const clipSpec={name:'Clip Player',kind:'Chromatic sampler',color:'#c9a86d',params:{root:[24,84,48],level:[0,2,.8],length:[.01,1,1],fade:[.001,.5,.008],tune:[-36,36,0],fine:[-100,100,0],start:[0,.9999,0],end:[.0001,1,1],reverse:[0,1,0],mode:[0,2,2],gateMode:[0,1,0],attack:[.0005,2,.003],hold:[0,2,0],decay:[.005,8,.5],sustain:[0,1,.7],release:[.003,4,.12],curve:[-8,8,-4],cutoff:[30,20000,20000],resonance:[0,.9,0],filter:[0,3,0],drive:[0,24,0],pitchAmount:[-24,24,0],pitchDecay:[.005,2,.08],pan:[-1,1,0],gain:[-48,18,0]},inputs:{},outputs:{audio:{type:'audio',label:'Clip stereo'}}};
export const clipDiscrete=new Set(['reverse','mode','gateMode','filter']);
export const newClipSource=()=>({id:null,name:'',...Object.fromEntries(Object.entries(clipSpec.params).map(([k,v])=>[k,v[2]]))});
export const clipIndex=(p,id)=>p.studio.devices.filter(d=>d.type==='clip').findIndex(d=>d.id===id);
export const clipBuffer=(p,id)=>7400+clipIndex(p,id);
export const clipSignature=p=>JSON.stringify(p.studio.devices.filter(d=>d.type==='clip').map(d=>[d.id,d.clip]));
export function clipParams(p,id,pitch,global){
 const d=p.studio.devices.find(d=>d.id===id);
 if(!d?.clip?.data)return null;
 const s={...d.params,...(global??{})};
 const tune=s.tune+(pitch-s.root);
 return {...s,buf:clipBuffer(p,id),tune,fine:s.fine};
}
export const clipArgs=v=>Object.entries({buf:v.buf,tune:v.tune,fine:v.fine,start:v.start,end:v.end,length:1,reverse:v.reverse,mode:v.mode,attack:v.attack,hold:v.hold,decay:v.decay,sustain:v.sustain,release:v.release,curve:v.curve,cutoff:v.cutoff,resonance:v.resonance,filter:v.filter,drive:v.drive,pitchAmount:v.pitchAmount,pitchDecay:v.pitchDecay,gain:v.gain,pan:v.pan,kitLength:v.length,kitFade:v.fade,kitLevel:v.level}).filter(([k,x])=>typeof x==='number').flat();
export function validateClip(p){
 for(const d of p.studio.devices.filter(d=>d.type==='clip')){
  if(!d.clip)return;
  const c=d.clip;
  if(typeof c.id!=='string'||typeof c.name!=='string'||c.name.length>255||typeof c.data!=='string'||c.data.length>28000000||!/^data:audio\/[\w.+-]+;base64,[A-Za-z0-9+/=]+$/.test(c.data))throw Error('Invalid clip source.');
  const params=d.params;
  for(const [k,[lo,hi]]of Object.entries(clipSpec.params))if(!Number.isFinite(params[k])||params[k]<lo||params[k]>hi||(clipDiscrete.has(k)&&!Number.isInteger(params[k])))throw Error('Invalid clip control '+k);
  if(params.start>=params.end)throw Error('Clip start must precede end.');
 }
}
