import bpy, math, random
from mathutils import Vector
import osc_score_bridge.live as live
random.seed(73)
scene=bpy.data.scenes.new('Chromatic Rift — live glass');bpy.context.window.scene=scene
scene.render.engine='CYCLES';scene.cycles.device='GPU';scene.cycles.samples=48;scene.cycles.use_denoising=True
scene.cycles.max_bounces=12;scene.cycles.transmission_bounces=10;scene.cycles.glossy_bounces=6
scene.cycles.caustics_reflective=True;scene.cycles.caustics_refractive=True
scene.render.resolution_x=720;scene.render.resolution_y=1280;scene.render.resolution_percentage=60;scene.render.fps=30;scene.frame_end=720
prefs=bpy.context.preferences.addons['cycles'].preferences
for d in prefs.devices:d.use=d.type!='CPU'
world=bpy.data.worlds.new('Rift / blue black');world.use_nodes=True;scene.world=world
bg=next(n for n in world.node_tree.nodes if n.type=='BACKGROUND');bg.inputs[0].default_value=(.006,.015,.1,1);bg.inputs[1].default_value=.3
ctrl=bpy.data.objects.new('RIFT / musical controls',None);scene.collection.objects.link(ctrl)
for k in ['keys','modulation','motion','kick']:ctrl[k]=.35 if k=='keys' else 0;ctrl.id_properties_ui(k).update(min=0,max=1)
settings=scene.osc_bridge_settings;settings.live_auto_objects=False
for key in ['keys','modulation','motion','kick']:
 m=settings.mappings.add();m.track_name='control.'+key;m.target_object=ctrl.name;m.target_data_path='["'+key+'"]';m.in_min=0;m.in_max=1;m.out_min=0;m.out_max=1

def drive(o,path,index,key,expression):
 f=o.driver_add(path,index);d=f.driver;v=d.variables.new();v.name='v';v.targets[0].id=ctrl;v.targets[0].data_path='["'+key+'"]';d.expression=expression

def glass(name,color,film):
 m=bpy.data.materials.new(name);m.use_nodes=True;n=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
 n.inputs['Base Color'].default_value=(*color,1);n.inputs['Transmission Weight'].default_value=1;n.inputs['Roughness'].default_value=.035;n.inputs['IOR'].default_value=1.46;n.inputs['Coat Weight'].default_value=.45;n.inputs['Coat Roughness'].default_value=.02;n.inputs['Thin Film Thickness'].default_value=film;n.inputs['Thin Film IOR'].default_value=1.35
 return m
mats=[glass('Rift / clear petrol glass',(.77,.92,1),420),glass('Rift / warm glass',(1,.86,.77),280),glass('Rift / acid glass',(.85,1,.71),520)]
# An invisible-to-camera luminous shell becomes the dense colour field inside the glass.
shellmat=bpy.data.materials.new('Rift / coral cobalt acid caustic field');shellmat.use_nodes=True;nt=shellmat.node_tree;nt.nodes.clear()
out=nt.nodes.new('ShaderNodeOutputMaterial');em=nt.nodes.new('ShaderNodeEmission');em.inputs['Strength'].default_value=3
tex=nt.nodes.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=1.25;tex.inputs['Detail'].default_value=2.5;tex.inputs['Roughness'].default_value=.65
coord=nt.nodes.new('ShaderNodeTexCoord');nt.links.new(coord.outputs['Generated'],tex.inputs['Vector'])
ramp=nt.nodes.new('ShaderNodeValToRGB');ramp.color_ramp.elements.remove(ramp.color_ramp.elements[1]);ramp.color_ramp.elements[0].position=.22;ramp.color_ramp.elements[0].color=(.002,.005,.055,1)
for at,c in [(.38,(.008,.035,1,1)),(.5,(1,.065,.025,1)),(.59,(.12,.015,.6,1)),(.68,(.46,1,.025,1)),(.8,(.02,.25,1,1))]:ramp.color_ramp.elements.new(at).color=c
nt.links.new(tex.outputs['Fac'],ramp.inputs[0]);nt.links.new(ramp.outputs[0],em.inputs[0]);nt.links.new(em.outputs[0],out.inputs[0])
bpy.ops.mesh.primitive_cylinder_add(vertices=96,radius=6.1,depth=48,location=(0,18,0),rotation=(math.pi/2,0,0));shell=bpy.context.object;shell.name='LIGHT FIELD / hidden from camera';shell.data.materials.append(shellmat);shell.visible_camera=False;shell.visible_shadow=False
# Thick irregular toroidal knots, tilted and staggered through a bent perspective corridor.
def knot(name,radius,phase,depth,mat):
 n=160;sides=10;verts=[];faces=[]
 def point(t):
  r=radius*(1+.18*math.sin(3*t+phase)+.065*math.sin(7*t-phase));return Vector((r*math.cos(t),.44*math.sin(2*t+phase),r*math.sin(t)))
 for j in range(n):
  t=j*math.tau/n;p=point(t);tangent=(point(t+.001)-p).normalized();normal=Vector((0,1,0));normal=(normal-tangent*normal.dot(tangent)).normalized();binormal=tangent.cross(normal);thick=.09+.052*(.5+.5*math.sin(4*t+phase))
  for k in range(sides):
   a=k*math.tau/sides;v=p+thick*(math.cos(a)*normal+math.sin(a)*binormal);verts.append(v)
 for j in range(n):
  for k in range(sides):faces.append((j*sides+k,((j+1)%n)*sides+k,((j+1)%n)*sides+(k+1)%sides,j*sides+(k+1)%sides))
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.materials.append(mat);o=bpy.data.objects.new(name,mesh);scene.collection.objects.link(o)
 o.location=(.9*math.sin(depth*.11),depth,.7*math.sin(depth*.15));o.rotation_euler.y=phase
 for p in mesh.polygons:p.use_smooth=True
 return o
