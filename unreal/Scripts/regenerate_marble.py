from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy.ndimage import gaussian_filter
from scipy.interpolate import splprep, splev

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'ContentSource'/'Textures'
rng=np.random.default_rng(20260723)
S=2048

# warm cloudy stone base
cloud=rng.normal(0,1,(S,S)).astype(np.float32)
cloud=gaussian_filter(cloud,75)
cloud=(cloud-cloud.min())/(cloud.max()-cloud.min())
fine=gaussian_filter(rng.normal(0,1,(S,S)).astype(np.float32),7)
fine=(fine-fine.min())/(fine.max()-fine.min())
base=np.zeros((S,S,3),np.float32)
base_color=np.array([240,237,230],np.float32)/255
base[:]=base_color
base*=0.965+(cloud[...,None]-0.5)*0.05
base+=(fine[...,None]-0.5)*0.012
base=np.clip(base,0,1)
base_img=Image.fromarray((base*255).astype(np.uint8),'RGB')

vein_soft=Image.new('L',(S,S),0)
vein_core=Image.new('L',(S,S),0)
gold_layer=Image.new('L',(S,S),0)
soft_draw=ImageDraw.Draw(vein_soft)
core_draw=ImageDraw.Draw(vein_core)
gold_draw=ImageDraw.Draw(gold_layer)


def smooth_curve(points, samples=350):
    pts=np.array(points,float)
    # remove duplicate points
    _, idx=np.unique(pts,axis=0,return_index=True)
    pts=pts[np.sort(idx)]
    if len(pts)<4: return pts
    tck,_=splprep([pts[:,0],pts[:,1]],s=1800,k=3)
    u=np.linspace(0,1,samples)
    x,y=splev(u,tck)
    return np.column_stack([x,y])

main_curves=[]
for i in range(8):
    # start above/below and travel diagonally with irregular bends
    left_to_right = i%2==0
    x0=-200 if left_to_right else S+200
    x1=S+200 if left_to_right else -200
    y0=rng.uniform(-150,S+150)
    slope=rng.uniform(-0.55,0.55)
    points=[]
    steps=11
    for j in range(steps):
        t=j/(steps-1)
        x=x0+(x1-x0)*t
        y=y0+slope*S*t+rng.normal(0,115)+95*np.sin(t*np.pi*rng.uniform(1.2,3.8)+rng.uniform(0,6.28))
        points.append((x,y))
    curve=smooth_curve(points)
    main_curves.append(curve)
    pts=[tuple(map(float,p)) for p in curve]
    w=int(rng.integers(18,42))
    soft_draw.line(pts,fill=int(rng.integers(110,190)),width=w,joint='curve')
    core_draw.line(pts,fill=int(rng.integers(70,130)),width=max(2,w//7),joint='curve')
    if rng.random()<0.45:
        gold_draw.line(pts,fill=int(rng.integers(40,85)),width=max(1,w//12),joint='curve')

    # natural branches peeling from main vein
    for _ in range(int(rng.integers(2,5))):
        idx=int(rng.integers(55,len(curve)-75))
        start=curve[idx]
        direction=1 if rng.random()<0.5 else -1
        branch=[]
        length=int(rng.integers(260,720))
        angle=rng.uniform(-1.25,1.25)
        for j in range(7):
            t=j/6
            bx=start[0]+direction*length*t*np.cos(angle)+rng.normal(0,35)
            by=start[1]+length*t*np.sin(angle)+rng.normal(0,42)+55*np.sin(t*np.pi*2+rng.uniform(0,3))
            branch.append((bx,by))
        bc=smooth_curve(branch,180)
        bpts=[tuple(map(float,p)) for p in bc]
        bw=int(rng.integers(3,10))
        soft_draw.line(bpts,fill=int(rng.integers(45,95)),width=bw,joint='curve')
        core_draw.line(bpts,fill=int(rng.integers(50,100)),width=max(1,bw//3),joint='curve')

# very fine capillary network
for _ in range(85):
    x=rng.uniform(0,S); y=rng.uniform(0,S)
    pts=[(x,y)]
    angle=rng.uniform(0,6.28)
    for j in range(1,8):
        angle+=rng.normal(0,0.35)
        x+=rng.uniform(18,60)*np.cos(angle)
        y+=rng.uniform(18,60)*np.sin(angle)
        pts.append((x,y))
    core_draw.line(pts,fill=int(rng.integers(18,45)),width=1)

soft=np.array(vein_soft.filter(ImageFilter.GaussianBlur(7)),np.float32)/255
core=np.array(vein_core.filter(ImageFilter.GaussianBlur(1.1)),np.float32)/255
gold=np.array(gold_layer.filter(ImageFilter.GaussianBlur(1.6)),np.float32)/255
mask=np.clip(soft*0.75+core*0.75,0,1)

arr=np.array(base_img,np.float32)/255
gray=np.array([0.42,0.44,0.45],np.float32)
warm=np.array([0.56,0.45,0.32],np.float32)
arr=arr*(1-mask[...,None]*0.38)+gray[None,None,:]*mask[...,None]*0.33
arr=arr*(1-gold[...,None]*0.20)+warm[None,None,:]*gold[...,None]*0.18
arr=np.clip(arr,0,1)

height=np.clip(0.54-(soft*0.055+core*0.085)+(cloud-0.5)*0.018+(fine-0.5)*0.008,0,1)
gy,gx=np.gradient(height)
strength=6.2
nx=-gx*strength; ny=-gy*strength; nz=np.ones_like(height)
norm=np.sqrt(nx*nx+ny*ny+nz*nz)
normal=np.stack((nx/norm,ny/norm,nz/norm),axis=-1)*0.5+0.5
rough=np.clip(0.12+soft*0.07+core*0.04+(fine-0.5)*0.025,0.07,0.27)
ao=np.clip(0.98-soft*0.08-core*0.05,0.84,1.0)

# upscale and save
Image.fromarray((arr*255).astype(np.uint8),'RGB').resize((8192,8192),Image.Resampling.LANCZOS).save(OUT/'T_Marble_Calacatta_Albedo_8K.jpg',quality=97,subsampling=0,optimize=True)
Image.fromarray((normal*255).astype(np.uint8),'RGB').resize((4096,4096),Image.Resampling.LANCZOS).save(OUT/'T_Marble_Calacatta_Normal_4K.png',compress_level=5)
for name,data in [('Roughness',rough),('AO',ao),('Height',height)]:
    Image.fromarray((data*255).astype(np.uint8),'L').resize((4096,4096),Image.Resampling.LANCZOS).save(OUT/f'T_Marble_Calacatta_{name}_4K.png',compress_level=5)
print('regenerated marble')
