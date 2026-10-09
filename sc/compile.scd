// Authoring only: compile portable devices. Does not boot an audio server.
(
var folder=PathName(thisProcess.nowExecutingPath).parentPath +/+ "../public/synthdefs";
var write={|def|def.writeDefFile(folder)};
write.(SynthDef(\rackGlass,{|out=16,freq=220,gate=1,velocity=0.7,body=0.48,metal=0.32,attack=0.008,decay=0.8,sustain=0.35,release=0.2,modAttack=1,modDecay=2,modSustain=0.5,modRelease=3,envAmount=0,envTarget=0,width=0.65,level=0.22,toneCV=0.5,modDepth=0|
 var env,cv,cutoff,sig,mod,shape,depth,fmAmount,stereo;
 shape=EnvGen.kr(Env.adsr(modAttack.clip(0.005,30),modDecay.clip(0.005,30),modSustain.clip(0,1),modRelease.clip(0.005,60),1,0),gate);
 depth=shape*envAmount.clip(-1,1);
 cv=Sanitize.kr(toneCV).clip(0,1);
 cutoff=(body.clip(0,1).linexp(0,1,250,14000)*(2**(((cv-0.5)*8*modDepth.clip(-1,1))+(depth*6*(envTarget < 0.5))))).clip(40,18000);
 env=EnvGen.kr(Env.adsr(attack.clip(0.005,30),decay.clip(0.005,30),sustain.clip(0,1),release.clip(0.005,60),1,0),gate,doneAction:2);
 fmAmount=(metal+depth*(envTarget > 0.5)*(envTarget < 1.5)).clip(0,1);
 stereo=(width+depth*(envTarget > 1.5)).clip(0,1);
 mod=SinOsc.ar(freq*2.001)*fmAmount*3;
 sig=SinOsc.ar(freq*[0.998,1.002],mod)+(VarSaw.ar(freq*0.5,0,0.35)*body*0.25);
 sig=LPF.ar(sig,cutoff);sig=Splay.ar(sig,stereo);
 Out.ar(out,Sanitize.ar(sig*env*velocity.clip(0,1)*Lag.kr(level.clip(0,0.6),0.02)));
}));
write.(SynthDef(\rackSample,{|out=24,buf=0,rate=1,velocity=0.8,tone=0.8,level=0.48,toneCV=0.5,modDepth=0,cutoff=20000,decay=30,drive=0,start=0,end=1|
 var sig,hz,duration,trim,shape,gain,distorted;
 hz=(tone.clip(0,1).linexp(0,1,150,18000)*(2**((Sanitize.kr(toneCV).clip(0,1)-0.5)*8*modDepth.clip(-1,1)))).min(cutoff.clip(100,20000)).clip(40,SampleRate.ir*0.45);
 duration=(BufDur.kr(buf)*(end-start).clip(0.001,1)/rate.clip(0.0625,8)).max(0.004);
 trim=EnvGen.ar(Env.linen(0.0002,(duration-0.003).max(0.001),0.003),doneAction:2);
 shape=EnvGen.ar(Env.perc(0.0002,decay.clip(0.01,30),1,-4));
 sig=PlayBuf.ar(1,buf,BufRateScale.kr(buf)*rate.clip(0.0625,8),startPos:BufFrames.kr(buf)*start.clip(0,0.99),doneAction:2);
 sig=LPF.ar(sig,hz)*trim*shape;
 gain=drive.clip(0,24).dbamp;distorted=(sig*gain).tanh/gain.sqrt;
 sig=XFade2.ar(sig,distorted,(drive/3).clip(0,1)*2-1);
 // No zero-to-level Lag at note-on: preserve the sample's initial transient.
 Out.ar(out,Pan2.ar(Sanitize.ar(sig*velocity.clip(0,1)*level.clip(0,4))));
}));
write.(SynthDef(\rackPadMix,{|in=24,out=18,on=1,meter=0|
 var sig=In.ar(in,2)*Lag.kr(on,0.005);
 ReplaceOut.kr(8+meter,Amplitude.kr(sig[0],0.001,0.06));
 Out.ar(out,sig);
}));
write.(SynthDef(\rackDrive,{|in=18,out=22,mode=0,drive=6,character=0.15,tone=9000,mix=0.5,output=0,bypass=1,compensate=1,bass=1,meter=5|
 var dry,low,source,x,wet,matched,ratio,dryAmp,wetAmp,result;
 dry=In.ar(in,2);low=LPF.ar(dry,120)*Lag.kr(bass.clip(0,1),0.02);source=dry-low;
 x=source*Lag.kr(drive.clip(0,30).dbamp,0.02)+Lag.kr(character.clip(0,1)*0.4,0.02);
 wet=SelectX.ar(Lag.kr(mode.clip(0,2),0.03),[x.tanh,x.fold2(1),x.wrap2(1)]);
 wet=LPF.ar(LeakDC.ar(wet),Lag.kr(tone.clip(200,18000),0.02))+low;
 dryAmp=Amplitude.kr(dry[0],0.01,0.15).max(Amplitude.kr(dry[1],0.01,0.15));
 wetAmp=Amplitude.kr(wet[0],0.01,0.15).max(Amplitude.kr(wet[1],0.01,0.15));
 ratio=Lag.kr((dryAmp/(wetAmp+0.00001)).clip(0.05,2),0.1);
 matched=wet*(1+((ratio-1)*compensate.clip(0,1)));
 result=(dry+((matched-dry)*Lag.kr(mix.clip(0,1),0.02)))*Lag.kr(output.clip(-24,6).dbamp,0.02);
 result=dry+((result-dry)*Lag.kr(1-bypass.clip(0,1),0.01));
 ReplaceOut.kr(8+meter,Amplitude.kr(result[0],0.001,0.06));
 Out.ar(out,Sanitize.ar(result));
}));
write.(SynthDef(\rackMotion,{|out=0,rate=0.7,wave=0|
 var cv=Select.kr(wave.clip(0,2),[SinOsc.kr(rate.clip(0.03,12)),LFTri.kr(rate.clip(0.03,12)),LFNoise0.kr(rate.clip(0.03,12))]);
 ReplaceOut.kr(out,Sanitize.kr((cv+1)*0.5).clip(0,1));
}));
write.(SynthDef(\rackChannel,{|in=20,out=80,level=0,pan=0,on=1,meter=32|
 var sig=In.ar(in,2)*Lag.kr(level.clip(-60,6).dbamp*on.clip(0,1),0.01);
 sig=Balance2.ar(sig[0],sig[1],Lag.kr(pan.clip(-1,1),0.02));
 ReplaceOut.kr(meter,Amplitude.kr(sig[0],0.001,0.08).max(Amplitude.kr(sig[1],0.001,0.08)));
 Out.ar(out,Sanitize.ar(sig));
}));
write.(SynthDef(\rackMaster,{|keysBus=80,drumBus=82,keysOn=1,drumsOn=1,level=0.7,mute=0|
 var sig=(In.ar(keysBus,2)*Lag.kr(keysOn,0.02))+(In.ar(drumBus,2)*Lag.kr(drumsOn,0.02));
 sig=LeakDC.ar(Sanitize.ar(sig))*Lag.kr(level.clip(0,1)*(1-mute.clip(0,1)),0.02);
 sig=Limiter.ar(sig,0.95,0.005);
 Out.ar(0,Sanitize.ar(sig).clip(-0.98,0.98));
}));
(PathName(thisProcess.nowExecutingPath).parentPath +/+ "fm.scd").load;
(PathName(thisProcess.nowExecutingPath).parentPath +/+ "wavetable.scd").load;
(PathName(thisProcess.nowExecutingPath).parentPath +/+ "library.scd").load;
(PathName(thisProcess.nowExecutingPath).parentPath +/+ "kit.scd").load;
"RACK_COMPILE_OK".postln;0.exit;
)
