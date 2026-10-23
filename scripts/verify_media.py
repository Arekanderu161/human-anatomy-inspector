from pathlib import Path
import json,subprocess
import numpy as np
from PIL import Image
import imageio_ffmpeg
ROOT=Path(__file__).resolve().parents[1];A=ROOT/'dist'/'assets'
im=Image.open(A/'human-anatomy.gif');first=np.array(im.convert('RGB'));durations=[]
for i in range(im.n_frames):im.seek(i);durations.append(im.info['duration'])
assert im.n_frames==225 and sum(durations)==15000
assert im.info.get('loop')==0 and im.size==(800,900)
assert np.array_equal(first,np.array(im.convert('RGB')))
exe=imageio_ffmpeg.get_ffmpeg_exe();r=subprocess.run([exe,'-hide_banner','-i',str(A/'human-anatomy.mp4'),'-f','null','-'],capture_output=True,check=True)
s=r.stderr.decode(errors='replace');assert '15 fps' in s and '225' in s and '800x900' in s and '00:00:15.00' in s
data={'frames':225,'fps':15,'seconds':15,'resolution':[800,900],'gif_infinite_loop':True,'gif_first_last_identical':True,'mp4_full_decode':'passed','gif_bytes':(A/'human-anatomy.gif').stat().st_size,'mp4_bytes':(A/'human-anatomy.mp4').stat().st_size}
(ROOT/'media-validation.json').write_text(json.dumps(data,indent=2));print(json.dumps(data,indent=2))
