"""Measured Hometaking room -> editable Blender scene and Cycles stills.
Run Blender --background --python scripts/blender/render_room.py -- input.json output_dir
Coordinates: plan cm, clockwise rotation; Blender metres, north is +Y, Z up.
"""
import bpy, json, math, sys, pathlib, base64
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:]; room=json.loads(pathlib.Path(args[0]).read_text()); out=pathlib.Path(args[1]).resolve();out.mkdir(parents=True,exist_ok=True)
if room.get('structure'):
 raise ValueError('Reviewed scan geometry requires the future structure-aware Blender importer. This legacy rectangular generator cannot render it faithfully.')
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
W,D,H=[room[k]/100 for k in ('width','depth','height')]
def material(name, colour, rough=.6, texture=None):
 m=bpy.data.materials.new(name);m.diffuse_color=(*colour,1);m.use_nodes=True;n=m.node_tree.nodes;p=n.get('Principled BSDF');p.inputs['Base Color'].default_value=(*colour,1);p.inputs['Roughness'].default_value=rough
 if texture:
  t=n.new('ShaderNodeTexNoise');t.inputs['Scale'].default_value=texture;t.inputs['Detail'].default_value=3
  bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.18;bump.inputs['Distance'].default_value=.018 if texture<30 else .002
  m.node_tree.links.new(t.outputs['Fac'],bump.inputs['Height']);m.node_tree.links.new(bump.outputs['Normal'],p.inputs['Normal'])
 return m
def rgb(h):
 # UI hex is sRGB; Blender shader colour uses linear values.
 a=[int(h[i:i+2],16)/255 for i in (1,3,5)];return tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in a)
wall=material('Saved slate wall finish',rgb(room['wallColour']),.88,100)
oak=material('Warm natural oak',(.30,.18,.09),.5,7);cream=material('Oatmeal woven linen',(.66,.60,.47),.85,180)
black=material('Graphite powder coated metal',(.025,.03,.032),.4);green=material('Forest green woven textile',(.06,.12,.09),.85,180)
paper=material('Warm paper',(.78,.75,.65),.8);cork=material('Natural cork',(.30,.16,.065),.95,90)
metal=material('Brushed brass',(.38,.24,.075),.3);metal.node_tree.nodes.get('Principled BSDF').inputs['Metallic'].default_value=.72
white=material('Ceiling chalk',(.75,.73,.68),.85)
def cube(name,loc,size,mat,bevel=0,parent=None):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if parent:o.parent=parent;o.location=loc
 o.data.materials.append(mat)
 if bevel:
  mod=o.modifiers.new('Soft manufactured edges','BEVEL');mod.width=min(bevel,min(size)*.3);mod.segments=4
  norm=o.modifiers.new('Weighted surface normals','WEIGHTED_NORMAL')
 return o
def sphere(name,loc,size,mat,parent=None):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=16,location=loc);o=bpy.context.object;o.name=name;o.scale=size
 if parent:o.parent=parent;o.location=loc
 o.data.materials.append(mat)
 for poly in o.data.polygons:poly.use_smooth=True
 return o
def rod(name,a,b,r,mat,parent=None):
 a,b=Vector(a),Vector(b);v=b-a;bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=r,depth=v.length,location=(a+b)/2);o=bpy.context.object;o.name=name;o.rotation_euler=v.to_track_quat('Z','Y').to_euler()
 if parent:o.parent=parent;o.location=(a+b)/2
 o.data.materials.append(mat)
 for poly in o.data.polygons:poly.use_smooth=True
 return o
# Floor planks stay within the exact room footprint.
cube('Subfloor exact room footprint',(W/2,D/2,-.055),(W,D,.1),oak)
for j in range(math.ceil(D/.18)):
 y0=j*.18;y1=min(D,y0+.18)
 for k in range(4):
  x0=k*W/4;x1=(k+1)*W/4
  cube('Oak floorboard',((x0+x1)/2,(y0+y1)/2,-.006),(x1-x0-.002,y1-y0-.002,.012),oak,.001)
