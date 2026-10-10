"""Reproducible export of the trained multilingual Laya checkpoint; no random head."""
import os,sys,json,hashlib,subprocess,pathlib,shutil,zipfile
from huggingface_hub import snapshot_download
MODEL='convaiinnovations/laya-multilingual';REV='e4e9ddf21a7b1903b7acffd8814ad4307bf63a67';SRC='68804629e8ccd9d616d48a40e87de9fabbeae069'
root=pathlib.Path.cwd();snapshot_download(MODEL,revision=REV,local_dir='laya-checkpoint')
weights=pathlib.Path('laya-checkpoint/model.safetensors');assert hashlib.sha256(weights.read_bytes()).hexdigest()=='9d628fd971b700382ac6f65920a86f149777b2e748e0c955fb3b19695aa8f204'
subprocess.run(['git','clone','https://github.com/NandhaKishorM/laya.git','laya-export-source'],check=True)
subprocess.run(['git','-C','laya-export-source','checkout',SRC],check=True)
source=pathlib.Path('laya-export-source/laya-ts/scripts/export_onnx.py').read_text();source=source.replace('model.load_state_dict(_load_safetensors(weights_path), strict=False)','print(model.load_state_dict(_load_safetensors(weights_path), strict=True))');pathlib.Path('export-strict.py').write_text(source)
subprocess.run([sys.executable,'export-strict.py','--model-dir','laya-checkpoint','--out-dir','laya-onnx-fp32'],check=True,env={**os.environ,'PYTHONPATH':str(root/'laya-export-source')})
subprocess.run([sys.executable,'scripts/pack-laya.py'],check=True)
folder=pathlib.Path('laya-onnx-packed');files={}
for key,name in [('encoder','encoder.onnx'),('head','head.onnx'),('tokenizer','tokenizer.json'),('config','rl_agent_config.json')]:
 p=folder/name;files[key]={'path':name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
manifest={'model':MODEL,'revision':REV,'upstream':SRC,'format':'FP16 weight storage, verified exact FP32 reconstruction and FP32 computation; trained head; WASM','files':files,'totalBytes':sum(f['bytes'] for f in files.values())}
(folder/'manifest.json').write_text(json.dumps(manifest,indent=2));shutil.copy('laya-export-source/LICENSE',folder/'LICENSE');(folder/'NOTICE').write_text('Laya by Convai Innovations, Apache-2.0. Exported from '+MODEL+'@'+REV+'.\nStored weights FP16, cast to exact original FP32 for computation; original trained decision head.\n')
with zipfile.ZipFile('laya-multilingual-packed.zip','w',compression=zipfile.ZIP_DEFLATED,compresslevel=1) as z:
 for p in folder.iterdir():z.write(p,p.name)
print(json.dumps(manifest,indent=2))
