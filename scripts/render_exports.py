from pathlib import Path
import json,math,sys,subprocess
import numpy as np
from PIL import Image,ImageDraw,ImageFont,ImageOps,ImageFilter,ImageEnhance
ROOT=Path(__file__).resolve().parents[1];A=ROOT/'dist'/'assets';S=A/'source'
import imageio_ffmpeg
DATA=json.loads((A/'illustration.json').read_text(encoding='utf8'))
IM=[Image.open(S/f'{i}.png').convert('RGB') for i in range(3)]
MASK=[Image.open(S/f'mask-{i}.png').convert('L') for i in range(3)]
WIRE=[Image.open(S/f'wire-{i}.png').convert('RGBA') for i in range(3)]
W,H,FPS=800,900,15;GREEN=(41,95,76);INK=(39,60,52);MUTED=(120,129,120);BG=(238,238,228)
BX,BY,BW,BH=260,208,280,577;SCALE=BW/233
NAMES=['ACQUIRE','SILHOUETTE','STRUCTURE','FEATURES','PALETTE','ATLAS'];START=DATA['stageStarts'];fonts={}
def font(size,bold=False):
    key=(size,bold)
    if key not in fonts:
        for name in [('C:/Windows/Fonts/consolab.ttf' if bold else 'C:/Windows/Fonts/consola.ttf'),('DejaVuSansMono-Bold.ttf' if bold else 'DejaVuSansMono.ttf')]:
            try:fonts[key]=ImageFont.truetype(name,size);break
            except OSError:continue
        if key not in fonts:fonts[key]=ImageFont.load_default(size=size)
    return fonts[key]
def txt(d,pos,s,size=13,color=INK,bold=False):d.text(pos,s,font=font(size,bold),fill=color)
def smooth(x):x=max(0,min(1,x));return x*x*(3-2*x)
def phase(t,a,b):return smooth((t-a)/(b-a))
def bracket(d,b,l=12):
    x0,y0,x1,y1=b
    for x,sx in [(x0,1),(x1,-1)]:
        for y,sy in [(y0,1),(y1,-1)]:d.line([(x,y+sy*l),(x,y),(x+sx*l,y)],fill=GREEN,width=2)
