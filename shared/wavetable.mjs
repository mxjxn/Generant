export const WAVE_SIZE=1024, WAVE_BASE=4096, WAVE_LEVELS=10, WAVE_STRIDE=WAVE_LEVELS*3;
export const waveParams={wavePosition:[0,1,0],waveDetune:[0,30,5],waveEnv:[-1,1,.4],waveDepth:[-1,1,0]};
export const waveLabels={wavePosition:'Table position',waveDetune:'Detune cents',waveEnv:'Envelope → position',waveDepth:'CV → position'};
export function newWavetable(){return{id:'wave-'+crypto.randomUUID(),name:'Envelope table',version:1,frames:[
 [{x:0,y:0,curve:0},{x:.25,y:1,curve:0},{x:.5,y:0,curve:0},{x:.75,y:-1,curve:0},{x:1,y:0,curve:0}],
 [{x:0,y:0,curve:3},{x:.15,y:1,curve:-4},{x:.4,y:-.6,curve:0},{x:.5,y:.3,curve:5},{x:.8,y:-1,curve:-2},{x:1,y:0,curve:0}]
 ]};}
export function validateWavetables(p){
 const waves=p.studio?.wavetables??[];if(!Array.isArray(waves)||waves.length>16)throw Error('Up to 16 wavetable assets are supported.');
 const ids=new Set();for(const w of waves){if(!w||w.version!==1||typeof w.id!=='string'||!/^wave-[a-zA-Z0-9-]{1,70}$/.test(w.id)||ids.has(w.id)||typeof w.name!=='string'||!w.name.trim()||w.name.length>80||!Array.isArray(w.frames)||w.frames.length!==2)throw Error('Invalid wavetable asset.');ids.add(w.id);
 for(const f of w.frames){if(!Array.isArray(f)||f.length<3||f.length>16||f[0].x!==0||f.at(-1).x!==1||f[0].y!==f.at(-1).y)throw Error('Waveform endpoints must join.');f.forEach((n,i)=>{if(!n||![n.x,n.y,n.curve].every(Number.isFinite)||Math.abs(n.y)>1||Math.abs(n.curve)>8||n.x<0||n.x>1||(i&&n.x-f[i-1].x<.005))throw Error('Invalid waveform point.');});}}
 for(const d of p.studio?.devices??[])if((d.params??p.params[d.id])?.fmMode===2&&!ids.has(d.wavetableId))throw Error('Wavetable instrument needs an existing waveform asset.');
}
export function sampleFrame(points,size=WAVE_SIZE){const out=new Float64Array(size);let segment=0;for(let i=0;i<size;i++){const x=i/size;while(segment<points.length-2&&x>=points[segment+1].x)segment++;const a=points[segment],b=points[segment+1],t=(x-a.x)/(b.x-a.x),c=a.curve;out[i]=a.y+(b.y-a.y)*(Math.abs(c)<1e-6?t:Math.expm1(c*t)/Math.expm1(c));}return out;}
// In-place radix-2 FFT. Generated banks retain phase and remove DC.
function fft(re,im,inverse=false){const n=re.length;for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]];}}
 for(let len=2;len<=n;len<<=1){const angle=(inverse?2:-2)*Math.PI/len;for(let i=0;i<n;i+=len)for(let j=0;j<len/2;j++){const c=Math.cos(angle*j),s=Math.sin(angle*j),a=i+j,b=a+len/2,tr=re[b]*c-im[b]*s,ti=re[b]*s+im[b]*c;re[b]=re[a]-tr;im[b]=im[a]-ti;re[a]+=tr;im[a]+=ti;}}if(inverse)for(let i=0;i<n;i++){re[i]/=n;im[i]/=n;}}
export function bandlimit(samples,harmonics){const re=Float64Array.from(samples),im=new Float64Array(re.length);fft(re,im);re[0]=im[0]=0;for(let i=1;i<re.length;i++)if(Math.min(i,re.length-i)>harmonics)re[i]=im[i]=0;fft(re,im,true);return re;}
export function asWavetable(samples){const out=new Float32Array(samples.length*2);for(let i=0;i<samples.length;i++){const a=samples[i],b=samples[(i+1)%samples.length];out[2*i]=2*a-b;out[2*i+1]=b-a;}return out;}
export function buildWaveBank(asset){const sources=asset.frames.map(f=>sampleFrame(f)),frames=Array.from({length:WAVE_LEVELS},(_,i)=>sources.map(s=>bandlimit(s,Math.min(511,512>>i))));let peak=0;for(const pair of frames)for(const frame of pair)for(const v of frame)peak=Math.max(peak,Math.abs(v));const gain=peak>0?1/peak:1;return frames.flatMap(pair=>{const a=asWavetable(pair[0].map(v=>v*gain)),b=asWavetable(pair[1].map(v=>v*gain));return[a,b,b];});}
export const waveBuffer=(p,id)=>WAVE_BASE+(p.studio?.wavetables??[]).findIndex(w=>w.id===id)*WAVE_STRIDE;
export function waveSignature(p){return JSON.stringify((p.studio?.wavetables??[]).map(w=>[w.id,w.frames]));}
