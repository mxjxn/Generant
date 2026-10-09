import bpy,sys,json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/'integrations'))
import osc_score_bridge as addon
addon.register()
from osc_score_bridge import cues,live
scene=bpy.context.scene
camera=bpy.data.objects.new('Cue test camera',bpy.data.cameras.new('Cue camera'))
scene.collection.objects.link(camera)
route=scene.rack_osc_cameras.add();route.address='/song/part1';route.camera=camera
live._handle('/song/part1',[])
assert scene.camera==camera
assert cues.score_object(scene)['osc:/song/part1']==1
live._handle('/palette',['violet'])
assert cues.score_object(scene)['osc:/palette']=='violet'
live._handle('/scale',[0.7])
assert abs(cues.score_object(scene)['osc:/scale']-.7)<1e-6
long_address='/'+('x'*100)
live._handle(long_address,[.5])
assert cues.score_object(scene)[cues.property_key(long_address)]==.5
live._scheduled.append((9999999999,'/song/part1',[]))
live._reset_transport()
assert not live._scheduled
score={'format':'rack-osc-score','version':1,'durationSeconds':2,'events':[{'seconds':0,'kind':'event','address':'/song/part1','args':[]},{'seconds':.5,'kind':'state','address':'/palette','args':['violet']},{'seconds':1,'kind':'state','address':'/scale','args':[.7]},{'seconds':1.5,'kind':'event','address':'/song/part1','args':[]}]}
scene.render.fps=24
obj=cues.bake_score(scene,score)
assert len(scene.timeline_markers)==4
assert scene.timeline_markers[0].camera==camera
scene.frame_set(37)
assert obj['osc:/song/part1']==2
assert abs(obj['osc:/scale']-.7)<1e-6
assert cues.score_object(scene)['osc:/palette']=='violet'
scene.frame_set(1)
assert obj['osc:/song/part1']==1
assert 'osc:/palette' not in obj
cues.bake_score(scene,score)
assert len(scene.timeline_markers)==4
print('PASS live empty/string/numeric cues, camera route, reset queue, deterministic bake, backwards seek and reimport')
addon.unregister()