# Build wall segments around the recorded openings. No invented windows.
for side,length in [('north',W),('south',W),('east',D),('west',D)]:
 openings=[]
 for it in room['items']:
  if it['kind'] not in ('door','window'):continue
  inferred=min({'north':it['y'],'south':room['depth']-it['y'],'west':it['x'],'east':room['width']-it['x']},key=lambda k:{'north':it['y'],'south':room['depth']-it['y'],'west':it['x'],'east':room['width']-it['x']}[k])
  if it.get('wall',inferred)!=side:continue
  centre=(it['x'] if side in ('north','south') else room['depth']-it['y'])/100
  low=0 if it['kind']=='door' else max(.3,(H-it['height']/100)/2)
  openings.append((max(0,centre-it['width']/200),min(length,centre+it['width']/200),low,min(H,low+it['height']/100)))
 cuts=sorted(set([0,length]+[v for a,b,_,_ in openings for v in (a,b)]))
 for a,b in zip(cuts,cuts[1:]):
  op=next((o for o in openings if o[0]<(a+b)/2<o[1]),None)
  for low,high in ([(0,op[2]),(op[3],H)] if op else [(0,H)]):
   if high-low<.001:continue
   loc=((a+b)/2,D+.06 if side=='north' else -.06,(low+high)/2) if side in ('north','south') else (W+.06 if side=='east' else -.06,(a+b)/2,(low+high)/2)
   size=(b-a,.12,high-low) if side in ('north','south') else (.12,b-a,high-low)
   cube(side+' measured wall',loc,size,wall)
  if not op:
   loc=((a+b)/2,D-.007 if side=='north' else .007,.055) if side in ('north','south') else (W-.007 if side=='east' else .007,(a+b)/2,.055)
   cube('Skirting',loc,(b-a,.014,.11) if side in ('north','south') else (.014,b-a,.11),wall,.002)
