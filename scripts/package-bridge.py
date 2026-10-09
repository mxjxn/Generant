import os
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
root=Path(__file__).resolve().parents[1]
source=Path(os.environ.get('GENERANT_BRIDGE_SOURCE',root.parent/'blender-osc-bridge'))
if not source.exists():
    source=root/'integrations/osc_score_bridge'
with ZipFile(root/'integrations/rack-osc-bridge.zip','w',ZIP_DEFLATED) as archive:
    for file in sorted(source.iterdir()):
        if file.suffix=='.py' or file.name in ('LICENSE','README.md'):
            archive.write(file,'osc_score_bridge/'+file.name)
print(f'Packaged integrations/rack-osc-bridge.zip from {source}')
