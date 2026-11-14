const finite=value=>typeof value==='number'&&Number.isFinite(value);
const text=value=>typeof value==='string'&&value.length>0&&value.length<=160;

export const REMOTE_PREFIX='/generant/v1';

export function remoteCommand(address,args=[]){
 if(typeof address!=='string'||!Array.isArray(args))throw Error('Invalid OSC command.');
 switch(address){
  case REMOTE_PREFIX+'/transport/play':if(args.length)throw Error('Play takes no arguments.');return{type:'play'};
  case REMOTE_PREFIX+'/transport/stop':if(args.length)throw Error('Stop takes no arguments.');return{type:'stop'};
  case REMOTE_PREFIX+'/transport/toggle':if(args.length)throw Error('Toggle takes no arguments.');return{type:'toggle'};
  case REMOTE_PREFIX+'/transport/tempo':if(args.length!==1||!finite(args[0])||args[0]<20||args[0]>999)throw Error('Tempo must be 20–999 BPM.');return{type:'tempo',bpm:args[0]};
  case REMOTE_PREFIX+'/song/position/select':
  case REMOTE_PREFIX+'/song/position/queue':if(args.length!==1||!Number.isInteger(args[0])||args[0]<0||args[0]>1023)throw Error('Song position must be a zero-based integer.');return{type:address.endsWith('/queue')?'queuePosition':'selectPosition',index:args[0]};
  case REMOTE_PREFIX+'/pattern/select':
  case REMOTE_PREFIX+'/pattern/queue':if(args.length!==1||!text(args[0]))throw Error('Pattern requires an id or name.');return{type:address.endsWith('/queue')?'queuePattern':'selectPattern',pattern:String(args[0])};
  case REMOTE_PREFIX+'/device/param':if(args.length!==3||!text(args[0])||!text(args[1])||!finite(args[2]))throw Error('Device parameter requires device id, parameter id, and numeric value.');return{type:'deviceParam',device:String(args[0]),param:String(args[1]),value:args[2]};
  case REMOTE_PREFIX+'/device/note':if(args.length<2||args.length>3||!text(args[0])||!Number.isInteger(args[1])||args[1]<0||args[1]>127||(args.length===3&&!finite(args[2]))||args[2]<0||args[2]>1)throw Error('Device note requires device id, MIDI pitch 0–127, optional velocity 0–1.');return{type:'note',device:String(args[0]),pitch:args[1],velocity:args.length===3?args[2]:.8};
  case REMOTE_PREFIX+'/bank/lane':if(args.length<2||args.length>3||!text(args[0])||!text(args[1])||!finite(args[2]??0))throw Error('Bank lane requires device id, bank pattern id or name, optional transpose -24–24.');if((args[2]??0)<-24||(args[2]??0)>24)throw Error('Transpose must be -24–24.');return{type:'bankLane',device:String(args[0]),pattern:String(args[1]),transpose:args[2]??0};
  default:return null;
 }
}
