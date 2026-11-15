import test from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import {WsRemote} from '../app/ws-remote.mjs';

const freePort = () => 0; // let the OS pick an ephemeral port

async function connect(port){
  const socket = new WebSocket('ws://127.0.0.1:'+port);
  await new Promise((res,rej)=>{socket.once('open',res);socket.once('error',rej);});
  const next = () => new Promise((res,rej)=>{socket.once('message',d=>res(JSON.parse(String(d))));socket.once('error',rej);});
  const send = obj => socket.send(JSON.stringify(obj));
  return {socket,next,send};
}

test('WsRemote parses commands through the shared remoteCommand parser', async ()=>{
  const got = [];
  const remote = new WsRemote(freePort(), cmd=>got.push(cmd));
  await remote.open();
  const c = await connect(remote.port);
  c.send({address:'/generant/v1/transport/tempo',args:[122]});
  assert.deepEqual(await c.next(), {id:null,ok:true});
  c.send({address:'/generant/v1/pattern/queue',args:['Pattern 00']});
  assert.deepEqual(await c.next(), {id:null,ok:true});
  await new Promise(r=>setTimeout(r,20));
  assert.deepEqual(got, [{type:'tempo',bpm:122,at:null},{type:'queuePattern',pattern:'Pattern 00',at:null}]);
  c.socket.close(); await remote.close();
});

test('WsRemote rejects unknown commands and bad payloads without dying', async ()=>{
  const remote = new WsRemote(freePort(), ()=>{});
  await remote.open();
  const c = await connect(remote.port);
  c.send({address:'/generant/v1/nope'});
  assert.equal((await c.next()).ok, false);
  c.send({address:'/generant/v1/transport/tempo',args:[3000]});
  assert.match((await c.next()).error, /20–999/);
  c.socket.send('garbage-not-json');
  assert.match((await c.next()).error, /Invalid JSON/);
  c.send({address:'/generant/v1/transport/play'});
  assert.deepEqual(await c.next(), {id:null,ok:true}); // still alive
  c.socket.close(); await remote.close();
});

test('WsRemote state query returns the provider snapshot', async ()=>{
  const state = {playing:false,bpm:122,devices:[{id:'keys',type:'keys',name:'Four FM'}],banks:{defs:[],lanes:[]}};
  const remote = new WsRemote(freePort(), ()=>{}, ()=>{}, async ()=>state);
  await remote.open();
  const c = await connect(remote.port);
  c.send({query:'state',id:7});
  assert.deepEqual(await c.next(), {id:7,ok:true,result:state});
  c.socket.close(); await remote.close();
});

test('WsRemote state provider failure surfaces as ok:false', async ()=>{
  const remote = new WsRemote(freePort(), ()=>{}, ()=>{}, async ()=>{throw Error('Renderer gone.');});
  await remote.open();
  const c = await connect(remote.port);
  c.send({query:'state',id:3});
  assert.deepEqual(await c.next(), {id:3,ok:false,error:'Renderer gone.'});
  c.socket.close(); await remote.close();
});

test('parser accepts device/note and bank/lane with validation', async ()=>{
  const {remoteCommand} = await import('../shared/remote.mjs');
  const note = remoteCommand('/generant/v1/device/note',['keys-1',48]);
  assert.deepEqual({...note, at:null}, {type:'note',device:'keys-1',pitch:48,velocity:.8,at:null});
  const note2 = remoteCommand('/generant/v1/device/note',['Bass Lane',60,.5]);
  assert.equal(note2.velocity,.5);
  assert.throws(()=>remoteCommand('/generant/v1/device/note',['keys-1',200]), /0–127/);
  const lane = remoteCommand('/generant/v1/bank/lane',['keys-1','i-dotted',3]);
  assert.deepEqual(lane,{type:'bankLane',device:'keys-1',pattern:'i-dotted',transpose:3});
  assert.equal(remoteCommand('/generant/v1/bank/lane',['keys-1','i-dotted']).transpose,0);
  assert.throws(()=>remoteCommand('/generant/v1/bank/lane',['keys-1','i-dotted',30]), /-24–24/);
});

test('WsRemote returns async render job results and progress', async ()=>{
  const remote = new WsRemote(freePort(), command=>{
    assert.equal(command.type,'render');
    assert.equal(typeof command.progress,'function');
    return (async()=>{
      await new Promise(r=>setTimeout(r,10));
      command.progress(0.5,'halfway');
      await new Promise(r=>setTimeout(r,10));
      return {files:{wav:'/tmp/x.wav'}};
    })();
  });
  await remote.open();
  const c = await connect(remote.port);
  const messages=[];
  const collect=new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('render reply timed out: '+JSON.stringify(messages))),2000);
   c.socket.on('message',data=>{
    const msg=JSON.parse(String(data));
    messages.push(msg);
    if(msg.ok===true&&msg.result){clearTimeout(timer);resolve(msg);}
    if(msg.ok===false){clearTimeout(timer);reject(Error(msg.error));}
   });
  });
  c.send({id:42,address:'/generant/v1/render/song',args:['wav','pulse','vertical','T','A',1,2,'/tmp']});
  const final=await collect;
  assert.ok(messages.some(m=>m.event==='progress'&&m.id===42));
  assert.equal(final.ok,true);
  assert.equal(final.result.files.wav,'/tmp/x.wav');
  c.socket.close(); await remote.close();
});
