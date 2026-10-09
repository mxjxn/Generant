// MIDI note ownership is independent of keyboard focus and current rack selection.
export class MidiInput {
 constructor({noteOn,noteOff,record=()=>{},programChange=()=>{},status=()=>{},route}){Object.assign(this,{noteOn,noteOff,record,programChange,status,route});this.notes=new Map();this.pedals=new Set();}
 release(key){const n=this.notes.get(key);if(!n)return;this.notes.delete(key);this.noteOff(n.node);this.record(n);}
 panic(port=null,channel=null){for(const [key,n]of this.notes)if((port===null||n.port===port)&&(channel===null||n.channel===channel))this.release(key);for(const key of this.pedals)if(port===null||key.startsWith(port+':')&&(channel===null||key===port+':'+channel))this.pedals.delete(key);}
 receive(port,data){if(!data?.length)return;const [s,a,b]=data,type=s&240,channel=(s&15)+1;
  if(s>=240)return;this.status({port,channel,type,a,b});
  const key=port+':'+channel+':'+a,pedal=port+':'+channel;
  if(type===128||type===144&&b===0){const n=this.notes.get(key);if(n){n.down=false;if(!this.pedals.has(pedal))this.release(key);}return;}
  if(type===176){if(a===64){if(b>=64)this.pedals.add(pedal);else{this.pedals.delete(pedal);for(const [k,n]of this.notes)if(n.port===port&&n.channel===channel&&!n.down)this.release(k);}}if(a===120||a===123)this.panic(port,channel);return;}
  if(type===192){if(!Number.isInteger(a)||a<0||a>127)return;const target=this.route(port,channel,'program');if(target)this.programChange(target,a);return;}
  if(type!==144||!Number.isInteger(a)||a>127||!Number.isInteger(b)||b>127)return;
  const target=this.route(port,channel);if(!target)return;this.release(key);
  const node=this.noteOn(target,a,b/127);if(node===undefined)return;
  this.notes.set(key,{...target,node,port,channel,pitch:a,velocity:b/127,down:true});
 }
}
