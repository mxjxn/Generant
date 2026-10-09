import {kitSpec,newKitPad} from './kit.mjs';
import {extraSpecs,isEffect,chain,writeChain,controlTypes,extendedKeys} from './devices.mjs';
// Studio identities surround the original musical payload. Built-in clips/parameters
// retain their v1 storage locations; these accessors are the only mapping boundary.
export function initializeStudio(p){
 const target=p.params.shaper.target;
 p.studio={devices:[{id:'keys',type:'keys',name:'Glass Keys'},{id:'drums',type:'drums',name:'Tape Drums'},{id:'motion',type:'motion',name:'Motion'},{id:'shaper',type:'shaper',name:'Contour'}],tracks:[{id:'track-keys',deviceId:'keys',clipId:'clip-keys'},{id:'track-drums',deviceId:'drums',clipId:'clip-drums'}],clips:[{id:'clip-keys',kind:'notes'},{id:'clip-drums',kind:'drums'}],channels:[channel('channel-keys','keys'),channel('channel-drums','drums')]};
 if(target===1)p.studio.channels[0].insert='shaper';else p.studio.channels[1].insert='shaper';
 if(target===2){p.studio.devices.push({id:'shaper-keys',type:'shaper',name:'Contour · Keys',params:structuredClone(p.params.shaper)});p.studio.channels[0].insert='shaper-keys';}
 return p;
}
function channel(id,deviceId){return{id,deviceId,level:0,pan:0,mute:false,solo:false,insert:null};}
export const deviceOf=(p,id)=>p.studio.devices.find(d=>d.id===id);
export const paramsOf=(p,id)=>deviceOf(p,id)?.params??p.params[id];
export function notesOf(p,id){if(id==='keys')return p.notes;const t=p.studio.tracks.find(t=>t.deviceId===id);return p.studio.clips.find(c=>c.id===t?.clipId)?.notes??[];}
export function setNotes(p,id,notes){if(id==='keys')p.notes=notes;else{const t=p.studio.tracks.find(t=>t.deviceId===id);p.studio.clips.find(c=>c.id===t.clipId).notes=notes;}}
export const channelOf=(p,id)=>p.studio.channels.find(c=>c.deviceId===id);
export const connected=(p,id)=>p.connections.some(c=>c.from===id+'.audio'&&c.to==='master.audio');
export function channelOn(p,id){const c=channelOf(p,id);return !!c&&connected(p,id)&&!c.mute&&(!p.studio.channels.some(x=>x.solo)||c.solo);}
export function setOutput(p,id,on){p.connections=p.connections.filter(c=>c.from!==id+'.audio');if(on)p.connections.push({from:id+'.audio',to:'master.audio',amount:1});}
export function setInsert(p,channelId,effect){if(effect)for(const c of p.studio.channels)if(chain(c).includes(effect))writeChain(c,chain(c).filter(id=>id!==effect));writeChain(p.studio.channels.find(c=>c.id===channelId),effect?[effect]:[]);}
export function appendInsert(p,channelId,effect){for(const c of p.studio.channels)if(chain(c).includes(effect))writeChain(c,chain(c).filter(id=>id!==effect));const c=p.studio.channels.find(c=>c.id===channelId);if(chain(c).length>=6)throw Error('Up to six inserts per channel.');writeChain(c,[...chain(c),effect]);}
export function removeInsert(p,effect){for(const c of p.studio.channels)if(chain(c).includes(effect))writeChain(c,chain(c).filter(id=>id!==effect));}
export function addKeys(p,source='keys'){
 const id='keys-'+crypto.randomUUID(),clipId='clip-'+crypto.randomUUID(),name=(deviceOf(p,source)?.name??'Four FM')+' copy';
 p.studio.devices.push({id,type:'keys',name,params:structuredClone(paramsOf(p,source)),...(deviceOf(p,source)?.patch?{patch:structuredClone(deviceOf(p,source)?.patch)}:{})});
 if(deviceOf(p,source)?.grainSample)deviceOf(p,id).grainSample=structuredClone(deviceOf(p,source).grainSample);if(deviceOf(p,source)?.presets){deviceOf(p,id).presets=structuredClone(deviceOf(p,source).presets);deviceOf(p,id).programs=structuredClone(deviceOf(p,source).programs);}if(deviceOf(p,source)?.wavetableId)deviceOf(p,id).wavetableId=deviceOf(p,source)?.wavetableId;
 p.studio.tracks.push({id:'track-'+crypto.randomUUID(),deviceId:id,clipId});
 p.studio.clips.push({id:clipId,kind:'notes',notes:structuredClone(notesOf(p,source)).map(n=>({...n,id:crypto.randomUUID()}))});
 if(p.studio.sequences?.[source])p.studio.sequences[id]=structuredClone(p.studio.sequences[source]);
 p.studio.channels.push(channel('channel-'+crypto.randomUUID(),id));setOutput(p,id,true);return id;
}
export function addEffect(p){const id='shaper-'+crypto.randomUUID();p.studio.devices.push({id,type:'shaper',name:'Contour '+(p.studio.devices.filter(d=>d.type==='shaper').length+1),params:structuredClone(p.params.shaper)});return id;}
export function removeDevice(p,id){if(!deviceOf(p,id))return;if(id==='keys')p.notes=[];if(id==='drums'){p.drums=p.drums.map(r=>r.map(()=>false));p.samples=[null,null,null,null];}for(const pat of p.song?.patterns??[]){delete pat.data.notes[id];delete pat.data.sequences[id];if(id==='drums')pat.data.drums=pat.data.drums.map(r=>r.map(()=>false));}const t=p.studio.tracks.find(t=>t.deviceId===id);if(p.studio.sequences)delete p.studio.sequences[id];p.studio.devices=p.studio.devices.filter(d=>d.id!==id);p.studio.tracks=p.studio.tracks.filter(t=>t.deviceId!==id);p.studio.clips=p.studio.clips.filter(c=>c.id!==t?.clipId);p.studio.channels=p.studio.channels.filter(c=>c.deviceId!==id);removeInsert(p,id);p.connections=p.connections.filter(c=>!c.from.startsWith(id+'.')&&!c.to.startsWith(id+'.'));}
export function validateStudio(p,specs){
 const s=p.studio,validId=x=>typeof x==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(x),unique=a=>Array.isArray(a)&&a.every(x=>x&&validId(x.id))&&new Set(a.map(x=>x.id)).size===a.length;
 if(!s||!['devices','tracks','clips','channels'].every(k=>unique(s[k]))||s.devices.length>48||s.channels.length>8)throw Error('Invalid studio identities or studio capacity exceeded (8 instrument channels).');

 for(const d of s.devices){if(!['kit','keys','drums','shaper','motion','osc',...Object.keys(extraSpecs)].includes(d.type)||typeof d.name!=='string'||!d.name.trim()||d.name.length>80)throw Error('Invalid device.');if(!['kit','keys','drums','shaper','motion'].includes(d.id)&&!['kit','keys','shaper','osc',...Object.keys(extraSpecs)].includes(d.type))throw Error('Only additional Keys, Contour and OSC instances are supported yet.');if(d.type==='osc'&&(typeof d.oscName!=='string'||!/^[a-zA-Z][a-zA-Z0-9_.-]{0,63}$/.test(d.oscName)||['keys','modulation','kick','snare','hat','texture','motion'].includes(d.oscName)))throw Error('Use a unique OSC name, e.g. asteroid.scale.');const params=paramsOf(p,d.id);if(!params||Object.keys(params).some(k=>!Object.hasOwn(specs[d.type].params,k)))throw Error('Unknown device parameter.');for(const [k,[lo,hi]]of Object.entries(specs[d.type].params))if(!Number.isFinite(params[k])||params[k]<lo||params[k]>hi)throw Error('Invalid device control '+k);for(const k of ['envTarget','mode','target','bypass','compensate','bass'])if(k in params&&!Number.isInteger(params[k]))throw Error('Invalid discrete device control.');}
 if(s.fmPatches!==undefined){if(!Array.isArray(s.fmPatches)||s.fmPatches.length>128)throw Error('Invalid FM patch library.');for(const patch of s.fmPatches){if(typeof patch.name!=='string'||!patch.name.trim()||patch.name.length>80||!patch.params)throw Error('Invalid FM patch.');for(const [k,[lo,hi]]of Object.entries(specs.keys.params))if(!Number.isFinite(patch.params[k])||patch.params[k]<lo||patch.params[k]>hi)throw Error('Invalid FM patch control.');}}
 const instruments=s.devices.filter(d=>['keys','kit','drums'].includes(d.type));
 if(s.tracks.length!==instruments.length||s.channels.length!==instruments.length||s.clips.length!==s.tracks.length)throw Error('Each instrument needs a track, clip, and channel.');
 for(const d of instruments){if(s.tracks.filter(t=>t.deviceId===d.id).length!==1||s.channels.filter(c=>c.deviceId===d.id).length!==1)throw Error('Conflicting instrument references.');}
 const oscNames=s.devices.filter(d=>d.type==='osc').map(d=>d.oscName);if(new Set(oscNames).size!==oscNames.length)throw Error('OSC output names must be unique.');
 const clipIds=new Set();for(const t of s.tracks){const d=deviceOf(p,t.deviceId),c=s.clips.find(c=>c.id===t.clipId);if(!d||!c||clipIds.has(c.id)||c.kind!==(d.type==='drums'?'drums':'notes'))throw Error('Invalid track clip.');clipIds.add(c.id);if(['keys','kit'].includes(d.type)){const notes=notesOf(p,d.id),ids=new Set();if(!Array.isArray(notes)||notes.length>2048)throw Error('Invalid clip notes.');for(const n of notes){if(typeof n.id!=='string'||ids.has(n.id)||!Number.isInteger(n.pitch)||n.pitch<0||n.pitch>127||![n.beat,n.duration,n.velocity].every(Number.isFinite)||n.beat<0||n.duration<.0625||n.beat+n.duration>p.bars*4||n.velocity<0||n.velocity>1)throw Error('Invalid clip note.');ids.add(n.id);}}}
 const inserts=new Set();for(const c of s.channels){if(!Number.isFinite(c.level)||c.level< -60||c.level>6||!Number.isFinite(c.pan)||Math.abs(c.pan)>1||typeof c.mute!=='boolean'||typeof c.solo!=='boolean')throw Error('Invalid mixer channel.');if(c.inserts!==undefined&&(!Array.isArray(c.inserts)||c.inserts.length>6||c.insert!==(c.inserts[0]??null)))throw Error('Invalid insert chain.');for(const id of chain(c)){if(!isEffect(deviceOf(p,id))||inserts.has(id))throw Error('Insert instances cannot be shared.');inserts.add(id);}}
}
export function deviceView(p,id){const d=deviceOf(p,id);if(!d)return p;const view=structuredClone(p);view.params[d.type]=structuredClone(paramsOf(p,id));if(['keys','kit'].includes(d.type))view.notes=structuredClone(notesOf(p,id));return view;}
export function mergeDeviceView(p,id,view){const next=structuredClone(p),d=deviceOf(next,id);if(!d)return next;next.connections=structuredClone(view.connections);if(d.params)d.params=structuredClone(view.params[d.type]);else next.params[d.id]=structuredClone(view.params[d.type]);if(['keys','kit'].includes(d.type))setNotes(next,id,structuredClone(view.notes));if(d.type==='kit'){const v=deviceOf(view,id);d.pads=structuredClone(v.pads);d.assets=structuredClone(v.assets);}if(d.type==='drums'){next.pads=view.pads;next.samples=view.samples;next.drums=view.drums;}if(d.type==='motion')next.wave=view.wave;return next;}
// Read-only projection: controls must not copy the entire song on every read.
// Edits still use independent drafts through deviceView / mergeDeviceView.
export function deviceReadView(p,id){const d=deviceOf(p,id);if(!d)return p;return {...p,params:{...p.params,[d.type]:paramsOf(p,id)},...(['keys','kit'].includes(d.type)?{notes:notesOf(p,id)}:{})};}
export function scopedStore(store,getId){return{get project(){return deviceReadView(store.project,getId());},edit(fn){store.edit(p=>{const view=deviceView(p,getId());fn(view);Object.assign(p,mergeDeviceView(p,getId(),view));});}};}
export function engineLayout(p){return p.studio.channels.map((c,i)=>({deviceId:c.deviceId,channelId:c.id,group:c.deviceId==='keys'?101:c.deviceId==='drums'?102:300+i,raw:c.deviceId==='keys'?16:c.deviceId==='drums'?18:40+i*4,processed:42+i*4,effectNode:400+i,channelNode:500+i,meter:32+i}));}

