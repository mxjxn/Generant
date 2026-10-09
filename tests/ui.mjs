import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/home/mxjxn/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/home/mxjxn/.cache/puppeteer/chrome-headless-shell/linux-148.0.7778.97/chrome-headless-shell-linux64/chrome-headless-shell',args:['--no-sandbox','--mute-audio']});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE ERROR',e.message)});page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text())});page.on('requestfailed',r=>console.log('REQUEST FAILED',r.url(),r.failure()?.errorText));
await fs.mkdir('tests/artifacts',{recursive:true});
try{
 await page.goto('http://127.0.0.1:4315/');await page.waitForFunction(()=>!!window.rack);await page.screenshot({path:'tests/artifacts/front.png',fullPage:true});
 assert.equal(await page.evaluate(()=>rack.engine.playing),false);assert.equal(await page.evaluate(()=>rack.engine.ready),false);
 await page.locator('#editorMode').selectOption('piano');
 // Add a note using the piano roll's real pointer interaction.
 const before=await page.evaluate(()=>rack.store.project.notes.length);
 const point=await page.evaluate(()=>({x:64+2.25*rack.roll.scale,y:25+(rack.roll.high-68)*rack.roll.row+6}));await page.locator('#roll').dblclick({position:point});
 assert.equal(await page.evaluate(()=>rack.store.project.notes.length),before+1);
 await page.locator('#rollScroll').press('ArrowUp');assert.equal(await page.evaluate(()=>rack.store.project.notes.at(-1).pitch),69);
 await page.locator('#undo').click();assert.equal(await page.evaluate(()=>rack.store.project.notes.at(-1).pitch),68);
 // One vertical knob gesture is one undo entry and supports exact numeric entry.
 await page.locator('#showTrackDevice').click();const knob=page.getByRole('slider',{name:'FM amount',exact:true});await knob.evaluate(el=>el.scrollIntoView({block:"center"}));const box=await knob.boundingBox();
 const knobBefore=await page.evaluate(()=>rack.store.project.params.keys.metal);
 const historyBefore=await page.evaluate(()=>rack.store.undoStack.length);
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2,box.y+box.height/2-35,{steps:8});await page.mouse.up();
 assert.ok(await page.evaluate(()=>rack.store.project.params.keys.metal)>knobBefore);
 assert.equal(await page.evaluate(()=>rack.store.undoStack.length),historyBefore+1);await page.locator('#undo').click();
 await page.locator('#back').click();await page.locator('[data-socket="out|motion.cv"]').click();await page.locator('[data-socket="in|drums.tone"]').click();
 assert.equal(await page.evaluate(()=>rack.store.project.connections.length),4);await page.screenshot({path:'tests/artifacts/rear.png',fullPage:true});
 await page.locator('aside .utility-menu').last().locator('summary').click();await page.locator('#enable').click();await page.waitForFunction(()=>rack.engine.ready,{},{timeout:30000});await page.waitForFunction(()=>document.querySelector('#enable').textContent==='Audio ready',{},{timeout:30000});
 assert.equal(await page.evaluate(()=>rack.engine.playing),false);
 await page.locator('#play').click();await page.waitForFunction(()=>rack.engine.playing);await page.waitForTimeout(1200);
 const audio=await page.evaluate(()=>({errors:rack.engine.errors,peak:rack.engine.peak,tree:rack.engine.sonic.getTree(),beat:rack.engine.beat}));console.log('AUDIO',JSON.stringify(audio));assert.ok(audio.peak>0.0001&&audio.peak<=.98);assert.deepEqual(audio.errors,[]);assert.ok(audio.beat>0);
 await page.locator('#stop').click();await page.waitForFunction(()=>!rack.engine.playing&&!rack.engine.stopping);await page.waitForTimeout(350);assert.ok(await page.evaluate(()=>rack.engine.peak<.00001));
 // Real sample import, undo buffer replacement, and saved-file roundtrip.
 const wav=await page.evaluate(async()=>{const {monoWav}=await import('/audio.mjs');return Array.from(new Uint8Array(monoWav(Float32Array.from({length:2205},(_,i)=>Math.sin(i*.09)*.2))));});
 await page.locator('#sampleFile').setInputFiles({name:'test-kick.wav',mimeType:'audio/wav',buffer:Buffer.from(wav)});
 await page.waitForFunction(()=>rack.store.project.samples[0]?.name==='test-kick.wav');
 assert.ok(await page.evaluate(()=>rack.engine.sampleKeys[0]?.startsWith('data:audio/')));
 await page.locator('#undo').click();await page.waitForFunction(()=>rack.engine.sampleKeys[0]===null&&!document.querySelector('#play').disabled);
 assert.equal(await page.evaluate(()=>rack.store.project.samples[0]),null);
 const dlPromise=page.waitForEvent('download');await page.locator('#fileMenu > summary').click();await page.locator('#save').click();const dl=await dlPromise;await dl.saveAs('tests/artifacts/roundtrip.rack.json');
 const saved=JSON.parse(await fs.readFile('tests/artifacts/roundtrip.rack.json','utf8'));
 await page.evaluate(()=>rack.store.edit(p=>p.name='changed'));await page.locator('#projectFile').setInputFiles('tests/artifacts/roundtrip.rack.json');await page.waitForFunction(name=>rack.store.project.name===name,saved.name);
 const cvA=await page.evaluate(()=>rack.engine.cv);await page.waitForTimeout(220);const cvB=await page.evaluate(()=>rack.engine.cv);assert.ok(Number.isFinite(cvA)&&cvA>=0&&cvA<=1&&cvA!==cvB);
 await page.locator('#front').click();await page.screenshot({path:'tests/artifacts/ready.png',fullPage:true});assert.deepEqual(errors,[]);console.log('PASS real UI note editing, transpose, undo, CV cabling, silent boot, audible loop, and Stop silence.');
}catch(e){await page.screenshot({path:'tests/artifacts/failure.png',fullPage:true});console.log('STATUS',await page.locator('#message').textContent());throw e;}finally{await browser.close();}
