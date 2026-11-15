class RenderCapture extends AudioWorkletProcessor {
 constructor(){
  super();
  this.active=false;
  this.port.onmessage=({data})=>{
   if(data?.type==='start')this.active=true;
   if(data?.type==='stop')this.active=false;
  };
 }
 process(inputs){
  if(!this.active)return true;
  const input=inputs[0];
  if(!input?.[0]?.length)return true;
  const channels=input.map(ch=>ch.slice());
  this.port.postMessage({type:'pcm',channels},{transfer:channels.map(c=>c.buffer)});
  return true;
 }
}
registerProcessor('render-capture',RenderCapture);
