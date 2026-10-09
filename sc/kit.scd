// Independent stereo sample voice. Kit Length scales the trimmed source duration,
// and may shorten voices already running without retriggering a closed envelope.
(
var folder=PathName(thisProcess.nowExecutingPath).parentPath +/+ "../public/synthdefs";
SynthDef(\rackKitSample,{
 var buf,frames,sr,start,end,rate,distance,pos,source,duration,limit,fade,closing,window,gate,shape,percussive,sustain,signal,drive,wet;
 buf=\buf.kr(7800);frames=BufFrames.kr(buf);sr=BufSampleRate.kr(buf);
 start=\start.kr(0)*frames;end=\end.kr(1)*frames;
 rate=(2**((\tune.kr(0)+(\fine.kr(0)/100))/12));
 duration=((end-start)/sr/rate).max(0.004);
 distance=Sweep.ar(0,sr*rate*(2**((EnvGen.kr(Env.perc(0.001,\pitchDecay.kr(0.08)))*\pitchAmount.kr(0))/12)));
 pos=Select.ar(\reverse.kr(0),[start+distance,(end-1)-distance]);
 source=BufRd.ar(2,buf,pos,0,4)*(distance<(end-start));
 limit=(duration*\length.kr(1)*Select.kr(\follow.kr(1),[1,\kitLength.kr(1)])).max(0.004);
 fade=\kitFade.kr(0.008).clip(0.001,0.5).min(limit*0.5);
 closing=SetResetFF.kr(Sweep.kr(0,1)>=(limit-fade),0);
 window=EnvGen.kr(Env.asr(0.0005,1,fade,-4),1-closing,doneAction:2);
 gate=\gate.kr(1)*(Sweep.kr(0,1)<\noteLength.kr(3600));percussive=EnvGen.kr(Env([0,1,1,0],[\attack.kr(0.001),\hold.kr(0),\decay.kr(0.5)],\curve.kr(-4)));
 sustain=EnvGen.kr(Env.adsr(\attack.kr(0.001),\decay.kr(0.5),\sustain.kr(0.7),\release.kr(0.08),1,\curve.kr(-4)),gate);
 shape=Select.kr(\mode.kr(0),[EnvGen.kr(Env([0,1],[\attack.kr(0.001)])),percussive,sustain]);
 FreeSelf.kr((\mode.kr(0)>0)*(shape<=0)*(Sweep.kr(0,1)>0.004));
 signal=SelectX.ar(\filter.kr(0),[source,RLPF.ar(source,\cutoff.kr(20000).clip(30,18000),(1-\resonance.kr(0)).max(0.1)),RHPF.ar(source,\cutoff.kr(20000).clip(30,18000),(1-\resonance.kr(0)).max(0.1)),BPF.ar(source,\cutoff.kr(20000).clip(30,18000),(1-\resonance.kr(0)).max(0.1))]);
 drive=\drive.kr(0).dbamp;wet=(signal*drive).tanh/drive.sqrt;
 signal=signal+((wet-signal)*(\drive.kr(0)/3).clip(0,1));
 signal=signal*window*shape*EnvGen.kr(Env.asr(0.0005,1,0.004),\killGate.kr(1),doneAction:2);
 signal=signal*(1-(\velocity.kr(1)*(1-\hitVelocity.kr(0.8))))*Lag.kr(\gain.kr(0).dbamp*\kitLevel.kr(0.8)*\on.kr(1),0.002);
 Out.ar(\out.kr(40),Sanitize.ar(Balance2.ar(signal[0],signal[1],\pan.kr(0),2.sqrt)));
}).writeDefFile(folder);
)
