const {app,BrowserWindow,dialog,ipcMain,Menu}=require('electron');
const fs=require('node:fs/promises');const fsSync=require('node:fs');const path=require('node:path');
if(process.env.RACK_PROFILE)app.setPath('userData',process.env.RACK_PROFILE);
else {
 const currentProfile=app.getPath('userData');
 const legacyProfile=path.join(path.dirname(currentProfile),'Rack Studio');
 if(currentProfile!==legacyProfile&&fsSync.existsSync(legacyProfile)&&!fsSync.existsSync(currentProfile))app.setPath('userData',legacyProfile);
}
let server,win,osc,projectPath=null,snapshot=null,dirty=false,closing=false,allowClose=false,recoveryTimer,recoveryQueue=Promise.resolve();
const locked=app.requestSingleInstanceLock();
if(!locked)app.quit();
else {
 app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.show();win.focus();}});
 app.whenReady().then(async()=>{
  const recoveryPath=path.join(app.getPath('userData'),'recovery.rack.json');
  const writeAtomic=async(file,text)=>{await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file+'.tmp',text);await fs.rename(file+'.tmp',file);};
  const {cleanSettings}=await import('../shared/settings.mjs');
  const hardwarePath=path.join(app.getPath('userData'),'hardware.json');let hardwareQueue=Promise.resolve();
  ipcMain.handle('hardware-load',async()=>{try{return cleanSettings(JSON.parse(await fs.readFile(hardwarePath,'utf8')));}catch(e){if(e.code==='ENOENT')return cleanSettings();throw e;}});
  ipcMain.handle('hardware-save',(_e,value)=>{const text=JSON.stringify(cleanSettings(value));hardwareQueue=hardwareQueue.catch(()=>{}).then(()=>writeAtomic(hardwarePath,text));return hardwareQueue;});
  const defaultPath=path.join(app.getPath('userData'),'default.rack.json');
  ipcMain.handle('default-load',async()=>{try{return await fs.readFile(defaultPath,'utf8');}catch(e){if(e.code==='ENOENT')return null;throw e;}});
  ipcMain.handle('default-save',async(_e,text)=>{if(typeof text!=='string'||text.length>110000000)throw Error('Invalid project size');const {upgrade}=await import('../shared/model.mjs');await writeAtomic(defaultPath,JSON.stringify(upgrade(JSON.parse(text))));});
  ipcMain.handle('default-clear',()=>fs.rm(defaultPath,{force:true}));
  const queueRecovery=()=>{const text=snapshot;recoveryQueue=recoveryQueue.catch(()=>{}).then(async()=>{if(text)await writeAtomic(recoveryPath,text);});recoveryQueue.catch(e=>win?.webContents.send('project-error',e.message));};
  const save=async(text=snapshot,saveAs=false)=>{
   if(typeof text!=='string'||text.length>110000000)throw Error('Invalid project size.');
   let destination=projectPath;
   if(!destination||saveAs){const choice=await dialog.showSaveDialog(win,{defaultPath:destination||'My patch.rack.json',filters:[{name:'Rack project',extensions:['json']}]});if(choice.canceled)return false;destination=choice.filePath;}
   await writeAtomic(destination,text);projectPath=destination;dirty=snapshot!==JSON.stringify(JSON.parse(text));
   win.webContents.send('project-saved',{text,path:projectPath});return{path:projectPath};
  };
  osc=new(await import('./osc.mjs')).BlenderOutput(Number(process.env.RACK_OSC_PORT)||57141);
  ipcMain.handle('osc-enable',(_e,value)=>osc.enable(value));ipcMain.handle('osc-reset',()=>osc.reset());ipcMain.on('osc-send',(_e,batch)=>{try{osc.send(batch);}catch(e){console.error(e.message);}});
  server=await(await import('./server.mjs')).serve();
  win=new BrowserWindow({width:1450,height:960,minWidth:850,minHeight:650,backgroundColor:'#151819',title:'Generant',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  const origin=`http://127.0.0.1:${server.address().port}`;
  const allowed=(contents,permission,url,details={})=>contents===win.webContents&&url?.startsWith(origin+'/')&&(['midi','midiSysex','speaker-selection'].includes(permission)||permission==='media'&&(details.mediaTypes??[details.mediaType]).every(t=>t==='audio'));
  win.webContents.session.setPermissionCheckHandler((contents,permission,url,details)=>allowed(contents,permission,url.endsWith('/')?url:url+'/',details));
  win.webContents.session.setPermissionRequestHandler((contents,permission,callback,details)=>callback(allowed(contents,permission,details.requestingUrl,details)));
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',(e,url)=>{if(!url.startsWith(`http://127.0.0.1:${server.address().port}/`))e.preventDefault();});
  ipcMain.on('project-state',(_e,state)=>{if(typeof state?.text!=='string'||state.text.length>110000000)return;snapshot=state.text;dirty=!!state.dirty;clearTimeout(recoveryTimer);recoveryTimer=setTimeout(queueRecovery,1500);});
  ipcMain.handle('export-osc-score',async(_e,text)=>{if(typeof text!=='string'||text.length>100000000)throw Error('OSC score too large.');const score=JSON.parse(text);if(score.format!=='rack-osc-score'||score.version!==1||!Array.isArray(score.events))throw Error('Invalid OSC score');const choice=await dialog.showSaveDialog(win,{defaultPath:'visuals.osc-score.json',filters:[{name:'OSC score',extensions:['json']}]});if(choice.canceled)return null;await writeAtomic(choice.filePath,text);return choice.filePath;});
  ipcMain.handle('export-blender-bridge',async()=>{const choice=await dialog.showSaveDialog(win,{defaultPath:'rack-osc-bridge.zip',filters:[{name:'Blender add-on',extensions:['zip']}]});if(choice.canceled)return null;await fs.copyFile(path.join(__dirname,'../integrations/rack-osc-bridge.zip'),choice.filePath);return choice.filePath;});
  ipcMain.handle('save-project',(_e,text,saveAs)=>save(text,saveAs));
  ipcMain.handle('load-project',async()=>{const choice=await dialog.showOpenDialog(win,{properties:['openFile'],filters:[{name:'Rack project',extensions:['json']}]});if(choice.canceled)return null;const file=choice.filePaths[0];if((await fs.stat(file)).size>110000000)throw Error('Project too large');return{text:await fs.readFile(file,'utf8'),path:file};});
  ipcMain.on('project-opened',(_e,file)=>{projectPath=file;});
  ipcMain.handle('recover-project',async()=>{let text;try{text=await fs.readFile(recoveryPath,'utf8');}catch{return null;}const {response}=await dialog.showMessageBox(win,{type:'question',message:'Restore the previous studio session?',detail:'A recovery snapshot is available. It does not replace your saved project.',buttons:['Restore','Start fresh'],defaultId:0,cancelId:1});return response===0?text:null;});
  win.on('close',e=>{
   if(allowClose)return;e.preventDefault();if(closing)return;closing=true;
   (async()=>{try{if(dirty){const {response}=await dialog.showMessageBox(win,{type:'question',message:'Save changes before closing?',detail:'Your saved project will only change if you choose Save.',buttons:['Save','Discard','Cancel'],defaultId:0,cancelId:2,noLink:true});if(response===2)return;if(response===0&&!await save())return;}
    clearTimeout(recoveryTimer);await recoveryQueue.catch(()=>{});await fs.rm(recoveryPath,{force:true});osc?.close();allowClose=true;win.close();
   }catch(error){await dialog.showMessageBox(win,{type:'error',message:'The project could not be closed safely.',detail:error.message});}finally{closing=false;}})();
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'Generant',submenu:[{role:'about'},{type:'separator'},{role:'quit'}]},{label:'Edit',submenu:[{label:'Undo',accelerator:'CmdOrCtrl+Z',click:()=>win.webContents.send('project-command','undo')},{label:'Redo',accelerator:'CmdOrCtrl+Shift+Z',click:()=>win.webContents.send('project-command','redo')},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]},{label:'View',submenu:[{role:'toggleDevTools'},{role:'togglefullscreen'}]}]));
  await win.loadURL(`http://127.0.0.1:${server.address().port}`);
 });
 app.on('window-all-closed',()=>{clearTimeout(recoveryTimer);osc?.close();server?.close();app.quit();});
}