def box(part):return [BX+part['box'][0]*SCALE,BY+part['box'][1]*SCALE,BX+part['box'][2]*SCALE,BY+part['box'][3]*SCALE]
def base(t):
    stage=max(k for k in range(6) if t>=START[k]);part=None
    if stage==3:part=DATA['parts'][min(4,int((t-7)/.64))]
    index=part['best'] if part else 1 if stage==2 else 2 if stage==4 else 0
    im=Image.new('RGB',(W,H),BG);plate=IM[index].resize((BW,BH),Image.Resampling.LANCZOS);m=MASK[index].resize((BW,BH),Image.Resampling.LANCZOS)
    if stage==0:plate=ImageEnhance.Color(plate).enhance(.14)
    im.paste(plate,(BX,BY));d=ImageDraw.Draw(im)
    if stage in [1,2]:
        for x in range(20,790,30):d.line((x,154,x,845),fill=(220,226,213))
        for y in range(154,845,30):d.line((20,y,780,y),fill=(220,226,213))
        if stage==1:
            scan=int(BH*phase(t,2.45,4.2));sm=np.asarray(m).copy();sm[scan:]=0
            solid=Image.new('RGB',(BW,BH),GREEN);im.paste(plate,(BX,BY));im.paste(solid,(BX,BY),Image.fromarray(sm));d=ImageDraw.Draw(im)
            d.line((235,BY+scan,565,BY+scan),fill=GREEN,width=2)
        else:
            layer=Image.new('RGB',(BW,BH),(220,230,213));im.paste(layer,(BX,BY),m)
            mesh=Image.new('RGBA',(BW,BH));md=ImageDraw.Draw(mesh)
            for r,y in enumerate(range(0,BH,25)):
                for x in range(-15+r%2*14,BW,28):md.line([(x,y),(x+28,y),(x+14,y+25),(x,y)],fill=(*GREEN,125),width=1)
            mesh.putalpha(Image.fromarray((np.asarray(mesh.getchannel('A')).astype(float)*np.asarray(m)/255).astype('uint8')))
            im=Image.alpha_composite(im.convert('RGBA'),Image.new('RGBA',(W,H))).convert('RGBA');im.alpha_composite(mesh,(BX,BY));im.alpha_composite(WIRE[index].resize((BW,BH),Image.Resampling.LANCZOS),(BX,BY));im=im.convert('RGB');d=ImageDraw.Draw(im)
    elif stage==3:
        faded=Image.blend(im,Image.new('RGB',(W,H),BG),.76);b=box(part)
        faded.paste(IM[index].crop(part['box']).resize((max(1,round(b[2]-b[0])),max(1,round(b[3]-b[1]))),Image.Resampling.LANCZOS),(round(b[0]),round(b[1])))
        im=faded;d=ImageDraw.Draw(im);bracket(d,b)
        k=DATA['parts'].index(part);age=t-(7+k*.64);p=phase(age,0,.25);ax=(b[0]+b[2])/2;ay=(b[1]+b[3])/2;cx=ax+(669-ax)*p;cy=ay+(300-ay)*p;ww=int(35+175*p);hh=int(30+126*p)
        crop=ImageOps.pad(IM[index].crop(part['box']),(ww,hh),method=Image.Resampling.LANCZOS,color=BG);x=int(cx-ww/2);y=int(cy-hh/2)
        d.line([(ax,ay),(cx,cy+hh/2)],fill=GREEN,width=1);im.paste(crop,(x,y));d=ImageDraw.Draw(im);d.rectangle((x,y,x+ww,y+hh),outline=GREEN,width=1)
        txt(d,(25,280),part['title'],20,GREEN,True);txt(d,(25,316),part['en'],12,MUTED)
        if p>.8:txt(d,(566,213),'DETAIL / ORIGINAL',11,GREEN,True)
    elif stage==4:
        for k,c in enumerate(DATA['palette']):
            p=phase(t,10.2+k*.16,10.2+k*.16+.6)
            if not p:continue
            x=round(400+(578-400)*p);y=round(420+(250+k*76-420)*p)
            d.rectangle((x,y,x+38,y+31),fill=c['hex'],outline=(169,177,161))
            if p>.8:txt(d,(x+49,y),c['hex'],13,GREEN,True);txt(d,(x+49,y+21),f"{c['percentage']:.1f}%",11,MUTED)
    elif stage==5:
        txt(d,(566,258),'ANATOMICAL MODEL',13,GREEN,True)
        for k,s in enumerate(['3 ORIGINAL VIEWS','5 SYSTEMS IN 3D','EDUCATIONAL ATLAS']):txt(d,(566,296+k*26),s,10,MUTED)
    # Original motion-style CCTV framing, adapted to an educational atlas.
    d.rectangle((0,0,W,65),fill=(246,246,238));d.line((24,65,776,65),fill=(190,204,181))
    d.ellipse((26,23,32,29),fill=GREEN);txt(d,(44,17),'ATLAS / HUMAN ANATOMY',16,GREEN,True)
    txt(d,(612,17),f'00:00:{int(t):02d}:{int(t*15)%15:02d}',16,INK,True);txt(d,(25,44),'OPTICAL STUDY / ORIGINAL PLATE',10,MUTED)
    for k,name in enumerate(NAMES):
        x=28+k*125;txt(d,(x,86),f'0{k+1}',10,GREEN if k<=stage else MUTED);txt(d,(x,108),name,11,GREEN if k==stage else MUTED,k==stage)
        d.rectangle((x,132,x+107,133),fill=(211,219,201));p=1 if k<stage else phase(t,START[k],START[k+1]) if k==stage else 0
        if p:d.rectangle((x,132,x+107*p,133),fill=GREEN)
    txt(d,(25,163),f'0{stage+1} / 06',11,GREEN);txt(d,(25,186),NAMES[stage],25,INK,True)
    if stage==0:bracket(d,(BX+20,BY,BX+BW-20,BY+BH),18)
    d.rectangle((0,857,W,H),fill=(246,246,238));d.line((24,856,776,856),fill=(190,204,181))
    txt(d,(25,873),'HUMAN ATLAS / 002',12,GREEN,True);txt(d,(499,874),'ILLUSTRATION / STUDY MODE',11,MUTED)
    return im
FIRST=base(0)
def frame(i):
    im=base(i/15)
    if i>=215:im=Image.blend(im,FIRST,smooth((i-215)/9))
    if i==224:im=FIRST.copy()
    return im
def main():
    exe=imageio_ffmpeg.get_ffmpeg_exe();tmp=ROOT/'body-render.mkv'
    p=subprocess.Popen([exe,'-hide_banner','-loglevel','error','-y','-f','rawvideo','-s','800x900','-pix_fmt','rgb24','-r','15','-i','-','-an','-c:v','ffv1','-level','3',str(tmp)],stdin=subprocess.PIPE)
    sheet=Image.new('RGB',(1200,900));picks=[15,49,80,131,177,204]
    for i in range(225):
        f=frame(i);p.stdin.write(f.tobytes())
        if i in picks:
            k=picks.index(i);sheet.paste(f.resize((400,450),Image.Resampling.LANCZOS),((k%3)*400,(k//3)*450))
        if i%45==0:print(f'Rendered body {i}/225',flush=True)
    p.stdin.close()
    if p.wait():raise RuntimeError('Body export failed')
    sheet.save(ROOT/'export-contact.jpg',quality=94)
    subprocess.run([exe,'-hide_banner','-loglevel','warning','-y','-i',str(tmp),'-an','-c:v','libx264','-preset','slow','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(A/'human-anatomy.mp4')],check=True)
    subprocess.run([exe,'-hide_banner','-loglevel','warning','-y','-i',str(tmp),'-filter_complex','[0:v]split[a][b];[a]palettegen=reserve_transparent=1[p];[b][p]paletteuse=dither=none:diff_mode=rectangle','-loop','0','-final_delay','7','-fps_mode','passthrough',str(A/'human-anatomy.gif')],check=True)
    tmp.unlink();print('Human illustration GIF and MP4 ready',flush=True)
if __name__=='__main__':main()
