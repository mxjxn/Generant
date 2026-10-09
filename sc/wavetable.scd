(
var folder=PathName(thisProcess.nowExecutingPath).parentPath +/+ "../public/synthdefs";
SynthDef(\rackWavetable,{|out=16,buf=4096,freq=220,gate=1,velocity=0.7,transpose=0,wavePosition=0,waveDetune=5,waveEnv=0.4,waveDepth=0,waveCV=0.5,waveConnected=0,cutoff=12000,resonance=0.1,attack=0.02,decay=0.8,sustain=0.7,release=2,modAttack=1,modDecay=2,modSustain=0.5,modRelease=3,width=0.6,level=0.18|
 var env,mod,pos,hz,mip,voices,sig;
 env=EnvGen.kr(Env.adsr(attack.clip(0.005,30),decay.clip(0.005,30),sustain.clip(0,1),release.clip(0.005,60)),gate,doneAction:2);
 mod=EnvGen.kr(Env.adsr(modAttack.clip(0.005,30),modDecay.clip(0.005,30),modSustain.clip(0,1),modRelease.clip(0.005,60)),gate);
 pos=Lag.kr((wavePosition+(mod*waveEnv)+((waveCV.clip(0,1)*2-1)*waveDepth*waveConnected)).clip(0,1),0.02);
 hz=(freq*(2**(transpose.clip(-48,48)/12))* (2**([-1,1]*waveDetune.clip(0,30)/1200))).clip(0.1,SampleRate.ir*0.4);
 // Choose a conservatively band-limited table for each detuned oscillator.
 mip=((hz*512/(SampleRate.ir*0.45)).max(1).log2.ceil).clip(0,9);
 voices=VOsc.ar(buf+(mip*3)+pos,hz);
 sig=Balance2.ar(voices[0],voices[1],0);
 sig=(sig.sum*0.5)+(sig-(sig.sum*0.5))*width.clip(0,1);
 sig=RLPF.ar(sig,Lag.kr(cutoff.clip(30,SampleRate.ir*0.4),0.02),(1-resonance.clip(0,0.9)).max(0.1));
 sig=LeakDC.ar(Sanitize.ar(sig))*env*velocity.clip(0,1)*Lag.kr(level.clip(0,0.6),0.02);
 Out.ar(out,sig.tanh);
}).writeDefFile(folder);
)
