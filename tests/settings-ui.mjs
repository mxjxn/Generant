import assert from 'node:assert/strict';
const {chromium}=await import('/home/mxjxn/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser=await chromium.launch({headless:true,executablePath:'/home/mxjxn/.cache/puppeteer/chrome-headless-shell/linux-148.0.7778.97/chrome-headless-shell-linux64/chrome-headless-shell',args:['--no-sandbox','--mute-audio']});
try{
 const page=await browser.newPage({viewport:{width:1450,height:960}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const input={id:'test-port',name:'Test controller',manufacturer:'Test',state:'connected',open:async()=>{},close:async()=>{}};window.testInput=input;Object.defineProperty(navigator,'requestMIDIAccess',{value:async()=>({inputs:new Map([[input.id,input]])})});});
 await page.goto('http://127.0.0.1:4315');await page.waitForFunction(()=>window.rack?.hardware);await page.evaluate(async()=>{const {demoProject}=await import('/shared/model.mjs');await rack.loadProject(demoProject(),{saved:true});});const original=await page.evaluate(()=>JSON.stringify(rack.store.project));
 await page.locator('#hardwareButton').click();await page.locator('[data-midi]').click();await page.locator('[data-port]').check();
 await page.locator('[data-enable]').click();await page.waitForFunction(()=>rack.engine.ready);
 await page.evaluate(()=>testInput.onmidimessage({data:[0x90,60,100]}));await page.waitForFunction(()=>rack.engine.peak>0.001);assert.equal(await page.evaluate(()=>rack.hardware.midi.notes.size),1);
 await page.evaluate(()=>{testInput.onmidimessage({data:[0xB0,64,127]});testInput.onmidimessage({data:[0x80,60,0]});});assert.equal(await page.evaluate(()=>rack.hardware.midi.notes.size),1);
 await page.locator('select[data-channel]').selectOption('2');assert.equal(await page.evaluate(()=>rack.hardware.midi.notes.size),0);
 await page.evaluate(()=>testInput.onmidimessage({data:[0x90,60,100]}));assert.equal(await page.evaluate(()=>rack.hardware.midi.notes.size),0);
 await page.locator('select[data-channel]').selectOption('0');await page.locator('[data-rate]').selectOption('44100');await page.locator('[data-restart]').click();await page.waitForFunction(()=>rack.engine.ready&&rack.engine.sonic.audioContext.sampleRate===44100);
 await page.evaluate(()=>testInput.onmidimessage({data:[0x90,60,127]}));await page.waitForFunction(()=>rack.engine.peak>.001);await page.locator('[data-panic]').click();await page.waitForFunction(()=>rack.hardware.midi.notes.size===0&&!rack.engine.stopping);
 assert.equal(await page.evaluate(()=>JSON.stringify(rack.store.project)),original);assert.equal(await page.evaluate(()=>rack.engine.sampleKeys.length),4);
 await page.screenshot({path:'tests/artifacts/settings.png'});
 await page.locator('[aria-label="Close audio and MIDI settings"]').click();
 const before=await page.evaluate(()=>rack.store.project.notes.length);
 await page.locator('[data-live-record]').click();await page.locator('#play').click();await page.waitForFunction(()=>rack.engine.playing);
 await page.evaluate(()=>testInput.onmidimessage({data:[0x90,75,101]}));await page.waitForTimeout(180);await page.evaluate(()=>testInput.onmidimessage({data:[0x80,75,0]}));
 assert.ok(await page.evaluate(n=>rack.store.project.notes.length>n,before));assert.ok(await page.evaluate(()=>rack.store.project.notes.some(n=>n.pitch===75&&Math.abs(n.velocity-101/127)<.0001)));
 await page.locator('#stop').click();await page.waitForFunction(()=>!rack.engine.stopping);
 await page.evaluate(()=>{rack.presets.store('keys',3,'MIDI test');rack.store.edit(p=>p.params.keys.metal=.99);testInput.onmidimessage({data:[0xC0,3]});});assert.equal(await page.evaluate(()=>rack.store.project.params.keys.metal),.32);
 // A failed output switch must not replace the saved route.
 await page.locator('#hardwareButton').click();
 await page.evaluate(()=>{navigator.mediaDevices.enumerateDevices=async()=>[{kind:'audiooutput',deviceId:'bad',label:'Unavailable output'}];rack.engine.sonic.audioContext.setSinkId=async()=>{throw Error('Output refused');};});
 await page.locator('[data-refresh]').click();await page.locator('#hardwareSettings [data-output]').selectOption('bad');await page.waitForFunction(()=>rack.hardware.status==='Output refused');assert.equal(await page.evaluate(()=>rack.hardware.preferences.output),'');
 page.on('dialog',d=>d.accept());
 await page.reload();await page.waitForFunction(()=>window.rack?.hardware);assert.equal(await page.evaluate(()=>rack.hardware.preferences.sampleRate),44100);assert.equal(await page.evaluate(()=>rack.hardware.preferences.inputs[0].id),'test-port');assert.equal(await page.evaluate(()=>rack.engine.ready),false);
 assert.deepEqual(errors,[]);console.log('PASS settings, real-engine MIDI sound, sustain, channel filtering, panic, 44.1k audio restart, sample reload, project isolation and preference persistence');
}finally{await browser.close();}
