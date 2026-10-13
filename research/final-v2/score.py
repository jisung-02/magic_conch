import pathlib,json,collections,statistics,hashlib
root=pathlib.Path(__file__).parent;retrieval=json.loads((root/'raw-retrieval.json').read_text());head=json.loads((root/'raw-laya.json').read_text());hm={r['id']:r for r in head['rows']};protective={'medical','financial','legal','career','safety','self_harm','consent'}
rows=[]
for r in retrieval['rows']:
 c=r['labels'];pairs=c['acceptable_intent_route_pairs'];routes={p['route'] for p in pairs};intents={p['intent_id'] for p in pairs}
 for mode,answer in [('korean',r['ko']),('light',r['light']),('laya_combined',hm[r['id']])]:
  exact=any(p['intent_id']==answer['intent'] and p['route']==answer['route'] for p in pairs)
  rows.append({'id':c['id'],'family_id':c['family_id'],'family_topic':c['family_topic'],'mode':mode,'query':c['query'],'ood':c['ood'],'tags':c['tags'],'multiAccepted':len(pairs)>1,'ordinary':'ordinary_choice' in c['tags'],'protected':bool(routes&protective),'clarification':c['expected_behavior']['clarification_required'],'intent':answer['intent'],'route':answer['route'],'exactAcceptedPair':exact,'intentAccept':None if c['ood'] else answer['intent'] in intents,'pairAcceptNonOOD':None if c['ood'] else exact,'routeOnlyAccept':answer['route'] in routes,'abstained':answer['route']=='unknown','answer':answer['answer'],'engine':answer['engine'],'elapsedMs':answer['elapsedMs'],'headExecuted':answer.get('headExecuted',False),'policyLocked':answer.get('locked',answer.get('policyLocked',False)),'reason':answer.get('reason'),'expected_behavior':c['expected_behavior'],'forbidden_behavior':c['forbidden_behavior']})
def stats(group):
 families=collections.defaultdict(list)
 for r in group:families[r['family_id']].append(r)
 n=len(group);strict=sum(all(r['exactAcceptedPair'] for r in rs) for rs in families.values());macro=sum(sum(r['exactAcceptedPair'] for r in rs)/len(rs) for rs in families.values())/len(families) if families else None
 return {'count':n,'exactAcceptedPair':sum(r['exactAcceptedPair'] for r in group),'routeOnlyAccept':sum(r['routeOnlyAccept'] for r in group),'nonOODPairCorrect':sum(bool(r['pairAcceptNonOOD']) for r in group),'nonOODCount':sum(not r['ood'] for r in group),'abstentions':sum(r['abstained'] for r in group),'headExecuted':sum(r['headExecuted'] for r in group),'policyLocked':sum(r['policyLocked'] for r in group),'familyCount':len(families),'strictFamilyPairCorrect':strict,'familyPairMacro':macro}
summary={}
for mode in ['korean','laya_combined','light']:
 group=[r for r in rows if r['mode']==mode];s={'all':stats(group)}
 for name,predicate in [('ordinary',lambda r:r['ordinary']),('protected',lambda r:r['protected']),('genuineClarification',lambda r:r['clarification']),('OOD',lambda r:r['ood']),('singleAccepted',lambda r:not r['multiAccepted']),('multiAccepted',lambda r:r['multiAccepted'])]:s[name]=stats([r for r in group if predicate(r)])
 s['engines']=dict(collections.Counter(r['engine'] for r in group));s['families']={f:stats([r for r in group if r['family_id']==f]) for f in sorted({r['family_id'] for r in group})};s['tags']={t:stats([r for r in group if t in r['tags']]) for t in sorted({t for r in group for t in r['tags']})};summary[mode]=s
# Strictly query + actual answer only, with an opaque shuffled review ID. No labels or engines.
order=sorted(rows,key=lambda r:hashlib.sha256((retrieval['datasetChecksum']+r['mode']+r['id']).encode()).hexdigest());blind=[];key=[]
for i,r in enumerate(order,1):rid=f'V2FINAL-R{i:03}';blind.append({'review_id':rid,'query':r['query'],'response':r['answer']});key.append({'review_id':rid,'id':r['id'],'mode':r['mode']})
(root/'blind-query-response.json').write_text(json.dumps(blind,ensure_ascii=False,indent=2));(root/'blind-key.json').write_text(json.dumps(key,indent=2));(root/'scored-routes.json').write_text(json.dumps({'candidateCommit':retrieval['candidateCommit'],'datasetChecksum':retrieval['datasetChecksum'],'scope':'Single-author candidate-separated synthetic final80; 40 correlated families. Exact pair/route scores separate from content review. OOD4 excluded only from intent/nonOOD-pair metrics. Subgroups may overlap. Content review not yet adjudicated.','summary':summary,'rows':rows},ensure_ascii=False,indent=2))
for mode,s in summary.items():print(mode,{k:v for k,v in s['all'].items() if k not in []},'ordinary',s['ordinary']['exactAcceptedPair'],'/',s['ordinary']['count'],'protected',s['protected']['exactAcceptedPair'],'/',s['protected']['count'],'OOD',s['OOD']['exactAcceptedPair'],'/',s['OOD']['count'])
