"""Measured Hometaking room -> editable Blender scene and Cycles stills.
Run Blender --background --python scripts/blender/render_room.py -- input.json output_dir
Coordinates: plan cm, clockwise rotation; Blender metres, north is +Y, Z up.
"""
import bpy, json, math, sys, pathlib, base64
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:]; room=json.loads(pathlib.Path(args[0]).read_text()); out=pathlib.Path(args[1]).resolve();out.mkdir(parents=True,exist_ok=True)
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
oak=material('Warm natural oak',(.30,.21,.125),.5,7);cream=material('Oatmeal woven linen',(.66,.60,.47),.85,180)
black=material('Graphite powder coated metal',(.025,.03,.032),.4);green=material('Forest green woven textile',(.075,.115,.16),.85,180)
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
  low=0 if it['kind']=='door' else it.get('sill',85)/100
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
 if it['kind']=='window':
  x=it['x']/100;ww=it['width']/100;hh=it['height']/100;sill=it.get('sill',85)/100
  for dx in (-ww/2,ww/2):cube('Provisional window jamb',(x+dx,-.035,sill+hh/2),(.045,.13,hh+.08),oak,.003)
  for z in (sill,sill+hh/2,sill+hh):cube('Window sash rail',(x,-.035,z),(ww,.10,.045),oak,.003)
  cube('Deep window sill',(x,.045,sill-.025),(ww+.10,.28,.04),white,.004)
  glass=material('Window glass',(.8,.9,.96),.08);glass.node_tree.nodes.get('Principled BSDF').inputs['Transmission Weight'].default_value=1
  cube('Window glazing',(x,-.085,sill+hh/2),(ww-.045,.008,hh-.045),glass)
  cube('Exterior pale view',(x,-1.5,1.4),(4,.02,3),material('Distant overcast sky',(.62,.71,.77)))
  continue
 if it['kind']!='furniture':continue
 w,d,h=[it[k]/100 for k in ('width','depth','height')];kind=it.get('archetype',it['name']).lower()
 root=bpy.data.objects.new(it['name']+' | '+it['id'],None);bpy.context.collection.objects.link(root);root.location=(it['x']/100,D-it['y']/100,0);root.rotation_euler.z=-math.radians(it['rotation']);root['source_item_id']=it['id'];root['width_cm']=it['width'];root['depth_cm']=it['depth'];root['height_cm']=it['height'];roots.append((root,it))
 cloth=material(it['name']+' upholstery',rgb(it['colour']),.82,160)
 def box(n,x,y,z,sx,sy,sz,m=cloth,b=.02):return cube(n,(x*w,y*d,z*h),(sx*w,sy*d,sz*h),m,b,root)
 if 'bed' in kind:
  box('Upholstered headboard',0,.473,.5,1,.054,1,b=.045)
  box('Oak bed frame',0,0,.20,1,.96,.30,oak,b=.018)
  for y in (-.24,.23):
   box('Storage drawer face',-.495,y,.22,.01,.43,.23,oak,.003)
   box('Recessed drawer pull',-.502,y,.285,.005,.14,.012,black,.001)
  for x in (-.4,.4):
   for y in (-.4,.4):box('Inset oak bed foot',x,y,.055,.07,.07,.11,oak)
  box('Mattress',0,-.02,.425,.94,.89,.19,cream,.04)
  # Shaped duvet with restrained ripples, actual geometry rather than a flat image.
  verts=[];faces=[];nx=40;ny=48
  for j in range(ny+1):
   y=(-.46+j/ny*.69)*d
   for i in range(nx+1):
    x=(-.495+i/nx*.99)*w;edge=max(0,(abs(x/w)-.42)/.075);z=.548*h-.13*edge**1.5+.007*math.sin(i*.61+j*.22)+.004*math.sin(j*.95+i*.13)
    verts.append((x,y,z))
  for j in range(ny):
   for i in range(nx):a=j*(nx+1)+i;faces.append((a,a+1,a+nx+2,a+nx+1))
  mesh=bpy.data.meshes.new('Duvet folds');mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new('Soft duvet',mesh);bpy.context.collection.objects.link(o);o.parent=root;o.data.materials.append(green);mod=o.modifiers.new('Duvet thickness','SOLIDIFY');mod.thickness=.016
  for poly in mesh.polygons:poly.use_smooth=True
  for x in (0,):
   o=box('Soft linen pillow',x,.32,.575,.72,.23,.15,cream,.065)
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
  # Articulated monitor arm, with screen facing across the aisle toward the bed.
  rod('Arm clamp post',(.30*w,.40*d,.76),(.30*w,.40*d,1.02),.018,black,root)
  rod('Swivel arm segment A',(.30*w,.40*d,1.02),(.10*w,.26*d,1.17),.016,black,root)
  rod('Swivel arm segment B',(.10*w,.26*d,1.17),(-.08*w,.14*d,1.15),.016,black,root)
  for pt in [(.30*w,.40*d,1.02),(.10*w,.26*d,1.17),(-.08*w,.14*d,1.15)]:sphere('Arm pivot',pt,(.024,.024,.024),black,root)
  screenroot=bpy.data.objects.new('Swivel screen assembly',None);bpy.context.collection.objects.link(screenroot);screenroot.parent=root;screenroot.location=(-.08*w,.14*d,1.15);screenroot.rotation_euler.z=.12
  cube('Thin monitor housing',(0,0,0),(.60,.036,.35),black,.009,screenroot)
  screen=material('Subtle screen landscape',(.06,.10,.12),.3)
  cube('Monitor display',(0,-.02,0),(.574,.003,.326),screen,.002,screenroot)
  box('Keyboard',0,-.20,1.015,.34,.21,.022,black,.003)
  for row in range(4):
   for col in range(12):box('Keyboard key',-.15+col*.027,-.27+row*.045,1.03,.02,.03,.008,paper,.0004)
  sphere('Mouse',(.31*w,-.21*d,h+.019),(.027,.047,.016),black,root)
  box('Homework notebook',-.32,-.18,1.02,.20,.34,.025,paper,.003)
  # Proposed 120cm desk wall: practical storage, warm integrated light, headphones.
  for i in range(33):cube('Oak slat backing',(-.576+i*.036,.285,1.45),(.023,.025,1.40),oak,.002,root)
  emitter=material('Warm LED diffuser',(.8,.58,.25));ep=emitter.node_tree.nodes.get('Principled BSDF');ep.inputs['Emission Color'].default_value=(1,.68,.34,1);ep.inputs['Emission Strength'].default_value=4
  for z in (1.45,1.85):
   cube('Graphite shelf',(0,.19,z),(1.20,.22,.028),black,.005,root)
   cube('Concealed LED',(0,.09,z-.017),(1.12,.012,.006),emitter,.001,root)
   data=bpy.data.lights.new('Shelf task light','AREA');data.energy=22;data.shape='RECTANGLE';data.size=1.05;data.size_y=.05;data.color=(1,.78,.52);o=bpy.data.objects.new('Shelf task light',data);bpy.context.collection.objects.link(o);o.parent=root;o.location=(0,.10,z-.022)
  for i in range(7):
   bm=material('Book cover '+str(i),[(.18,.22,.24),(.5,.45,.34),(.15,.25,.24)][i%3]);x=-.52+i*.038
   cube('Book',(x,.19,1.97+i%3*.013),(.028,.14,.22+i%3*.026),bm,.001,root)
   cube('Book spine rule',(x,.117,1.97),(.024,.003,.008),cream,0,root)
  cube('Equipment storage box',(.30,.18,1.95),(.26,.18,.17),cloth,.008,root)
  cube('Box label',(.30,.086,1.96),(.05,.002,.018),paper,.001,root)
  cube('Speaker',(.43,.15,1.57),(.14,.15,.21),black,.01,root)
  sphere('Speaker driver',(.43,.073,1.56),(.048,.007,.048),cloth,root)
  cube('Accessory rail',(-.40,.258,1.27),(.28,.03,.024),black,.003,root)
  rod('Headphone hook',(-.40,.24,1.27),(-.40,.15,1.27),.008,black,root)
  for side in (-1,1):sphere('Headphone earcup',(-.40+side*.065,.14,1.13),(.026,.025,.045),black,root)
  for j in range(16):
   a=j*math.pi/15;b=(j+1)*math.pi/15
   rod('Headphone headband',(-.4+.07*math.cos(a),.14,1.16+.09*math.sin(a)),(-.4+.07*math.cos(b),.14,1.16+.09*math.sin(b)),.006,black,root)
 elif 'wardrobe' in kind:
  box('Wardrobe carcass',0,0,.5,1,1,1,oak,.006)
  for x in (-.249,.249):
   box('Graphite wardrobe door',x,-.493,.51,.486,.014,.96,cloth,.004)
   box('Recessed wardrobe handle',x/5,-.504,.50,.012,.009,.15,black,.002)
 else:box('Furniture',0,0,.5,1,1,1)
