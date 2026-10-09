// Last stage after all engine output. The rack cannot bypass this node.
class OutputGuard extends AudioWorkletProcessor{
 constructor(){super();this.mute=1;this.gain=0;this.frames=0;this.peak=0;this.bad=0;this.port.onmessage=({data})=>{if(data.type==='mute')this.mute=data.value?1:0;};}
 process(inputs,outputs){const input=inputs[0],output=outputs[0];for(let i=0;i<output[0].length;i++){
  this.gain+=(1-this.mute-this.gain)*.004;
  for(let c=0;c<output.length;c++){let v=input[c]?.[i]??0;if(!Number.isFinite(v)){v=0;this.bad++;}if(Math.abs(v)>.98)this.bad++;v=Math.min(.98,Math.max(-.98,v))*this.gain;output[c][i]=v;this.peak=Math.max(this.peak,Math.abs(v));}
 }this.frames+=output[0].length;if(this.frames>=2048){this.port.postMessage({peak:this.peak,corrected:this.bad});this.frames=0;this.peak=0;this.bad=0;}return true;}
}
registerProcessor('rack-output-guard',OutputGuard);
