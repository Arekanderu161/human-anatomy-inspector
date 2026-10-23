import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';

const SYSTEM_NAMES={skeleton:'Кости',muscular:'Мышцы',cardiovascular:'Сосуды',nervous:'Нервы',visceral:'Органы'};
const RU=[[/^frontal bone/i,'Лобная кость'],[/^parietal bone/i,'Теменная кость'],[/^occipital bone/i,'Затылочная кость'],[/^temporal bone/i,'Височная кость'],[/^mandible/i,'Нижняя челюсть'],[/^sternum/i,'Грудина'],[/^sacrum/i,'Крестец'],[/^coccyx/i,'Копчик'],[/^hip bone/i,'Тазовая кость'],[/^femur/i,'Бедренная кость'],[/^humerus/i,'Плечевая кость'],[/^tibia/i,'Большеберцовая кость'],[/^scapula/i,'Лопатка'],[/^clavicle/i,'Ключица'],[/^liver/i,'Печень'],[/^stomach/i,'Желудок'],[/^lung/i,'Лёгкое'],[/^heart/i,'Сердце'],[/^small intestine/i,'Тонкая кишка'],[/^ascending colon/i,'Восходящая ободочная кишка'],[/^descending colon/i,'Нисходящая ободочная кишка'],[/^transverse colon/i,'Поперечная ободочная кишка']];
function cleanName(name){return name.replace(/\.\d+$/,'').replace(/\.([lr])$/,'').replace(/_/g,' ')}
function labelFor(name){const clean=cleanName(name);const hit=RU.find(([pattern])=>pattern.test(clean));return hit?hit[1]:clean}

