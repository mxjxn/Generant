import {programPreset,recallPreset} from '/shared/presets.mjs';
import {cleanSettings} from '/shared/settings.mjs';
import {MidiInput} from '/shared/midi.mjs';
import {recordNote} from '/shared/keyboard.mjs';
import {sequence} from '/shared/tracker.mjs';
import {escape} from './studio-shell.mjs';

export async function hardwareSettings({engine,store,grid,getDevice,getTrack,report,audioAction}){
 let prefs=cleanSettings(),access=null,target='',ports=[],busy=false,last='',saveQueue=Promise.resolve(),outputQueue=Promise.resolve();
 try{prefs=cleanSettings(window.desktop?.settings?await window.desktop.settings.load():JSON.parse(localStorage.getItem('rack-hardware')||'{}'));}catch(e){report('Could not load hardware preferences: '+e.message,true);}
 const dialog=document.createElement('dialog');dialog.id='hardwareSettings';dialog.innerHTML=`<form method="dialog" class="settings-heading"><strong>Audio / MIDI</strong><button aria-label="Close audio and MIDI settings">Close</button></form>
 <section><h3>Audio</h3><div class="settings-row"><button data-enable>Enable audio</button><button data-test>Test L → R</button><button data-panic>Stop / Panic</button></div>
 <label>Output <select data-output><option value="">System default</option></select></label><div class="settings-row"><button data-refresh>Refresh devices</button><button data-access>Allow device discovery…</button></div>
 <p class="muted">Device discovery briefly requests microphone access to reveal device names, then closes it. Audio recording is not connected.</p>
 <div class="settings-row"><label>Sample rate <select data-rate><option value="44100">44.1 kHz</option><option value="48000">48 kHz</option><option value="96000">96 kHz</option></select></label><label>Latency preference <select data-latency><option value="interactive">Interactive</option><option value="balanced">Balanced</option><option value="playback">Playback</option></select></label><button data-restart>Apply / restart audio</button></div>
 <p class="muted">Rate and latency changes apply on audio restart; playback stops. Actual latency depends on the OS and device. Stereo output; buffer size is OS-managed.</p><output data-audio></output></section>
 <section><h3>MIDI inputs</h3><div class="settings-row"><button data-midi>Enable MIDI</button><button data-midi-refresh>Refresh ports</button></div><div data-ports></div>
 <div class="settings-row"><label>Channel <select data-channel><option value="0">Any</option>${Array.from({length:16},(_,i)=>`<option>${i+1}</option>`).join('')}</select></label><label>Route to <select data-target></select></label></div>
 <p class="muted">Notes, velocity and sustain control the routed synth. Program Change recalls its stored program slot (MIDI 0–127 = PR 00–7F); no SysEx or Bank Select is required. Arm Live Record in the tracker to record that instrument while transport runs. Fixed instrument routing lasts for this session. Other CCs and pitch bend appear in the monitor; mapping, MIDI output and external clock are not connected yet.</p><output data-monitor>No MIDI messages</output><output data-midi-state></output></section>
 <p role="status" data-status></p>`;document.body.append(dialog);
 const $=s=>dialog.querySelector(s),status=(text,error=false)=>{last=text;$('[data-status]').textContent=text;$('[data-status]').classList.toggle('error',error);if(error)report(text,true);};
 const save=()=>{const value=structuredClone(prefs);saveQueue=saveQueue.catch(()=>{}).then(()=>window.desktop?.settings?window.desktop.settings.save(value):localStorage.setItem('rack-hardware',JSON.stringify(value))).catch(e=>status('Preferences could not be saved: '+e.message,true));return saveQueue;};
 const options=()=>{engine.audioOptions={sampleRate:prefs.sampleRate,latencyHint:prefs.latency};};options();
 const midi=new MidiInput({
  programChange:(target,slot)=>{try{const preset=programPreset(store.project,target.id,slot);if(!preset)throw Error(`Program ${slot.toString(16).toUpperCase().padStart(2,'0')} is empty.`);store.edit(p=>recallPreset(p,target.id,preset.id));status(`Preset: ${preset.name}`);}catch(e){status(e.message);}},
  route:(port,channel,kind)=>{if(!prefs.midiEnabled||!isEnabled(port)||prefs.channel&&prefs.channel!==channel)return null;const id=target||getDevice(),d=store.project.studio.devices.find(d=>d.id===id);if(!['keys','kit'].includes(d?.type)||(kind==='program'&&d.type==='kit'))return null;if(kind!=='program'&&(!engine.ready||engine.sonic.audioContext.state!=='running')){status('Enable audio to hear MIDI.');return null;}const k=grid.keyboard.state,record=k.record&&engine.playing&&engine.playbackOptions?.mode!=='song'&&id===getTrack();return{id,record,start:engine.absoluteBeat,grid:k.quant==='grid'?1/sequence(store.project,id).lpb:+k.quant};},
  noteOn:(n,p,v)=>engine.keyboardNoteOn(n.id,p,v),noteOff:id=>engine.keyboardNoteOff(id),
  record:n=>{if(!n.record||!store.project.studio.devices.some(d=>d.id===n.id))return;try{store.edit(p=>recordNote(p,n.id,{...n,end:engine.absoluteBeat}));}catch(e){status(e.message,true);}},
  status:m=>{$('[data-monitor]').textContent=`Ch ${m.channel} · ${({128:'Note off',144:m.b?'Note on':'Note off',176:'CC',192:'Program change',224:'Pitch bend'})[m.type]||'MIDI'} · ${m.a??''} ${m.b??''}`;}
 });
 const beforeStop=engine.beforeStop;engine.beforeStop=()=>{midi.panic();stopTone();beforeStop?.();};
 function isEnabled(id){return prefs.inputs.some(p=>p.id===id);}
 function renderPorts(){ports=[...(access?.inputs.values()??[])];
  // Chromium device IDs can change with the desktop server origin. Only recover an unambiguous name.
  for(const p of prefs.inputs)if(!ports.some(x=>x.id===p.id)){const matches=ports.filter(x=>x.name===p.name);if(matches.length===1)p.id=matches[0].id;}
  $('[data-ports]').innerHTML=ports.length?ports.map(p=>`<label class="midi-port"><input type="checkbox" data-port="${escape(p.id)}" ${isEnabled(p.id)?'checked':''} ${p.state==='disconnected'?'disabled':''}>${escape(p.name||'Unnamed MIDI input')} <small>${escape(p.manufacturer||'')} · ${escape(p.state)}</small></label>`).join(''):'<p class="muted">'+(access?'No MIDI input ports found. Connect a controller or create an OS virtual MIDI port, then refresh.':'MIDI is disabled.')+'</p>';
  for(const n of midi.notes.values())if(!ports.some(p=>p.id===n.port&&p.state==='connected'))midi.panic(n.port);
  for(const p of ports){p.onmidimessage=prefs.midiEnabled&&isEnabled(p.id)?e=>midi.receive(p.id,e.data):null;if(p.state==='disconnected')midi.panic(p.id);}
  $('[data-ports]').querySelectorAll('[data-port]').forEach(el=>el.onchange=async()=>{const p=ports.find(p=>p.id===el.dataset.port);midi.panic(p.id);prefs.inputs=prefs.inputs.filter(x=>x.id!==p.id);if(el.checked){try{await p.open();prefs.inputs.push({id:p.id,name:p.name||''});}catch(e){status('MIDI port: '+e.message,true);}}else await p.close().catch(()=>{});save();renderPorts();});
  $('[data-midi]').textContent=prefs.midiEnabled?'Disable MIDI':'Enable MIDI';$('[data-midi-state]').textContent=access?`${ports.filter(p=>isEnabled(p.id)&&p.state==='connected').length} enabled inputs`:'No MIDI access';
 }
 async function enableMidi(){if(!navigator.requestMIDIAccess)throw Error('Web MIDI is unavailable in this runtime.');access??=await navigator.requestMIDIAccess({sysex:false});prefs.midiEnabled=true;access.onstatechange=()=>{renderPorts();save();};renderPorts();save();}
 async function refreshOutputs(){const devices=await navigator.mediaDevices?.enumerateDevices()??[],outputs=devices.filter(d=>d.kind==='audiooutput'&&d.deviceId&&d.deviceId!=='default');let desired=prefs.output;
  if(desired&&!outputs.some(d=>d.deviceId===desired)){const matches=outputs.filter(d=>d.label&&d.label===prefs.outputName);if(matches.length===1){desired=matches[0].deviceId;prefs.output=desired;save();}}
  $('[data-output]').innerHTML='<option value="">System default</option>'+outputs.map(d=>`<option value="${escape(d.deviceId)}">${escape(d.label||'Audio output')}</option>`).join('')+(desired&&!outputs.some(d=>d.deviceId===desired)?`<option value="${escape(desired)}">Unavailable: ${escape(prefs.outputName||'saved output')}</option>`:'');$('[data-output]').value=desired;
  $('[data-output]').disabled=!('setSinkId' in AudioContext.prototype);return outputs;
 }
 async function applyOutput(){const ctx=engine.sonic?.audioContext;if(!ctx)return;const outputs=await refreshOutputs();if(prefs.output&&!outputs.some(d=>d.deviceId===prefs.output)){await ctx.setSinkId?.('');status('Saved output unavailable. Using system default; saved preference retained.');return;}if(ctx.setSinkId)await ctx.setSinkId(prefs.output);else if(prefs.output)throw Error('Output selection is unavailable. Use OS audio routing.');}
 engine.configureAudio=applyOutput;
 const run=fn=>async()=>{if(busy)return;busy=true;try{await fn();}catch(e){status(e.message,true);}finally{busy=false;diagnostics();}};
 $('[data-enable]').onclick=run(()=>audioAction(async()=>{await engine.boot(store.project);await engine.sonic.audioContext.resume();status('Audio ready.');}));
 $('[data-refresh]').onclick=run(refreshOutputs);
 $('[data-access]').onclick=run(async()=>{const stream=await navigator.mediaDevices.getUserMedia({audio:true,video:false});stream.getTracks().forEach(t=>t.stop());await refreshOutputs();status('Audio devices refreshed. Microphone closed.');});
 $('[data-output]').onchange=run(async()=>{const old={output:prefs.output,outputName:prefs.outputName};prefs.output=$('[data-output]').value;prefs.outputName=prefs.output?$('[data-output]').selectedOptions[0].textContent:'';try{if(engine.ready)await applyOutput();await save();status('Output saved.');}catch(e){Object.assign(prefs,old);await refreshOutputs();throw e;}});
 $('[data-rate]').value=prefs.sampleRate;$('[data-latency]').value=prefs.latency;$('[data-channel]').value=prefs.channel;
 for(const [selector,key]of [['[data-rate]','sampleRate'],['[data-latency]','latency']])$(selector).onchange=()=>{prefs[key]=key==='sampleRate'?+$(selector).value:$(selector).value;options();save();status('Pending audio restart.');};
 $('[data-restart]').onclick=run(()=>audioAction(async()=>{midi.panic();stopTone();await engine.destroy();await engine.boot(store.project);status('Audio restarted. Transport stopped.');}));
 $('[data-channel]').onchange=()=>{midi.panic();prefs.channel=+$('[data-channel]').value;save();};
 $('[data-target]').onchange=()=>{midi.panic();target=$('[data-target]').value;};
 $('[data-midi]').onclick=run(async()=>{if(prefs.midiEnabled){midi.panic();prefs.midiEnabled=false;await Promise.all(ports.map(p=>p.close().catch(()=>{})));save();renderPorts();}else await enableMidi();});
 $('[data-midi-refresh]').onclick=run(async()=>{if(prefs.midiEnabled)await enableMidi();else status('Enable MIDI to discover ports.');});
 $('[data-panic]').onclick=run(()=>audioAction(()=>engine.stop()));
 let tones=[];function stopTone(){for(const node of tones){try{node.stop?.();node.disconnect();}catch{}}tones=[];}
 $('[data-test]').onclick=run(()=>audioAction(async()=>{await engine.boot(store.project);const ctx=engine.sonic.audioContext;await ctx.resume();stopTone();for(let i=0;i<2;i++){const osc=ctx.createOscillator(),gain=ctx.createGain(),pan=ctx.createStereoPanner(),t=ctx.currentTime+i*.4;osc.frequency.value=440;pan.pan.value=i?1:-1;gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(.04,t+.015);gain.gain.setValueAtTime(.04,t+.2);gain.gain.linearRampToValueAtTime(0,t+.25);osc.connect(gain).connect(pan).connect(engine.guard);engine.guard.port.postMessage({type:'mute',value:false});osc.start(t);osc.stop(t+.26);tones.push(osc,gain,pan);}status('440 Hz · −28 dBFS · left, then right (independent of mixer).');}));
 function diagnostics(){const c=engine.sonic?.audioContext,ms=v=>Number.isFinite(v)?(v*1000).toFixed(1)+' ms':'Not reported';$('[data-audio]').textContent=c?`${c.state} · ${c.sampleRate/1000} kHz · processing ${ms(c.baseLatency)} · output ${ms(c.outputLatency)}${engine.activeAudioOptions?.sampleRate!==prefs.sampleRate||engine.activeAudioOptions?.latencyHint!==prefs.latency?' · restart pending':''}`:'Audio off';$('[data-enable]').textContent=c?.state==='running'?'Audio running':'Enable / resume audio';}
 const timer=setInterval(()=>{if(dialog.open)diagnostics();},500);
 navigator.mediaDevices?.addEventListener('devicechange',()=>{outputQueue=outputQueue.catch(()=>{}).then(()=>engine.ready?applyOutput():refreshOutputs()).catch(e=>status('Audio device change: '+e.message,true));});
 dialog.addEventListener('close',stopTone);dialog.addEventListener('keydown',e=>e.stopPropagation());
 window.addEventListener('blur',()=>midi.panic());
 async function open(){grid.keyboard.finishAll();$('[data-target]').innerHTML='<option value="">Selected instrument</option>'+store.project.studio.devices.filter(d=>['keys','kit'].includes(d.type)).map(d=>`<option value="${escape(d.id)}">${escape(d.name)}</option>`).join('');if(target&&!store.project.studio.devices.some(d=>d.id===target)){midi.panic();target='';}$('[data-target]').value=target;if(!dialog.open)dialog.showModal();diagnostics();try{await refreshOutputs();renderPorts();}catch(e){status(e.message,true);}}
 if(prefs.midiEnabled)try{await enableMidi();}catch(e){prefs.midiEnabled=false;status('MIDI: '+e.message,true);}
 return{open,midi,dialog,get preferences(){return structuredClone(prefs);},get access(){return access;},get status(){return last;},dispose(){clearInterval(timer);midi.panic();stopTone();}};
}
