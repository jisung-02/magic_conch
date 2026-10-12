"""Recheck archived Korean inputs against FP32 and packed trained ONNX models.
Run from any directory: python reproduce-packed-parity.py --model-root PATH
Does not overwrite the original experimental result files.
"""
import argparse, json, pathlib, time
import numpy as np
import onnxruntime as ort
parser=argparse.ArgumentParser()
parser.add_argument('--model-root', type=pathlib.Path, required=True)
parser.add_argument('--output', type=pathlib.Path)
args=parser.parse_args()
inputs=json.loads(pathlib.Path(__file__).with_name('inputs.json').read_text())
options=ort.SessionOptions()
options.intra_op_num_threads=2
options.graph_optimization_level=ort.GraphOptimizationLevel.ORT_ENABLE_BASIC
results={}
for variant in ['fp32','packed']:
 folder=args.model_root/f'laya-onnx-{variant}'
 encoder=ort.InferenceSession(str(folder/'encoder.onnx'), sess_options=options)
 head=ort.InferenceSession(str(folder/'head.onnx'), sess_options=options)
 rows=[]
 for query,batch in zip(inputs['questions'], inputs['batches']):
  start=time.perf_counter()
  mask=np.array(batch['attentionMask'], dtype=np.int64)
  hidden=encoder.run(None, {'input_ids':np.array(batch['inputIds'], dtype=np.int64), 'attention_mask':mask})[0]
  logits,act=head.run(None, {'hidden_states':hidden,'marker_pos':np.array(batch['markerPos'],dtype=np.int64),'marker_mask':np.array(batch['markerMask'],dtype=np.bool_),'qtype':np.array(batch['qtype'],dtype=np.int64).reshape(-1,1),'attention_mask':mask})
  probabilities=np.exp(logits-logits.max());probabilities/=probabilities.sum()
  rows.append({'query':query,'choice':int(probabilities.argmax()),'probabilities':probabilities.tolist(),'ms':(time.perf_counter()-start)*1000})
 results[variant]=rows
 del encoder,head
summary={'agreement':sum(a['choice']==b['choice'] for a,b in zip(results['fp32'],results['packed'])),'count':len(inputs['questions']),'max_probability_drift':max(abs(x-y) for a,b in zip(results['fp32'],results['packed']) for x,y in zip(a['probabilities'][0],b['probabilities'][0]))}
print(json.dumps(summary,indent=2))
if args.output:args.output.write_text(json.dumps({'summary':summary,'results':results},ensure_ascii=False,indent=2))
