import json,numpy as np,onnxruntime as ort,time,pathlib
base=pathlib.Path('source/magic-conch/research/laya');inputs=json.loads((base/'inputs.json').read_text());results={}
opts=ort.SessionOptions();opts.intra_op_num_threads=2;opts.graph_optimization_level=ort.GraphOptimizationLevel.ORT_ENABLE_BASIC
for name in ['fp32','int8']:
 start=time.perf_counter();enc=ort.InferenceSession(f'laya-onnx-{name}/encoder.onnx',sess_options=opts);head=ort.InferenceSession(f'laya-onnx-{name}/head.onnx',sess_options=opts);rows=[];print(name,'load',time.perf_counter()-start,flush=True)
 for q,b in zip(inputs['questions'],inputs['batches']):
  start=time.perf_counter();ids=np.array(b['inputIds'],dtype=np.int64);mask=np.array(b['attentionMask'],dtype=np.int64)
  hidden=enc.run(None,{'input_ids':ids,'attention_mask':mask})[0]
  logits,act=head.run(None,{'hidden_states':hidden,'marker_pos':np.array(b['markerPos'],dtype=np.int64),'marker_mask':np.array(b['markerMask'],dtype=np.bool_),'qtype':np.array(b['qtype'],dtype=np.int64).reshape(-1,1),'attention_mask':mask})
  probs=np.exp(logits-logits.max());probs/=probs.sum();rows.append({'query':q,'choice':int(probs.argmax()),'logits':logits.tolist(),'act':act.tolist(),'probabilities':probs.tolist(),'ms':(time.perf_counter()-start)*1000});print(name,q,int(probs.argmax()),rows[-1]['ms'],flush=True)
 results[name]=rows;del enc,head
summary={'agreement':sum(a['choice']==b['choice'] for a,b in zip(results['fp32'],results['int8'])),'count':len(inputs['questions']),'max_probability_drift':max(abs(x-y) for a,b in zip(results['fp32'],results['int8']) for x,y in zip(a['probabilities'][0],b['probabilities'][0]))}
(base/'onnx-parity.json').write_text(json.dumps({'summary':summary,'results':results},ensure_ascii=False,indent=2));print(summary,flush=True)