cube('Ceiling',(W/2,D/2,H+.035),(W,D,.07),white)
roots=[]
for it in room['items']:
 if it['kind']=='door':
  # Door kept closed at its exact recorded north-wall opening for this interior view.
  if it.get('wall')=='north':
   x=it['x']/100;w=it['width']/100;h=it['height']/100
   cube('Recorded door leaf',(x,D+.018,h/2),(w,.035,h),oak,.004)
   for dx in (-w/2,w/2):cube('Door frame',(x+dx,D-.015,h/2),(.04,.045,h+.04),oak,.003)
   cube('Door lintel',(x,D-.015,h+.02),(w+.04,.045,.04),oak,.003)
  continue
 if it['kind']!='furniture':continue
 w,d,h=[it[k]/100 for k in ('width','depth','height')];kind=it.get('archetype',it['name']).lower()
 root=bpy.data.objects.new(it['name']+' | '+it['id'],None);bpy.context.collection.objects.link(root);root.location=(it['x']/100,D-it['y']/100,0);root.rotation_euler.z=-math.radians(it['rotation']);root['source_item_id']=it['id'];root['width_cm']=it['width'];root['depth_cm']=it['depth'];root['height_cm']=it['height'];roots.append((root,it))
 cloth=material(it['name']+' saved terracotta',rgb(it['colour']),.82,160)
 def box(n,x,y,z,sx,sy,sz,m=cloth,b=.02):return cube(n,(x*w,y*d,z*h),(sx*w,sy*d,sz*h),m,b,root)
 if 'bed' in kind:
  box('Upholstered headboard',0,.473,.5,1,.054,1,b=.045)
  box('Bed frame',0,0,.20,1,.96,.30,b=.035)
  for x in (-.4,.4):
   for y in (-.4,.4):box('Inset oak bed foot',x,y,.055,.07,.07,.11,oak)
  box('Mattress',0,-.02,.425,.94,.89,.19,cream,.04)
  # Shaped duvet with restrained ripples, actual geometry rather than a flat image.
  verts=[];faces=[];nx=40;ny=48
  for j in range(ny+1):
   y=(-.46+j/ny*.69)*d
   for i in range(nx+1):
    x=(-.47+i/nx*.94)*w;z=.539*h+.008*math.sin(i*.6+j*.22)+.004*math.sin(j*.95)
    verts.append((x,y,z))
  for j in range(ny):
   for i in range(nx):a=j*(nx+1)+i;faces.append((a,a+1,a+nx+2,a+nx+1))
  mesh=bpy.data.meshes.new('Duvet folds');mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new('Soft duvet',mesh);bpy.context.collection.objects.link(o);o.parent=root;o.data.materials.append(green);mod=o.modifiers.new('Duvet thickness','SOLIDIFY');mod.thickness=.016
  for poly in mesh.polygons:poly.use_smooth=True
  for x in (-.23,.23):
   o=box('Soft linen pillow',x,.32,.575,.41,.23,.13,cream,.065)
   o.rotation_euler.z=x*.12
   sub=o.modifiers.new('Soft pillow surface','SUBSURF');sub.levels=2
   tex=bpy.data.textures.new('Pillow irregularities',type='CLOUDS');tex.noise_scale=.12
   dis=o.modifiers.new('Subtle pillow folds','DISPLACE');dis.texture=tex;dis.strength=.006
  for x in (-.33,0,.33):box('Headboard upholstery seam',x,.441,.55,.003,.003,.73,cream,.001)
  for j in range(9):
   box('Folded throw soft ridge',0,-.30+j*.016,.558+math.sin(j*.7)*.003,.92,.035,.024,cream,.009)
 elif 'office chair' in kind:
  rod('Chair stem',(0,0,.09),(0,0,.46),.028,black,root)
  for i in range(5):
   a=i*math.tau/5;x=.42*w*math.cos(a);y=.42*d*math.sin(a);rod('Five-star base',(0,0,.1),(x,y,.07),.018,black,root);sphere('Caster',(x,y,.035),(.035,.028,.035),black,root)
  box('Contoured seat',0,-.03,.45,.79,.77,.09,b=.035);box('Chair back',0,.40,.75,.78,.13,.5,b=.04)
  for x in (-.44,.44):box('Arm support',x,0,.53,.055,.055,.22,black);box('Arm pad',x,-.03,.66,.09,.57,.035,black)
 elif 'chair' in kind:
  for x in (-.38,.38):
   for y in (-.36,.36):box('Armchair foot',x,y,.09,.055,.055,.18,oak)
  box('Armchair base',0,0,.28,.92,.94,.22);box('Seat cushion',0,-.035,.46,.74,.80,.18,cream,.045)
  box('Back cushion',0,.41,.71,.92,.18,.58,b=.055)
  for x in (-.44,.44):box('Upholstered arm',x,-.015,.46,.12,.96,.5,b=.035)
  sphere('Accent cushion',(0,.20*d,.65*h),(.23*w,.105*d,.22*h),green,root)
 elif 'desk' in kind:
  box('Oak desk top',0,0,.974,1,1,.052,oak,.009)
  for x in (-.43,.43):
   for y in (-.39,.39):box('Desk leg',x,y,.46,.045,.045,.92,black,.004)
  box('Shallow drawer',-.22,.0,.85,.43,.84,.16,oak,.006)
  # Proposed work/gaming accessories, separate from the locked furniture envelope.
  box('PROPOSED monitor foot',0,.20,1.014,.23,.24,.025,black,.005)
  box('PROPOSED monitor stem',0,.29,1.18,.03,.035,.31,black,.003)
  box('PROPOSED monitor',0,.29,1.45,.49,.05,.46,black,.009)
  screen=material('Muted screen',(.07,.16,.17),.3);p=screen.node_tree.nodes.get('Principled BSDF');p.inputs['Emission Color'].default_value=(.06,.18,.2,1);p.inputs['Emission Strength'].default_value=.25
  box('Monitor display',0,.262,1.45,.465,.005,.415,screen,.001)
  box('Keyboard',0,-.20,1.015,.34,.21,.022,black,.003)
  for row in range(4):
   for col in range(12):box('Keyboard key',-.15+col*.027,-.27+row*.045,1.03,.02,.03,.008,paper,.0004)
  sphere('Mouse',(.31*w,-.21*d,h+.019),(.027,.047,.016),black,root)
  box('Homework notebook',-.32,-.18,1.02,.20,.34,.025,paper,.003)
  # Wall board above desk, flush to the existing wall, clearly proposed.
  box('PROPOSED corkboard frame',0,.49,1.99,.85,.035,.69,oak,.005)
  box('PROPOSED corkboard',0,.469,1.99,.80,.008,.63,cork,.001)
  for x,y,z in [(-.22,.462,2.05),(.15,.462,1.9)]:
   box('PROPOSED pinned note',x,y,z,.13,.006,.18,paper,.001)
   sphere('Pin',(x*w,(y-.01)*d,(z+.075)*h),(.005,.003,.005),metal,root)
 else:box('Furniture',0,0,.5,1,1,1)
