import corpus from './korean-corpus.json' with {type:'json'};
import extraExamples from './retrieval-examples-v2.json' with {type:'json'};
import {cosine} from './data.js';
export const baseExamples=corpus.intents.flatMap(intent=>intent.questionExamples.map(text=>({text,id:intent.id})));
export const examples=[...baseExamples,...corpus.intents.flatMap(intent=>(extraExamples[intent.id]||[]).map(text=>({text,id:intent.id})))];
export const intents=corpus.intents;
export const routePrecedence=[...new Set((corpus.routingPrecedence||[]).map(id=>intents.find(i=>i.id===id)?.route).filter(Boolean))];
export const normalize=text=>text.normalize('NFC').trim().replace(/\s+/g,' ');
const grams=text=>{const s=normalize(text).replace(/\s/g,'');return new Set(Array.from({length:Math.max(0,s.length-1)},(_,i)=>s.slice(i,i+2)));};
export function lexicalRanks(question,{expanded=false}={}){const q=grams(question);return intents.map(intent=>({intent,score:Math.max(...(expanded?examples.filter(e=>e.id===intent.id).map(e=>e.text):intent.questionExamples).map(text=>{const g=grams(text);let n=0;for(const x of q)if(g.has(x))n++;return n/Math.sqrt(Math.max(1,q.size*g.size));}))})).sort((a,b)=>b.score-a.score);}
export function denseRanks(query,vectors,aggregation='balanced'){return intents.map(intent=>{const list=vectors.filter((v,i)=>examples[i].id===intent.id);const scores=list.map(v=>cosine(query,v)).sort((a,b)=>b-a);const centroid=list[0].map((_,j)=>list.reduce((sum,v)=>sum+v[j],0)/list.length);let score=scores[0];if(aggregation==='top2')score=(scores[0]+scores[1])/2;if(aggregation==='centroid')score=cosine(query,centroid);if(aggregation==='balanced')score=.75*scores[0]+.25*cosine(query,centroid);return {intent,score};}).sort((a,b)=>b.score-a.score);}
export function fuse(dense,lexical,k=20){return intents.map(intent=>({intent,score:1/(k+1+dense.findIndex(r=>r.intent.id===intent.id))+1/(k+1+lexical.findIndex(r=>r.intent.id===intent.id))})).sort((a,b)=>b.score-a.score);}
export function isBuiltin(records){return records.length===corpus.records.length&&records.every(r=>corpus.records.some(x=>r.id===x.id&&r.answer===x.answer));}
export function candidatesFor(intent,records){const routeId=intent.routingResponseId&&'route_'+intent.routingResponseId;const ids=routeId?[routeId,'route_unknown']:intent.eligibleAnswerIds;return [...new Set(ids)].map(id=>records.find(r=>r.id===id)).filter(Boolean).slice(0,8);}
export function chooseCompatible(intent,records){const candidates=candidatesFor(intent,records);return candidates[0]||records.find(r=>r.id==='route_unknown')||{answer:'질문의 뜻을 조금만 더 알려 줘.',tag:'질문 확인'};}
// Historical v1 comparison only; the current UI uses context-policy.js.
// This v1 margin is not a calibrated probability cutoff.
export const CONFLICT_MARGIN=0.06;
const protectedIntent=i=>['high','urgent','boundary'].includes(i.risk);
export function planBuiltinAnswer(ranked,records){
 const top=ranked[0];
 const close=ranked.slice(0,3).filter(r=>top.score-r.score<=CONFLICT_MARGIN);
 const guarded=close.filter(r=>protectedIntent(r.intent));
 const conflict=close.length>1&&guarded.length>0&&new Set(close.map(r=>r.intent.routingResponseId||'ordinary')).size>1;
 if(conflict){
  const unknown=records.find(r=>r.id==='route_unknown');
  const candidates=[...guarded.flatMap(r=>candidatesFor(r.intent,records)),unknown].filter(Boolean);
  return {record:unknown||chooseCompatible(top.intent,records),candidates:[...new Map(candidates.map(r=>[r.id,r])).values()].slice(0,8),abstained:true,reason:'의도 간 점수 차이가 작아 질문을 더 확인해요.'};
 }
 return {record:chooseCompatible(top.intent,records),candidates:candidatesFor(top.intent,records),abstained:false};
}
