"""Actual trained Laya head on the final application's DB-answer candidates."""
import argparse,json,pathlib,time,numpy as np,onnxruntime as ort
parser=argparse.ArgumentParser();parser.add_argument('--model-root',type=pathlib.Path,required=True);args=parser.parse_args()
root=pathlib.Path(__file__).resolve().parents[1]/'results'
data=json.loads((root/'final-answer-flow.json').read_text())
opts=ort.SessionOptions();opts.intra_op_num_threads=2;opts.graph_optimization_level=ort.GraphOptimizationLevel.ORT_ENABLE_BASIC
folder=args.model_root/'laya-onnx-packed';enc=ort.InferenceSession(str(folder/'encoder.onnx'),sess_options=opts);head=ort.InferenceSession(str(folder/'head.onnx'),sess_options=opts);rows=[]
for c,b in zip(data['cases'],data['batches']):
 start=time.perf_counter();mask=np.array(b['attentionMask'],np.int64);hidden=enc.run(None,{'input_ids':np.array(b['inputIds'],np.int64),'attention_mask':mask})[0]
 logits,act=head.run(None,{'hidden_states':hidden,'marker_pos':np.array(b['markerPos'],np.int64),'marker_mask':np.array(b['markerMask'],np.bool_),'qtype':np.array(b['qtype'],np.int64).reshape(-1,1),'attention_mask':mask})
 choice=int(logits.argmax());record=c['candidates'][choice] if choice<len(c['candidates']) else None
 record_id=record['id'] if record else 'NONE';rows.append({'id':c['id'],'query':c['query'],'selected':record_id,'answer':record['answer'] if record else '지금 질문에는 맞는 답을 찾지 못했어. 상황과 원하는 선택을 조금 더 알려 줘.','strictPass':record_id in c['allowed'],'abstained':record_id in ['NONE','route_unknown'],'ms':(time.perf_counter()-start)*1000})
summary={'count':len(rows),'strictAnswerAccept':sum(r['strictPass'] for r in rows),'additionalAbstentions':sum(r['abstained'] and not r['strictPass'] for r in rows),'scope':'trained Laya shipping answer candidates, Korean semantic source ready, CPU two threads; authored smoke; not browser or blinded human evaluation'}
(root/'laya-final-answer-flow.json').write_text(json.dumps({'summary':summary,'rows':rows},ensure_ascii=False,indent=2));print(summary)
