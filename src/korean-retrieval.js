import corpus from './korean-corpus.json' with {type:'json'};
import {cosine} from './data.js';
export const examples=corpus.intents.flatMap(intent=>intent.questionExamples.map(text=>({text,id:intent.id})));
export const intents=corpus.intents;
export const normalize=text=>text.normalize('NFC').trim().replace(/\s+/g,' ');
const grams=text=>{const s=normalize(text).replace(/\s/g,'');return new Set(Array.from({length:Math.max(0,s.length-1)},(_,i)=>s.slice(i,i+2)));};
export function lexicalRanks(question){const q=grams(question);return intents.map(intent=>({intent,score:Math.max(...intent.questionExamples.map(text=>{const g=grams(text);let n=0;for(const x of q)if(g.has(x))n++;return n/Math.sqrt(Math.max(1,q.size*g.size));}))})).sort((a,b)=>b.score-a.score);}
export function denseRanks(query,vectors,aggregation='balanced'){return intents.map(intent=>{const list=vectors.filter((v,i)=>examples[i].id===intent.id);const scores=list.map(v=>cosine(query,v)).sort((a,b)=>b-a);const centroid=list[0].map((_,j)=>list.reduce((sum,v)=>sum+v[j],0)/list.length);let score=scores[0];if(aggregation==='top2')score=(scores[0]+scores[1])/2;if(aggregation==='centroid')score=cosine(query,centroid);if(aggregation==='balanced')score=.75*scores[0]+.25*cosine(query,centroid);return {intent,score};}).sort((a,b)=>b.score-a.score);}
export function fuse(dense,lexical,k=20){return intents.map(intent=>({intent,score:1/(k+1+dense.findIndex(r=>r.intent.id===intent.id))+1/(k+1+lexical.findIndex(r=>r.intent.id===intent.id))})).sort((a,b)=>b.score-a.score);}
export function isBuiltin(records){return records.length===corpus.records.length&&records.every(r=>corpus.records.some(x=>r.id===x.id&&r.answer===x.answer));}
export function candidatesFor(intent,records){const routeId=intent.routingResponseId&&'route_'+intent.routingResponseId;const ids=routeId?[routeId,'route_unknown']:intent.eligibleAnswerIds;return ids.map(id=>records.find(r=>r.id===id)).filter(Boolean).slice(0,8);}
export function chooseCompatible(intent,records){const candidates=candidatesFor(intent,records);return candidates[0]||records.find(r=>r.id==='route_unknown')||{answer:'질문의 뜻을 조금만 더 알려 줘.',tag:'질문 확인'};}