# Use the saved inspiration as a proposed framed print above the bed.
if room.get('ideas'):
 uri=room['ideas'][0]['image']
 if uri.startswith('data:'):
  f=out/'reference.png';f.write_bytes(base64.b64decode(uri.split(',')[1]));m=material('Saved Zelda reference artwork',(.7,.7,.7));n=m.node_tree.nodes.new('ShaderNodeTexImage');n.image=bpy.data.images.load(str(f));m.node_tree.links.new(n.outputs['Color'],m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
  cube('PROPOSED artwork frame',(.75,.035,1.65),(1.02,.04,.70),oak,.006)
  bpy.ops.mesh.primitive_plane_add(size=1,location=(.75,.058,1.65));o=bpy.context.object;o.name='PROPOSED Zelda print';o.rotation_euler=(math.pi/2,0,0);o.scale=(.94,.62,1);o.data.materials.append(m)
def light(name,loc,target,power,size,colour):
 data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;data.color=colour;o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
# Visible proposed ceiling fixtures provide all main room illumination.
for x,y in [(1.05,1.2),(3.1,1.2),(2.1,2.8)]:
 cube('PROPOSED ceiling light housing',(x,y,H-.025),(.32,.32,.05),white,.015)
 em=material('Warm luminous diffuser',(.8,.7,.5));p=em.node_tree.nodes.get('Principled BSDF');p.inputs['Emission Color'].default_value=(1,.83,.65,1);p.inputs['Emission Strength'].default_value=3
 cube('Visible light diffuser',(x,y,H-.052),(.28,.28,.004),em,.008)
 light('Ceiling warm diffuser',(x,y,H-.056),(x,y,0),110,.30,(1,.83,.65))
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=80;scene.cycles.use_denoising=True
scene.world.color=(.04,.04,.04);scene.render.resolution_x=1400;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG';scene.unit_settings.system='METRIC'
camdata=bpy.data.cameras.new('Interior camera');cam=bpy.data.objects.new('Interior camera',camdata);bpy.context.collection.objects.link(cam);scene.camera=cam;camdata.lens=20;camdata.clip_start=.03
cam.location=(2.05,3.30,1.68);cam.rotation_euler=(Vector((2.10,.75,1.15))-cam.location).to_track_quat('-Z','Y').to_euler()
# Validate root transforms before rendering; decorative accessories do not move base furniture.
for root,it in roots:
 assert abs(root.location.x-it['x']/100)<1e-5 and abs(root.location.y-(D-it['y']/100))<1e-5
 assert abs(root.rotation_euler.z+math.radians(it['rotation']))<1e-5
scene['source_room_json']=json.dumps(room);scene['measured_room_metres']=f'{W} x {D} x {H}'
scene['proposals']='Desk monitor, keyboard, notebook, corkboard, Zelda print, ceiling lights. No new storage footprint or window.'
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(out/'arthur-bedroom.blend'))
scene.render.filepath=str(out/'arthur-bedroom.png');bpy.ops.render.render(write_still=True)
reverse=cam.copy();reverse.data=cam.data.copy();reverse.name='Reverse interior camera';bpy.context.collection.objects.link(reverse);cam=reverse;camdata=reverse.data
cam.location=(1.8,.22,1.60);cam.rotation_euler=(Vector((2.65,2.65,.95))-cam.location).to_track_quat('-Z','Y').to_euler();camdata.lens=20
bpy.ops.wm.save_as_mainfile(filepath=str(out/'arthur-bedroom.blend'))
scene.camera=cam
scene.render.filepath=str(out/'arthur-bedroom-second-view.png');bpy.ops.render.render(write_still=True)
print('HOMETAKING_RENDER_COMPLETE')
