// Linear ADSR, matching the instrument's curve=0 envelope. Times are seconds.
export function envelopeAt(age,gate,p,mod=false){
 const a=p[mod?'modAttack':'attack'],d=p[mod?'modDecay':'decay'],s=p[mod?'modSustain':'sustain'],r=p[mod?'modRelease':'release'];
 const held=t=>t<0?0:t<a?t/a:t<a+d?1+(s-1)*(t-a)/d:s;
 return Math.max(0,Math.min(1,age<=gate?held(age):held(gate)*Math.max(0,1-(age-gate)/r)));
}
