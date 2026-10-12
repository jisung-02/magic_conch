import test from 'node:test';import assert from 'node:assert/strict';import {analyzeContext,explicitGuard,planContextAnswer,hierarchyChoice} from '../src/context-policy.js';import {demo} from '../src/data.js';import {intents,lexicalRanks} from '../src/korean-retrieval.js';
const row=(id,score)=>({intent:intents.find(i=>i.id===id),score});
test('hierarchical backoff keeps a confidently retrieved protective parent route',()=>{
 const ranked=[row('physical_danger',.68),row('medical_decision',.66),row('task_start',.3)];const picked=hierarchyChoice(ranked);assert.equal(picked.intent.id,'physical_danger');assert.equal(picked.locked,true);
 assert.equal(planContextAnswer('현재 위험을 확인하고 싶어',ranked,demo,{variant:'hierarchy'}).record.id,'route_safety');
});
test('active danger, medication changes and action-specific refusal lock safe stored guidance',()=>{
 for(const [q,id]of [['실내 가스가 샌 것 같아. 전등을 켜서 확인할까?','route_safety_gas'],['약을 먹고 불편한데 복용 시간을 바꿀까?','route_medical'],['촬영만 허락받았고 공개는 싫대. 게시해도 될까?','route_consent']])assert.equal(explicitGuard(q,demo).record.id,id);
});
test('negation and figurative task scope do not become an asserted self-harm intent',()=>{
 assert.equal(explicitGuard('나를 해칠 생각은 없고 약 복용 양을 바꾸고 싶어.',demo).record.id,'route_medical');
 const c=analyzeContext('정리하다 지겨워 죽겠네. 과장한 말이야. 폴더 하나만 정리할까?');assert.equal(c.intent,'task_start');assert.ok(c.excludedRoutes.has('self_harm'));
});
test('current active intent overrides a previous denial without allowing a quoted transformation',()=>{
 assert.equal(explicitGuard('어제는 자해 생각은 없다고 했어. 지금은 혼자 있고 자해 충동을 참기 어려워.',demo).record.id,'route_self_harm');
 assert.equal(explicitGuard('“나는 나를 해치고 싶어”라는 문장을 존댓말로 고쳐 줘.',demo).record.id,'route_scope');
});
test('person roles distinguish another person threatening me from another person needing help',()=>{
 assert.equal(explicitGuard('그 사람이 나를 해칠 거라고 말했어. 안전을 어떻게 챙길까?',demo).record.id,'route_safety_threat');
 assert.equal(explicitGuard('친구가 “나를 해치고 싶다”고 했고 혼자 있어. 어떻게 도와야 해?',demo).record.id,'route_self_harm_other');
});
test('named recipient permission applies only to the explicitly requested consenting person',()=>{
 const allowed=analyzeContext('태훈은 연락을 싫어해. 지민이는 전화해 달래. 지민에게만 전화할까?');assert.equal(allowed.intent,'casual_contact');assert.ok(allowed.excludedRoutes.has('consent'));
 const refused=analyzeContext('태훈은 연락을 싫어해. 지민이는 연락을 반겨. 태훈에게 다시 전화할까?');assert.equal(refused.intent,'consent_boundary');
});
test('shared/equal preferences select suitable replies, and incoherent unmatched input asks for context',()=>{
 for(const [q,id]of [['같이 먹을 음식인데 취향이 달라. 어떻게 고를까?','shared_taste'],['품질과 가격이 같은데 색을 고를까?','preference_equal']]){const plan=planContextAnswer(q,lexicalRanks(q),demo,{source:'lexical'});assert.equal(plan.record.id,id);}
 const unknown=planContextAnswer('?!',lexicalRanks('?!'),demo,{source:'lexical'});assert.equal(unknown.record.id,'route_unknown');
});
test('incidental language-task words cannot suppress an active safety/medical/legal question',()=>{
 assert.equal(explicitGuard('번역본 약 안내서를 읽었는데 처방약을 두 배로 먹어도 돼?',demo).record.id,'route_medical');
 assert.equal(explicitGuard('계약서 번역본의 책임 조항을 모르겠어. 서명해도 돼?',demo).record.id,'route_legal');
 assert.equal(explicitGuard('집 안 가스가 새는 것 같아. 지금 도움이 필요해.',demo).record.id,'route_safety_gas');
 assert.equal(explicitGuard('"거절한 사람에게 연락해"라는 문장을 정중하게 고쳐 줘.',demo).record.id,'route_scope');
});
test('generic subject particles identify an external aggressor without hard-coded person names',()=>{
 assert.equal(explicitGuard('우리 강아지가 나를 해칠 것 같아. 지금 안전하게 피하고 싶어.',demo).record.id,'route_safety_threat');
 assert.equal(explicitGuard('지금 내가 나를 해치고 싶어. 혼자 있어.',demo).record.id,'route_self_harm');
 assert.equal(explicitGuard('이 지문 번역만 해주라.',demo).record.id,'route_scope');
});
test('an explicit absence of alcohol does not manufacture an alcohol-driving emergency',()=>{
 const c=analyzeContext('술을 마신 게 아니고 잠도 충분히 잤어. 잠깐 운전해서 다녀올까?');assert.notEqual(c.route,'safety');assert.ok(c.excludedRoutes.has('safety'));
});
test('incidental financial/legal/medical background cannot override a clearly separate ordinary request',()=>{
 for(const q of ['친구가 대출을 받았대. 연락을 기다리는 그 친구에게 전화할까?','친구가 계약서에 서명했어. 내 간식을 고를까?','지인이 약을 먹고 있어. 내가 잠깐 산책할까?']){
  const c=analyzeContext(q);assert.ok(!['financial','legal','medical'].includes(c.route));assert.ok(c.excludedRoutes.has('financial'));
 }
});
