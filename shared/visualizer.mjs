// Software visualizer frames driven by audio analysis + Generant timeline events.
import {RENDER_ASPECTS,RENDER_STYLES,eventsAtTime,safeMargins,defaultPlacement,defaultCoverMode} from './render.mjs';

const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));

function palette(style,t,hit){
 const hues={
  pulse:[40+hit*80,30+t*40,90+hit*120],
  ribbons:[180+t*40,70+hit*80,40],
  lattice:[30+hit*40,90+t*60,160],
  bars:[200,40+hit*100,120]
 }[style]||[80,80,100];
 return hues.map(v=>clamp(v/255)*255|0);
}

function fill(buf,w,h,r,g,b){
 for(let i=0;i<w*h;i++){const o=i*4;buf[o]=r;buf[o+1]=g;buf[o+2]=b;buf[o+3]=255;}
}

function sampleEnergy(analysis,t){
 const idx=Math.min(analysis.energy.length-1,Math.max(0,Math.floor(t*analysis.sampleRate/analysis.hop)));
 const bands=analysis.bandEnergy.map(b=>b[idx]||0);
 return {e:analysis.energy[idx]||0,bands,onset:analysis.onsets.some(o=>Math.abs(o-t)<0.04)};
}

const GLYPHS={
 ' ':['00000','00000','00000','00000','00000','00000','00000'],
 '-':['00000','00000','00000','11111','00000','00000','00000'],
 '.':['00000','00000','00000','00000','00000','01100','01100'],
 "'":['00100','00100','00000','00000','00000','00000','00000'],
 A:['01110','10001','10001','11111','10001','10001','10001'],
 B:['11110','10001','10001','11110','10001','10001','11110'],
 C:['01110','10001','10000','10000','10000','10001','01110'],
 D:['11110','10001','10001','10001','10001','10001','11110'],
 E:['11111','10000','10000','11110','10000','10000','11111'],
 F:['11111','10000','10000','11110','10000','10000','10000'],
 G:['01110','10001','10000','10111','10001','10001','01110'],
 H:['10001','10001','10001','11111','10001','10001','10001'],
 I:['11111','00100','00100','00100','00100','00100','11111'],
 J:['00111','00010','00010','00010','00010','10010','01100'],
 K:['10001','10010','10100','11000','10100','10010','10001'],
 L:['10000','10000','10000','10000','10000','10000','11111'],
 M:['10001','11011','10101','10001','10001','10001','10001'],
 N:['10001','11001','10101','10011','10001','10001','10001'],
 O:['01110','10001','10001','10001','10001','10001','01110'],
 P:['11110','10001','10001','11110','10000','10000','10000'],
 Q:['01110','10001','10001','10001','10101','10010','01101'],
 R:['11110','10001','10001','11110','10100','10010','10001'],
 S:['01111','10000','10000','01110','00001','00001','11110'],
 T:['11111','00100','00100','00100','00100','00100','00100'],
 U:['10001','10001','10001','10001','10001','10001','01110'],
 V:['10001','10001','10001','10001','10001','01010','00100'],
 W:['10001','10001','10001','10001','10101','10101','01010'],
 X:['10001','10001','01010','00100','01010','10001','10001'],
 Y:['10001','10001','01010','00100','00100','00100','00100'],
 Z:['11111','00001','00010','00100','01000','10000','11111'],
 0:['01110','10001','10011','10101','11001','10001','01110'],
 1:['00100','01100','00100','00100','00100','00100','01110'],
 2:['01110','10001','00001','00010','00100','01000','11111'],
 3:['11110','00001','00001','01110','00001','00001','11110'],
 4:['00010','00110','01010','10010','11111','00010','00010'],
 5:['11111','10000','10000','11110','00001','00001','11110'],
 6:['01110','10000','10000','11110','10001','10001','01110'],
 7:['11111','00001','00010','00100','01000','01000','01000'],
 8:['01110','10001','10001','01110','10001','10001','01110'],
 9:['01110','10001','10001','01111','00001','00001','01110']
};

function drawGlyphText(buf,w,h,text,ox,oy,scale,r=245,g=245,b=250){
 let x=ox;
 for(const ch of text.toUpperCase().slice(0,36)){
  const rows=GLYPHS[ch]||GLYPHS['.'];
  for(let row=0;row<7;row++)for(let col=0;col<5;col++){
   if(rows[row][col]!=='1')continue;
   for(let dy=0;dy<scale;dy++)for(let dx=0;dx<scale;dx++){
    const px=x+col*scale+dx,py=oy+row*scale+dy;
    if(px<0||py<0||px>=w||py>=h)continue;
    const o=(py*w+px)*4;buf[o]=r;buf[o+1]=g;buf[o+2]=b;
   }
  }
  x+=6*scale;
 }
 return x-ox;
}

