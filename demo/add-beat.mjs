import fs from 'node:fs/promises';
const {chromium}=await import('/home/mxjxn/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const port=(await fs.readFile('/home/mxjxn/.config/Rack Studio/DevToolsActivePort','utf8')).split('\n')[0];
const browser=await chromium.connectOverCDP('http://127.0.0.1:'+port);
const pages=browser.contexts().flatMap(c=>c.pages());let page;
for(const p of pages)if(await p.evaluate(()=>!!window.rack&&rack.engine.playing).catch(()=>false)){page=p;break;}
if(!page)throw Error('Playing rack not found');
const project=await page.evaluate(()=>{rack.store.edit(p=>{p.name='Slow glass / asteroid pulse';p.params.drums.level=.65;p.params.drums.tone=.7;p.drums=Array.from({length:4},(_,pad)=>Array.from({length:p.bars*16},(_,i)=>pad===0?i%4===0:pad===1?i%16===12:pad===2?i%4===2:false));});return rack.store.project;});
await fs.writeFile('demo/asteroid-pulse.rack.json',JSON.stringify(project,null,2));console.log('Live pattern updated: quarter-note kicks, sparse snare, offbeat hats at '+project.bpm+' BPM.');process.exit(0);
