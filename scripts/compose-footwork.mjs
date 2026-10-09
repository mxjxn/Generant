import fs from 'node:fs/promises';
import {newProject,specs,validate} from '../shared/model.mjs';
import {addKeys,addUtility,addTool,appendInsert,deviceOf,channelOf,setNotes} from '../shared/studio.mjs';
import {factoryPatches} from '../shared/fm.mjs';
import {storePreset} from '../shared/presets.mjs';
import {ensureSequence,editFx} from '../shared/tracker.mjs';
import {syncPattern,selectPattern,insertPosition,compileSong} from '../shared/song.mjs';
const p=newProject();p.name='Sideways Bloom';p.bpm=160;p.params.master.level=.95;
const base=Object.fromEntries(Object.entries(specs.keys.params).map(([k,v])=>[k,v[2]]));
function synth(name,params,pan=0){const id=addKeys(p);const d=deviceOf(p,id);d.name=name;d.params={...factoryPatches(base)[0].params,...params};d.patch={name,params:structuredClone(d.params)};channelOf(p,id).pan=pan;setNotes(p,id,[]);return id;}
const chords=synth('Velvet / chord stabs',{level:.155,m21:1.65,op2Ratio:1,op2Decay:.16,op2Sustain:.025,op1Attack:.003,op1Decay:.65,op1Sustain:.55,op1Release:.16,op3Level:.13,op3Ratio:2,op3Pan:.6,op1Pan:-.2,m43:.35,op4Ratio:3,attack:.005,decay:.25,sustain:.46,release:.13,cutoff:6800,width:.8});
const ghosts=synth('Stab ghosts',{...deviceOf(p,chords).params,level:.05,cutoff:2300,release:.25,op1Release:.35},.48);
const bass=synth('Root / round FM bass',{level:.34,cutoff:950,m21:.45,op2Ratio:1,op2Decay:.08,op2Sustain:.035,op1Attack:.005,op1Decay:1,op1Sustain:1,op1Release:.06,attack:.005,decay:.5,sustain:.9,release:.055,width:0});
const veil=synth('Veil / transition chords',{level:.085,cutoff:1800,resonance:0,width:1,
 m21:.35,op2Ratio:2,op2Attack:.12,op2Decay:1.7,op2Sustain:.35,
 op1Fine:3,op1Attack:.15,op1Decay:2,op1Sustain:.8,op1Release:.8,
 op3Level:.17,op3Ratio:1,op3Fine:-4,op3Pan:.7,op3Attack:.2,op3Decay:2,op3Sustain:.7,op3Release:.8,
 attack:.22,decay:2,sustain:.7,release:.85},-.15);