function resolvePlacement(placement,aspect){
 const p=placement==='auto'||placement==='safe'?defaultPlacement(aspect):placement;
 return OVERLAY_OK.includes(p)?p:defaultPlacement(aspect);
}
const OVERLAY_OK=['top-left','top','bottom-left','bottom'];

function drawTextOverlay(buf,w,h,{title='',artist='',aspect='vertical',placement='auto'}={}){
 if(!title&&!artist)return;
 const m=safeMargins(aspect);
 const scale=Math.max(2,Math.floor(w/380));
 const plateH=(artist?18:10)*scale;
 const plateW=Math.min(w* (1-m.left-m.right),(Math.max(title.length,artist.length||0)+2)*6*scale);
 const place=resolvePlacement(placement,aspect);
 let ox=Math.floor(w*m.left),oy=Math.floor(h*m.top);
 if(place==='top')ox=Math.floor((w-plateW)/2);
 if(place==='bottom-left'){ox=Math.floor(w*m.left);oy=Math.floor(h*(1-m.bottom))-plateH;}
 if(place==='bottom'){ox=Math.floor((w-plateW)/2);oy=Math.floor(h*(1-m.bottom))-plateH;}
 for(let y=oy-scale;y<oy+plateH+scale;y++)for(let x=ox-scale;x<ox+plateW+scale;x++){
  if(x<0||y<0||x>=w||y>=h)continue;
  const o=(y*w+x)*4;buf[o]=buf[o]*0.28;buf[o+1]=buf[o+1]*0.28;buf[o+2]=buf[o+2]*0.32;
 }
 if(title)drawGlyphText(buf,w,h,title,ox,oy,scale);
 if(artist)drawGlyphText(buf,w,h,artist,ox,oy+9*scale,Math.max(2,scale-1),180,190,210);
}

/** Cover is {width,height,pixels:Uint8Array RGBA}. mode: frame|backdrop. */
function drawCover(buf,w,h,cover,mode,aspect,style){
 if(!cover?.pixels||!cover.width||!cover.height)return;
 const m=safeMargins(aspect);
 if(mode==='backdrop'){
  // Cover-fit scaled + darkened/tinted under the visualizer.
  const scale=Math.max(w/cover.width,h/cover.height);
  const dw=cover.width*scale,dh=cover.height*scale;
  const ox=(w-dw)/2,oy=(h-dh)/2;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const sx=Math.min(cover.width-1,Math.max(0,((x-ox)/scale)|0));
   const sy=Math.min(cover.height-1,Math.max(0,((y-oy)/scale)|0));
   const si=(sy*cover.width+sx)*4,o=(y*w+x)*4;
   const tint=style==='ribbons'?[20,12,8]:[12,10,22];
   buf[o]=buf[o]*0.55+(cover.pixels[si]*0.28+tint[0]);
   buf[o+1]=buf[o+1]*0.55+(cover.pixels[si+1]*0.28+tint[1]);
   buf[o+2]=buf[o+2]*0.55+(cover.pixels[si+2]*0.28+tint[2]);
  }
  return;
 }
 // Framed cover in safe area (upper third for vertical/square, left for landscape).
 const boxW=aspect==='landscape'?Math.floor(w*.28):Math.floor(w*(1-m.left-m.right)*.42);
 const boxH=aspect==='landscape'?Math.floor(h*(1-m.top-m.bottom)*.7):Math.floor(boxW);
 const bx=aspect==='landscape'?Math.floor(w*m.left):Math.floor(w*(1-m.right)-boxW);
 const by=Math.floor(h*m.top);
 const scale=Math.min(boxW/cover.width,boxH/cover.height);
 const dw=Math.floor(cover.width*scale),dh=Math.floor(cover.height*scale);
 const ix=bx+((boxW-dw)/2)|0,iy=by+((boxH-dh)/2)|0;
 // Frame plate
 for(let y=by-4;y<by+boxH+4;y++)for(let x=bx-4;x<bx+boxW+4;x++){
  if(x<0||y<0||x>=w||y>=h)continue;
  const o=(y*w+x)*4;buf[o]=buf[o]*0.25+18;buf[o+1]=buf[o+1]*0.25+18;buf[o+2]=buf[o+2]*0.25+22;
 }
 for(let y=0;y<dh;y++)for(let x=0;x<dw;x++){
  const sx=Math.min(cover.width-1,((x/scale)|0)),sy=Math.min(cover.height-1,((y/scale)|0));
  const si=(sy*cover.width+sx)*4,dx=ix+x,dy=iy+y;
  if(dx<0||dy<0||dx>=w||dy>=h)continue;
  const o=(dy*w+dx)*4;buf[o]=cover.pixels[si];buf[o+1]=cover.pixels[si+1];buf[o+2]=cover.pixels[si+2];
 }
}

