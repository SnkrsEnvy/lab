from pathlib import Path
import trimesh
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'ContentSource'/'Geometry'/'GrandCore_MasterShell.glb'

L=24.384
W=12.192
H=6.096
T=0.15
DOOR_W=1.2192
DOOR_H=2.4384
DOOR_Y=-3.05

scene=trimesh.Scene()

def mat(name, color, metallic=0.0, roughness=0.5, emissive=None):
    m=trimesh.visual.material.PBRMaterial(name=name, baseColorFactor=color, metallicFactor=metallic, roughnessFactor=roughness)
    if emissive is not None:
        m.emissiveFactor=emissive
    return m

M_MARBLE=mat('M_Marble_Master',[238,235,228,255],0.0,0.12)
M_VELVET=mat('M_Velvet_Camel',[154,93,42,255],0.0,0.62)
M_PLASTER=mat('M_Plaster_Ivory',[232,225,211,255],0.0,0.58)
M_BRONZE=mat('M_Bronze_Dark',[78,36,14,255],0.92,0.25)
M_EMISSIVE=mat('M_Cove_Emissive',[255,237,198,255],0.0,0.2,[1.0,0.82,0.48])
M_BLACK=mat('M_ShadowGap',[7,5,4,255],0.0,0.8)


def add_box(name, extents, center, material):
    mesh=trimesh.creation.box(extents=extents)
    mesh.apply_translation(center)
    mesh.visual.material=material
    scene.add_geometry(mesh,node_name=name,geom_name=name)

# Core shell
add_box('Floor_Slab',(L,W,0.10),(0,0,-0.05),M_MARBLE)
add_box('Wall_Long_North',(L,T,H),(0,W/2+T/2,H/2),M_PLASTER)
add_box('Wall_Long_South',(L,T,H),(0,-W/2-T/2,H/2),M_PLASTER)
add_box('Wall_Short_Right',(T,W,H),(L/2+T/2,0,H/2),M_PLASTER)

# Left wall with door opening
wall_y_min=-W/2
wall_y_max=W/2
door_min=DOOR_Y-DOOR_W/2
door_max=DOOR_Y+DOOR_W/2
seg1=(door_min-wall_y_min)
seg2=(wall_y_max-door_max)
add_box('Wall_Short_Left_BeforeDoor',(T,seg1,H),(-L/2-T/2,wall_y_min+seg1/2,H/2),M_PLASTER)
add_box('Wall_Short_Left_AfterDoor',(T,seg2,H),(-L/2-T/2,door_max+seg2/2,H/2),M_PLASTER)
add_box('Wall_Short_Left_Header',(T,DOOR_W,H-DOOR_H),(-L/2-T/2,DOOR_Y,DOOR_H+(H-DOOR_H)/2),M_PLASTER)
add_box('Door_Leaf',(0.08,DOOR_W-0.05,DOOR_H-0.04),(-L/2+0.02,DOOR_Y,DOOR_H/2),M_BRONZE)

# Tray ceiling
add_box('Ceiling_Main',(L,W,0.10),(0,0,H+0.05),M_PLASTER)
soffit=0.62
drop=0.30
add_box('Soffit_North',(L,soffit,drop),(0,W/2-soffit/2,H-drop/2),M_PLASTER)
add_box('Soffit_South',(L,soffit,drop),(0,-W/2+soffit/2,H-drop/2),M_PLASTER)
add_box('Soffit_East',(soffit,W-2*soffit,drop),(L/2-soffit/2,0,H-drop/2),M_PLASTER)
add_box('Soffit_West',(soffit,W-2*soffit,drop),(-L/2+soffit/2,0,H-drop/2),M_PLASTER)
# emissive cove strips
strip=0.035
z=H-drop+0.04
add_box('Cove_North',(L-2*soffit,strip,strip),(0,W/2-soffit,z),M_EMISSIVE)
add_box('Cove_South',(L-2*soffit,strip,strip),(0,-W/2+soffit,z),M_EMISSIVE)
add_box('Cove_East',(strip,W-2*soffit,strip),(L/2-soffit,0,z),M_EMISSIVE)
add_box('Cove_West',(strip,W-2*soffit,strip),(-L/2+soffit,0,z),M_EMISSIVE)

# Velvet panels on inside faces.  Gaps remain subtle, not black strips.
panel_h=H-0.10
panel_t=0.035
gap=0.012
panel_w=2.35

# Long walls, panels along x
for side, y in [('North',W/2-0.03),('South',-W/2+0.03)]:
    count=int(np.ceil(L/panel_w))
    actual=(L-(count-1)*gap)/count
    for i in range(count):
        x=-L/2+actual/2+i*(actual+gap)
        add_box(f'Velvet_{side}_{i+1:02d}',(actual,panel_t,panel_h),(x,y,H/2),M_VELVET)

# Right short wall panels along y
count=int(np.ceil(W/panel_w)); actual=(W-(count-1)*gap)/count
for i in range(count):
    y=-W/2+actual/2+i*(actual+gap)
    add_box(f'Velvet_Right_{i+1:02d}',(panel_t,actual,panel_h),(L/2-0.03,y,H/2),M_VELVET)

# Left wall panels around door, leaving opening clear
segments=[(wall_y_min,door_min),(door_max,wall_y_max)]
idx=1
for a,b in segments:
    length=b-a
    count=max(1,int(np.ceil(length/panel_w)))
    actual=(length-(count-1)*gap)/count
    for i in range(count):
        y=a+actual/2+i*(actual+gap)
        add_box(f'Velvet_Left_{idx:02d}',(panel_t,actual,panel_h),(-L/2+0.03,y,H/2),M_VELVET)
        idx+=1
# velvet header above door
add_box('Velvet_Left_DoorHeader',(panel_t,DOOR_W-0.02,H-DOOR_H-0.10),(-L/2+0.03,DOOR_Y,DOOR_H+(H-DOOR_H)/2),M_VELVET)

# Bronze base trim around interior perimeter
trim_h=0.09; trim_t=0.025
add_box('BaseTrim_North',(L,trim_t,trim_h),(0,W/2-0.055,trim_h/2),M_BRONZE)
add_box('BaseTrim_South',(L,trim_t,trim_h),(0,-W/2+0.055,trim_h/2),M_BRONZE)
add_box('BaseTrim_Right',(trim_t,W,trim_h),(L/2-0.055,0,trim_h/2),M_BRONZE)
# left split trim
add_box('BaseTrim_Left_A',(trim_t,seg1,trim_h),(-L/2+0.055,wall_y_min+seg1/2,trim_h/2),M_BRONZE)
add_box('BaseTrim_Left_B',(trim_t,seg2,trim_h),(-L/2+0.055,door_max+seg2/2,trim_h/2),M_BRONZE)

# Discreet floor light fixture placeholders along three visible walls
fixture_mat=M_BRONZE
for x in np.linspace(-L/2+1.0,L/2-1.0,12):
    for y in (W/2-0.22,-W/2+0.22):
        add_box(f'FloorLight_{x:.2f}_{y:.2f}',(0.18,0.10,0.025),(float(x),float(y),0.013),fixture_mat)
for y in np.linspace(-W/2+1.0,W/2-1.0,5):
    add_box(f'FloorLight_Right_{y:.2f}',(0.10,0.18,0.025),(L/2-0.22,float(y),0.013),fixture_mat)

OUT.parent.mkdir(parents=True,exist_ok=True)
OUT.write_bytes(scene.export(file_type='glb'))
print(OUT, OUT.stat().st_size)
