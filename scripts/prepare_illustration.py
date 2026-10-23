from pathlib import Path
import sys,json
import numpy as np
from PIL import Image,ImageDraw,ImageFilter,ImageOps
ROOT=Path(__file__).resolve().parents[1];A=ROOT/'dist'/'assets';S=A/'source'
import cv2
source=Image.open(S/'original.gif')
PARTS=[
 {'id':'skull','title':'Череп','en':'Skull','best':0,'system':'skeleton','box':[74,1,140,76],'description':'Кости головы образуют череп. В 3D можно выделять отдельные кости и рассматривать их с разных сторон.','match':'parietal|frontal bone|occipital|temporal bone|sphenoid|ethmoid|maxilla|mandible|zygomatic|nasal bone|palatine|vomer|lacrimal'},
 {'id':'thorax','title':'Грудная клетка','en':'Thoracic cage','best':0,'system':'skeleton','box':[49,77,163,167],'description':'Рёбра, грудина и грудные позвонки формируют грудную клетку. Переключение систем помогает увидеть её положение относительно органов.','match':'rib|sternum|costal cartilage|vertebra t'},
 {'id':'spine','title':'Позвоночник','en':'Vertebral column','best':1,'system':'skeleton','box':[96,62,128,248],'description':'Позвоночный столб проходит вдоль туловища. Для иллюстрации выбран задний вид; в 3D доступен осмотр позвонков.','match':'vertebra|sacrum|coccyx'},
 {'id':'intestine','title':'Кишечник','en':'Intestines','best':0,'system':'visceral','box':[36,153,157,246],'description':'На исходной иллюстрации видны петли кишечника. В атласе можно отдельно рассмотреть видимые участки тонкой и толстой кишки.','match':'colon|intestine|duoden|jejun|ileum|ileal|caecum|cecum|rectum|appendix'},
 {'id':'pelvis','title':'Таз','en':'Pelvis','best':0,'system':'skeleton','box':[61,220,160,293],'description':'Костный таз расположен в нижней части туловища. Выделение тазовых костей в 3D показывает их форму и взаимное положение.','match':'hip bone|ilium|ischium|pubis|sacrum|coccyx'},
]
outline=[(91,1),(118,1),(135,10),(139,30),(134,57),(127,72),(150,84),(170,99),(180,137),(182,192),(188,250),(192,286),(184,301),(172,300),(162,278),(157,237),(153,214),(152,264),(149,308),(145,350),(149,399),(156,462),(144,479),(124,479),(117,465),(123,420),(125,380),(122,336),(113,294),(102,290),(95,318),(91,358),(85,400),(80,445),(75,470),(65,479),(43,479),(38,465),(45,430),(51,391),(56,345),(61,299),(63,252),(58,226),(54,247),(53,276),(45,299),(32,296),(31,275),(37,247),(39,220),(38,192),(33,175),(36,149),(39,119),(43,100),(59,87),(79,74),(84,61),(77,45),(75,27),(81,10)]
data={'width':233,'height':480,'sourceFrames':3,'sourceDuration':1.5,'duration':15,'fps':15,'parts':PARTS,
 'views':[{'id':'anatomy','title':'Кости и органы','image':'0.png'},{'id':'nerves','title':'Нервы и сосуды','image':'1.png'},{'id':'muscles','title':'Мышцы','image':'2.png'}],
 'stageStarts':[0,2.2,4.4,7,10.2,12.4,15],'frames':[]}
pixels=[]
for i in range(3):
    source.seek(i);rgb=source.convert('RGB');rgb.save(S/f'{i}.png')
    m=Image.new('L',(233,480));d=ImageDraw.Draw(m);d.polygon(outline,fill=255)
    d.polygon([(100,291),(111,292),(120,338),(117,381),(110,432),(92,454),(88,437),(95,393),(96,350)],fill=0)
    if i==2:m=m.filter(ImageFilter.MaxFilter(5))
    arr=np.asarray(rgb);mask=np.asarray(m).copy()
    gc=np.where(mask>0,cv2.GC_PR_FGD,cv2.GC_BGD).astype('uint8')
    interior=np.asarray(m.filter(ImageFilter.MinFilter(7)))>0
    saturation=arr.max(axis=2).astype(int)-arr.min(axis=2).astype(int)
    gc[interior&(saturation>22)&(arr.mean(axis=2)<220)]=cv2.GC_FGD
    cv2.grabCut(cv2.cvtColor(arr,cv2.COLOR_RGB2BGR),gc,None,np.zeros((1,65)),np.zeros((1,65)),3,cv2.GC_INIT_WITH_MASK)
    mask=np.isin(gc,[cv2.GC_FGD,cv2.GC_PR_FGD]).astype('uint8')*255
    mask=cv2.morphologyEx(mask,cv2.MORPH_CLOSE,np.ones((3,3),np.uint8))
    Image.fromarray(mask).save(S/f'mask-{i}.png')
    map_image=Image.new('RGBA',(233,480),(65,96,74));map_image.putalpha(Image.fromarray(mask));map_image.save(S/f'map-{i}.png')
    contours,_=cv2.findContours(mask,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
    cs=[cv2.approxPolyDP(c,.8,True)[:,0,:].tolist() for c in contours if cv2.contourArea(c)>15]
    edge=cv2.Canny(arr,50,120);edge=(edge.astype(float)*mask/255).astype('uint8')
    wire=Image.new('RGBA',(233,480),(35,101,79));wire.putalpha(Image.fromarray(edge));wire.save(S/f'wire-{i}.png')
    data['frames'].append({'contours':cs,'bounds':Image.fromarray(mask).getbbox()})
    pixels.append(arr[mask>200][::3])
for part in PARTS:
    source.seek(part['best']);im=source.convert('RGB').crop(part['box'])
    ImageOps.pad(im,(280,160),method=Image.Resampling.LANCZOS,color='#ecece4').save(A/f"{part['id']}.webp",quality=94)
samples=np.concatenate(pixels).astype('float32');cv2.setRNGSeed(11)
_,labels,centers=cv2.kmeans(samples,6,None,(cv2.TERM_CRITERIA_EPS+cv2.TERM_CRITERIA_MAX_ITER,70,.1),6,cv2.KMEANS_PP_CENTERS)
counts=np.bincount(labels[:,0],minlength=6);order=np.argsort(counts)[::-1];pct=counts[order]/len(samples)*100
units=np.floor(pct*10).astype(int)
for k in np.argsort(pct*10-units)[::-1][:1000-units.sum()]:units[k]+=1
data['palette']=[{'hex':'#%02X%02X%02X'%tuple(np.round(centers[k]).astype(int)),'percentage':float(units[j]/10)} for j,k in enumerate(order)]
(A/'illustration.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('Prepared three original views, masks, five regions, and six-color palette')
