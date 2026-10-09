import {validAddress,validArgs} from '../shared/osc-score.mjs';
import dgram from 'node:dgram';
function string(value){const bytes=Buffer.from(value+'\0'),out=Buffer.alloc(Math.ceil(bytes.length/4)*4);bytes.copy(out);return out;}
export function encodeMessage(address,args=[]){return Buffer.concat([string(address),string(','+args.map(v=>typeof v==='string'?'s':Number.isInteger(v)?'i':'f').join('')),...args.map(v=>{if(typeof v==='string')return string(v);const b=Buffer.alloc(4);Number.isInteger(v)?b.writeInt32BE(v):b.writeFloatBE(v);return b;})]);}
export function encodeBundle(at,messages){const time=Buffer.alloc(8);time.writeUInt32BE(Math.floor(at));time.writeUInt32BE(Math.floor((at%1)*4294967296),4);return Buffer.concat([string('#bundle'),time,...messages.flatMap(([address,...args])=>{const msg=encodeMessage(address,args),length=Buffer.alloc(4);length.writeUInt32BE(msg.length);return[length,msg];})]);}
export class BlenderOutput{
 constructor(port=57141){this.port=port;this.enabled=false;this.socket=dgram.createSocket('udp4');this.error=null;this.socket.on('error',e=>this.error=e.message);}
 reset(){if(this.enabled)this.socket.send(encodeMessage('/rack/reset'),this.port,'127.0.0.1');}
 enable(value){this.reset();this.enabled=!!value;this.reset();return this.enabled;}
 send({at,messages}){if(!this.enabled)return;if(!Number.isFinite(at)||Math.abs(at-(Date.now()/1000+2208988800))>90||!Array.isArray(messages)||messages.length>128)throw Error('Invalid OSC batch');for(const m of messages){if(!Array.isArray(m)||!validAddress(m[0])||m.length>80||!m.slice(1).every(v=>validArgs([v])))throw Error('Invalid OSC message');}const packet=encodeBundle(at,messages);if(packet.length>60000)throw Error('OSC packet too large');this.socket.send(packet,this.port,'127.0.0.1');}
 close(){this.reset();try{this.socket.close();}catch{}}
}
