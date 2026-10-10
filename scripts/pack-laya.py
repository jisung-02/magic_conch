import onnx,numpy as np,pathlib,shutil
from onnx import numpy_helper,helper,TensorProto
out=pathlib.Path('laya-onnx-packed');out.mkdir(exist_ok=True)
for part in ['encoder','head']:
 m=onnx.load(f'laya-onnx-fp32/{part}.onnx');casts=[]
 for i,t in enumerate(m.graph.initializer):
  if t.data_type!=TensorProto.FLOAT:continue
  a=numpy_helper.to_array(t);old=t.name
  if a.size<1024:continue
  assert np.array_equal(a,a.astype(np.float16).astype(np.float32)), f'Lossy weight packing: {old}';short=old+'__stored_fp16';new=numpy_helper.from_array(a.astype(np.float16),short);m.graph.initializer[i].CopyFrom(new);casts.append(helper.make_node('Cast',[short],[old],to=TensorProto.FLOAT))
 nodes=list(m.graph.node);del m.graph.node[:];m.graph.node.extend(casts+nodes);del m.graph.value_info[:];onnx.save(m,str(out/f'{part}.onnx'));print(part,(out/f'{part}.onnx').stat().st_size,flush=True);del m
for name in ['rl_agent_config.json','tokenizer.json']:shutil.copy('laya-onnx-fp32/'+name,out/name)
