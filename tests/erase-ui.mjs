import assert from 'node:assert/strict';
const {chromium}=await import('/home/mxjxn/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser=await chromium.launch({headless:true,executablePath:'/home/mxjxn/.cache/puppeteer/chrome-headless-shell/linux-148.0.7778.97/chrome-headless-shell-linux64/chrome-headless-shell',args:['--no-sandbox','--mute-audio']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4315');await page.waitForFunction(()=>window.rack);
 await page.evaluate(async()=>{const {editFx}=await import('/shared/tracker.mjs');rack.store.edit(p=>{p.notes=[{id:'a',pitch:60,beat:0,duration:1,velocity:.5,column:0},{id:'b',pitch:64,beat:2,duration:1,velocity:.8,column:0}];editFx(p,'keys',0,0,'01 10');editFx(p,'keys',2,0,'01 20');});});
 const cell=(b,k='note')=>page.locator('[data-cell="'+b+':'+k+':0"]');
 await cell(0).focus();await page.keyboard.press('Delete');assert.equal(await cell(0).inputValue(),'');assert.equal(await cell(1).inputValue(),'');assert.equal(await page.evaluate(()=>document.activeElement.dataset.cell),'0:note:0');assert.equal(await page.evaluate(()=>rack.store.project.notes[0].beat),2);
 await page.keyboard.press('Control+z');await cell(1).focus();await page.keyboard.press('Delete');assert.equal(await page.evaluate(()=>rack.store.project.notes[0].duration),2);await cell(3).focus();await page.keyboard.press('Delete');assert.equal(await page.evaluate(()=>rack.store.project.notes[1].duration),6);
 await page.locator('[data-edit-step]').selectOption('2');await cell(0,'fx').focus();await page.keyboard.press('Backspace');assert.equal(await page.evaluate(()=>document.activeElement.dataset.cell),'0.5:fx:0');assert.deepEqual(await page.evaluate(()=>rack.store.project.studio.sequences.keys.fx.map(f=>f.beat)),[2]);
 await page.keyboard.press('Backspace');assert.equal(await page.evaluate(()=>document.activeElement.dataset.cell),'1:fx:0');await page.keyboard.press('i');await cell(2).focus();await page.keyboard.press('Backspace');assert.equal(await page.evaluate(()=>document.activeElement.dataset.cell),'2.5:note:0');
 await cell(0).focus();await page.keyboard.press('F2');await cell(0).fill('C#4');await cell(0).evaluate(el=>el.setSelectionRange(1,1));await page.keyboard.press('Delete');assert.equal(await cell(0).inputValue(),'C4');await page.keyboard.press('Backspace');assert.equal(await cell(0).inputValue(),'4');assert.equal(await page.evaluate(()=>rack.store.project.notes[0].pitch),60);await page.keyboard.press('Escape');
 await page.locator('[data-edit-step]').selectOption('0');await cell(0).focus();await page.keyboard.press('Backspace');assert.equal(await page.evaluate(()=>document.activeElement.dataset.cell),'0:note:0');assert.deepEqual(errors,[]);
 console.log('PASS Delete/Backspace in both modes, fixed timing, OFF extension, empty-cell advance, step zero, undo and F2 character editing.');
}finally{await browser.close();}
