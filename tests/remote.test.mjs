import test from 'node:test';
import assert from 'node:assert/strict';
import dgram from 'node:dgram';
import {encodeMessage,encodeBundle} from '../app/osc.mjs';
import {decodeOsc,GenerantRemote} from '../app/remote.mjs';
import {remoteCommand} from '../shared/remote.mjs';

test('decodes Renoise-style OSC messages and timestamped bundles',()=>{
 const message=decodeOsc(encodeMessage('/generant/v1/transport/tempo',[144]))[0];
 assert.deepEqual(message,{at:null,address:'/generant/v1/transport/tempo',args:[144]});
 const bundle=decodeOsc(encodeBundle(2208988810.25,[['/generant/v1/song/position/queue',3]]))[0];
 assert.equal(bundle.at,10.25);assert.equal(bundle.address,'/generant/v1/song/position/queue');assert.deepEqual(bundle.args,[3]);
});

test('validates remote commands',()=>{
 assert.deepEqual(remoteCommand('/generant/v1/transport/play',[]),{type:'play'});
 assert.deepEqual(remoteCommand('/generant/v1/device/param',['keys','cutoff',1200]),{type:'deviceParam',device:'keys',param:'cutoff',value:1200});
 assert.equal(remoteCommand('/visual/kick',[1]),null);
 assert.throws(()=>remoteCommand('/generant/v1/transport/tempo',[0]));
 assert.throws(()=>remoteCommand('/generant/v1/song/position/queue',[1.5]));
});

test('receives commands over localhost UDP',async t=>{
 let resolveCommand,socketError;const received=new Promise(resolve=>resolveCommand=resolve),remote=new GenerantRemote(0,resolveCommand,error=>socketError=error);
 try{await remote.open();}catch(error){if(error.code==='EPERM'){t.skip('localhost sockets are disabled in this sandbox');return;}throw error;}
 const sender=dgram.createSocket('udp4'),packet=encodeMessage('/generant/v1/pattern/queue',['Pattern 03']);
 await new Promise((resolve,reject)=>sender.send(packet,remote.socket.address().port,'127.0.0.1',error=>error?reject(error):resolve()));
 assert.ifError(socketError);assert.deepEqual(await received,{type:'queuePattern',pattern:'Pattern 03',at:null});sender.close();remote.close();
});