const room=addTool(p,'reverb');deviceOf(p,room).name='Veil / blurred room';Object.assign(deviceOf(p,room).params,{room:.45,damp:.72,predelay:.015,mix:.24});appendInsert(p,channelOf(p,veil).id,room);
storePreset(p,veil,0,'Veil / swell');Object.assign(deviceOf(p,veil).params,{attack:.012,decay:.18,sustain:.3,release:.18,op1Attack:.008,op1Decay:.3,op1Sustain:.4,op1Release:.18,op3Attack:.012,op3Release:.18});storePreset(p,veil,1,'Veil / soft pulse');deviceOf(p,veil).params=structuredClone(deviceOf(p,veil).presets[0].params);
const bloom=addTool(p,'hall');deviceOf(p,bloom).name='Velvet / transition bloom';Object.assign(deviceOf(p,bloom).params,{size:28,decay:3.4,damp:.62,bandwidth:.7,spread:20,mix:.045,output:-1});appendInsert(p,channelOf(p,chords).id,bloom);
const air=synth('Afterimage',{level:.05,m21:.55,op2Ratio:2,op2Sustain:.25,op1Attack:.45,op1Decay:3,op1Sustain:.6,op1Release:1.2,attack:.45,decay:2,sustain:.6,release:1.2,cutoff:2400,width:1});
addUtility(p,'drums');deviceOf(p,'drums').name='909 / heel & toe';p.params.drums.level=.64;p.params.drums.tone=1;
for(let i=0;i<4;i++)p.samples[i]={name:['D kick · SFM 909','Clap + snare · SFM 909','Closed hat · SFM 909','Rim · SFM 909'][i],data:'data:audio/wav;base64,'+(await fs.readFile(new URL(`./demo-assets/footwork-${i}.wav`,import.meta.url))).toString('base64')};
Object.assign(p.pads[0],{level:0,cutoff:9000,decay:.27});Object.assign(p.pads[1],{level:-3,cutoff:14000});Object.assign(p.pads[2],{level:-12,cutoff:14000});Object.assign(p.pads[3],{level:-9,cutoff:9000});
for(const channel of p.studio.channels)channel.level=channel.deviceId===bass||channel.deviceId==='drums'?4:6;
channelOf(p,veil).level=3;
const ch=deviceOf(p,chords);storePreset(p,chords,0,'Velvet / dry');Object.assign(ch.params,{m21:2.5,cutoff:10500,op2Decay:.23,level:.142});storePreset(p,chords,1,'Velvet / open');Object.assign(ch.params,{m21:.65,cutoff:2500,release:.33,op1Release:.4,level:.148});storePreset(p,chords,2,'Velvet / low light');ch.params=structuredClone(ch.presets[0].params);
const progressions=[
 [{root:38,n:[53,57,60,64,69]},{root:34,n:[53,57,60,64,65]},{root:31,n:[53,58,62,69,74]},{root:33,n:[55,61,65,70,76]}],
 [{root:41,n:[57,60,64,67,72]},{root:40,n:[55,58,62,65,69]},{root:33,n:[55,61,65,70,76]},{root:38,n:[53,57,60,64,69]}]
];
let serial=0;function note(list,beat,pitch,duration,velocity,column=0){if(beat<16&&duration>=.0625)list.push({id:'bloom-'+serial++,beat,pitch,duration:Math.min(duration,16-beat),velocity,column});}
function make(name,mode,variant=0){const id=p.song.patterns.length===1&&!p.song.patterns[0].data.notes[chords]?.length?p.song.patterns[0].id:null;let entry;if(id){entry=p.song.order[0].id;selectPattern(p,id);}else entry=insertPosition(p,p.song.order.at(-1).id,{kind:'new'});const pat=p.song.patterns.find(x=>x.id===p.song.editPatternId);pat.name=name;p.notes=[];p.drums=Array.from({length:4},()=>Array(64).fill(false));p.studio.sequences={};for(const dev of p.studio.devices.filter(d=>d.type==='keys'))setNotes(p,dev.id,[]);
 const ns=Object.fromEntries([chords,ghosts,bass,veil,air].map(id=>[id,[]]));const prog=progressions[variant%2];const intro=mode==='intro',build=mode==='build',breakdown=mode==='break',bridge=mode==='bridge',outro=mode==='outro',drop=mode==='drop';
 const spaceForTexture=intro||build||breakdown||bridge||outro||(!drop&&variant%2===1);
 const rhythm=[[0,.75,1.5,2.75,3.5],[.25,1,1.75,3.25],[0,.75,2.25,3,3.75],[.5,1.25,2.5,3.25]];
 for(let bar=0;bar<4;bar++){const b=bar*4,{root,n}=prog[bar];let hits=intro?[0,2.75]:breakdown?[.75,3]:bridge?[0,1.5,3.25]:rhythm[(bar+variant)%4];if(outro)hits=bar===0?[.75]:bar===1?[1.5]:bar===2?[0]:[];if(intro)hits=bar===0?[]:bar===3?[0]:[2.75];if(spaceForTexture&&!intro&&!outro&&!build)hits=bar%2?[.75,3.25]:[0,2.75];if(build&&bar===3)hits=[0,.75,1.5,2.5,3,3.5,3.75];
 hits.forEach((t,i)=>{let voicing=[...n];if(drop&&i%3===2)voicing[voicing.length-1]+=12;const v=(i===0?.82:.58+(i%3)*.09)*(intro?.16:outro?.13:spaceForTexture?.43:1);voicing.forEach((pitch,col)=>note(ns[chords],b+t,pitch,(intro||breakdown)?.34:drop?.15:.21,v*(col===0?.87:1),col));if(!intro&&!outro&&(!spaceForTexture||bar%2===1))voicing.slice(1).forEach((pitch,col)=>note(ns[ghosts],b+t+.375,pitch,.15,v*.7,col));});
 if(!intro){const positions=breakdown?[0]:bridge?[0,2.75]:[0,1.5,3.25];positions.forEach((t,i)=>note(ns[bass],b+t,root+(i===2&&bar%2?12:0),i===0?(breakdown?2.75:1.15):.36,i===0?.93:.65));if(drop&&bar%2===1)note(ns[bass],b+3.75,root+7,.125,.5);}
 if(intro||breakdown||bridge||outro) n.slice(0,4).forEach((pitch,col)=>note(ns[air],b,pitch+12,outro&&bar===3?2:3.3,.5,col));
 const hit=(pad,t,v)=>{const step=Math.round((b+t)*4);if(step>=64)return;p.drums[pad][step]=true;ensureSequence(p,'drums').velocities[pad+':'+step]=Math.round(v*255);};
 if(!intro&&!breakdown){let kicks=drop?[0,.75,1.5,2.75,3.5]:[0,1.5,3.25];if(bar%2)kicks=drop?[0,1.25,1.75,3,3.75]:[0,.75,2.75];if(bridge)kicks=[0,3.25];if(outro&&bar>1)kicks=bar===2?[0]:[];kicks.forEach((t,i)=>hit(0,t,i===0?.94:.73));}
 if((!intro&&!breakdown)&&!(outro&&bar===3)){hit(1,2,.92);if(bar===3&&!bridge&&!outro){hit(1,3.25,.33);hit(1,3.75,.54);}}
 if(!intro||bar>=2){for(let step=0;step<16;step++){if((breakdown||bridge)&&step%4!==2)continue;if(outro&&bar===3)continue;if(step%2===0||drop&&[7,11,15].includes(step)||build&&bar===3){hit(2,step/4,step%4===2?.63:step%2===0?.38:.24);}}}
 if(!intro&&!outro){const taps=breakdown?[1.5,3.75]:[.75,2.5,3.75];taps.forEach((t,i)=>hit(3,t,[.42,.58,.3][i]));}
 }
 // Whole voicings only: a few swells at handoffs, no melodic line.
 const section=Number(name.slice(0,2));
 const padChord=(beat,bar,duration,velocity)=>prog[bar].n.slice(0,4).forEach((pitch,col)=>note(ns[veil],beat,pitch,duration,velocity,col));
 if([2,6,12,14].includes(section))padChord(12,3,3.25,.58);
 if(section===1)padChord(8,2,3.1,.42);
 if(section===7)padChord(0,0,3.25,.5);
 if(section===8){padChord(8,2,3.1,.5);for(const [beat,v]of [[12,.52],[12.75,.43],[13.5,.36]])padChord(beat,3,.25,v);}
 if(section===15)padChord(4,1,3.2,.43);
 if(section===16){padChord(0,0,3,.38);padChord(12,3,1.5,.3);}
 editFx(p,veil,0,0,'PR 00');if(section===8)editFx(p,veil,12,0,'PR 01');
 for(const [dev,notes]of Object.entries(ns))setNotes(p,dev,notes);
 // Explicit resets prevent transition settings leaking into subsequent patterns.
 const lift=[2,6,8,12,14,15,16].includes(section),arrival=[3,7,9,13,15,16].includes(section);
 const fx=(id,beat,code,value,curve='hold')=>editFx(p,id,beat,0,code+' '+Math.round(value*255).toString(16).toUpperCase().padStart(2,'0'),curve);
 fx(bloom,0,'06',arrival?.24:.045,arrival?'smooth':'hold');fx(bloom,2,'06',.045);
 if(lift){fx(bloom,12.5,'06',.045,'smooth');fx(bloom,14.75,'06',section===8?.48:.36);}
 editFx(p,chords,0,0,'PR '+(drop?'01':intro||breakdown||outro?'02':'00'));
 if(drop){editFx(p,chords,14,1,'11 B0','linear');editFx(p,chords,15.5,1,'11 55','hold');} // stable 11 = cutoff
 syncPattern(p);return entry;
}
const sections=[['01 · Dust in the stairwell','intro',0],['02 · Count the corners','build',0],['03 · Sideways A','groove',0],['04 · Sideways B','groove',1],['05 · Heel turn','groove',2],['06 · Answer back','groove',3],['07 · Low light','break',0],['08 · Suspended','break',1],['09 · Bloom A','drop',0],['10 · Bloom B','drop',1],['11 · Double back','drop',2],['12 · Turnaround','drop',3],['13 · Soft landing','bridge',0],['14 · Last answer','bridge',1],['15 · After hours','outro',0],['16 · Door closes','outro',1]];
for(const [name,mode,variant]of sections){const entry=make(name,mode,variant);p.song.order.find(e=>e.id===entry).section=name.split(' · ')[1];}
selectPattern(p,p.song.order[0].patternId);validate(p);const resolved=compileSong(p,{mode:'song',loop:false});const file=new URL('../public/examples/sideways-bloom.rack.json',import.meta.url);await fs.writeFile(file,JSON.stringify(p,null,2));await fs.writeFile(new URL('../demos/Sideways Bloom.rack.json',import.meta.url),JSON.stringify(p,null,2));console.log(JSON.stringify({patterns:p.song.patterns.length,positions:p.song.order.length,bars:resolved.bars,seconds:resolved.bars*4*60/p.bpm,instruments:p.studio.devices.length,notes:resolved.studio.clips.reduce((n,c)=>n+(c.notes?.length??0),0)}));
