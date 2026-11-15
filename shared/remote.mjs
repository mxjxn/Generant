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
  case REMOTE_PREFIX+'/render/song':
  case REMOTE_PREFIX+'/render/pattern':
  case REMOTE_PREFIX+'/render/video':{
   // args: [format?, style?, aspect?, title?, artist?, videoFlag?, maxSeconds?, outDir?, pattern?]
   const mode=address.endsWith('/pattern')?'pattern':address.endsWith('/video')?'video':'song';
   const format=args[0]==null||args[0]===''?'wav':String(args[0]);
   if(!['wav','mp3','aac'].includes(format))throw Error('Render format must be wav, mp3, or aac.');
   const style=args[1]==null||args[1]===''?'pulse':String(args[1]);
   if(!['pulse','ribbons','lattice','bars'].includes(style))throw Error('Render style must be pulse, ribbons, lattice, or bars.');
   const aspect=args[2]==null||args[2]===''?'vertical':String(args[2]);
   if(!['vertical','square','landscape'].includes(aspect))throw Error('Aspect must be vertical, square, or landscape.');
   const title=args[3]==null?'':String(args[3]);
   const artist=args[4]==null?'':String(args[4]);
   if(title.length>80||artist.length>80)throw Error('Title/artist max 80 characters.');
   const video=args[5]==null?true:!!args[5]&&args[5]!==0&&args[5]!=='0'&&args[5]!==false;
   const maxSeconds=args[6]==null||args[6]===0||args[6]===''?null:+args[6];
   if(maxSeconds!==null&&(!finite(maxSeconds)||maxSeconds<1||maxSeconds>600))throw Error('maxSeconds must be 1–600.');
   const outDir=args[7]==null||args[7]===''?null:String(args[7]);
   if(outDir&&(outDir.length>400||outDir.includes('\0')))throw Error('Invalid outDir.');
   const pattern=args[8]==null||args[8]===''?null:String(args[8]);
   if(pattern&&!text(pattern))throw Error('Pattern id/name too long.');
   return{type:'render',mode,format,style,aspect,title,artist,video,maxSeconds,outDir,pattern};
  }
  default:return null;
 }
}
