import bpy, math
from mathutils import Vector
import osc_score_bridge.live as live
live.stop()
scene=bpy.data.scenes.new('Ambient — OSC Bloom')
bpy.context.window.scene=scene
try: scene.render.engine='CYCLES'
except TypeError: pass
scene.render.resolution_x=1000;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.render.fps=30;scene.frame_start=1;scene.frame_end=720
world=bpy.data.worlds.new('Bloom midnight');world.use_nodes=True;scene.world=world
bg=next(n for n in world.node_tree.nodes if n.type=='BACKGROUND');bg.inputs[0].default_value=(.008,.015,.03,1);bg.inputs[1].default_value=.2
ctrl=bpy.data.objects.new('MUSIC — envelope controls',None);scene.collection.objects.link(ctrl)
for k in ['keys','modulation','motion']:ctrl[k]=0.0;ctrl.id_properties_ui(k).update(min=0,max=1)
settings=scene.osc_bridge_settings;settings.live_auto_objects=False
for key in ['keys','modulation','motion']:
 m=settings.mappings.add();m.track_name='control.'+key;m.target_object=ctrl.name;m.target_data_path='["'+key+'"]';m.in_min=0;m.in_max=1;m.out_min=0;m.out_max=1

def drive(obj,path,index,expression,key):
 f=obj.driver_add(path,index) if index is not None else obj.driver_add(path)
 d=f.driver;d.type='SCRIPTED';v=d.variables.new();v.name='v';v.targets[0].id=ctrl;v.targets[0].data_path='["'+key+'"]';d.expression=expression

def material(name,color,strength):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 n=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED');n.inputs['Base Color'].default_value=(*color,1);n.inputs['Metallic'].default_value=.45;n.inputs['Roughness'].default_value=.27;n.inputs['Emission Color'].default_value=(*color,1);n.inputs['Emission Strength'].default_value=strength
 return m
teal=material('Glacial cyan',(.08,.64,.72),1.3);gold=material('Warm ivory',(.95,.57,.25),1.8);violet=material('Dusk violet',(.34,.15,.7),1)
root=bpy.data.objects.new('MOTION — orbit',None);scene.collection.objects.link(root)
drive(root,'rotation_euler',2,'v*1.2','motion')
for i in range(11):
 bpy.ops.mesh.primitive_torus_add(major_segments=96,minor_segments=8,major_radius=1.2+i*.115,minor_radius=.013)
 o=bpy.context.object;o.name='MOD — halo %02d'%i;o.parent=root;o.data.materials.append([teal,gold,violet][i%3])
 o.rotation_euler=(math.pi/2,0,0)
 drive(o,'rotation_euler',0,f'{math.pi/2+(i-5)*.085}+v*{(i-5)*.13}','modulation')
 drive(o,'rotation_euler',1,f'{(i-5)*.05}+v*{(i-5)*.055}','modulation')
 for axis in range(3):drive(o,'scale',axis,'1+v*.18','keys')
 for p in o.data.polygons:p.use_smooth=True
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=4,radius=.68)
core=bpy.context.object;core.name='VOLUME — breathing core';core.data.materials.append(gold)
for axis in range(3):drive(core,'scale',axis,'.7+v*.65','keys')
tex=bpy.data.textures.new('Organic core texture',type='CLOUDS');tex.noise_scale=.23
mod=core.modifiers.new('Breathing surface','DISPLACE');mod.texture=tex;mod.strength=.14
for p in core.data.polygons:p.use_smooth=True
for i in range(72):
 angle=i*math.tau/72;radius=2.55+.11*math.sin(i*2.4)
 bpy.ops.mesh.primitive_uv_sphere_add(segments=8,ring_count=4,radius=.018 if i%6 else .038,location=(radius*math.cos(angle),.08*math.sin(i),radius*math.sin(angle)))
 o=bpy.context.object;o.name='Constellation %02d'%i;o.data.materials.append(teal if i%3 else gold);o.parent=root
camdata=bpy.data.cameras.new('Bloom camera');cam=bpy.data.objects.new('Bloom camera',camdata);scene.collection.objects.link(cam);scene.camera=cam
cam.location=(0,-10,2.1);cam.rotation_euler=(Vector((0,0,0))-cam.location).to_track_quat('-Z','Y').to_euler();camdata.type='ORTHO';camdata.ortho_scale=6.5
for name,pos,color,power,size in [('Cool rim',(-3,-2,4),(.25,.65,1),650,4),('Warm key',(2,-4,2),(1,.6,.25),800,3)]:
 data=bpy.data.lights.new(name,'AREA');data.energy=power;data.color=color;data.shape='DISK';data.size=size;o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.location=pos;o.rotation_euler=(-o.location).to_track_quat('-Z','Y').to_euler()
# Material preview is responsive during live OSC; saved camera remains render-ready.
for screen in bpy.data.screens:
 for area in screen.areas:
  if area.type=='VIEW_3D':
   area.spaces.active.region_3d.view_perspective='CAMERA';area.spaces.active.shading.type='MATERIAL';area.spaces.active.overlay.show_overlays=False
scene['demo_notes']='Generant > Ambient sketch > Preview in Blender > Play. ADSR keys controls core size; modulation opens rings; Motion rotates. 24s loop at 80 BPM.'
# Drivers must see incoming custom-property changes even with timeline stopped.
def refresh_demo():
 if scene.name not in bpy.data.scenes:return None
 ctrl.update_tag();scene.view_layers[0].update()
 return 1/30
bpy.app.driver_namespace['rack_demo_refresh']=refresh_demo
bpy.app.timers.register(refresh_demo)
live.start(57141)
bpy.ops.wm.save_as_mainfile(filepath='/home/mxjxn/Documents/ChatGPT/New project/rack-studio/demo/ambient-osc-bloom.blend')
print('DEMO_READY',scene.name,len(scene.objects),len(settings.mappings))
