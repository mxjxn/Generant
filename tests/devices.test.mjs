import test from 'node:test';
import assert from 'node:assert/strict';
import {Store,validate,upgrade,connect} from '../shared/model.mjs';
import {addKeys,addTool,appendInsert,removeDevice,channelOf,paramsOf} from '../shared/studio.mjs';
import {chain,effectLayout,cvBus,controlOrder,extraSpecs} from '../shared/devices.mjs';
import {synthName,synthParams} from '../shared/fm.mjs';

test('effect chains transfer ownership, reject overflow atomically and survive deletion/undo',()=>{
 const s=new Store();let a,b,fx=[];s.edit(p=>{a=addKeys(p);b=addKeys(p);for(const type of ['gain','vca','filter','reverb','chorus','delay','hall'])fx.push(addTool(p,type));for(const id of fx.slice(0,6))appendInsert(p,channelOf(p,a).id,id);});
 const before=structuredClone(s.project);assert.throws(()=>s.edit(p=>appendInsert(p,channelOf(p,a).id,fx[6])),/six/);assert.deepEqual(s.project,before);
 s.edit(p=>appendInsert(p,channelOf(p,b).id,fx[0]));assert.equal(chain(channelOf(s.project,a)).length,5);assert.deepEqual(chain(channelOf(s.project,b)),[fx[0]]);
 const layout=effectLayout(s.project);assert.equal(new Set(layout.map(f=>f.node)).size,6);assert.ok(layout.every(f=>f.node<1000));assert.equal(layout[1].input,layout[0].output);
 s.edit(p=>removeDevice(p,fx[2]));assert.ok(!effectLayout(s.project).some(f=>f.id===fx[2]));s.undo();assert.ok(effectLayout(s.project).some(f=>f.id===fx[2]));assert.deepEqual(upgrade(s.project),s.project);
});
test('CV sources have distinct buses, dependencies order correctly and cycles rollback',()=>{
 const s=new Store();let a,b,env,key;s.edit(p=>{key=addKeys(p);a=addTool(p,'cvmath');b=addTool(p,'cvmath');env=addTool(p,'envelope');connect(p,key+'.gate',env+'.gate');connect(p,env+'.cv',b+'.a');connect(p,b+'.cv',a+'.a');});
 assert.equal(new Set([a,b,env,key].map(id=>cvBus(s.project,id))).size,4);assert.notEqual(cvBus(s.project,key),cvBus(s.project,key,'gate'));assert.deepEqual(controlOrder(s.project).map(d=>d.id),[env,b,a]);
 const before=structuredClone(s.project);assert.throws(()=>s.edit(p=>connect(p,a+'.cv',b+'.b')),/cycle/);assert.deepEqual(s.project,before);
});
test('all devices validate; new engines retain buffer/CV routing and reject bad sample data',()=>{
 const s=new Store();let cloud,lfo;s.edit(p=>{cloud=addKeys(p);paramsOf(p,cloud).fmMode=3;for(const type of Object.keys(extraSpecs)){const id=addTool(p,type);if(type==='lfo')lfo=id;}connect(p,lfo+'.cv',cloud+'.position',-.5);});
 validate(s.project);const params=paramsOf(s.project,cloud),synth=synthParams(s.project,cloud,params);assert.equal(synthName(params),'rackCloud');assert.equal(synth.buf,7600);assert.equal(synth.positionConnected,1);assert.equal(synth.positionAmount,-.5);assert.equal(synth.positionBus,cvBus(s.project,lfo));
 assert.throws(()=>s.edit(p=>p.studio.devices[0].grainSample={name:'bad',data:'file:///bad'}),/sample/);assert.throws(()=>s.edit(p=>p.studio.devices.find(d=>d.id===lfo).params.shape=1.5),/switch/);
 s.edit(p=>paramsOf(p,cloud).fmMode=4);assert.equal(synthName(paramsOf(s.project,cloud)),'rackVCO');
});

test('tracker automation targets every insert stage and independent modulator with discrete selectors',async()=>{
 const {automationMessages}=await import('../shared/automation.mjs');const {ensureSequence,fxMaps,effectiveParams}=await import('../shared/tracker.mjs');const {specs}=await import('../shared/model.mjs');
 const s=new Store();let key,filter,lfo;s.edit(p=>{key=addKeys(p);paramsOf(p,key).fmMode=4;appendInsert(p,channelOf(p,key).id,addTool(p,'gain'));filter=addTool(p,'filter');appendInsert(p,channelOf(p,key).id,filter);lfo=addTool(p,'lfo');for(const [id,code,value]of [[filter,'02',100],[lfo,'01',80],[key,fxMaps.keys.find(f=>f[1]==='oscShape')[0],100]])ensureSequence(p,id).fx.push({beat:0,column:0,code,value,curve:'hold'});});
 const messages=automationMessages(s.project,0).audio;assert.ok(messages.some(m=>m[1]===effectLayout(s.project)[1].node));assert.ok(messages.some(m=>m[1]===800+s.project.studio.devices.findIndex(d=>d.id===lfo)));assert.equal(effectiveParams(s.project,key,0,specs).oscShape,2);
});
