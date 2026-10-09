import fs from 'node:fs/promises';
import {ambientProject} from '../shared/model.mjs';
const {_electron}=await import('/home/mxjxn/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const project=ambientProject();project.name='Slow glass / asteroid pulse';project.params.drums.level=.65;project.params.drums.tone=.7;project.drums=Array.from({length:4},(_,pad)=>Array.from({length:project.bars*16},(_,i)=>pad===0?i%4===0:pad===1?i%16===12:pad===2?i%4===2:false));
await fs.writeFile('demo/asteroid-pulse.rack.json',JSON.stringify(project,null,2));
const app=await _electron.launch({executablePath:process.cwd()+'/dist/linux-unpacked/rack-studio',args:['--no-sandbox'],timeout:30000});
const page=await app.firstWindow();page.on('dialog',d=>d.accept().catch(()=>{}));await page.waitForFunction(()=>!!window.rack);await page.evaluate(p=>rack.store.load(p),project);await page.locator('#blender').click();await page.locator('#play').click();await page.waitForFunction(()=>rack.engine.playing);console.log('PERCUSSIVE_DEMO_PLAYING');await app.waitForEvent('close',{timeout:0});
