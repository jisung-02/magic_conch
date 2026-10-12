import fs from 'node:fs';
import test from 'node:test';import assert from 'node:assert/strict';import {buildLayaQuestion,resolveLayaChoice} from '../src/laya-choice.js';import {demo} from '../src/data.js';import {intents,candidatesFor,isBuiltin,denseRanks,examples,planBuiltinAnswer} from '../src/korean-retrieval.js';
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
test('shipping answer flow abstains on conflicting close intents and constrains Laya answers',()=>{
 const rows=JSON.parse(fs.readFileSync('research/results/frozen-holdout.json')).rows;
 const row=rows.find(r=>r.id==='boundary-paraphrase');
 const ranked=row.ranked.map(r=>({score:r.score,intent:intents.find(i=>i.id===r.id)}));
 const plan=planBuiltinAnswer(ranked,demo);
 assert.equal(plan.record.id,'route_unknown');assert.equal(plan.abstained,true);
 assert.deepEqual(plan.candidates.map(r=>r.id),['route_consent','route_unknown']);
 const question=buildLayaQuestion(plan.candidates);
 assert.ok(question.answer.criteria.A.includes(demo.find(r=>r.id==='route_consent').answer));
 for(const [index,record] of plan.candidates.entries())assert.equal(resolveLayaChoice(String.fromCharCode(65+index),plan.candidates),record);
 assert.ok(plan.candidates.every(r=>!['ask_01','small_09','check_05'].includes(r.id)));
});
test('factual-current intent maps to explicit current-information guidance',()=>{
 const plan=planBuiltinAnswer([{intent:intents.find(i=>i.id==='factual_current'),score:0.8}],demo);
 assert.equal(plan.record.id,'route_external');assert.match(plan.record.answer,/공식 예보|최신 안내/);
 assert.deepEqual(plan.candidates.map(r=>r.id),['route_external','route_unknown']);
});
test('well-separated benign intents keep ordinary answers; conflicting high-risk intents hold',()=>{
 const ranked=[{intent:intents.find(i=>i.id==='casual_contact'),score:0.8},{intent:intents.find(i=>i.id==='consent_boundary'),score:0.6}];
 assert.equal(planBuiltinAnswer(ranked,demo).record.id,'ask_01');
 const conflicting=[{intent:intents.find(i=>i.id==='self_harm_concern'),score:0.61},{intent:intents.find(i=>i.id==='medical_decision'),score:0.57}];
 const plan=planBuiltinAnswer(conflicting,demo);assert.equal(plan.record.id,'route_unknown');
 assert.ok(plan.candidates.some(r=>r.id==='route_medical'));assert.ok(plan.candidates.some(r=>r.id==='route_self_harm'));
});
