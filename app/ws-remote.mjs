import {WebSocketServer} from 'ws';
import {remoteCommand} from '../shared/remote.mjs';

// WebSocket twin of the UDP OSC remote. Same command parser, JSON wire format:
// client sends {"address":"/generant/v1/...","args":[...]} or {"query":"state","id":N};
// server replies {"id":N,"ok":true,"result":...} or {"id":N,"ok":false,"error":"..."}.
// Browsers cannot UDP, so this is the transport for browser REPLs (zippah).
export class WsRemote{
 constructor(port=57143,onCommand=()=>{},onError=()=>{},onState=async()=>({})){this.port=port;this.onCommand=onCommand;this.onError=onError;this.onState=onState;this.server=null;this.pending=new Map();}
 async open(){
  if(this.server)return;
  const server=this.server=new WebSocketServer({host:'127.0.0.1',port:this.port});
  server.on('error',this.onError);
  server.on('connection',socket=>{
   socket.on('error',this.onError);
   socket.on('message',data=>{
    let msg;try{msg=JSON.parse(String(data));}catch(error){return this.safeSend(socket,{ok:false,error:'Invalid JSON: '+error.message});}
    try{
     if(msg?.query==='state'){
      const id=msg.id??null;
      Promise.resolve().then(()=>this.onState()).then(
       state=>this.safeSend(socket,{id,ok:true,result:state}),
       error=>this.safeSend(socket,{id,ok:false,error:error.message}));
     }
     else if(typeof msg?.address==='string'){
      const command=remoteCommand(msg.address,Array.isArray(msg.args)?msg.args:[]);
      if(!command)this.safeSend(socket,{ok:false,error:'Unknown remote command.'});
      else{this.onCommand({...command,at:msg.at??null});this.safeSend(socket,{ok:true});}
     }
     else this.safeSend(socket,{ok:false,error:'Send {address,args} or {query:"state"}.'});
    }catch(error){this.safeSend(socket,{ok:false,error:error.message});}
   });
  });
  await new Promise((resolve,reject)=>{
   const fail=error=>{server.off('listening',resolve);reject(error);};
   server.once('error',fail);server.once('listening',()=>{server.off('error',fail);resolve();});
  });
 }
 safeSend(socket,payload){try{if(socket.readyState===1)socket.send(JSON.stringify(payload));}catch(error){this.onError(error);}}
 close(){return new Promise(resolve=>{if(!this.server)return resolve();for(const set of [this.server.clients])for(const socket of set)socket.terminate();this.server.close(()=>{this.server=null;resolve();});});}
}
