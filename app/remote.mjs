import dgram from 'node:dgram';
import {remoteCommand,REMOTE_PREFIX} from '../shared/remote.mjs';

function stringAt(data,offset){const end=data.indexOf(0,offset);if(end<0)throw Error('Unterminated OSC string.');return[data.toString('utf8',offset,end),(end+4)&~3];}

export function decodeOsc(data,inherited=null,depth=0){
 if(!Buffer.isBuffer(data)||data.length<4||depth>8)throw Error('Invalid OSC packet.');
 if(data.subarray(0,8).toString('binary')==='#bundle\0'){
  if(data.length<16)throw Error('Truncated OSC bundle.');
  const high=data.readUInt32BE(8),low=data.readUInt32BE(12),at=high===0&&low===1?inherited:high+low/2**32-2208988800;let offset=16,out=[];
  while(offset<data.length){if(offset+4>data.length)throw Error('Truncated OSC bundle element.');const size=data.readInt32BE(offset);offset+=4;if(size<1||offset+size>data.length)throw Error('Invalid OSC bundle element.');out.push(...decodeOsc(data.subarray(offset,offset+size),at,depth+1));offset+=size;}return out;
 }
 let address,tags,offset;[address,offset]=stringAt(data,0);[tags,offset]=stringAt(data,offset);if(!address.startsWith('/')||!tags.startsWith(','))throw Error('Invalid OSC message.');const args=[];
 for(const tag of tags.slice(1)){let value;if(tag==='s'){[value,offset]=stringAt(data,offset);}else if(tag==='i'){value=data.readInt32BE(offset);offset+=4;}else if(tag==='f'){value=data.readFloatBE(offset);offset+=4;}else if(tag==='d'){value=data.readDoubleBE(offset);offset+=8;}else if(tag==='T'||tag==='F'){value=tag==='T';}else throw Error('Unsupported OSC type '+tag+'.');args.push(value);}
 return[{at:inherited,address,args}];
}

export class GenerantRemote{
 constructor(port=57142,onCommand=()=>{},onError=()=>{}){this.port=port;this.onCommand=onCommand;this.onError=onError;this.socket=null;}
 async open(){if(this.socket)return;const socket=dgram.createSocket('udp4');socket.on('message',data=>{try{for(const event of decodeOsc(data)){if(!event.address.startsWith(REMOTE_PREFIX+'/'))continue;const command=remoteCommand(event.address,event.args);if(command)this.onCommand({...command,at:event.at});}}catch(error){this.onError(error);}});socket.on('error',this.onError);await new Promise((resolve,reject)=>{const fail=error=>{socket.off('listening',resolve);reject(error);};socket.once('error',fail);socket.once('listening',()=>{socket.off('error',fail);resolve();});socket.bind(this.port,'127.0.0.1');});this.socket=socket;}
 close(){this.socket?.close();this.socket=null;}
}
