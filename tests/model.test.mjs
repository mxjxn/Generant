import test from 'node:test';import assert from 'node:assert/strict';import {Store,demoProject as newProject,validate,connect,resize} from '../shared/model.mjs';
test('default project and roundtrip preserve musical data',()=>{const p=newProject();assert.deepEqual(validate(JSON.parse(JSON.stringify(p))),p);});
test('routing rejects incompatible ports without altering the patch',()=>{const p=newProject(),before=structuredClone(p);assert.throws(()=>connect(p,'keys.audio','keys.tone'));assert.deepEqual(p,before);connect(p,'motion.cv','drums.tone',-.5);assert.equal(p.connections.at(-1).amount,-.5);});
test('invalid external values never enter project',()=>{for(const value of [NaN,Infinity,2,-1]){const s=new Store(newProject());assert.throws(()=>s.edit(p=>p.params.keys.body=value));assert.equal(s.project.params.keys.body,.48);}const p=newProject();p.notes[0].velocity=3;assert.throws(()=>validate(p));});
test('undo and redo preserve both notes and cables',()=>{const s=new Store(newProject()),initial=structuredClone(s.project);s.edit(p=>{p.notes[0].pitch=61;connect(p,'motion.cv','drums.tone');});s.undo();assert.deepEqual(s.project,initial);s.redo();assert.equal(s.project.notes[0].pitch,61);assert.equal(s.project.connections.length,4);});
test('shortening loop retains valid notes and drum lengths',()=>{const p=newProject();resize(p,1);validate(p);assert.equal(p.drums[0].length,16);assert.ok(p.notes.every(n=>n.beat+n.duration<=4));});

// Exercise the actual final worklet against overload and non-finite input.
test('output guard bounds both channels and silences non-finite values',async()=>{
 const {readFile}=await import('node:fs/promises');const vm=await import('node:vm');let Guard;
 const context={AudioWorkletProcessor:class{constructor(){this.port={postMessage(){}};}},registerProcessor:(_name,cls)=>Guard=cls};
 vm.runInNewContext(await readFile(new URL('../public/guard.js',import.meta.url),'utf8'),context);
 const guard=new Guard();guard.mute=0;guard.gain=1;
 const output=[new Float32Array(6),new Float32Array(6)];guard.process([[Float32Array.from([NaN,Infinity,-Infinity,20,-20,.25]),Float32Array.from([4,-4,NaN,0,.5,-.5])]], [output]);
 for(const channel of output)for(const value of channel)assert.ok(Number.isFinite(value)&&Math.abs(value)<=.981);
 assert.equal(output[0][0],0);assert.equal(output[0][1],0);assert.equal(output[0][2],0);assert.equal(output[0][5],.25);
});

test('code cannot inject engine-only controls or malformed ports',()=>{const p=newProject();p.params.keys.out=0;assert.throws(()=>validate(p));assert.throws(()=>connect(newProject(),'keys.audio.extra','master.audio'));});

test('legacy patches gain envelope defaults; ambient preset is valid',async()=>{const {upgrade,ambientProject}=await import('../shared/model.mjs');const old=newProject();delete old.params.keys.attack;delete old.params.keys.release;assert.equal(upgrade(old).params.keys.release,.2);const ambient=ambientProject();assert.equal(ambient.params.keys.attack,2);assert.equal(ambient.notes.length,16);assert.equal(ambient.drums[0].length,128);});
test('ADSR release starts from instantaneous level and reaches zero',async()=>{const {envelopeAt}=await import('../shared/envelope.mjs');const p={attack:2,decay:2,sustain:.5,release:4};assert.equal(envelopeAt(1,10,p),.5);assert.equal(envelopeAt(3,10,p),.75);assert.equal(envelopeAt(6,10,p),.5);assert.equal(envelopeAt(3,1,p),.25);assert.equal(envelopeAt(5,1,p),0);});

test('pad solo is independent, legacy projects migrate, and trim is ordered',async()=>{const {upgrade,padOn}=await import('../shared/model.mjs');const p=newProject();delete p.pads;delete p.params.shaper;const next=upgrade(p);next.pads[1].solo=1;assert.equal(padOn(next,0),false);assert.equal(padOn(next,1),true);next.pads[1].mute=1;assert.equal(padOn(next,1),false);next.pads[0].start=.8;next.pads[0].end=.2;assert.throws(()=>validate(next));});
test('fine adjustment changes sensitivity without a value jump',async()=>{const {dragPosition,toPosition,fromPosition}=await import('../public/controls.mjs');let n=.4;n=dragPosition(n,16,false);assert.equal(n,.5);assert.equal(dragPosition(n,0,true),n);assert.equal(dragPosition(n,16,true),.51);assert.equal(dragPosition(.51,0,false),.51);assert.ok(Math.abs(fromPosition(toPosition(.01,.005,30,true),.005,30,true)-.01)<1e-8);});