function drawPulse(buf,w,h,ctx){
 const [br,bg,bb]=palette('pulse',ctx.norm,ctx.audio.onset?1:ctx.audio.e*4);
 if(!ctx.preserveBackground)fill(buf,w,h,(br*.15)|0,(bg*.12)|0,(bb*.2)|0);
 const cx=w/2,cy=h*.48,maxR=Math.min(w,h)*.42*(.35+ctx.audio.e*2.5);
 for(let y=0;y<h;y++){
  const dy=y-cy;
  for(let x=0;x<w;x++){
   const dx=x-cx,d=Math.sqrt(dx*dx+dy*dy);
   const rings=Math.abs(Math.sin(d/(18+ctx.audio.e*40)-ctx.norm*12));
   if(d>maxR)continue;
   const fall=1-d/maxR;
   const glow=fall*fall*(.25+rings*.75+ctx.audio.bands[0]*8);
   const o=(y*w+x)*4;
   buf[o]=Math.min(255,buf[o]+br*glow);
   buf[o+1]=Math.min(255,buf[o+1]+bg*glow);
   buf[o+2]=Math.min(255,buf[o+2]+bb*glow);
  }
 }
 for(const n of ctx.events.notes.slice(0,32)){
  const ang=(n.pitch%24)/24*Math.PI*2+ctx.norm*6;
  const dist=Math.min(w,h)*(.12+n.velocity*.2);
  const px=(cx+Math.cos(ang)*dist)|0,py=(cy+Math.sin(ang)*dist)|0;
  for(let y=-6;y<=6;y++)for(let x=-6;x<=6;x++){
   if(x*x+y*y>36)continue;
   const xx=px+x,yy=py+y;if(xx<0||yy<0||xx>=w||yy>=h)continue;
   const o=(yy*w+xx)*4;buf[o]=240;buf[o+1]=210;buf[o+2]=160;
  }
 }
 if(ctx.events.change.length)for(let i=0;i<buf.length;i+=4){buf[i]=Math.min(255,buf[i]+40);buf[i+1]=Math.min(255,buf[i+1]+40);buf[i+2]=Math.min(255,buf[i+2]+40);}
}

function drawRibbons(buf,w,h,ctx){
 if(!ctx.preserveBackground)fill(buf,w,h,8,10,18);
 const bands=ctx.audio.bands;
 for(let y=0;y<h;y++){
  const b=Math.min(bands.length-1,Math.floor(y/h*bands.length));
  const amp=bands[b]*60+ctx.audio.e*.5;
  const [r,g,bl]=palette('ribbons',b/bands.length,amp);
  const mid=h*(.18+b/(bands.length+1)*.65);
  for(let x=0;x<w;x++){
   const wave=Math.sin(x*.012+ctx.norm*16+b)*amp*h*.05+Math.sin(x*.003-ctx.norm*7)*amp*h*.03;
   const d=Math.abs(y-(mid+wave));
   if(d>10+amp*14)continue;
   const glow=1-d/(10+amp*14);
   const o=(y*w+x)*4;
   buf[o]=Math.min(255,buf[o]+r*glow);
   buf[o+1]=Math.min(255,buf[o+1]+g*glow);
   buf[o+2]=Math.min(255,buf[o+2]+bl*glow);
  }
 }
 for(const d of ctx.events.drums){
  const cx=(w*(.2+d.pad*.18))|0,cy=(h*.82)|0,rad=(12+d.velocity*28)|0;
  for(let y=-rad;y<=rad;y++)for(let x=-rad;x<=rad;x++){
   if(x*x+y*y>rad*rad)continue;
   const xx=cx+x,yy=cy+y;if(xx<0||yy<0||xx>=w||yy>=h)continue;
   const o=(yy*w+xx)*4;buf[o]=255;buf[o+1]=140;buf[o+2]=90;
  }
 }
}

function drawLattice(buf,w,h,ctx){
 const cols=12,rows=Math.max(8,Math.floor(cols*h/w));
 if(!ctx.preserveBackground)fill(buf,w,h,6,8,12);
 const cellW=w/cols,cellH=h/rows;
 for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
  const idx=(col+row*3)%ctx.audio.bands.length;
  const v=ctx.audio.bands[idx]*35+ctx.audio.e*.25;
  const lit=ctx.events.notes.some(n=>(n.pitch%cols)===col);
  const [r,g,b]=palette('lattice',(col+row)/30,lit?1:v);
  const x0=(col*cellW+3)|0,y0=(row*cellH+3)|0,x1=((col+1)*cellW-3)|0,y1=((row+1)*cellH-3)|0;
  const a=40+v*160+(lit?100:0);
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
   const o=(y*w+x)*4,k=a/255;
   buf[o]=buf[o]*(1-k)+r*k;buf[o+1]=buf[o+1]*(1-k)+g*k;buf[o+2]=buf[o+2]*(1-k)+b*k;
  }
 }
}