export function addUtility(p,type){if(!['drums','motion'].includes(type))throw Error('Unsupported device');if(deviceOf(p,type))return type;p.studio.devices.push({id:type,type,name:type==='drums'?'Tape Drums':'Motion'});if(type==='drums'){p.studio.tracks.push({id:'track-drums',deviceId:type,clipId:'clip-drums'});p.studio.clips.push({id:'clip-drums',kind:'drums'});p.studio.channels.push(channel('channel-drums',type));setOutput(p,type,true);}return type;}

export function addTool(p,type){const spec=extraSpecs[type];if(!spec)throw Error('Unknown device');const id=type+'-'+crypto.randomUUID();p.studio.devices.push({id,type,name:spec.name,params:Object.fromEntries(Object.entries(spec.params).map(([k,v])=>[k,v[2]]))});return id;}

export function addKit(p){const id=addKeys(p),d=deviceOf(p,id);d.type='kit';d.name='Drum Rack';d.params=Object.fromEntries(Object.entries(kitSpec.params).map(([k,v])=>[k,v[2]]));d.pads=Array.from({length:16},newKitPad);d.assets=[];delete d.patch;delete d.presets;delete d.programs;delete d.wavetableId;delete d.grainSample;setNotes(p,id,[]);delete p.studio.sequences?.[id];return id;}