for i in range(34):
 y=i*1.03;phase=i*.42
 for layer in range(2):
  o=knot('REFRACTION / folded aperture %02d-%d'%(i,layer),3.05+layer*.39,phase+layer*.7,y+layer*.27,mats[(i+layer)%3])
  drive(o,'rotation_euler',1,'modulation',f'{phase}+v*.23')
  drive(o,'scale',0,'keys','1+v*.055');drive(o,'scale',2,'keys','1+v*.055')
# Foreground shards, deliberately larger and clearly tied to the kick.
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1);proto=bpy.context.object;shardmesh=proto.data;shardmesh.materials.append(mats[0]);bpy.data.objects.remove(proto,do_unlink=True)
for i in range(180):
 t=random.random()*math.tau;y=random.uniform(-.5,32);r=random.uniform(1.6,3.4)
 o=bpy.data.objects.new('PULSE / refractive shard %03d'%i,shardmesh);scene.collection.objects.link(o);o.location=(r*math.cos(t)+.9*math.sin(y*.11),y,r*math.sin(t));o.rotation_euler=(random.random()*3,random.random()*3,random.random()*3)
 size=random.uniform(.022,.085)
 for axis,factor in enumerate([1,.7,2.4]):drive(o,'scale',axis,'kick',f'{size*factor}*(1+v*3.8)')
# Distant white-blue splinter, not a central solid ball.
star=bpy.data.materials.new('Rift / distant ice');star.use_nodes=True;bs=next(n for n in star.node_tree.nodes if n.type=='BSDF_PRINCIPLED');bs.inputs['Emission Color'].default_value=(.3,.55,1,1);bs.inputs['Emission Strength'].default_value=7
for i in range(9):
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=(.4,33,-.8));o=bpy.context.object;o.name='DISTANCE / ice splinter';o.scale=(.08,.08,.65+random.random());o.rotation_euler=(random.random()*3,random.random()*3,random.random()*3);o.data.materials.append(star)
camdata=bpy.data.cameras.new('Rift camera');cam=bpy.data.objects.new('Rift camera',camdata);scene.collection.objects.link(cam);scene.camera=cam;cam.location=(.35,-3.2,.4);cam.rotation_euler=(Vector((.25,17,-.4))-cam.location).to_track_quat('-Z','Y').to_euler();camdata.lens=21;cam.rotation_euler.rotate_axis('Z',.23)
for name,pos,col,power,size in [('Coral caustic key',(2,-1,2),(1,.12,.055),1100,1.1),('Cobalt reflection',(-2,2,-1),(.025,.1,1),1600,1.4),('Acid rim',(1,9,2),(.5,1,.05),900,.65)]:
 data=bpy.data.lights.new(name,'AREA');data.energy=power;data.color=col;data.shape='DISK';data.size=size;o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.location=pos;o.rotation_euler=(Vector((0,9,0))-o.location).to_track_quat('-Z','Y').to_euler()
# Subtle bloom, preserving the sharp refractive edges.
g=bpy.data.node_groups.new('Rift / optical bloom','CompositorNodeTree');scene.compositing_node_group=g
g.interface.new_socket(name='Image',in_out='OUTPUT',socket_type='NodeSocketColor');rl=g.nodes.new('CompositorNodeRLayers');rl.scene=scene;gl=g.nodes.new('CompositorNodeGlare');gl.inputs['Strength'].default_value=.12;gl.inputs['Threshold'].default_value=2;go=g.nodes.new('NodeGroupOutput');g.links.new(rl.outputs['Image'],gl.inputs['Image']);g.links.new(gl.outputs['Image'],go.inputs['Image'])
old=bpy.app.driver_namespace.get('rack_demo_refresh')
if old and bpy.app.timers.is_registered(old):bpy.app.timers.unregister(old)
def refresh_rift():
 ctrl.update_tag();scene.view_layers[0].update();return 1/30
bpy.app.driver_namespace['rack_demo_refresh']=refresh_rift;bpy.app.timers.register(refresh_rift)
for screen in bpy.data.screens:
 for area in screen.areas:
  if area.type=='VIEW_3D':
   area.spaces.active.region_3d.view_perspective='CAMERA';area.spaces.active.shading.type='MATERIAL';area.spaces.active.shading.use_scene_world=True;area.spaces.active.shading.use_scene_lights=True;area.spaces.active.overlay.show_overlays=False
live.start(57141)
scene['art_direction']='73.mp4: cobalt/coral/acid green, thick refractive glass, warped maximal corridor. Kick expands shards; pad breathes apertures; modulation rotates folds.'
bpy.ops.wm.save_as_mainfile(filepath='/home/mxjxn/Documents/ChatGPT/New project/rack-studio/demo/chromatic-rift.blend')
scene.render.filepath='/home/mxjxn/Documents/ChatGPT/New project/rack-studio/demo/rift-preview.png'
print('RIFT_READY',len(scene.objects))
