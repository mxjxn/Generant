import test from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import {WsRemote} from '../app/ws-remote.mjs';

const freePort = () => 57190 + Math.floor(Math.random() * 40);

async function connect(port){
  const socket = new WebSocket('ws://127.0.0.1:'+port);
  await new Promise((res,rej)=>{socket.once('open',res);socket.once('error',rej);});
  const next = () => new Promise((res,rej)=>{socket.once('message',d=>res(JSON.parse(String(d))));socket.once('error',rej);});
  const send = obj => socket.send(JSON.stringify(obj));
  return {socket,next,send};
}

test('WsRemote parses commands through the shared remoteCommand parser', async ()=>{
  const port = freePort(), got = [];
  const remote = new WsRemote(port, cmd=>got.push(cmd));
  await remote.open();
  const c = await connect(port);
  c.send({address:'/generant/v1/transport/tempo',args:[122]});
  assert.deepEqual(await c.next(), {ok:true});
  c.send({address:'/generant/v1/pattern/queue',args:['Pattern 00']});
  assert.deepEqual(await c.next(), {ok:true});
  await new Promise(r=>setTimeout(r,20));
  assert.deepEqual(got, [{type:'tempo',bpm:122,at:null},{type:'queuePattern',pattern:'Pattern 00',at:null}]);
  c.socket.close(); await remote.close();
});

test('WsRemote rejects unknown commands and bad payloads without dying', async ()=>{
  const port = freePort();
  const remote = new WsRemote(port, ()=>{});
  await remote.open();
  const c = await connect(port);
  c.send({address:'/generant/v1/nope'});
  assert.equal((await c.next()).ok, false);
  c.send({address:'/generant/v1/transport/tempo',args:[3000]});
  assert.match((await c.next()).error, /20–999/);
  c.socket.send('garbage-not-json');
  assert.match((await c.next()).error, /Invalid JSON/);
  c.send({address:'/generant/v1/transport/play'});
  assert.deepEqual(await c.next(), {ok:true}); // still alive
  c.socket.close(); await remote.close();
});

test('WsRemote state query returns the provider snapshot', async ()=>{
  const port = freePort();
  const state = {playing:false,bpm:122,devices:[{id:'keys',type:'keys',name:'Four FM'}],banks:{defs:[],lanes:[]}};
  const remote = new WsRemote(port, ()=>{}, ()=>{}, async ()=>state);
  await remote.open();
  const c = await connect(port);
  c.send({query:'state',id:7});
  assert.deepEqual(await c.next(), {id:7,ok:true,result:state});
  c.socket.close(); await remote.close();
});

test('WsRemote state provider failure surfaces as ok:false', async ()=>{
  const port = freePort();
  const remote = new WsRemote(port, ()=>{}, ()=>{}, async ()=>{throw Error('Renderer gone.');});
  await remote.open();
  const c = await connect(port);
  c.send({query:'state',id:3});
  assert.deepEqual(await c.next(), {id:3,ok:false,error:'Renderer gone.'});
  c.socket.close(); await remote.close();
});
