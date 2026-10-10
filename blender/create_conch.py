import bpy, math, os
from mathutils import Vector
from math import sin,cos,pi,exp
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
# Polished, sculptural gastropod with a continuous logarithmic spiral and a real open mouth.
mat=bpy.data.materials.new('Moonlit nacre • lavender and porcelain');mat.use_nodes=True
n=mat.node_tree.nodes;l=mat.node_tree.links;p=n.get('Principled BSDF')
p.inputs['Metallic'].default_value=.28;p.inputs['Roughness'].default_value=.24;p.inputs['Coat Weight'].default_value=.42;p.inputs['Coat Roughness'].default_value=.18
p.inputs['Subsurface Weight'].default_value=.06
noise=n.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=2.8;noise.inputs['Detail'].default_value=3
r=n.new('ShaderNodeValToRGB');r.color_ramp.elements[0].position=.18;r.color_ramp.elements[0].color=(.25,.12,.39,1);r.color_ramp.elements[1].position=.8;r.color_ramp.elements[1].color=(.92,.84,.64,1)
r.color_ramp.elements.new(.44).color=(.64,.48,.68,1);r.color_ramp.elements.new(.6).color=(.81,.91,.85,1)
l.new(noise.outputs['Fac'],r.inputs[0]);l.new(r.outputs[0],p.inputs['Base Color'])
inner=bpy.data.materials.new('Opalescent teal interior');inner.use_nodes=True
ip=inner.node_tree.nodes.get('Principled BSDF');ip.inputs['Base Color'].default_value=(.16,.49,.47,1);ip.inputs['Metallic'].default_value=.35;ip.inputs['Roughness'].default_value=.2;ip.inputs['Coat Weight'].default_value=.5
ip.inputs['Emission Color'].default_value=(.04,.38,.32,1);ip.inputs['Emission Strength'].default_value=.13
# xsection radial u and axial v, increasingly fluted and flared during the last turn
N=860; M=112; end=-2.35; start=end-6.6*pi
verts=[];faces=[]
def pos(i,j,inside=False):
    s=i/N; t=start+(end-start)*s; R=.035*exp(math.log(1.36/.035)*s)
    a=2*pi*j/M; flare=max(0,(s-.965)/.035)**2
    width=.70*R*(1+.30*flare); height=.95*R*(1+.12*flare)
    # Growth ribs and subtle secondary striae remain part of the geometry.
    rib=(.018+.012*s)*sin(t*24)+.005*sin(t*72)
    rr=1+rib
    if inside: width-=.025; height-=.025
    # Fluted frill at the broad outer edge of the opening.
    outer=max(0,cos(a))**5
    width*=1+.12*flare*outer*(1+.16*sin(a*11))
    x=(R+width*cos(a)*rr)*cos(t); y=(R+width*cos(a)*rr)*sin(t)
    z=1.8-1.48*R+height*sin(a)*rr
    # Elegant siphonal canal drawn down from the lower lip.
    canal=flare*max(0,-sin(a))**18
    z-=.58*canal;x+=.10*canal*cos(t);y+=.10*canal*sin(t)
    return (x,y,z)
for i in range(N+1):
 for j in range(M):verts.append(pos(i,j))
for i in range(N):
 for j in range(M):a=i*M+j;b=i*M+(j+1)%M;faces.append((a,b,b+M,a+M))
mesh=bpy.data.meshes.new('Continuous spiral nacre');mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new('The magic conch',mesh);bpy.context.collection.objects.link(o);o.data.materials.append(mat);o.data.materials.append(inner)
for p in mesh.polygons:p.use_smooth=True
solid=o.modifiers.new('Fine shell wall','SOLIDIFY');solid.thickness=.035;solid.material_offset=1
bev=o.modifiers.new('Soft organic edges','BEVEL');bev.width=.015;bev.segments=2
# Rolled rim picks up the studio light, defining a genuinely hollow aperture.
curve=bpy.data.curves.new('Hand-rolled nacre lip','CURVE');curve.dimensions='3D';curve.resolution_u=2;curve.bevel_depth=.035;curve.bevel_resolution=4
sp=curve.splines.new('POLY');sp.points.add(M-1)
for j,point in enumerate(sp.points):point.co=(*pos(N,j),1)
sp.use_cyclic_u=True;rim=bpy.data.objects.new('Luminous mouth rim',curve);bpy.context.collection.objects.link(rim);rim.data.materials.append(mat)
# Short shoulder spines emerge smoothly from the last two whorls.
for k in range(30):
 s=.67+k*.0096;t=start+(end-start)*s;R=.035*exp(math.log(1.36/.035)*s)
 a=.7; base=Vector(pos(s*N,a*M/(2*pi))); direction=Vector((cos(t)*.7,sin(t)*.7,.85)).normalized();length=.15*R
 # curved tapered mesh instead of detached cones
 vs=[];fs=[]
 b1=Vector((-sin(t),cos(t),0));b2=direction.cross(b1)
 for h in range(9):
  q=h/8; cen=base+direction*length*q + b1*length*.22*q*q; rad=.075*R*(1-q)**1.25+.0008
  for j in range(16):vs.append(cen+rad*(b1*cos(j*2*pi/16)+b2*sin(j*2*pi/16)))
 for h in range(8):
  for j in range(16):v=h*16+j;fs.append((v,h*16+(j+1)%16,(h+1)*16+(j+1)%16,v+16))
 me=bpy.data.meshes.new('Shoulder scallop');me.from_pydata(vs,[],fs);me.update();ob=bpy.data.objects.new('Natural shell spine',me);bpy.context.collection.objects.link(ob);me.materials.append(mat)
 for p in me.polygons:p.use_smooth=True
# Camera, lighting, and transparent studio backdrop.
def track(o,pt):o.rotation_euler=(Vector(pt)-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(6.2,-8.7,4.4));cam=bpy.context.object;track(cam,(0,0,.25));cam.data.type='ORTHO';cam.data.ortho_scale=5.65;bpy.context.scene.camera=cam
# slight diagonal composition achieved by rolling camera
cam.rotation_euler.rotate_axis('Z',math.radians(-14))
def area(name,loc,color,energy,size):
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=energy;o.data.color=color;o.data.shape='DISK';o.data.size=size;track(o,(0,0,.2))
area('Large warm silk', (1,-5,7),(1,.87,.71),900,5)
area('Turquoise rim',(-4,-1,2),(.19,1,.91),750,3)
area('Violet rim',(3,4,4),(.58,.34,1),1100,3)
area('Soft front',(5,-7,1),(.73,.84,1),220,4)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=96;scene.cycles.use_denoising=False
scene.world.color=(.13,.13,.13);scene.render.film_transparent=True
scene.render.resolution_x=1100;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.image_settings.color_depth='8';scene.render.image_settings.compression=100
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
scene.render.filepath='/workspace/scratch/899c62501baf/magic-conch/public/conch.png'
bpy.ops.wm.save_as_mainfile(filepath='/workspace/scratch/899c62501baf/conch-art/magic-conch.blend');bpy.ops.render.render(write_still=True)
