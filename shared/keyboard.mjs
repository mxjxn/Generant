import {columnNotes,ensureSequence} from './tracker.mjs';
import {setNotes} from './studio.mjs';
const lower=['KeyZ','KeyS','KeyX','KeyD','KeyC','KeyV','KeyG','KeyB','KeyH','KeyN','KeyJ','KeyM'];
const upper=['KeyQ','Digit2','KeyW','Digit3','KeyE','KeyR','Digit5','KeyT','Digit6','KeyY','Digit7','KeyU'];
export function keyboardPitch(code,octave=3){let n=lower.indexOf(code);if(n<0){n=upper.indexOf(code);if(n<0)return null;n+=12;}const pitch=(octave+1)*12+n;return pitch<=127?pitch:null;}
export function quantizeBeat(beat,grid){return grid?Math.round(beat/grid)*grid:beat;}
// Overdub without erasing existing notes. Boundary-crossing notes become retriggered segments.
export function recordNote(p,id,{pitch,start,end,grid=.25,column=0,velocity=.75}){
 const loop=p.bars*4,a=quantizeBeat(Math.max(0,start),grid),b=Math.max(a+.0625,quantizeBeat(Math.max(start,end),grid)),duration=Math.min(loop,b-a),beat=((a%loop)+loop)%loop,segments=[];
 let first=Math.min(duration,loop-beat);if(first<.0625){segments.push({beat:0,duration:Math.max(.0625,duration)});}else{segments.push({beat,duration:first});if(duration-first>=.0625)segments.push({beat:0,duration:duration-first});}
 const notes=columnNotes(p,id),free=c=>segments.every(s=>!notes.some(n=>n.column===c&&n.beat<s.beat+s.duration-1e-8&&s.beat<n.beat+n.duration-1e-8));
 let col=free(column)?column:Array.from({length:32},(_,i)=>i).find(free);if(col===undefined)throw Error('All 32 note columns are occupied.');
 for(const segment of segments)notes.push({id:crypto.randomUUID(),pitch,velocity,column:col,...segment});setNotes(p,id,notes);ensureSequence(p,id).columns=Math.max(ensureSequence(p,id).columns,col+1);return col;
}
