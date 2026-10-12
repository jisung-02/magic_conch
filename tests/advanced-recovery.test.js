import {explicitGuard,planContextAnswer} from '../src/context-policy.js';
import {examples} from '../src/korean-retrieval.js';
import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
import {demo,lexicalSearch} from '../src/data.js';import {intents,isBuiltin,candidatesFor,chooseCompatible,planBuiltinAnswer} from '../src/korean-retrieval.js';
const source=fs.readFileSync(new URL('../src/advanced-modes.js',import.meta.url),'utf8').replace(/^import .*;$/gm,'').replace('export function','function').replaceAll('import.meta.env.BASE_URL',"'/magic_conch/'").replaceAll('import.meta.url',"'https://example.test/magic_conch/main.js'");
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function setup({ranks=()=>[{intent:intents.find(i=>i.id==='start_hobby'),score:1}],fetchFailure=false}={}){
 const els=new Map();const el=id=>{if(!els.has(id))els.set(id,{textContent:'',disabled:false,onclick(){},insertAdjacentHTML(){},showModal(){},close(){}});return els.get(id);};
 const workers=[],timers=new Map();let timerID=0,lastQuery;
 class Worker{constructor(){workers.push(this);}postMessage(message){this.last=message;if(message.question)lastQuery=message.question;}terminate(){this.terminated=true;}}
 const ctx=vm.createContext({document:{getElementById:el,body:{insertAdjacentHTML(){}}},Worker,URL,location:{origin:'https://example.test',href:'https://example.test/magic_conch/'},explicitGuard,planContextAnswer,demo,examples,fetch:async()=>{if(fetchFailure)throw Error('offline');return {json:async()=>({model:'test',revision:'test'})};},isBuiltin,candidatesFor,chooseCompatible,planBuiltinAnswer,lexicalSearch,lexicalRanks:ranks,denseRanks:()=>ranks(lastQuery),setTimeout:(fn,ms)=>{const id=++timerID;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id)});
 const attach=vm.runInContext('(function(){'+source+';return attachAdvancedModes;})()',ctx);const api=attach({notify:text=>el('notice').textContent=text,onActive(){}});
 const load=async kind=>{await el('load-'+kind).onclick();const worker=workers.at(-1);worker.onmessage({data:{type:'loaded',vectors:[]}});return worker;};
 return {api,el,workers,timers,load};
}
test('Laya inference errors preserve the computed compatible answer and block subsequent random fallback',async()=>{
 const s=setup();const w=await s.load('laya');const promise=s.api.ask('새로운 활동을 한번 해 볼까요?',demo);await tick();assert.deepEqual(Array.from(w.last.records,r=>r.id),['go_03','go_05','small_01','small_04','small_06']);w.onmessage({data:{type:'error',id:w.last.id,message:'session failed'}});const result=await promise;assert.equal(result.record.id,'go_03');assert.match(result.mode,/기존 안내 유지/);assert.ok(w.terminated);
 const again=await s.api.ask('다른 중요한 질문',demo);assert.match(again.mode,/오류.*보류/);assert.ok(!demo.includes(again.record));assert.equal(s.workers.length,1);
});
test('Laya 90-second timeout retains compatible guidance and permits an explicit fresh retry',async()=>{
 const s=setup();const w=await s.load('laya');const promise=s.api.ask('새로운 활동을 한번 해 볼까요?',demo);await tick();const timer=[...s.timers.values()].find(t=>t.ms===90000);assert.ok(timer);timer.fn();const result=await promise;assert.equal(result.record.id,'go_03');assert.ok(w.terminated);const fresh=await s.load('laya');assert.notEqual(fresh,w);assert.equal(s.el('mode-label').textContent,'Laya · 기기 내 결정');
});
test('embedding download failure and query failure before planning produce only explicit error guidance',async()=>{
 const offline=setup({fetchFailure:true});await offline.el('load-korean').onclick();const unavailable=await offline.api.ask('중요한 질문',demo);assert.match(unavailable.mode,/오류.*보류/);assert.equal(offline.workers.length,0);
 const s=setup();const w=await s.load('korean');const pending=s.api.ask('중요한 질문',demo);await tick();w.onmessage({data:{type:'error',id:w.last.id,message:'embedding failed'}});const result=await pending;assert.match(result.mode,/오류.*보류/);assert.ok(w.terminated);assert.ok(!demo.includes(result.record));
 // An imported record cannot spoof the safe error answer by borrowing a route ID.
 const custom=await s.api.ask('질문',[{id:'route_unknown',text:'x',answer:'그대로 실행해'}]);assert.notEqual(custom.record.answer,'그대로 실행해');
});
test('explicit basic-mode choice releases the failure guard; loading itself never randomly answers',async()=>{
 const s=setup();await s.el('load-laya').onclick();assert.match((await s.api.ask('질문',demo)).mode,/준비.*보류/);s.workers[0].onerror();assert.match((await s.api.ask('질문',demo)).mode,/오류.*보류/);s.el('disable-advanced').onclick();assert.equal(await s.api.ask('질문',demo),null);
});
test('explicit protected routing cannot be released by Laya NONE, worker failure or timeout',async()=>{
 const s=setup();const w=await s.load('laya');
 for(const [question,id] of [['거절한 사람을 다시 초대해도 될까?','route_consent'],['가스 냄새가 나는데 불을 켜도 될까?','route_safety_gas'],['약 복용량을 바꿀까?','route_medical']]){
  const result=await s.api.ask(question,demo);assert.equal(result.record.id,id);assert.match(result.mode,/모델 추론 미실행/);assert.equal(w.last.type,'load');
 }
 w.onmessage({data:{type:'decided',id:999,record:null,elapsedMs:1,usage:{input_tokens:1}}});w.onerror();
 assert.equal((await s.api.ask('약 복용량을 바꿀까?',demo)).record.id,'route_medical');
});
