import {settle,smooth} from './anatomy-motion.js';

const $=id=>document.getElementById(id),canvas=$('illustration'),ctx=canvas.getContext('2d');
const green='#295f4c',muted='#788178';const BODY={x:245,y:65,w:310,h:480*310/233},scale=310/233;
const systemList=[['skeleton','Кости',0],['muscular','Мышцы',2],['cardiovascular','Сосуды',1],['nervous','Нервы',1],['visceral','Органы',0]];
const stages=['ACQUIRE','SILHOUETTE','STRUCTURE','FEATURES','PALETTE','ATLAS'];
const titles=['Общий вид','Границы тела','Структуры и системы','Осмотр областей','Цветовая подпись','Анатомический атлас'];
const captions=['Исходная анатомическая иллюстрация','Выделение силуэта по исходному изображению','Контур и сетка видимых структур','Увеличенные детали из исходных кадров','Шесть цветов трёх исходных видов','Иллюстрация / открытая 3D-модель'];
let data,ready=false,images=[],wires=[],masks=[],mode='illustration',playing=!matchMedia('(prefers-reduced-motion: reduce)').matches,loop=true,time=0,last=0,selected=null,manualView=null,viewIndex=0,lastUI='',spring={x:0,v:0},springKey='',viewer=null,viewerPromise=null,isolate=false,rotating=false;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
function sourcePath(index){ctx.beginPath();for(const contour of data.frames[index].contours){contour.forEach(([x,y],i)=>i?ctx.lineTo(BODY.x+x*scale,BODY.y+y*scale):ctx.moveTo(BODY.x+x*scale,BODY.y+y*scale));ctx.closePath()}}
function boxFor(part){return part.box.map((n,i)=>(i%2?BODY.y:BODY.x)+n*scale)}
function brackets(box,len=13){ctx.strokeStyle=green;ctx.lineWidth=1.3;ctx.beginPath();for(const[x,sx]of[[box[0],1],[box[2],-1]])for(const[y,sy]of[[box[1],1],[box[3],-1]]){ctx.moveTo(x,y+sy*len);ctx.lineTo(x,y);ctx.lineTo(x+sx*len,y)}ctx.stroke()}
function stageAt(t){let s=0;while(s<5&&t>=data.stageStarts[s+1])s++;return s}
function autoPart(stage){if(stage!==3)return null;return data.parts[Math.min(4,Math.floor((time-7)/.64))]}
function indexAt(stage,part){if(part)return part.best;if(manualView!==null)return manualView;if(stage===2)return 1;if(stage===4)return 2;return 0}
function grid(){ctx.strokeStyle='#71816a19';ctx.lineWidth=.7;ctx.beginPath();for(let x=0;x<800;x+=30){ctx.moveTo(x,0);ctx.lineTo(x,760)}for(let y=0;y<760;y+=30){ctx.moveTo(0,y);ctx.lineTo(800,y)}ctx.stroke()}
function plate(index){ctx.drawImage(images[index],BODY.x,BODY.y,BODY.w,BODY.h)}
function fitCrop(img,b,box){const[x,y,w,h]=box,sw=b[2]-b[0],sh=b[3]-b[1],s=Math.min(w/sw,h/sh),dw=sw*s,dh=sh*s;ctx.fillStyle='#f8f8f0';ctx.fillRect(x,y,w,h);ctx.drawImage(img,b[0],b[1],sw,sh,x+(w-dw)/2,y+(h-dh)/2,dw,dh)}
function drawFocus(part,index,dt){
  plate(index);ctx.fillStyle='#eeeee4cc';ctx.fillRect(0,0,800,760);
  const b=boxFor(part);ctx.save();ctx.beginPath();ctx.roundRect(b[0],b[1],b[2]-b[0],b[3]-b[1],5);ctx.clip();plate(index);ctx.restore();brackets(b);
  if(springKey!==part.id){springKey=part.id;spring={x:0,v:0}}settle(spring,1,dt,.12,reduced);
  const p=Math.min(1,spring.x),ax=(b[0]+b[2])/2,ay=(b[1]+b[3])/2,cx=ax+(675-ax)*p,cy=ay+(160-ay)*p,w=40+160*p,h=30+130*p;
  ctx.strokeStyle='#295f4c90';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(cx,cy+h/2);ctx.stroke();
  fitCrop(images[index],part.box,[cx-w/2,cy-h/2,w,h]);ctx.strokeStyle=green;ctx.strokeRect(cx-w/2,cy-h/2,w,h);
  if(p>.85){ctx.fillStyle=green;ctx.font='11px Consolas,monospace';ctx.fillText('DETAIL / '+part.en.toUpperCase(),558,58);ctx.fillStyle=muted;ctx.font='9px Consolas,monospace';ctx.fillText('ИСХОДНЫЙ ФРАГМЕНТ',559,260)}
}
function drawIllustration(dt){
  if(!data)return;const stage=stageAt(time),part=selected||autoPart(stage),idx=indexAt(stage,part);viewIndex=idx;
  ctx.clearRect(0,0,800,760);ctx.fillStyle='#eeeee4';ctx.fillRect(0,0,800,760);
  if(part)drawFocus(part,idx,dt);
  else if(stage===0||manualView!==null){
    ctx.filter=stage===0&&manualView===null?'saturate(.15)':'none';plate(idx);ctx.filter='none';
    const b=data.frames[idx].bounds;const p=smooth(.1,1.5,time);brackets([BODY.x+b[0]*scale-20*(1-p),BODY.y+b[1]*scale,BODY.x+b[2]*scale+20*(1-p),BODY.y+b[3]*scale]);
  }else if(stage===1){
    plate(idx);grid();const scan=BODY.y+BODY.h*smooth(2.45,4.2,time);
    ctx.save();ctx.beginPath();ctx.rect(0,0,800,scan);ctx.clip();sourcePath(idx);ctx.fillStyle=green;ctx.fill();ctx.restore();
    ctx.strokeStyle=green;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(205,scan);ctx.lineTo(595,scan);ctx.stroke();
  }else if(stage===2){
    grid();sourcePath(idx);ctx.fillStyle='#dde6d7';ctx.fill();ctx.save();sourcePath(idx);ctx.clip();ctx.strokeStyle='#295f4c70';ctx.lineWidth=.8;ctx.beginPath();
    for(let y=60,r=0;y<710;y+=26,r++)for(let x=230+r%2*15;x<565;x+=30){ctx.moveTo(x,y);ctx.lineTo(x+30,y);ctx.lineTo(x+15,y+26);ctx.closePath()}ctx.stroke();ctx.restore();
    ctx.globalAlpha=.7;ctx.drawImage(wires[idx],BODY.x,BODY.y,BODY.w,BODY.h);ctx.globalAlpha=1;sourcePath(idx);ctx.strokeStyle=green;ctx.stroke();
  }else{
    plate(idx);
    if(stage===4){
      data.palette.forEach((c,k)=>{const p=smooth(10.2+k*.15,10.2+k*.15+.6,time),x=590,y=80+k*74,ax=BODY.x+140,ay=BODY.y+220;const px=ax+(x-ax)*p,py=ay+(y-ay)*p;ctx.fillStyle=c.hex;ctx.fillRect(px,py,41,32);ctx.strokeStyle='#8b998b50';ctx.strokeRect(px,py,41,32);if(p>.8){ctx.fillStyle=green;ctx.font='12px Consolas,monospace';ctx.fillText(c.hex,x+53,y+12);ctx.fillStyle=muted;ctx.font='10px Consolas,monospace';ctx.fillText(c.percentage.toFixed(1)+'%',x+53,y+30)}})
    }else if(stage===5){ctx.fillStyle=green;ctx.font='14px Consolas,monospace';ctx.fillText('ANATOMICAL PLATE',565,100);ctx.fillStyle=muted;ctx.font='10px Consolas,monospace';ctx.fillText('3 ИСХОДНЫХ ВИДА',565,127);ctx.fillText('5 СИСТЕМ В 3D',565,151);ctx.fillText('УЧЕБНАЯ МОДЕЛЬ',565,175)}
  }
  if(!selected&&manualView===null&&time>14.35){const p=smooth(14.35,14.96,time);ctx.globalAlpha=p;ctx.fillStyle='#eeeee4';ctx.fillRect(0,0,800,760);plate(0);ctx.globalAlpha=1}
  updateIllustrationUI(stage,part,idx);
}
function updateIllustrationUI(stage,part,index){
  const key=`${stage}/${part?.id||''}/${manualView}`;
  if(lastUI!==key){lastUI=key;$('stage-kicker').textContent=selected?'DETAIL / ORIGINAL':manualView!==null?'ORIGINAL / PLATE '+(index+1):`${String(stage+1).padStart(2,'0')} / ${stages[stage]}`;
    $('stage-title').textContent=part?part.title:manualView!==null?data.views[index].title:titles[stage];
    $('stage-caption').textContent=part?'Увеличение исходного фрагмента':manualView!==null?'Один из трёх предоставленных кадров':captions[stage];
    setReadout(part?{partId:part.id,title:part.title,description:part.description,source:'Иллюстрация / '+data.views[index].title}:null);
    [...$('parts').children].forEach(b=>b.setAttribute('aria-pressed',String(part?.id===b.dataset.part)));
    updateSystems();paintMap(part);
  }
  [...$('stages').children].forEach((b,k)=>{b.setAttribute('aria-current',String(k===stage));const p=k<stage?1:k===stage?Math.max(0,Math.min(1,(time-data.stageStarts[k])/(data.stageStarts[k+1]-data.stageStarts[k]))):0;b.style.setProperty('--progress',p*100+'%')});
  $('timeline').value=String(time);$('elapsed').textContent='00:'+String(Math.floor(time)).padStart(2,'0');$('play').textContent=playing?'Ⅱ':'▶';$('play').setAttribute('aria-label',playing?'Пауза':'Воспроизвести');
}
function paintMap(part){const c=$('body-map'),d=c.getContext('2d');d.clearRect(0,0,c.width,c.height);const s=.32,x=9,y=6;d.globalAlpha=.28;d.drawImage(masks[0],x,y,233*s,480*s);d.globalAlpha=1;
  if(part){const b=part.box;d.fillStyle='#295f4c30';d.fillRect(x+b[0]*s,y+b[1]*s,(b[2]-b[0])*s,(b[3]-b[1])*s);d.strokeStyle=green;d.lineWidth=1;d.strokeRect(x+b[0]*s,y+b[1]*s,(b[2]-b[0])*s,(b[3]-b[1])*s)}$('map-region').textContent=part?part.title:'Всё тело';}
