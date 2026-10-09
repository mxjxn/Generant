(
var folder=PathName(thisProcess.nowExecutingPath).parentPath +/+ "../public/synthdefs";
var write={|def|def.writeDefFile(folder)};
var finish={|dry,wet|
 var sig=dry+((wet-dry)*Lag.kr(1-\bypass.kr(0).clip(0,1),0.02));
 sig=Sanitize.ar(sig)*Lag.kr(\output.kr(0).clip(-24,24).dbamp,0.02);
 ReplaceOut.kr(8+\meter.kr(4),Amplitude.kr(sig[0],0.001,0.08).max(Amplitude.kr(sig[1],0.001,0.08)));
 Out.ar(\out.kr(128),sig);
};
var cv={|name,default=0.5|var val=In.kr((name++"Bus").asSymbol.kr(0),1).clip(0,1);Select.kr((name++"Connected").asSymbol.kr(0),[default,val])};
write.(SynthDef(\rackGate,{ReplaceOut.kr(\out.kr(129),(In.kr(\seq.kr(1129))+In.kr(\manual.kr(2129))).clip(0,1));}));
write.(SynthDef(\rackGain,{var dry=In.ar(\in.kr(16),2),mid,side,wet;mid=(dry[0]+dry[1])*0.5;side=(dry[0]-dry[1])*0.5*Lag.kr(\width.kr(1).clip(0,2),0.02);wet=[mid+side,mid-side]*Lag.kr(\gain.kr(0).clip(-60,24).dbamp,0.02)*(1-(2*\invert.kr(0)));wet=Balance2.ar(wet[0],wet[1],\pan.kr(0),2.sqrt);finish.(dry,wet);}));
write.(SynthDef(\rackVCA,{var dry=In.ar(\in.kr(16),2),amp; amp=(\base.kr(1)+((cv.("control",1)-1)*\controlConnected.kr(0)*\depth.kr(1)*\controlAmount.kr(1))).clip(0,1).pow(\curve.kr(1).clip(0.25,4));finish.(dry,dry*Lag.kr(amp*\gain.kr(0).clip(-60,24).dbamp,0.003));}));
write.(SynthDef(\rackFilter,{var dry=In.ar(\in.kr(16),2),wet,freq,rq,x,drive;freq=(\cutoff.kr(8000)*(2**((cv.("control")-0.5)*2*\depth.kr(0)*\controlAmount.kr(0)))).clip(20,SampleRate.ir*0.45);rq=(1-\resonance.kr(0.1)).clip(0.06,1);drive=\drive.kr(0).dbamp;x=(dry*drive).tanh/drive.sqrt;wet=SelectX.ar(Lag.kr(\mode.kr(0).clip(0,4),0.03),[RLPF.ar(x,freq,rq),RHPF.ar(x,freq,rq),BPF.ar(x,freq,rq),BRF.ar(x,freq,rq),MoogFF.ar(x,freq,\resonance.kr(0.1)*3.7)]);finish.(dry,dry+((wet-dry)*Lag.kr(\mix.kr(1),0.02)));}));
write.(SynthDef(\rackFreeVerb,{var dry=In.ar(\in.kr(16),2),wet,x;x=DelayC.ar(dry,0.2,\predelay.kr(0.02).clip(0,0.2));wet=FreeVerb2.ar(x[0],x[1],1,\room.kr(0.7),\damp.kr(0.45));finish.(dry,dry+((wet-dry)*Lag.kr(\mix.kr(0.25),0.02)));}));
write.(SynthDef(\rackGVerb,{var dry=In.ar(\in.kr(16),2),wet;wet=GVerb.ar(Mix(dry)*0.5,\size.kr(35).clip(5,100),\decay.kr(4).clip(0.2,20),\damp.kr(0.5),\bandwidth.kr(0.8),\spread.kr(15),0,0.5,0.5,100);finish.(dry,dry+((wet-dry)*Lag.kr(\mix.kr(0.22),0.02)));}));
write.(SynthDef(\rackChorus,{var dry=In.ar(\in.kr(16),2),wet,time;time=(\delay.kr(0.015)+(SinOsc.kr(\rate.kr(0.35),[0,pi*0.5])*\depth.kr(0.004))).clip(0.0001,0.06);wet=DelayC.ar(dry,0.06,time);finish.(dry,dry+((wet-dry)*Lag.kr(\mix.kr(0.35),0.02)));}));
write.(SynthDef(\rackPhaser,{var dry=In.ar(\in.kr(16),2),wet,freq;freq=(\center.kr(900)*(2**(SinOsc.kr(\rate.kr(0.25))*\depth.kr(1.5)))).clip(40,14000);wet=dry;[0.5,1,2,4].do{|ratio|wet=BAllPass.ar(wet,(freq*ratio).clip(30,16000),0.7)};finish.(dry,dry+((wet-dry)*Lag.kr(\mix.kr(0.5),0.02)));}));
write.(SynthDef(\rackDelay,{var dry=In.ar(\in.kr(16),2),wet,feedback,time,fb;time=Select.kr(\sync.kr(1),[\time.kr(0.375),60/\bpm.kr(120)*\beats.kr(0.75)]).clip(0.005,2);feedback=LocalIn.ar(2);fb=SelectX.ar(\pingpong.kr(1),[feedback,feedback.reverse]);wet=DelayC.ar(dry+(LPF.ar(LeakDC.ar(fb),\tone.kr(6500))*\feedback.kr(0.35).clip(0,0.9)).tanh,2,Lag.kr(time,0.05));LocalOut.ar(Sanitize.ar(wet));finish.(dry,dry+((wet-dry)*Lag.kr(\mix.kr(0.25),0.02)));}));
write.(SynthDef(\rackLFO,{var rate,wave;rate=Select.kr(\sync.kr(0),[\rate.kr(0.5),\bpm.kr(120)/60/\beats.kr(4)]).clip(0.01,100);wave=Select.kr(\shape.kr(0),[SinOsc.kr(rate),LFTri.kr(rate),LFSaw.kr(rate),LFPulse.kr(rate,0,\width.kr(0.5))*2-1,LFNoise0.kr(rate),LFNoise1.kr(rate)]);ReplaceOut.kr(\out.kr(128),Sanitize.kr(wave*\depth.kr(1)*0.5+\offset.kr(0.5)).clip(0,1));}));
write.(SynthDef(\rackEnvelope,{var a,d,s,h,r,c,gate,loopgate,env,shot;a=\attack.kr(0.05);d=\decay.kr(0.3);s=\sustain.kr(0.5);h=\hold.kr(0.2);r=\release.kr(0.6);c=\curve.kr(-4);loopgate=LFPulse.kr(1/(a+d+h+r).max(0.01),0,(a+d+h)/(a+d+h+r));gate=Select.kr(\loop.kr(0),[(\gate.kr(0)+(cv.("gate",0)*\gateAmount.kr(1))).clip(0,1)>0.5,loopgate]);env=EnvGen.kr(Env.adsr(a,d,s,r,1,c),gate);shot=EnvGen.kr(Env([0,1,s,s,0],[a,d,h,r],c),\t_trigger.tr(0));ReplaceOut.kr(\out.kr(128),Sanitize.kr(env.max(shot)*\depth.kr(1)).clip(0,1));}));
write.(SynthDef(\rackCVMath,{var a,b,v;a=cv.("a",0)*\a.kr(1)*\aAmount.kr(1);b=cv.("b",0)*\b.kr(0)*\bAmount.kr(1);v=Select.kr(\mode.kr(0),[a+b,a*b,a.min(b),a.max(b)])+\offset.kr(0);ReplaceOut.kr(\out.kr(128),Lag.kr(Sanitize.kr(v).clip(0,1),\smooth.kr(0.01)));}));
write.(SynthDef(\rackCloud,{var trigger,duration,density,position,pitch,pan,signal,env,overlap,ampCV;
 duration=\grainDuration.kr(0.12).clip(0.01,1);overlap=\grainOverlap.kr(5).clip(0.25,24);density=(overlap/duration*(2**((cv.("density")-0.5)*2*\grainDensityDepth.kr(0)*\densityAmount.kr(0)))).clip(0.5,200);
 trigger=Select.ar(\grainRandom.kr(1),[Impulse.ar(density),Dust.ar(density)]);
 position=(\grainPosition.kr(0.4)+Sweep.kr(0,\grainScan.kr(0.03))+(TRand.ar(-1,1,trigger)*\grainSpread.kr(0.15))+((cv.("position")-0.5)*2*\grainPositionDepth.kr(0)*\positionAmount.kr(0))).wrap(0,1);
 pitch=(\freq.kr(261.625565)/\grainRoot.kr(60).midicps)*(2**((\transpose.kr(0)+(TRand.ar(-1,1,trigger)*\grainPitchRange.kr(0.4))+((cv.("pitch")-0.5)*24*\pitchDepth.kr(0)*\pitchAmount.kr(0)))/12));
 pan=TRand.ar(-1,1,trigger)*\grainPan.kr(0.8)*\width.kr(0.65);signal=GrainBuf.ar(2,trigger,(duration*(1+(TRand.ar(-1,1,trigger)*\grainJitter.kr(0.2)))).clip(0.005,2),\buf.kr(7600),pitch,position,4,pan,-1,256)/overlap.sqrt;
 signal=RLPF.ar(signal,(\cutoff.kr(14000)*(2**((cv.("filter")-0.5)*2*\filterDepth.kr(0)*\filterAmount.kr(0)))).clip(30,18000),(1-\resonance.kr(0)).clip(0.06,1));
 env=EnvGen.kr(Env.adsr(\attack.kr(0.2),\decay.kr(0.5),\sustain.kr(0.8),\release.kr(2)),\gate.kr(1),doneAction:2);ampCV=(1+((cv.("amp",1)-1)*\ampDepth.kr(0)*\ampAmount.kr(0))).clip(0,2);
 Out.ar(\out.kr(16),Sanitize.ar(LeakDC.ar(signal)*env*\velocity.kr(0.8)*\level.kr(0.4)*ampCV*3).tanh);
}));
write.(SynthDef(\rackVCO,{var freq,osc,signal,env,ampCV;freq=(\freq.kr(220)*(2**((\transpose.kr(0)+((cv.("pitch")-0.5)*24*\pitchDepth.kr(0)*\pitchAmount.kr(0)))/12)))*[1,2**(\oscDetune.kr(3)/1200)];osc=SelectX.ar(\oscShape.kr(0),[Saw.ar(freq),Pulse.ar(freq,\oscPulse.kr(0.5)),SinOsc.ar(freq),LFTri.ar(freq),PinkNoise.ar(1!2)]);signal=Splay.ar(osc,\width.kr(0.65));signal=RLPF.ar(signal,(\cutoff.kr(9000)*(2**((cv.("filter")-0.5)*2*\filterDepth.kr(0)*\filterAmount.kr(0)))).clip(30,18000),(1-\resonance.kr(0.1)).clip(0.06,1));env=EnvGen.kr(Env.adsr(\attack.kr(0.005),\decay.kr(0.4),\sustain.kr(0.7),\release.kr(0.3)),\gate.kr(1),doneAction:2);ampCV=(1+((cv.("amp",1)-1)*\ampDepth.kr(0)*\ampAmount.kr(0))).clip(0,2);Out.ar(\out.kr(16),Sanitize.ar(LeakDC.ar(signal)*env*\velocity.kr(0.8)*\level.kr(0.3)*ampCV).tanh);}));
)
