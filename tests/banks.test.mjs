import test from 'node:test';import assert from 'node:assert';
import {upgrade,demoProject} from '../shared/model.mjs';
import {SCALES,degreeToSemis,validateBankDef,validateBanks,renderLane,newBankLane,applyBankLanes,bakeLaneToPattern} from '../shared/banks.mjs';
import {compileSong} from "../shared/song.mjs";
import {addKeys,addClip} from '../shared/studio.mjs';

const def={id:'dub-techno-bass',name:'Dub Techno Bass',instrument:'keys',key:9,scale:'minor',bpm:122,patterns:[
 {id:'p1',name:'Root Pulse',rows:16,lpb:4,steps:[{step:0,note:33,velocity:.9,gate:.4},{step:8,note:33,velocity:.6,gate:.3}]},
 {id:'p2',name:'Octave Roll',rows:16,lpb:4,steps:[{step:0,note:33,velocity:.9,gate:.45},{step:4,note:45,velocity:.7,gate:.3},{step:8,note:40,velocity:.8,gate:.4},{step:12,note:45,velocity:.7,gate:.3}]}]};

test('bank def validation',()=>{
 validateBankDef(def);
 assert.throws(()=>validateBankDef({...def,scale:'blues'}),/Unknown bank scale/);
 assert.throws(()=>validateBankDef({...def,instrument:'kit'}),/keys or clip/);
 assert.throws(()=>validateBankDef({...def,patterns:[{...def.patterns[0],steps:[{step:0,note:200,velocity:.5,gate:.5}]}]}),/0-127/);
});

test('project upgrade creates banks state and validateBanks accepts a def+lane',()=>{
 const p=upgrade(demoProject());
 assert.deepEqual(p.banks,{defs:[],lanes:[]});
 p.banks.defs.push(def);
 p.banks.lanes.push(newBankLane('lane-1','keys','dub-techno-bass','p1'));
 upgrade(p); // validateBanks runs inside
 assert.throws(()=>{const q=upgrade(demoProject());q.banks.lanes.push(newBankLane('bad','keys','nonexistent','p1'));validateBanks(q);},/unknown bank/);
});

test('renderLane: hard gate, tiling, transpose',()=>{
 const lane=newBankLane('l','keys','b','p1');
 lane.gateMode='hard';
 const notes=renderLane(lane,def,0,8); // 2 bars = 2 reps of the 1-bar pattern
 assert.equal(notes.length,4);
 assert.deepEqual(notes.map(n=>n.beat),[0,2,4,6]);
 // gate .4 * stepBeats .25 = 0.1 beats duration
 assert.equal(notes[0].duration,.1);
 assert.ok(notes.every(n=>n.pitch===33));
 lane.transpose=-12;
 assert.ok(renderLane(lane,def,0,4).every(n=>n.pitch===21));
 lane.transpose=2;lane.scaleLock=true; // 2 minor degrees from A = C
 assert.ok(renderLane(lane,def,0,4).every(n=>n.pitch===36));
 assert.equal(degreeToSemis('minor',2),3);
 assert.equal(degreeToSemis('minor',-1),-2);
});

test('renderLane: envelope gate sustains to next sounding step',()=>{
 const lane=newBankLane('l','keys','b','p2');
 lane.gateMode='env';
 const notes=renderLane(lane,def,0,4);
 assert.equal(notes.length,4);
 // each note sustains to the next step one beat later
 assert.deepEqual(notes.map(n=>n.duration),[1,1,1,1]);
 // last note wraps to the next repetition's first step (1 beat later)
 assert.equal(notes[3].duration,1);
});

test('applyBankLanes injects lane notes through compileSong and scales decay/release',()=>{
 let p=upgrade(demoProject());
 const id=addKeys(p);
 p=upgrade(p);
 p.banks.defs.push(def);
 const lane=newBankLane('lane-1',id,'dub-techno-bass','p1');
 p.banks.lanes.push(lane);
 const out=compileSong(p,{mode:'pattern'});
 const dev=out.studio.devices.find(d=>d.id===id);
 assert.ok(dev.params.decay!==undefined,'lane device has params');
 const base={decay:dev.params.decay,release:dev.params.release};
 lane.decayMul=2;lane.releaseMul=3;
 const out2=compileSong(p,{mode:'pattern'});
 const dev2=out2.studio.devices.find(d=>d.id===id);
 const track2=out2.studio.tracks.find(t=>t.deviceId===id);
 const clipNotes=out2.studio.clips.find(c=>c.id===track2.clipId).notes;
 const keys=clipNotes.filter(n=>n.id.startsWith('bank-lane-1'));
 assert.equal(keys.length,4); // 2-bar segment, pattern tiles twice: 2 steps x 2 reps
 assert.ok(Math.abs(dev2.params.decay-base.decay*2)<1e-9);
 assert.ok(Math.abs(dev2.params.release-base.release*3)<1e-9);
 lane.enabled=false;
 assert.equal(compileSong(p,{mode:'pattern'}).notes.filter(n=>n.id.startsWith('bank-')).length,0);
});

test('bakeLaneToPattern writes editable integer notes into the pattern',()=>{
 let p=upgrade(demoProject());
 p=upgrade(p);
 p.banks.defs.push(def);
 const lane=newBankLane('lane-1','keys','dub-techno-bass','p2');
 lane.transpose=.4; // fractional detune — baked notes must round
 p.banks.lanes.push(lane);
 const patId=p.song.editPatternId;
 const n=bakeLaneToPattern(p,patId,'lane-1');
 assert.equal(n,8);
 assert.ok(p.notes.filter(x=>x.id.startsWith('bank-')).every(x=>Number.isInteger(x.pitch)));
 upgrade(p); // full validate passes with baked notes
});
