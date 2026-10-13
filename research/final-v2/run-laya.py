import json,pathlib,time,statistics,numpy as np,onnxruntime as ort
root=pathlib.Path(__file__).parent;data=json.loads((root/'raw-retrieval.json').read_text());opts=ort.SessionOptions();opts.intra_op_num_threads=2;opts.graph_optimization_level=ort.GraphOptimizationLevel.ORT_ENABLE_BASIC
folder=pathlib.Path('laya-onnx-packed');start=time.perf_counter();enc=ort.InferenceSession(str(folder/'encoder.onnx'),sess_options=opts);enc_ms=(time.perf_counter()-start)*1000;start=time.perf_counter();head=ort.InferenceSession(str(folder/'head.onnx'),sess_options=opts);head_ms=(time.perf_counter()-start)*1000
source={r['id']:r for r in data['rows']};forward=[]
def run(batch):
 mask=np.array(batch['attentionMask'],np.int64);hidden=enc.run(None,{'input_ids':np.array(batch['inputIds'],np.int64),'attention_mask':mask})[0]
 return head.run(None,{'hidden_states':hidden,'marker_pos':np.array(batch['markerPos'],np.int64),'marker_mask':np.array(batch['markerMask'],np.bool_),'qtype':np.array(batch['qtype'],np.int64).reshape(-1,1),'attention_mask':mask})
for c,b in zip(data['headCases'],data['batches']):
 start=time.perf_counter();logits,act=run(b);elapsed=(time.perf_counter()-start)*1000;plan=source[c['id']]['layaPolicyPlan'];pick=int(logits.argmax());record=plan['candidates'][pick] if pick<len(plan['candidates']) else None
 if c['rejectAfterInference']:record=plan['record']
 p=np.exp(logits-logits.max());p/=p.sum();forward.append({'id':c['id'],'choice':chr(65+pick) if pick<len(plan['candidates']) else 'NONE','record':record,'logits':logits.tolist(),'actLogits':act.tolist(),'rawUnscaledHeadSoftmax':p.tolist(),'ms':elapsed,'usage':c['usage'],'workerTokenRejection':c['rejectAfterInference'],'tokenizeMs':c['tokenizeMs']})
lookup={r['id']:r for r in forward};rows=[]
for r in data['rows']:
 plan=r['layaPolicyPlan'];h=lookup.get(r['id']);record=plan['record'] if plan['locked'] else h['record'];route=plan['route'] if record else 'unknown';intent=plan['intent']['id'] if record else 'unclear_question';answer=record['answer'] if record else '지금 질문에는 맞는 답을 찾지 못했어. 상황과 원하는 선택을 조금 더 알려 줘.'
 engine=r['ko']['engine'] if plan['locked'] else 'ko_search_error_backoff' if h['workerTokenRejection'] else 'ko_search_laya_head';elapsed=r['ko']['elapsedMs']+(h['ms']+h['tokenizeMs'] if h else 0)
 rows.append({'id':r['id'],'family_id':r['family_id'],'query':r['query'],'intent':intent,'route':route,'record':record,'answer':answer,'engine':engine,'policyLocked':plan['locked'],'headExecuted':h is not None,'head':h,'abstained':route=='unknown','reason':plan['reason'] if plan['locked'] else 'Laya returned NONE' if record is None else 'Worker token-limit error; compatible plan retained' if h['workerTokenRejection'] else None,'elapsedMs':elapsed})
# Non-validation developer microbenchmark, not an extra selected validation run.
dev=json.loads(pathlib.Path('source/magic-conch/research/pipeline-v2/laya-inputs.json').read_text());b=dev['batches'][0];bench=[];picks=[]
for i in range(5):
 start=time.perf_counter();logits,_=run(b);bench.append((time.perf_counter()-start)*1000);picks.append(int(logits.argmax()))
out={'candidateCommit':data['candidateCommit'],'datasetChecksum':data['datasetChecksum'],'execution':'One actual trained packed-head forward per unlocked validation query; isolated ready-model cases; Python ORT CPU2threads, no browser measurements. Raw softmax is unscaled and not calibrated confidence.','preparation':{'encoderSessionMs':enc_ms,'headSessionMs':head_ms,'modelDownloadMs':None,'cachedWeights':True},'developerRepeatCPU':{'question':dev['cases'][0]['query'],'count':5,'ms':bench,'argmax':picks},'headExecutedCount':len(forward),'policyProcessedCount':len(rows)-len(forward),'rows':rows}
(root/'raw-laya.json').write_text(json.dumps(out,ensure_ascii=False,indent=2));print('Actual head:',len(forward),'Policy only:',len(rows)-len(forward))
