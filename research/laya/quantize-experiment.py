from pathlib import Path
import onnx,shutil
from onnxruntime.quantization import QuantType,quantize_dynamic
out=Path('laya-onnx-int8');out.mkdir(exist_ok=True)
m=onnx.load('laya-onnx-fp32/encoder.onnx');del m.graph.value_info[:]
onnx.save(m,'laya-onnx-fp32/encoder-prepared.onnx',save_as_external_data=True,all_tensors_to_one_file=True,location='encoder-prepared.onnx.data',size_threshold=1024)
del m
quantize_dynamic('laya-onnx-fp32/encoder-prepared.onnx',str(out/'encoder.onnx'),op_types_to_quantize=['MatMul','Gather'],weight_type=QuantType.QInt8,per_channel=False,reduce_range=False,use_external_data_format=False)
h=onnx.load('laya-onnx-fp32/head.onnx');onnx.save(h,str(out/'head.onnx'));del h
for name in ['rl_agent_config.json','tokenizer.json']:shutil.copy('laya-onnx-fp32/'+name,out/name)
for p in out.iterdir():print(p.name,p.stat().st_size,flush=True)
