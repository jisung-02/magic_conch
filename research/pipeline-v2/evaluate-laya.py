import pathlib,json,time,numpy as np,onnxruntime as ort
root=pathlib.Path(__file__).parent;data=json.loads((root/'laya-inputs.json').read_text());opts=ort.SessionOptions();opts.intra_op_num_threads=2;opts.graph_optimization_level=ort.GraphOptimizationLevel.ORT_ENABLE_BASIC
previous=json.loads((root/'laya-inputs.phase1.json').read_text());old_results=json.loads((root/'laya-results.phase1.json').read_text());old_inputs={c['id']:(c,b) for c,b in zip(previous['cases'],previous['batches'])};old_heads={r['id']:r['head'] for r in old_results['rows'] if r.get('headExecuted')};reused_count=0
folder=pathlib.Path('laya-onnx-packed');encoder=ort.InferenceSession(str(folder/'encoder.onnx'),sess_options=opts);head=ort.InferenceSession(str(folder/'head.onnx'),sess_options=opts);head_rows=[]
for c,b in zip(data['cases'],data['batches']):
 prior=old_inputs.get(c['id']);
 if prior and prior[1]==b and prior[0]['candidates']==c['candidates']:
  head_rows.append(old_heads[c['id']]);reused_count+=1;continue
 start=time.perf_counter();mask=np.array(b['attentionMask'],np.int64);hidden=encoder.run(None,{'input_ids':np.array(b['inputIds'],np.int64),'attention_mask':mask})[0];logits,act=head.run(None,{'hidden_states':hidden,'marker_pos':np.array(b['markerPos'],np.int64),'marker_mask':np.array(b['markerMask'],np.bool_),'qtype':np.array(b['qtype'],np.int64).reshape(-1,1),'attention_mask':mask});pick=int(logits.argmax());record=c['candidates'][pick] if pick<len(c['candidates']) else None;prob=np.exp(logits-logits.max());prob/=prob.sum();head_rows.append({'id':c['id'],'choice':chr(65+pick) if record else 'NONE','record':record,'rawUnscaledHeadSoftmax':prob.tolist(),'ms':(time.perf_counter()-start)*1000})
lookup={r['id']:r for r in head_rows};rows=[]
for c in data['rows']:
 h=lookup.get(c['id']);record=c['record'] if c['locked'] else h['record'];route=c['route'] if record else 'unknown';answer=record['answer'] if record else '지금 질문에는 맞는 답을 찾지 못했어. 상황과 원하는 선택을 조금 더 알려 줘.';rows.append({**c,'headExecuted':bool(h),'head':h,'record':record,'answer':answer,'route':route,'routeAccept':route in c['acceptableRoutes'],'abstained':route=='unknown'})
summary={}
for source in ['regression68','developerStress','edgeStress']:
 group=[r for r in rows if r['source']==source];summary[source]={'count':len(group),'policyLocked':sum(r['locked'] for r in group),'headExecuted':sum(r['headExecuted'] for r in group),'headNONE':sum(r['headExecuted'] and r['head']['choice']=='NONE' for r in group),'routeAccept':sum(r['routeAccept'] for r in group),'abstentions':sum(r['abstained'] for r in group)}
(root/'laya-results.json').write_text(json.dumps({'scope':'All development/regression. Hybrid policy+Laya results, not standalone model accuracy. Raw unscaled softmax is not calibrated confidence. CPU not browser.','summary':summary,'inferenceReuse':{'unchangedTypedInputs':reused_count,'freshlyExecuted':len(head_rows)-reused_count,'source':'laya-results.phase1.json; exact batch and candidate equality; same model files'},'rows':rows},ensure_ascii=False,indent=2));print(summary)
