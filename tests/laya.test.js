import test from 'node:test';import assert from 'node:assert/strict';import {buildLayaQuestion,resolveLayaChoice} from '../src/laya-choice.js';import {demo} from '../src/data.js';import {intents,candidatesFor,isBuiltin,denseRanks,examples} from '../src/korean-retrieval.js';
test('Laya receives original answer and context and maps only valid labels',()=>{const records=demo.slice(0,4);const q=buildLayaQuestion(records);assert.ok(q.answer.criteria.A.includes(records[0].answer));assert.ok(q.answer.criteria.A.includes(records[0].text));assert.ok(q.answer.criteria.NONE);assert.equal(resolveLayaChoice('B',records),records[1]);assert.equal(resolveLayaChoice('NONE',records),null);assert.throws(()=>resolveLayaChoice('Z',records));assert.throws(()=>buildLayaQuestion(demo));});
test('career candidates contain neutral guidance, not arbitrary go/no-go fortunes',()=>{const intent=intents.find(i=>i.id==='major_career'),candidates=candidatesFor(intent,demo);assert.deepEqual(candidates.map(r=>r.id),['route_career','route_unknown']);assert.ok(isBuiltin(demo));assert.equal(isBuiltin(demo.slice(0,12)),false);});
test('natural question index has four vectors per intent and stable aggregation',()=>{assert.equal(examples.length,88);assert.equal(intents.length,22);for(const intent of intents)assert.equal(examples.filter(e=>e.id===intent.id).length,4);const vectors=examples.map((e,i)=>e.id==='major_career'?[1,0]:[0,1]);assert.equal(denseRanks([1,0],vectors)[0].intent.id,'major_career');});
test('explicit max differs from balanced and top2 on mixed intent examples',()=>{
 const target=intents[0].id,query=[1,0];
 const vectors=examples.map((e,i)=>e.id===target?(i%4===0?[1,0]:[0,1]):[-1,0]);
 const score=method=>denseRanks(query,vectors,method).find(r=>r.intent.id===target).score;
 assert.equal(score('max'),1);
 assert.equal(score('top2'),0.5);
 const centroid=1/Math.sqrt(10);
 assert.ok(Math.abs(score('centroid')-centroid)<1e-12);
 assert.ok(Math.abs(score('balanced')-(0.75+0.25*centroid))<1e-12);
 assert.equal(denseRanks(query,vectors).find(r=>r.intent.id===target).score,score('balanced'));
});
