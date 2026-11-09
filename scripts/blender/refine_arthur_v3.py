import bpy, math, sys
from pathlib import Path
out=Path(sys.argv[sys.argv.index('--')+1]).resolve()
# Do not let the daylight emitter appear as a bright disc through the window.
glass=bpy.data.materials['Window glass'];nodes=glass.node_tree.nodes;nodes.clear();shader=nodes.new('ShaderNodeBsdfTransparent');output=nodes.new('ShaderNodeOutputMaterial');glass.node_tree.links.new(shader.outputs[0],output.inputs['Surface'])
light=bpy.data.objects['Daylight through provisional south window'];light.visible_camera=False;light.visible_glossy=False;light.visible_transmission=False
sky=bpy.data.materials['Distant overcast sky'];p=sky.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(.65,.76,.9,1);p.inputs['Emission Color'].default_value=(.65,.76,.9,1);p.inputs['Emission Strength'].default_value=.6
# Keep the duvet above the mattress until its edges fall outside the mattress sides.
duvet=bpy.data.objects['Soft duvet'];w=1.;h=1.05
for j in range(49):
 for i in range(41):
  v=duvet.data.vertices[j*41+i];edge=max(0,(abs(v.co.x/w)-.465)/.03);v.co.z=.565*h-.13*edge**1.5+.006*math.sin(i*.61+j*.22)+.003*math.sin(j*.95+i*.13)
for o in list(bpy.data.objects):
 if o.name.startswith('Folded throw soft ridge'):bpy.data.objects.remove(o,do_unlink=True)
# A continuous draped throw instead of stacked rigid bars.
verts=[];faces=[]
for j in range(13):
 for i in range(41):
  x=(-.495+i/40*.99);edge=max(0,(abs(x)-.465)/.03);y=(-.33+j/12*.22)*2
  jd=(y/2+.46)/.69*48
  z=.565*1.05-.13*edge**1.5+.006*math.sin(i*.61+jd*.22)+.003*math.sin(jd*.95+i*.13)+.025
  verts.append((x,y,z))
for j in range(12):
 for i in range(40):a=j*41+i;faces.append((a,a+1,a+42,a+41))
mesh=bpy.data.meshes.new('Continuous throw');mesh.from_pydata(verts,[],faces);mesh.update();obj=bpy.data.objects.new('Draped linen throw',mesh);bpy.context.collection.objects.link(obj);obj.parent=duvet.parent;obj.data.materials.append(bpy.data.materials['Oatmeal woven linen']);mod=obj.modifiers.new('Throw thickness','SOLIDIFY');mod.thickness=.008
for p in mesh.polygons:p.use_smooth=True
scene=bpy.context.scene;scene.cycles.samples=80;scene.camera=bpy.data.objects['01 Entrance toward bottom window'];bpy.ops.wm.save_as_mainfile(filepath=str(out/'arthur-bedroom.blend'));scene.render.filepath=str(out/'arthur-bedroom.png');bpy.ops.render.render(write_still=True)
scene.camera=bpy.data.objects['02 Bottom window toward top door'];scene.render.filepath=str(out/'arthur-bedroom-second-view.png');bpy.ops.render.render(write_still=True)
print('CORRECTED_V3_COMPLETE')
