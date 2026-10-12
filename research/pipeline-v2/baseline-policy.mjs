import fs from 'node:fs';
const corpus=JSON.parse(fs.readFileSync(new URL('./baseline/korean-corpus.json',import.meta.url)));
export const baselineRecords=corpus.records,baselineIntents=corpus.intents;
export function baselineCandidates(intent,records=baselineRecords){const ids=intent.routingResponseId?['route_'+intent.routingResponseId,'route_unknown']:intent.eligibleAnswerIds;return [...new Set(ids)].map(id=>records.find(r=>r.id===id)).filter(Boolean).slice(0,8);}
export function baselinePlan(ranked,records=baselineRecords){const top=ranked[0];const close=ranked.slice(0,3).filter(r=>top.score-r.score<=.06),guarded=close.filter(r=>['high','urgent','boundary'].includes(r.intent.risk));const conflict=close.length>1&&guarded.length>0&&new Set(close.map(r=>r.intent.routingResponseId||'ordinary')).size>1;
 if(conflict){const unknown=records.find(r=>r.id==='route_unknown'),candidates=[...guarded.flatMap(r=>baselineCandidates(r.intent,records)),unknown].filter(Boolean);return {record:unknown,candidates:[...new Map(candidates.map(r=>[r.id,r])).values()],abstained:true,locked:false,intent:top.intent,route:'unknown'};}
 const candidates=baselineCandidates(top.intent,records);return {record:candidates[0]||records.find(r=>r.id==='route_unknown'),candidates,intent:top.intent,route:top.intent.route,abstained:top.intent.route==='unknown',locked:false};}
