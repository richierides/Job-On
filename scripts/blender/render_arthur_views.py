import bpy, sys
from pathlib import Path
out=Path(sys.argv[sys.argv.index('--')+1]).resolve()
s=bpy.context.scene
# Make the plan's door/window positions explicit above the wall lintels.
top=bpy.data.objects['00 Verified plan'];top.data.ortho_scale=6.7
roof=bpy.data.objects['Ceiling'];roof.hide_render=True;bpy.data.objects['Oak and graphite pendant'].hide_render=True
for o in bpy.data.objects:
 if o.name.startswith('Plan label'):o.hide_render=False
markers=[]
for name,y,width in [('Top door marker',3.5,.8),('Bottom window marker',0,.9)]:
 bpy.ops.mesh.primitive_cube_add(size=1,location=(2.1,y,2.61));o=bpy.context.object;o.name=name;o.dimensions=(width,.08,.012);o.data.materials.append(bpy.data.materials['Warm LED diffuser']);markers.append(o)
s.camera=top;s.cycles.samples=24;s.render.filepath=str(out/'top-down.png');bpy.ops.render.render(write_still=True)
roof.hide_render=False;bpy.data.objects['Oak and graphite pendant'].hide_render=False
for o in bpy.data.objects:
 if o.name.startswith('Plan label') or o in markers:o.hide_render=True
s.cycles.samples=80
s.camera=bpy.data.objects['01 Entrance toward bottom window'];bpy.ops.wm.save_as_mainfile(filepath=str(out/'arthur-bedroom.blend'))
s.render.filepath=str(out/'arthur-bedroom.png');bpy.ops.render.render(write_still=True)
s.camera=bpy.data.objects['02 Bottom window toward top door'];s.render.filepath=str(out/'arthur-bedroom-second-view.png');bpy.ops.render.render(write_still=True)
print('V3_ALL_VIEWS_COMPLETE')