function setReadout(item){$('readout-title').textContent=item?item.title:'Общий вид';$('readout-description').textContent=item?item.description:mode==='model'?'Включайте системы тела, вращайте модель и выбирайте структуры непосредственно на ней.':'Выберите область на изображении или в списке справа.';$('source-name').textContent=item?.source||'';$('readout-label').textContent=item?'В ФОКУСЕ':'ОБЛАСТЬ АТЛАСА';$('clear-selection').hidden=!item;$('isolate').hidden=!(mode==='model'&&item);isolate=false;$('isolate').setAttribute('aria-pressed','false')}
function updateSystems(){for(const b of $('systems').children){const sys=b.dataset.system;const on=mode==='model'?viewer?.enabled.has(sys):systemList.find(s=>s[0]===sys)?.[2]===viewIndex;b.setAttribute('aria-pressed',String(!!on))}}
async function ensureViewer(){
  if(viewerPromise)return viewerPromise;
  viewerPromise=(async()=>{const {AnatomyViewer}=await import('./model-viewer.js');viewer=new AnatomyViewer($('model'),{
    onSelect:item=>{if(mode!=='model')return;setReadout(item);const part=data.parts.find(p=>p.id===item?.partId);paintMap(part);$('stage-title').textContent=item?item.title:'Объёмный атлас';$('stage-caption').textContent=item?'Выбранная структура 3D-модели':'Вращение · выбор · прозрачность';[...$('parts').children].forEach(b=>b.setAttribute('aria-pressed',String(item?.partId===b.dataset.part)))},
    onStatus:status=>{if(mode!=='model')return;$('model-loading').hidden=!status.loading&&!!viewer?.ready;$('model-status').textContent=status.text;if(status.error){$('model-error').hidden=false;$('model-error').textContent='Не удалось открыть 3D-модель: '+status.error}},onLayers:updateSystems});await viewer.init(data.parts);viewer.activate(mode==='model');return viewer})();
  try{return await viewerPromise}catch(error){$('model-loading').hidden=true;$('model-error').hidden=mode!=='model';$('model-error').textContent='3D-просмотр недоступен в этом браузере: '+error.message+'. Иллюстрация продолжает работать.';console.error(error);throw error}
}
async function setMode(next){
  if(!ready)return;
  mode=next;playing=false;selected=null;manualView=null;lastUI='';
  [...$('parts').children].forEach(b=>b.setAttribute('aria-pressed','false'));
  $('mode-illustration').classList.toggle('active',next==='illustration');$('mode-model').classList.toggle('active',next==='model');$('mode-illustration').setAttribute('aria-pressed',String(next==='illustration'));$('mode-model').setAttribute('aria-pressed',String(next==='model'));
  $('illustration').hidden=next==='model';$('model').hidden=next!=='model';$('viewport').classList.toggle('is-3d',next==='model');
  $('transport').hidden=next==='model';$('stages').hidden=next==='model';$('model-controls').hidden=next!=='model';$('model-hint').hidden=next!=='model';$('opacity-control').hidden=next!=='model';
  $('view-tag').textContent=next==='model'?'Z-ANATOMY / GLB ATLAS':'ORIGINAL PLATE / 3 VIEWS';$('mode-note').textContent=next==='model'?'3D / ВЫБОР СТРУКТУР':'ИЛЛЮСТРАЦИЯ / 15-СЕКУНДНЫЙ ЦИКЛ';$('view-stamp').textContent=next==='model'?'Z-ANATOMY / BODYPARTS3D':'233 × 480 / SOURCE PRESERVED';
  $('system-hint').textContent=next==='model'?'Системы включаются независимо. Файлы загружаются по мере выбора.':'В иллюстрации переключаются три исходных вида.';
  $('guide-copy').textContent=next==='model'?'Потяните для вращения. Выберите структуру нажатием.':'Иллюстрация остаётся исходной. 3D-модель открывается отдельно.';
  $('model-error').hidden=true;setReadout(null);paintMap(null);
  if(next==='model'){$('stage-kicker').textContent='3D / OPEN ANATOMY';$('stage-title').textContent='Объёмный атлас';$('stage-caption').textContent='Вращение · выбор · прозрачность';$('model-loading').hidden=true;try{const v=await ensureViewer();if(mode==='model'){v.activate(true);v.clear();$('model-loading').hidden=true}}catch{}}
  else{viewer?.activate(false);$('model-loading').hidden=true}updateSystems();
}
async function choosePart(id){const part=data.parts.find(p=>p.id===id);if(!part)return;if(mode==='model'){try{const v=await ensureViewer();await v.selectRegion(part)}catch{}}else{selected=part;manualView=null;playing=false;springKey='';lastUI=''} }
function clear(){if(mode==='model'){viewer?.clear();return}selected=null;manualView=null;playing=true;time=0;lastUI='';springKey=''}
function seek(value){selected=null;manualView=null;playing=false;time=Math.max(0,Math.min(14.999,Number(value)));lastUI='';springKey=''}
function togglePlay(){selected=null;manualView=null;if(time>14.96)time=0;playing=!playing;lastUI=''}
$('mode-illustration').addEventListener('click',()=>setMode('illustration'));$('mode-model').addEventListener('click',()=>setMode('model'));
$('play').addEventListener('click',togglePlay);$('restart').addEventListener('click',clear);$('clear-selection').addEventListener('click',clear);$('timeline').addEventListener('input',e=>seek(e.target.value));
$('loop').addEventListener('click',()=>{loop=!loop;$('loop').setAttribute('aria-pressed',String(loop))});
$('opacity').addEventListener('input',e=>{$('opacity-value').textContent=Math.round(Number(e.target.value)*100)+'%';viewer?.setOpacity(e.target.value)});
$('isolate').addEventListener('click',()=>{isolate=!isolate;viewer?.setIsolated(isolate);$('isolate').setAttribute('aria-pressed',String(isolate))});
$('camera-front').addEventListener('click',()=>viewer?.face(false));$('camera-back').addEventListener('click',()=>viewer?.face(true));$('camera-reset').addEventListener('click',()=>viewer?.clear());
$('fascia').addEventListener('click',()=>{const value=$('fascia').getAttribute('aria-pressed')!=='true';viewer?.setFascia(value);$('fascia').setAttribute('aria-pressed',String(value))});
$('auto-rotate').addEventListener('click',()=>{rotating=!rotating;viewer?.rotate(rotating);$('auto-rotate').setAttribute('aria-pressed',String(rotating))});
document.addEventListener('keydown',e=>{if(/INPUT|TEXTAREA/.test(document.activeElement.tagName))return;if(e.key==='Escape'){clear()}if(e.code==='Space'){e.preventDefault();if(mode==='model')$('auto-rotate').click();else togglePlay()}});
canvas.addEventListener('click',e=>{if(!ready)return;const r=canvas.getBoundingClientRect(),s=Math.min(r.width/800,r.height/760);const x=(e.clientX-r.left-(r.width-800*s)/2)/s,y=(e.clientY-r.top-(r.height-760*s)/2)/s;const part=data.parts.find(p=>{const b=boxFor(p);return x>=b[0]&&x<=b[2]&&y>=b[1]&&y<=b[3]});if(part)choosePart(part.id)});
function tick(now){const dt=Math.min(.05,last?(now-last)/1000:1/60);last=now;if(ready&&mode==='illustration'&&!document.hidden){if(playing){time+=dt;if(time>=15){if(loop)time%=15;else{time=14.999;playing=false}}}drawIllustration(dt)}requestAnimationFrame(tick)}requestAnimationFrame(tick);
function image(url){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('Не удалось открыть '+url));im.src=url})}
async function boot(){
  data=await(await fetch('assets/illustration.json')).json();
  [images,wires,masks]=await Promise.all([Promise.all([0,1,2].map(i=>image(`assets/source/${i}.png`))),Promise.all([0,1,2].map(i=>image(`assets/source/wire-${i}.png`))),Promise.all([0,1,2].map(i=>image(`assets/source/map-${i}.png`)))]);
  stages.forEach((name,k)=>{const b=document.createElement('button');b.type='button';b.className='stage-button';b.setAttribute('aria-label',`${k+1}. ${titles[k]}`);b.innerHTML=`<small>0${k+1}</small><span>${name}</span>`;b.addEventListener('click',()=>seek(data.stageStarts[k]+.35));$('stages').append(b)});
  data.parts.forEach((part,k)=>{const b=document.createElement('button');b.type='button';b.className='part-button';b.dataset.part=part.id;b.setAttribute('aria-pressed','false');b.innerHTML=`<img src="assets/${part.id}.webp" alt="" width="48" height="41"><span><strong>${part.title}</strong><small>0${k+1} / ${part.en}</small></span><b aria-hidden="true">↗</b>`;b.addEventListener('click',()=>choosePart(part.id));$('parts').append(b)});
  systemList.forEach(([id,title,index])=>{const b=document.createElement('button');b.type='button';b.className='system-button';b.dataset.system=id;b.setAttribute('aria-pressed','false');b.innerHTML=`<i aria-hidden="true"></i>${title}`;b.addEventListener('click',async()=>{if(mode==='illustration'){selected=null;manualView=index;viewIndex=index;playing=false;lastUI='';springKey=''}else{try{const v=await ensureViewer();await v.setLayer(id,!v.enabled.has(id))}catch{}}});$('systems').append(b)});
  ready=true;paintMap(null);updateSystems();
}
boot().catch(error=>{$('stage-title').textContent='Не удалось загрузить данные';$('stage-caption').textContent=error.message;console.error(error)});
