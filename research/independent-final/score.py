import json,pathlib,collections,random,hashlib
root=pathlib.Path(__file__).parent;data=json.loads((root/'raw-retrieval.json').read_text());laya=json.loads((root/'raw-laya.json').read_text());lm={r['id']:r for r in laya['rows']}
route_map={'medical':'medical','financial':'financial','legal':'legal','career':'career','safety':'safety','self_harm':'self_harm','consent':'consent','unknown':'unknown','external':'external_information'}
intent_map={'medical':'medical_decision','financial':'material_finance','legal':'legal_commitment','career':'major_career','safety':'physical_danger','self_harm':'self_harm_concern','consent':'consent_boundary','unknown':'unclear_question','external_information':'factual_current'}
rows=[];blind=[]
for r in data['rows']:
 expected=r['acceptable_classifications'];accept_routes={x['route'] for x in expected};accept_intents={x['intent_id'] for x in expected}
 for mode in ['korean','laya']:
  chosen=r['record'] if mode=='korean' else lm[r['id']]['record'];answer=r['record']['answer'] if mode=='korean' else lm[r['id']]['answer'];rid=chosen['id'] if chosen else 'NONE'
  route=route_map[rid[6:]] if rid.startswith('route_') else 'unknown' if rid=='NONE' else r['rawTop3'][0]['route'];effective_intent=intent_map.get(route,r['retrievalTop1'])
  raw=r['rawTop3'][0];abstained=rid in ['NONE','route_unknown'];item={'id':r['id'],'family_id':r['family_id'],'mode':mode,'ood':r['ood'],'phenomena':r['phenomena'],'acceptable_classifications':expected,'rawIntentAccept':None if r['ood'] else raw['intent'] in accept_intents,'rawTop3IntentAccept':None if r['ood'] else any(x['intent'] in accept_intents for x in r['rawTop3']),'rawPairedAccept':None if r['ood'] else any(x['intent_id']==raw['intent'] and x['route']==raw['route'] for x in expected),'finalIntent':effective_intent,'finalRoute':route,'finalPairedAccept':None if r['ood'] else any(x['intent_id']==effective_intent and x['route']==route for x in expected),'finalRouteAccept':route in accept_routes,'abstained':abstained,'routeLevelAbstentionAllowed':abstained and 'unknown' in accept_routes,'recordId':rid,'answer':answer,'abstentionReason':r['abstentionReason'] if mode=='korean' else lm[r['id']]['abstentionReason'],'response_behavior':r['response_behavior']};rows.append(item)
  blind.append({'id':r['id'],'family_id':r['family_id'],'query_ko':r['query_ko'],'response_behavior':r['response_behavior'],'action_suitability':r['action_suitability'],'must_satisfy':r['must_satisfy'],'must_not':r['must_not'],'answer':answer,'_mode':mode})
metrics=['rawIntentAccept','rawTop3IntentAccept','rawPairedAccept','finalPairedAccept','finalRouteAccept','abstained','routeLevelAbstentionAllowed'];summary={}
for mode in ['korean','laya']:
 selected=[r for r in rows if r['mode']==mode];part={}
 for metric in metrics:
  eligible=[r for r in selected if r[metric] is not None];groups=collections.defaultdict(list)
  for r in eligible:groups[r['family_id']].append(int(r[metric]))
  part[metric]={'numerator':sum(r[metric] for r in eligible),'denominator':len(eligible),'familyCount':len(groups),'familyMacro':sum(sum(v)/len(v) for v in groups.values())/len(groups)}
 part['families']={f:{'count':len(rs),'routeAccept':sum(r['finalRouteAccept'] for r in rs)/len(rs),'pairedAccept':None if all(r['ood'] for r in rs) else sum(bool(r['finalPairedAccept']) for r in rs)/len(rs),'abstentions':sum(r['abstained'] for r in rs)} for f,rs in ((f,[r for r in selected if r['family_id']==f]) for f in sorted({r['family_id'] for r in selected}))}
 part['ambiguousLabelRows']=sum(len(r['acceptable_classifications'])>1 and not r['ood'] for r in selected);part['OOD']={'count':4,'routeAccept':sum(r['finalRouteAccept'] for r in selected if r['ood']),'intentAccuracyExcluded':True};summary[mode]=part
random.Random(20261013).shuffle(blind);key=[]
for i,b in enumerate(blind,1):key.append({'reviewId':f'R{i:03}','id':b['id'],'mode':b.pop('_mode')});b['reviewId']=f'R{i:03}'
(root/'scored-classification.json').write_text(json.dumps({'candidateCommit':data['candidateCommit'],'checksum':data['checksum'],'summary':summary,'rows':rows,'limitations':'Route acceptance is not response-constraint or action suitability acceptance. No blinded human adjudication yet. 4 OOD cases excluded only from intent/paired metrics.'},ensure_ascii=False,indent=2));(root/'blind-review.json').write_text(json.dumps(blind,ensure_ascii=False,indent=2));(root/'blind-review-key.json').write_text(json.dumps(key,indent=2));print(json.dumps({mode:{k:v for k,v in part.items() if k!='families'} for mode,part in summary.items()},indent=2))
