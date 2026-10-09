import assert from 'node:assert/strict';
import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
const {_electron}=await import('/home/mxjxn/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const profile=await fs.mkdtemp(path.join(os.tmpdir(),'rack-settings-test-'));
const launch=()=>_electron.launch({executablePath:process.cwd()+'/dist-settings/linux-unpacked/rack-studio',args:['--no-sandbox','--mute-audio'],env:{...process.env,RACK_PROFILE:profile},timeout:30000});
let app=await launch();
try{
 let page=await app.firstWindow();await page.waitForFunction(()=>window.rack?.hardware);await page.locator('#hardwareButton').click();
 await page.locator('[data-midi]').click();await page.waitForFunction(()=>rack.hardware.preferences.midiEnabled);
 assert.equal(await page.evaluate(()=>rack.hardware.access.sysexEnabled),false);
 const devices=await page.evaluate(async()=>{const stream=await navigator.mediaDevices.getUserMedia({audio:true});stream.getTracks().forEach(t=>t.stop());return(await navigator.mediaDevices.enumerateDevices()).map(d=>({kind:d.kind,label:d.label}));});
 await page.locator('[data-refresh]').click();await page.locator('[data-rate]').selectOption('44100');
 await page.waitForFunction(()=>rack.hardware.preferences.sampleRate===44100);await page.waitForTimeout(200);
 const disk=JSON.parse(await fs.readFile(path.join(profile,'hardware.json'),'utf8'));assert.equal(disk.sampleRate,44100);assert.equal(disk.midiEnabled,true);
 await page.locator('[data-enable]').click();await page.waitForFunction(()=>rack.engine.ready);assert.equal(await page.evaluate(()=>rack.engine.sonic.audioContext.sampleRate),44100);
 await app.close();app=await launch();page=await app.firstWindow();await page.waitForFunction(()=>window.rack?.hardware);
 assert.equal(await page.evaluate(()=>rack.hardware.preferences.sampleRate),44100);assert.equal(await page.evaluate(()=>rack.hardware.preferences.midiEnabled),true);assert.equal(await page.evaluate(()=>rack.engine.ready),false);
 console.log('PASS packaged Electron permissions, native hardware discovery, disk preferences across random-origin launches, no automatic audio start. Devices:',devices);
}finally{await app.evaluate(({app})=>app.exit()).catch(()=>{});}
