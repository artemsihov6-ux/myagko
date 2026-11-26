"""Build the original Мягко collection. Run in Blender background mode."""
import bpy
import math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
collection = None

def material(name, color, roughness=.8, cloth=False):
    def linear(x):
        return x / 12.92 if x < .04045 else ((x + .055) / 1.055) ** 2.4
    rgb = tuple(linear(int(color[i:i+2], 16) / 255) for i in (0, 2, 4))
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*rgb, 1)
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (*rgb, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    if cloth:
        bsdf.inputs['Sheen Weight'].default_value = .18
        noise = m.node_tree.nodes.new('ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value = 245
        bump = m.node_tree.nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = .12
        bump.inputs['Distance'].default_value = .023
        m.node_tree.links.new(noise.outputs['Fac'], bump.inputs['Height'])
        m.node_tree.links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    return m

sage = material('Шалфейный шенилл', '8B9D76', cloth=True)
sage_dark = material('Оливковая окантовка', '6D805D', cloth=True)
sage_light = material('Шалфейная подушка', 'A1AB85', cloth=True)
lilac = material('Вересковый велюр', 'A293B5', cloth=True)
lilac_dark = material('Вересковая окантовка', '7C6B90', cloth=True)
cream = material('Молочный жаккард', 'EFE6CE', cloth=True)
teal = material('Эвкалиптовый борт', '6E9891', cloth=True)
teal_dark = material('Тёмная тесьма', '4F746D')
ochre = material('Тёплая охра', 'C79A65', cloth=True)
ochre_dark = material('Охристая окантовка', '9F7049')
wood = material('Орех', '725144', .53)
ink = material('Графит', '303632', .48)
ivory = material('Блики', 'FCF2DA', .43)
peach = material('Румянец', 'D7A28E', cloth=True)
linen = material('Льняная ткань', 'C78E71', cloth=True)
linen_dark = material('Терракотовый шов', 'A36A54', cloth=True)

def put(obj, name, mat=None):
    obj.name = name
    for previous in list(obj.users_collection):
        previous.objects.unlink(obj)
    collection.objects.link(obj)
    if mat:
        obj.data.materials.append(mat)
    return obj

def box(name, position, size, radius, mat):
    bpy.ops.mesh.primitive_cube_add(size=1, location=position)
    ob = put(bpy.context.object, name, mat)
    ob.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bevel = ob.modifiers.new('Мягкие углы', 'BEVEL')
    bevel.width = radius
    bevel.segments = 5
    bevel.harden_normals = True
    normal = ob.modifiers.new('Сглаживание ткани', 'WEIGHTED_NORMAL')
    normal.keep_sharp = True
    for poly in ob.data.polygons:
        poly.use_smooth = True
    return ob

def oval(name, p, size, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=12, radius=1, location=p)
    ob = put(bpy.context.object, name, mat)
    ob.scale = size
    for poly in ob.data.polygons:
        poly.use_smooth = True
    return ob

def tube(name, points, radius, mat):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.resolution_u = 8
    curve.bevel_depth = radius
    curve.bevel_resolution = 2
    spline = curve.splines.new('BEZIER')
    spline.bezier_points.add(len(points) - 1)
    for p, xyz in zip(spline.bezier_points, points):
        p.co = xyz
        p.handle_left_type = 'AUTO'
        p.handle_right_type = 'AUTO'
    return put(bpy.data.objects.new(name, curve), name, mat)

def rod(name, a, b, r1, r2, mat):
    delta = Vector(b) - Vector(a)
    bpy.ops.mesh.primitive_cone_add(vertices=14, radius1=r1, radius2=r2, depth=delta.length, location=(Vector(a)+Vector(b))/2)
    ob = put(bpy.context.object, name, mat)
    ob.rotation_euler = delta.to_track_quat('Z', 'Y').to_euler()
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob

def frame(name, x, y, z, half_x, half_y, radius, mat, thickness=.014):
    points = []
    for cx, cy, a in [(half_x-radius,half_y-radius,0),(-half_x+radius,half_y-radius,90),(-half_x+radius,-half_y+radius,180),(half_x-radius,-half_y+radius,270)]:
        for i in range(7):
            angle=math.radians(a+i*15)
            points.append((x+cx+math.cos(angle)*radius,y+cy+math.sin(angle)*radius,z))
    ob = tube(name, points, thickness, mat)
    ob.data.splines[0].use_cyclic_u = True

def face(y, z, width=.51):
    for side in (-1,1):
        x=side*width/2
        oval('Eye.L' if side < 0 else 'Eye.R', (x,y,z), (.041,.024,.059), ink)
        oval('Glint.L' if side < 0 else 'Glint.R', (x-.011,y-.022,z+.019), (.012,.006,.013), ivory)
        oval('Cheek', (side*(width/2+.105),y+.008,z-.067), (.069,.013,.031), peach)
    tube('Smile', [(-.066,y,z-.073),(0,y-.008,z-.106),(.066,y,z-.073)], .012, ink)

def arm(side, x, y, z, cloth):
    pivot = put(bpy.data.objects.new('Wave' if side>0 else 'RestArm', None), 'Wave' if side>0 else 'RestArm')
    pivot.location=(side*x,y,z)
    reach = .43 if side>0 else .34
    rise = .31 if side>0 else -.19
    end=(side*reach,-.08,rise)
    stroke = tube('Мягкая рука', [(0,0,0),(side*.21,-.04,rise*.28),end], .055, cloth)
    hand = oval('Варежка', end, (.104,.067,.105), cloth)
    hand.rotation_euler[1]=side*.3
    thumb = oval('Большой палец', (end[0]-side*.069,end[1]-.018,end[2]+.028), (.048,.047,.061), cloth)
    for obj in (stroke,hand,thumb):
        obj.parent=pivot

def feet(x, y, mat=wood):
    for a in (-1,1):
        for b in (-1,1):
            rod('Ножка', (a*(x+.06),b*(y+.048),.025), (a*x,b*y,.28), .048,.071,mat)

def sofa():
    feet(1.44,.59)
    box('Clean.Base', (0,0,.46), (3.48,1.62,.48), .20,sage_dark)
    frame('Нижний кант',0,0,.46,1.71,.785,.19,sage_light)
    box('Задник',(0,.60,1.00),(3.38,.46,1.29),.22,sage_dark)
    for side in (-1,1):
        box('Clean.Bolster',(side*1.52,-.045,.87),(.50,1.54,.84),.24,sage)
        box('Clean.Seat',(side*.65,-.30,.775),(1.27,1.06,.37),.17,sage_light)
        box('Clean.Back',(side*.65,.36,1.205),(1.29,.55,.96),.235,sage)
        frame('Кант сиденья',side*.65,-.30,.781,.625,.519,.17,sage)
    box('Clean.Center',(0,.22,1.24),(.99,.38,.80),.17,sage_light)
    face(.023,1.30,.48)
    arm(-1,1.73,-.48,.83,sage_light)
    arm(1,1.73,-.48,.85,sage_light)

def armchair():
    feet(.68,.47)
    box('Clean.Base',(0,0,.48),(1.74,1.35,.52),.24,lilac_dark)
    box('Clean.Back',(0,.40,1.23),(1.53,.59,1.38),.285,lilac)
    box('Clean.Seat',(0,-.24,.77),(1.27,.97,.37),.17,lilac)
    frame('Кант',0,-.24,.79,.62,.47,.16,lilac_dark)
    for side in (-1,1):
        box('Clean.Armrest',(side*.75,-.11,.87),(.43,1.23,.65),.205,lilac)
        arm(side,.92,-.48,.82,lilac)
    face(.09,1.40,.45)

def mattress():
    box('Clean.Band',(0,0,.26),(2.90,1.86,.47),.205,teal)
    box('Clean.Top',(0,0,.57),(2.92,1.87,.39),.185,cream)
    frame('Верхний кант',0,0,.59,1.45,.923,.17,teal_dark,.019)
    frame('Нижний кант',0,0,.19,1.432,.908,.17,teal_dark,.016)
    for x in (-.92,-.46,0,.46,.92):
        for y in (-.45,0,.45):
            oval('Стёжка',(x,y,.758),(.070,.044,.012),cream)
    for x in (-.92,.92):
        tube('Ручка матраса',[(x-.12,-.89,.33),(x,-.96,.32),(x+.12,-.89,.33)],.028,teal_dark)
    face(-.941,.455,.47)
    arm(-1,1.44,-.41,.30,teal)
    arm(1,1.44,-.41,.34,teal)

def chair():
    for a in (-1,1):
        for b in (-1,1):
            rod('Ножка', (a*.63,b*.53,.02),(a*.48,b*.44,.95),.055,.075,wood)
    for a in (-1,1):
        rod('Стойка',(a*.44,.43,.79),(a*.46,.50,1.99),.057,.057,wood)
    box('Clean.Seat',(0,-.05,.96),(1.37,1.24,.37),.175,ochre)
    frame('Шов сиденья',0,-.05,.95,.67,.61,.16,ochre_dark)
    box('Clean.Back',(0,.43,1.71),(1.34,.40,1.05),.187,ochre)
    face(.224,1.79,.45)
    arm(-1,.65,.15,1.42,ochre)
    arm(1,.65,.15,1.42,ochre)

def other():
    feet(.56,.47)
    box('Clean.Base',(0,0,.51),(1.62,1.28,.78),.29,linen_dark)
    box('Clean.Top',(0,0,.88),(1.64,1.30,.43),.19,linen)
    frame('Шов пуфа',0,0,.875,.80,.635,.18,linen_dark)
    face(-.653,.84,.44)
    arm(-1,.80,-.30,.59,linen)
    arm(1,.80,-.30,.62,linen)

models = {'sofa':sofa,'armchair':armchair,'mattress':mattress,'chair':chair,'other':other}
for name, build in models.items():
    collection = bpy.data.collections.new(name)
    scene.collection.children.link(collection)
    build()
    # Bake curves into real meshes and export only this collection.
    bpy.ops.object.select_all(action='DESELECT')
    for obj in collection.objects:
        obj.select_set(True)
        if obj.type == 'CURVE':
            bpy.context.view_layer.objects.active = obj
    if bpy.context.view_layer.objects.active:
        bpy.ops.object.convert(target='MESH')
    bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models'/f'{name}.glb'), export_format='GLB',
                             use_selection=True, export_apply=True, export_animations=False)
    collection.hide_render = True

def point_at(ob, target):
    ob.rotation_euler = (Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler()

def light(name, loc, power, size, tint):
    data=bpy.data.lights.new(name,'AREA')
    data.energy=power
    data.shape='DISK'
    data.size=size
    data.color=tint
    obj=bpy.data.objects.new(name,data)
    scene.collection.objects.link(obj)
    obj.location=loc
    point_at(obj,(0,0,.65))

light('Ключевой свет',(-3,-4,6),520,5,(1,.94,.85))
light('Мягкое заполнение',(4,-2,3),220,4,(.87,.94,1))
light('Контровой', (1,4,5),410,3,(1,.97,.84))
world=bpy.data.worlds.new('Студия')
scene.world=world
world.use_nodes=True
world.node_tree.nodes.get('Background').inputs[0].default_value=(.65,.69,.58,1)
world.node_tree.nodes.get('Background').inputs[1].default_value=.38
cam=bpy.data.objects.new('Камера',bpy.data.cameras.new('Камера'))
scene.collection.objects.link(cam)
scene.camera=cam
cam.data.type='ORTHO'
scene.render.engine='CYCLES'
scene.cycles.samples=24
scene.cycles.use_denoising=True
scene.render.resolution_x=820
scene.render.resolution_y=560
scene.render.resolution_percentage=100
scene.render.film_transparent=True
scene.render.image_settings.file_format='PNG'
for name in models:
    for candidate in models:
        bpy.data.collections[candidate].hide_render=candidate!=name
        bpy.data.collections[candidate].hide_viewport=candidate!=name
    width={'sofa':5.05,'armchair':3.85,'mattress':4.55,'chair':3.75,'other':3.45}[name]
    target={'sofa':.79,'armchair':.89,'mattress':.46,'chair':1.08,'other':.52}[name]
    cam.location=(3.3,-7,4.2)
    point_at(cam,(0,0,target))
    cam.data.ortho_scale=width
    scene.render.filepath=str(ROOT/'public/posters'/f'{name}.png')
    bpy.ops.render.render(write_still=True)
    features = [obj for obj in bpy.data.collections[name].objects if obj.name.startswith(('Eye', 'Glint', 'Cheek', 'Smile'))]
    for obj in features:
        obj.hide_render = True
    scene.render.filepath=str(ROOT/'public/posters'/f'{name}-plain.png')
    bpy.ops.render.render(write_still=True)
    for obj in features:
        obj.hide_render = False

for name in models:
    bpy.data.collections[name].hide_render = name != 'sofa'
    bpy.data.collections[name].hide_viewport = name != 'sofa'
cam.data.ortho_scale=5.05
point_at(cam,(0,0,.79))
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/blender/myagko-furniture.blend'),compress=True)