function drawBars(buf,w,h,ctx){
 if(!ctx.preserveBackground)fill(buf,w,h,4,5,10);
 const n=40;
 for(let i=0;i<n;i++){
  const band=ctx.audio.bands[i%ctx.audio.bands.length];
  const height=(band*16+ctx.audio.e)*h*.7;
  const x0=((i+.15)*w/n)|0,x1=(((i+.85)*w/n))|0;
  const [r,g,b]=palette('bars',i/n,band*8);
  for(let y=0;y<height;y++){
   const yy=(h-y-h*.08)|0;
   if(yy<0||yy>=h)continue;
   for(let x=x0;x<x1;x++){const o=(yy*w+x)*4;buf[o]=r;buf[o+1]=g;buf[o+2]=b;}
  }
 }
 for(const nte of ctx.events.notes.slice(0,20)){
  const cx=(((nte.pitch%n)+.5)*w/n)|0,cy=(h*.18)|0,rad=(6+nte.velocity*14)|0;
  for(let y=-rad;y<=rad;y++)for(let x=-rad;x<=rad;x++){
   if(x*x+y*y>rad*rad)continue;
   const xx=cx+x,yy=cy+y;if(xx<0||yy<0||xx>=w||yy>=h)continue;
   const o=(yy*w+xx)*4;buf[o]=255;buf[o+1]=255;buf[o+2]=220;
  }
 }
}

const drawers={pulse:drawPulse,ribbons:drawRibbons,lattice:drawLattice,bars:drawBars};

export function renderFrame(buffer,width,height,{
 style='pulse',timeline,analysis,seconds,title='',artist='',
 aspect='vertical',overlay=true,placement='auto',cover=null,coverMode='auto'
}={}){
 const duration=Math.max(timeline.durationSeconds||analysis.duration||1,1e-3);
 const ctx={
  norm:seconds/duration,
  audio:sampleEnergy(analysis,seconds),
  events:eventsAtTime(timeline,seconds,.08)
 };
 const mode=coverMode==='auto'?defaultCoverMode(style):coverMode;
 // Backdrop sits under the visualizer wash; frame sits on top after.
 const useBackdrop=!!(cover&&mode==='backdrop');
 if(useBackdrop){
  fill(buffer,width,height,8,8,12);
  drawCover(buffer,width,height,cover,'backdrop',aspect,style);
  ctx.preserveBackground=true;
 }
 (drawers[style]||drawPulse)(buffer,width,height,ctx);
 if(cover&&mode==='frame')drawCover(buffer,width,height,cover,'frame',aspect,style);
 if(overlay!==false){
  drawTextOverlay(buffer,width,height,{
   title:title||timeline.options?.title||'',
   artist:artist||timeline.options?.artist||'',
   aspect,placement
  });
 }
}

export function* iterateFrames(timeline,analysis,{
 style='pulse',aspect='vertical',fps=30,title='',artist='',maxSeconds=null,scale=1,
 overlay=true,placement='auto',cover=null,coverMode='auto'
}={}){
 if(!RENDER_STYLES.includes(style))style='pulse';
 const base=RENDER_ASPECTS[aspect]||RENDER_ASPECTS.vertical;
 const s=clamp(scale,.05,1);
 // Keep even dimensions for yuv420p.
 const width=Math.max(2,Math.floor(base.width*s/2)*2);
 const height=Math.max(2,Math.floor(base.height*s/2)*2);
 const duration=Math.min(maxSeconds??1e9,timeline.durationSeconds||analysis.duration||1);
 const total=Math.max(1,Math.ceil(duration*fps));
 const frame=new Uint8Array(width*height*4);
 for(let i=0;i<total;i++){
  const seconds=i/fps;
  renderFrame(frame,width,height,{style,timeline,analysis,seconds,title,artist,aspect,overlay,placement,cover,coverMode});
  yield {index:i,total,seconds,width,height,pixels:frame};
 }
}

export function frameToPpm(pixels,width,height){
 const header=Buffer.from(`P6\n${width} ${height}\n255\n`);
 const rgb=Buffer.alloc(width*height*3);
 for(let i=0,j=0;i<pixels.length;i+=4,j+=3){rgb[j]=pixels[i];rgb[j+1]=pixels[i+1];rgb[j+2]=pixels[i+2];}
 return Buffer.concat([header,rgb]);
}
