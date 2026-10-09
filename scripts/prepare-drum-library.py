from pathlib import Path
import shutil,subprocess,json
source=Path('/run/media/mxjxn/ffa47f4c-25f2-4f61-addf-b01061ad3fa3/home/mxjxn/audio/sampleswap/5000_DRUMHITS/SAMPLES - 5000 DRUMHITS')
root=Path(__file__).resolve().parent.parent;target=root/'sample-library';catalog=[]
for p in sorted(source.rglob('*')):
 if p.suffix.lower() not in ['.wav','.aif','.aiff']:continue
 rel=p.relative_to(source);dest=target/rel
 if p.suffix.lower()!='.wav':dest=dest.with_suffix('.aif.wav')
 dest.parent.mkdir(parents=True,exist_ok=True)
 if not dest.exists():
  if p.suffix.lower()=='.wav':shutil.copy2(p,dest)
  else:subprocess.run(['ffmpeg','-v','error','-y','-i',str(p),'-c:a','pcm_s16le',str(dest)],check=True)
 catalog.append({'path':dest.relative_to(target).as_posix(),'name':p.stem,'folder':rel.parent.as_posix(),'bytes':dest.stat().st_size})
(root/'public/library-index.json').write_text(json.dumps(catalog))
print('Indexed',len(catalog),'local default samples')
