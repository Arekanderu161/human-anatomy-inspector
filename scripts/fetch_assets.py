from pathlib import Path
import json,urllib.request,tarfile,io,hashlib,struct,shutil
ROOT=Path(__file__).resolve().parents[1];D=ROOT/'dist';A=D/'assets'
COMMIT='322ba39e96ea91ce08601caad2c0aaade1dc99f0'
THREE='0.186.1'
def download(url,path):
    path.parent.mkdir(parents=True,exist_ok=True)
    if not path.exists():
        with urllib.request.urlopen(url,timeout=90) as r:path.write_bytes(r.read())
    print(f'{path.name}: {path.stat().st_size}',flush=True)
    return path.read_bytes()

manifest={'source':'https://github.com/JMK712/human-anatomy-online','commit':COMMIT,'upstream':'https://github.com/Z-Anatomy/Models-of-human-anatomy','three_version':THREE,'models':{}}
for name in ['skeleton','muscular','cardiovascular','nervous','visceral']:
    url=f'https://raw.githubusercontent.com/JMK712/human-anatomy-online/{COMMIT}/public/models/{name}.glb'
    raw=download(url,A/'models'/f'{name}.glb')
    assert raw[:4]==b'glTF'
    length,kind=struct.unpack_from('<II',raw,12);gltf=json.loads(raw[20:20+length])
    names=[n.get('name','') for n in gltf.get('nodes',[]) if 'mesh' in n]
    manifest['models'][name]={'file':f'{name}.glb','url':url,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'nodes':len(names),'extensions':gltf.get('extensionsUsed',[]),'names':names}
download('https://raw.githubusercontent.com/Z-Anatomy/Models-of-human-anatomy/master/License.txt',D/'Z-ANATOMY-NOTICE.txt')
download(f'https://raw.githubusercontent.com/JMK712/human-anatomy-online/{COMMIT}/README.md',ROOT/'licenses'/'GLB-EXPORT-PROVENANCE.md')
package=download(f'https://registry.npmjs.org/three/-/three-{THREE}.tgz',ROOT/'three-package.tgz')
with tarfile.open(fileobj=io.BytesIO(package),mode='r:gz') as tar:
    wanted=['build/three.module.js','build/three.core.js','examples/jsm/loaders/GLTFLoader.js','examples/jsm/loaders/DRACOLoader.js','examples/jsm/controls/OrbitControls.js','examples/jsm/utils/BufferGeometryUtils.js','examples/jsm/utils/SkeletonUtils.js','examples/jsm/libs/draco/gltf/draco_decoder.js','examples/jsm/libs/draco/gltf/draco_decoder.wasm','examples/jsm/libs/draco/gltf/draco_wasm_wrapper.js','LICENSE']
    for relative in wanted:
        member=tar.getmember('package/'+relative)
        dst=D/'vendor'/'three'/relative;dst.parent.mkdir(parents=True,exist_ok=True)
        dst.write_bytes(tar.extractfile(member).read())
(A/'models'/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:{'nodes':v['nodes'],'bytes':v['bytes'],'extensions':v['extensions'],'examples':v['names'][:5]} for k,v in manifest['models'].items()},indent=2),flush=True)