def light(name,loc,target,power,size,colour):
 data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;data.color=colour;o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
# Restrained architectural trim, measured rectangular ceiling retained.
for z,thick,projection in [(H-.035,.055,.065),(H-.080,.025,.035)]:
 for side in ('north','south'):
  cube('Cornice',(W/2,D-projection/2 if side=='north' else projection/2,z),(W,projection,thick),white,.006)
 for side in ('east','west'):
  cube('Cornice',(W-projection/2 if side=='east' else projection/2,D/2,z),(projection,D,thick),white,.006)
# Radiator beside the entry, size and offset are explicitly provisional.
for i in range(18):cube('PROVISIONAL radiator fin',(2.96+i*.045,D-.075,.59),(.032,.08,.56),white,.005)
for z in (.32,.86):cube('Radiator rail',(3.345,D-.075,z),(.84,.09,.025),white,.005)
rod('Radiator valve',(3.8,D-.08,.38),(3.89,D-.08,.38),.018,white)
# Quiet reading light and warm pendant, plus daylight through the real bottom-wall opening.
light('Daylight through provisional south window',(2.1,-.15,1.6),(1.1,2.3,.55),220,.8,(.78,.87,1))
light('Pendant bounce',(2.1,1.9,2.04),(2.1,1.9,0),65,.42,(1,.82,.60))
rod('Pendant flex',(2.1,1.9,H),(2.1,1.9,2.12),.008,black)
bpy.ops.mesh.primitive_cone_add(vertices=64,radius1=.19,radius2=.095,depth=.15,location=(2.1,1.9,2.12));pendant=bpy.context.object;pendant.name='Oak and graphite pendant';pendant.data.materials.append(black)
light('Bed reading light',(.12,.25,1.30),(.60,.55,.55),12,.10,(1,.76,.48))
rod('Reading lamp arm',(.06,.20,1.30),(.20,.28,1.30),.014,black)
# Soft rug, clear of desk-chair casters.
rug=material('Woven oatmeal rug',(.32,.30,.25),.95,210);cube('Central rug',(1.9,1.60,.008),(1.35,1.9,.014),rug,.004)
# Procedural oak grain at a plausible furniture scale, not broad random bumps.
for mat in [oak]:
 n=mat.node_tree.nodes;links=mat.node_tree.links;bs=n.get('Principled BSDF');coords=n.new('ShaderNodeTexCoord');mapping=n.new('ShaderNodeVectorMath');mapping.operation='MULTIPLY';mapping.inputs[1].default_value=(3,75,4);links.new(coords.outputs['Generated'],mapping.inputs[0]);noise=n.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=3;noise.inputs['Detail'].default_value=2;links.new(mapping.outputs[0],noise.inputs['Vector']);ramp=n.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].position=.15;ramp.color_ramp.elements[0].color=(.19,.12,.060,1);ramp.color_ramp.elements[1].position=.85;ramp.color_ramp.elements[1].color=(.40,.29,.16,1);links.new(noise.outputs['Fac'],ramp.inputs['Fac']);links.new(ramp.outputs['Color'],bs.inputs['Base Color'])
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=64;scene.cycles.use_denoising=True
scene.world.use_nodes=True;scene.world.node_tree.nodes.get('Background').inputs[0].default_value=(.50,.60,.75,1);scene.world.node_tree.nodes.get('Background').inputs[1].default_value=.12
scene.render.resolution_x=1400;scene.render.resolution_y=1000;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG';scene.unit_settings.system='METRIC'
# Verify floor bounds and non-overlap in the model, not only by looking at an image.
rects=[]
for root,it in roots:
 expected=(it['x']/100,D-it['y']/100,0)
 assert max(abs(a-b) for a,b in zip(root.location,expected))<1e-5
 assert abs(root.rotation_euler.z+math.radians(it['rotation']))<1e-5
 a=math.radians(it['rotation']);ex=(abs(math.cos(a))*it['width']+abs(math.sin(a))*it['depth'])/200;ey=(abs(math.sin(a))*it['width']+abs(math.cos(a))*it['depth'])/200
 x,y=root.location.x,root.location.y;rect=(x-ex,x+ex,y-ey,y+ey)
 assert rect[0]>=-1e-5 and rect[1]<=W+1e-5 and rect[2]>=-1e-5 and rect[3]<=D+1e-5
 for name,r in rects:assert min(rect[1],r[1])-max(rect[0],r[0])<.001 or min(rect[3],r[3])-max(rect[2],r[2])<.001,(name,it['name'])
 rects.append((it['name'],rect))