export class AnatomyViewer{
  constructor(canvas,{onSelect,onStatus,onLayers}){
    this.canvas=canvas;this.onSelect=onSelect;this.onStatus=onStatus;this.onLayers=onLayers;
    this.groups=new Map();this.promises=new Map();this.meshes=[];this.enabled=new Set(['skeleton','visceral']);
    this.opacity=1;this.selected=new Set();this.isolated=false;this.fasciaVisible=false;this.active=false;this.dirty=true;this.parts=[];
    this.cameraGoal=null;this.targetGoal=null;this.ready=false;this.normalized=false;this.last=0;
  }
  async init(parts){
    this.parts=parts;if(this.initPromise)return this.initPromise;
    this.initPromise=this.setup();return this.initPromise;
  }
  async setup(){
    this.renderer=new THREE.WebGLRenderer({canvas:this.canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
    this.renderer.setClearColor(0x101b1b);this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.12;
    this.scene=new THREE.Scene();this.root=new THREE.Group();this.scene.add(this.root);
    this.camera=new THREE.PerspectiveCamera(36,1,.01,100);this.camera.position.set(0,0,5.2);
    this.controls=new OrbitControls(this.camera,this.canvas);this.controls.enableDamping=true;this.controls.dampingFactor=.075;
    this.controls.minDistance=.15;this.controls.maxDistance=9;this.controls.autoRotateSpeed=.65;
    this.controls.addEventListener('start',()=>{this.cameraGoal=null;this.targetGoal=null});
    this.controls.addEventListener('change',()=>{this.dirty=true});
    this.scene.add(new THREE.HemisphereLight(0xf5f6e8,0x2e443f,2.1));
    for(const [color,intensity,pos] of [[0xfff1d8,3,[3,4,5]],[0xb6e7e4,2,[-4,1,-3]],[0xffffff,1.3,[0,-2,4]]]){
      const light=new THREE.DirectionalLight(color,intensity);light.position.set(...pos);this.scene.add(light)
    }
    const grid=new THREE.GridHelper(5,25,0x426454,0x233c32);grid.position.y=-1.52;grid.material.transparent=true;grid.material.opacity=.28;this.scene.add(grid);
    this.loader=new GLTFLoader();this.draco=new DRACOLoader();
    this.draco.setDecoderPath(new URL('./vendor/three/examples/jsm/libs/draco/gltf/',import.meta.url).href);this.draco.setWorkerLimit(2);this.loader.setDRACOLoader(this.draco);
    this.raycaster=new THREE.Raycaster();this.pointer=new THREE.Vector2();let down=null;
    this.canvas.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY}});
    this.canvas.addEventListener('pointerup',e=>{if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<6)this.pick(e);down=null});
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(this.canvas.parentElement);this.resize();
    await Promise.all([...this.enabled].map(id=>this.loadSystem(id)));
    this.ready=true;this.resize();this.resetCamera(true);this.updateMaterials();this.onStatus({loading:false,text:'Модель готова'});
    this.renderer.setAnimationLoop(now=>this.tick(now));
  }
  async loadSystem(id){
    if(this.groups.has(id))return this.groups.get(id);
    if(this.promises.has(id))return this.promises.get(id);
    const job=(async()=>{
      this.onStatus({loading:true,text:`Загрузка системы: ${SYSTEM_NAMES[id]}…`});
      const gltf=await this.loader.loadAsync(new URL(`./assets/models/${id}.glb`,import.meta.url).href);
      const group=gltf.scene;const helpers=[];
      group.traverse(obj=>{
        if(!obj.isMesh)return;
        const a=gltf.parser.associations.get(obj)||{};
        const name=gltf.parser.json.nodes?.[a.nodes]?.name||gltf.parser.json.meshes?.[a.meshes]?.name||obj.name;
        if(/\.g(?:\.|$)/i.test(name)){helpers.push(obj);return}
        obj.userData.sourceName=name;obj.userData.system=id;obj.userData.label=labelFor(name);
        obj.userData.isFascia=id==='muscular'&&/\bfascia\b/i.test(name);
        const material=Array.isArray(obj.material)?obj.material[0]:obj.material;
        obj.material=material.clone();obj.material.roughness=.68;obj.material.metalness=0;
        obj.userData.color=obj.material.color.clone();obj.userData.emissive=obj.material.emissive?.clone()||new THREE.Color(0);
        obj.geometry.computeBoundingBox();this.meshes.push(obj);
      });
      helpers.forEach(obj=>obj.removeFromParent());group.visible=this.enabled.has(id);this.groups.set(id,group);this.root.add(group);
      if(id==='skeleton'&&!this.normalized){
        group.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(group),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
        const factor=3/size.y;this.root.scale.setScalar(factor);this.root.position.copy(center).multiplyScalar(-factor);this.normalized=true;
      }
      this.root.updateMatrixWorld(true);this.updateMaterials();this.onLayers([...this.enabled]);
      this.onStatus({loading:false,text:`${SYSTEM_NAMES[id]} — загружено`});return group;
    })();
    this.promises.set(id,job);
    try{return await job}catch(error){this.promises.delete(id);this.enabled.delete(id);this.onLayers([...this.enabled]);this.onStatus({loading:false,text:`Ошибка загрузки: ${SYSTEM_NAMES[id]}`,error:String(error.message||error)});throw error}
  }
  resize(){
    if(!this.renderer)return;const r=this.canvas.parentElement.getBoundingClientRect();if(!r.width||!r.height)return;
    this.renderer.setSize(r.width,r.height,false);this.camera.aspect=r.width/r.height;this.camera.updateProjectionMatrix();this.dirty=true;
  }
  activate(active){this.active=active;if(active){this.resize();this.dirty=true}}
  tick(now){
    const dt=Math.min(.05,this.last?(now-this.last)/1000:1/60);this.last=now;
    if(!this.active||document.hidden)return;
    let moving=false;
    if(this.cameraGoal){const p=1-Math.exp(-dt/.16);this.camera.position.lerp(this.cameraGoal,p);this.controls.target.lerp(this.targetGoal,p);moving=true;
      if(this.camera.position.distanceTo(this.cameraGoal)<.001&&this.controls.target.distanceTo(this.targetGoal)<.001){this.camera.position.copy(this.cameraGoal);this.controls.target.copy(this.targetGoal);this.cameraGoal=null;this.targetGoal=null}}
    const changed=this.controls.update();if(this.dirty||changed||moving||this.controls.autoRotate){this.renderer.render(this.scene,this.camera);this.dirty=false}
  }
  async setLayer(id,on){
    if(on)this.enabled.add(id);else this.enabled.delete(id);
    if(on)await this.loadSystem(id);
    if(this.groups.has(id))this.groups.get(id).visible=this.enabled.has(id);
    this.updateMaterials();this.onLayers([...this.enabled]);
  }
  async selectRegion(part){
    await this.setLayer(part.system,true);
    const pattern=new RegExp(part.match,'i');const matches=this.meshes.filter(m=>m.userData.system===part.system&&pattern.test(m.userData.sourceName));
    this.selected=new Set(matches);this.isolated=false;this.updateMaterials();
    if(matches.length)this.frame(matches);
    this.onSelect({partId:part.id,title:part.title,description:part.description,source:`Элементов модели: ${matches.length} · ${SYSTEM_NAMES[part.system]} · Z-Anatomy`,count:matches.length});
  }
  clear(){this.selected.clear();this.isolated=false;this.updateMaterials();this.resetCamera();this.onSelect(null)}
  setOpacity(value){this.opacity=Number(value);this.updateMaterials()}
  setIsolated(value){this.isolated=value&&this.selected.size>0;this.updateMaterials()}
  setFascia(value){this.fasciaVisible=value;this.updateMaterials()}
  updateMaterials(){
    for(const mesh of this.meshes){
      const selected=this.selected.has(mesh),any=this.selected.size>0;
      mesh.visible=!(this.isolated&&any&&!selected)&&(this.fasciaVisible||!mesh.userData.isFascia||selected);
      const alpha=selected?1:this.opacity*(any ? .18 : 1),mat=mesh.material;
      if(mat.transparent!==(alpha<.999)){mat.transparent=alpha<.999;mat.needsUpdate=true}
      mat.opacity=alpha;mat.depthWrite=alpha>=.999;mat.color.copy(selected?new THREE.Color(0x9ce0ba):mesh.userData.color);
      if(mat.emissive){mat.emissive.copy(selected?new THREE.Color(0x153c26):mesh.userData.emissive);mat.emissiveIntensity=selected ? .55 : 1}
    }
    this.dirty=true;
  }
  frame(meshes,immediate=false){
    this.root.updateMatrixWorld(true);const box=new THREE.Box3();for(const m of meshes)box.expandByObject(m);
    if(box.isEmpty())return;const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
    const span=Math.max(size.y,size.x/Math.max(.35,this.camera.aspect),size.z,.1);
    const distance=Math.max(.35,span/(2*Math.tan(THREE.MathUtils.degToRad(this.camera.fov*.5)))*1.32);
    const direction=this.camera.position.clone().sub(this.controls.target).normalize();
    this.targetGoal=center;this.cameraGoal=center.clone().add(direction.multiplyScalar(distance));
    if(immediate){this.camera.position.copy(this.cameraGoal);this.controls.target.copy(center);this.cameraGoal=null;this.targetGoal=null;this.controls.update()}
    this.dirty=true;
  }
  resetCamera(immediate=false){
    const skeleton=this.groups.get('skeleton');if(!skeleton)return;
    this.camera.position.set(0,.02,5.5);this.controls.target.set(0,0,0);
    this.frame(this.meshes.filter(m=>m.userData.system==='skeleton'),immediate);
  }
  face(back=false){const center=this.controls.target.clone(),distance=this.camera.position.distanceTo(center);this.cameraGoal=center.clone().add(new THREE.Vector3(0,.025,back?-distance:distance));this.targetGoal=center;this.dirty=true}
  rotate(value){this.controls.autoRotate=value;this.dirty=true}
  pick(event){
    const r=this.canvas.getBoundingClientRect();this.pointer.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);
    this.raycaster.setFromCamera(this.pointer,this.camera);
    const visible=this.meshes.filter(m=>m.visible&&this.enabled.has(m.userData.system));
    const hit=this.raycaster.intersectObjects(visible,false)[0];if(!hit)return;
    const mesh=hit.object;this.selected=new Set([mesh]);this.isolated=false;this.updateMaterials();
    const name=mesh.userData.sourceName;const part=this.parts.find(p=>p.system===mesh.userData.system&&new RegExp(p.match,'i').test(name));
    this.onSelect({partId:part?.id||null,title:mesh.userData.label,description:`Выбрана отдельная структура системы «${SYSTEM_NAMES[mesh.userData.system]}». Вращайте модель или изолируйте её для осмотра.`,source:cleanName(name)+' · Z-Anatomy',count:1});
  }
}