assert next(i for i in room['items'] if i['kind']=='door')['wall']=='north'
assert next(i for i in room['items'] if i['kind']=='window')['wall']=='south'
(out/'verification.json').write_text(json.dumps({'room_cm':[room['width'],room['depth'],room['height']],'door_wall':'top / north','window_wall':'bottom / south','furniture_bounds_metres':rects,'overlaps':False,'assumptions':['Window centred on bottom wall, 90cm wide x130cm high, sill85cm','Radiator on top wall beside door,84cm wide x56cm high','Ceiling flat at240cm; unmeasured slope deliberately omitted','New furniture positions and sizes are design proposals; source plan retained separately']},indent=2))
scene['design_room_json']=json.dumps(room);scene['assumptions']='Window width/offset/sill and radiator dimensions/offset provisional. No angled floor wall. Flat ceiling pending scan.'
def camera(name,loc,target,lens=23):
 data=bpy.data.cameras.new(name);data.lens=lens;data.clip_start=.025;o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler();return o
main=camera('01 Entrance toward bottom window',(2.1,3.32,1.60),(2.1,.65,1.12),22)
reverse=camera('02 Bottom window toward top door',(2.1,.18,1.58),(2.1,2.9,1.18),22)
top=camera('00 Verified plan',(W/2,D/2,8),(W/2,D/2,0));top.rotation_euler=(0,0,0);top.data.type='ORTHO';top.data.ortho_scale=5.9
scene.camera=main;bpy.ops.wm.save_as_mainfile(filepath=str(out/'arthur-bedroom.blend'))
# A labelled top-down inspection view precedes either perspective render.
roof=bpy.data.objects.get('Ceiling');roof.hide_render=True;pendant.hide_render=True
labels=[]
for text,loc,size in [('TOP / DOOR',(1.45,D+.24,2.60),.16),('BOTTOM / WINDOW - provisional',(1.02,-.30,2.60),.115),('4.20 m x 3.50 m | rectangular footprint',(.65,-.62,2.60),.12)]:
 bpy.ops.object.text_add(location=loc);o=bpy.context.object;o.name='Plan label';o.data.body=text;o.data.size=size;o.data.materials.append(black);labels.append(o)
scene.camera=top;scene.cycles.samples=24;scene.render.filepath=str(out/'top-down.png');bpy.ops.render.render(write_still=True)
for o in labels:o.hide_render=True
roof.hide_render=False;pendant.hide_render=False
scene.cycles.samples=64;scene.camera=main
bpy.ops.wm.save_as_mainfile(filepath=str(out/'arthur-bedroom.blend'))
if '--plan-only' not in sys.argv:
 scene.render.filepath=str(out/'arthur-bedroom.png');bpy.ops.render.render(write_still=True)
 scene.camera=reverse;scene.render.filepath=str(out/'arthur-bedroom-second-view.png');bpy.ops.render.render(write_still=True)
print('ARTHUR_V3_COMPLETE')
