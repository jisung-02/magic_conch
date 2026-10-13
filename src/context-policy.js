// Transparent Korean clause/cue heuristics, not a general language parser.
// No evaluation IDs or exact scenario sentences; ambiguous cases remain selective.
import {intents,candidatesFor,chooseCompatible,normalize,routePrecedence} from './korean-retrieval.js';
import {evidenceClauses,affirmativeCue,publicationEvidence} from './context-evidence.js';
const protectedRoutes=new Set(['self_harm','safety','consent','medical','financial','legal','career']);
const precedence=routePrecedence.filter(r=>protectedRoutes.has(r));
const compact=s=>normalize(s).toLowerCase().replace(/\s/g,'');
function permittedRecipient(question){
 // Only prove a permission for one explicitly named recipient. Collective or
 // ambiguous references do not relax the boundary gate.
 const clauses=evidenceClauses(normalize(question)).map(compact);
 const permissions=new Set(),refusals=new Set();
 for(const clause of clauses){const subject=/^([가-힣]{2,6}?)(?:이는|은|는|이가|가|이)/.exec(clause);if(!subject||!/(연락|전화|메시지|문자|메일)/.test(clause))continue;
  const actor=subject[1];if(affirmativeCue(clause,/싫|거절|원치않|하지말/))refusals.add(actor);else if(affirmativeCue(clause,/해달|기다|반겨|반갑|원해|좋아/))permissions.add(actor);
 }
 const last=clauses.at(-1)||'';const target=/^([가-힣]{2,6}?)(?:에게|한테)(?:만)?(?:전화|연락|메시지|메일|문자|또|다시)/.exec(last);
 return target&&!/(모두|둘다|같이)/.test(last)&&permissions.has(target[1])&&!refusals.has(target[1])?target[1]:null;
}
export function analyzeContext(question){
 const raw=compact(question),permittedTarget=permittedRecipient(question),text=raw;const evidence=[],excludedRoutes=new Set();
 const outsideQuotes=raw.replace(/["“‘'][^"”’']*["”’']/g,'');
 const transformSyntax=/(번역(?:만|좀)?(?:해줘|해주라|해주세요|해줄|해봐)|(?:문장|대사|인용문|공지).{0,15}(교정|고쳐|바꿔)|(?:존댓말|존대말|정중하게).{0,10}(고쳐|바꿔)|문법.{0,10}(교정|고쳐)|띄어쓰기.{0,10}(해줘|고쳐)|계산해|합산해|코드.{0,15}(작성해|만들어줘))/.test(raw);
 const activeDecision=/(먹어도|먹을까|바꿔도|할까|해도|될까|해칠충동|자해충동|해치고싶|죽고싶)/.test(outsideQuotes);
 const activeHelp=/(친구|사람|상대).{0,30}(지금|혼자|위험)/.test(outsideQuotes)&&/(도와|도움|신고|응급)/.test(outsideQuotes);
 const transform=transformSyntax&&!activeDecision&&!activeHelp;
 if(transform)return {intent:'unclear_question',route:'unknown',scope:'unsupported_transform',locked:true,evidence:['문장 변환 요청'],excludedRoutes};
 const scoped=evidenceClauses(text);
 // No text deletion or global protected-route exclusions. Scope evidence may
 // suppress one explicit cue, but every retrieved protective candidate remains.
 const figurative=/(농담|과장|비유|관용).{0,10}(말|표현|이야|임|야)|그냥과장/.test(raw)&&!/(농담|과장|비유).{0,5}(아니|않)/.test(raw);
 const quotedSelfHarm=/["“‘'](?:[^"”’']{0,35})(?:나를|죽고싶|자해)(?:[^"”’']{0,35})["”’']/.test(text);
 const actorMatch=/(?:^|[.!?,\s])([가-힣]{1,8}?)(?:이가|가|이)\s*나(?:를)?\s*.{0,8}(?:해치|해칠|해쳐|다치게)/.exec(normalize(question));
 const actor=actorMatch?.[1].replace(/^(지금|현재|오늘|아까|어제|그때|이제|방금)/,'');
 const otherActor=actor&&!['나','내','저','제','스스로','자신'].includes(actor);
 const otherThreat=(!!otherActor||/(누가|그사람이|상대가|친구가|타인이|다른사람이).{0,16}나(?:를)?.{0,6}(해치|해칠|해쳐|다치|다칠)/.test(text))&&!quotedSelfHarm;
 if(otherThreat)return {intent:'physical_danger',route:'safety',locked:true,scope:'other_person_threat',evidence:[...evidence,'타인의 직접적인 위협'],excludedRoutes};
 const explicitHarm=scoped.some(clause=>affirmativeCue(clause,/(나를|자신을|스스로를?).{0,10}(해치|다치)|자해하고싶|죽고싶|살고싶지|살기싫|해칠.{0,6}(충동|생각|수단)/)||affirmativeCue(clause,/나해칠/)&&/(혼자|약꺼내|충동|스스로|버티기)/.test(clause)||affirmativeCue(clause,/(자해|자살).{0,10}(충동|생각|싶)/)&&/(지금|혼자|참기|어려|싶|나는|내가)/.test(clause));
 const helpingOther=/(친구|상대|사람|동료|가족).{0,45}(자해|자신을해치|나를해치|죽고싶)/.test(text)&&/(도와|돕|도움|어떻게|지금|혼자)/.test(text);
 if(explicitHarm||helpingOther){return {intent:'self_harm_concern',route:'self_harm',locked:true,scope:helpingOther?'helping_other':'active',evidence:[...evidence,'현재 해칠 의도/도움 요청'],excludedRoutes};}
 const gas=scoped.some(c=>affirmativeCue(c,/(가스).{0,12}(냄새|새|샌|샜|누출)|가연성|인화성/));
 const water=scoped.some(c=>affirmativeCue(c,/(침수|급류|붕괴)/)||/(물).{0,8}(차오|차있|찬|불어|잠겼|잠긴)/.test(c)&&/(길|통로|지하|도로|계곡|강|집|차량)/.test(c));
 const dangerAction=/(라이터|불|전등|스위치|켜|들어|건너|통과|지나|사용|확인|시도)/.test(text);
 const alcohol=scoped.some(c=>affirmativeCue(c,/(술|음주).{0,8}(마셨|먹|취했|마신)|술을마/));
 const driving=scoped.some(c=>affirmativeCue(c,/운전(?:하려|할|해도|해서|하|은|을|으)?/));
 const drunk=alcohol&&driving;
 if(gas&&(dangerAction||/(지금|실내|집안|주방|부엌|냄새가나|샌)/.test(text))||water&&dangerAction||drunk)return {intent:'physical_danger',route:'safety',locked:true,scope:drunk?'danger_driving':gas?'danger_gas':'danger_water',evidence:[...evidence,'현재 위험과 행동의 결합'],excludedRoutes};
 const boundaryAction=/(연락|전화|메시지|문자|메일|초대|명단|참가|공개|게시|업로드|올리|올려|접촉|손잡|손올리|어깨|만지|사진|촬영|설득)/.test(text);
 const refusal=!permittedTarget&&scoped.some(c=>affirmativeCue(c,/(싫다|싫대|싫어|거절|원하지않|원치않|안된다고|차단|하지말|보내지말|올리지말)/));
 if(boundaryAction&&refusal)return {intent:'consent_boundary',route:'consent',locked:true,scope:'active_action_boundary',evidence:[...evidence,'행동 범위와 명시 거절'],excludedRoutes};
 const clauses=scoped,tail=clauses.at(-1)||text;
 const everydayTail=/(연락|전화|간식|취미|산책|정리|색).{0,18}(할까|갈까|먹을까|고를|할지|볼까)/.test(tail)&&!/(약|복용|계약|대출|투자|자해|위험|가스)/.test(tail);
 const incidentalDomain=clauses.length>1&&everydayTail;
 if(incidentalDomain)evidence.push('실제 요청 절과 분리된 배경 정보');
 const medicine=/(처방약|복용|투약|알약|정제|캡슐|부작용|약사|의사(?:에게|한테|와|나|선생|진료|상담))|약(?:을|먹|복용|은|의|이|중단|끊|오늘|안|부작용)/.test(text);
 const dosing=/(먹|마시|복용|투약|삼키|양을|용량|분쇄|쪼개|나눠|중단|끊|어지|시간|시각|옮겨|줄|늘|불편)/.test(text);
 if(medicine&&dosing&&!incidentalDomain)return {intent:'medical_decision',route:'medical',locked:true,scope:'medication_decision',evidence:[...evidence,'의약품/복용과 변경 판단'],excludedRoutes};
 const legal=/(계약서|책임조항|특약|서명|보증인|법적책임|채무.{0,8}보증)/.test(text);
 const commitment=/(서명할|서명해도|싸인할|사인할|싸인해도|사인해도|계약해도|계약할|동의할|동의해도|특약.{0,15}(써도|넣어|바꾸|동의)|책임.{0,15}(질|지는)|그냥서명)/.test(text);
 if(legal&&commitment&&!incidentalDomain)return {intent:'legal_commitment',route:'legal',locked:true,scope:'commitment',evidence:[...evidence,'계약/서명 책임'],excludedRoutes};
 const money=/(전재산|생활비|목돈|퇴직금|큰돈|큰금액|대출|투자|금융|원금|수익|해지|돈.{0,8}묶)/.test(text);
 const financialAction=/(투자할|투자해도|가입할|가입해도|가입할지|돈.{0,16}(넣|맡|묶|빼)|묶어도|넣어도|맡겨도|대출.{0,10}(받을|받아도|신청할)|금융.{0,15}(결정|고를))/.test(text);
 if(money&&financialAction&&!incidentalDomain)return {intent:'material_finance',route:'financial',locked:true,scope:'material_stakes',evidence:[...evidence,'중대한 자금/계약 조건'],excludedRoutes};
 const career=/(퇴사|사표|이직|진로|전근|장기파견|해외파견|직장을옮|회사를그만)/.test(text)&&/(할까|될까|고민|결정|수락|할지|변경|그만|낼까|옮길)/.test(text);
 const careerDenied=/(파견|진로|퇴사).{0,15}(결정|하려는|하려).{0,8}(아니라|아니고|아니야|아니)/.test(text);
 if(career&&!careerDenied)return {intent:'major_career',route:'career',locked:true,scope:'career_stakes',evidence:[...evidence,'장기 생활/진로 변경'],excludedRoutes};
 const current=/(지금|오늘|현재|최신|실시간)/.test(text)&&/(수치|농도|세기|몇시|막차|운행|운영|미세먼지|공기|영업|문열|열었|측정|바람|기온)/.test(text);
 const factualRequest=/(알려|확인|몇|얼마|어떤|정상|괜찮|열었|열려|운행|운영)/.test(text);
 const alreadyKnown=/(확인했|확인했고|확인함|알고있|확인완료|확인하여)/.test(text);
 if(current&&factualRequest&&!alreadyKnown)return {intent:'factual_current',route:'external_information',locked:true,scope:'current_fact',evidence:[...evidence,'최신 자료가 필요한 사실'],excludedRoutes};
 const explanation=/(원리|정의|무엇|뭐야|왜).{0,30}(설명|알려)|설명해/.test(text)&&!/(고민|선택|할까|해야|해도)/.test(text);
 if(explanation)return {intent:'factual_current',route:'external_information',locked:true,scope:'factual_explanation',evidence:[...evidence,'사실 설명 요청'],excludedRoutes};
 if(/(추첨|심사|당첨|합격|입상|우승|결과).{0,20}(될까|할까|인지|보장|장담|맞혀|맞힐)/.test(text))return {intent:'unverifiable_future',route:'uncertain',locked:true,scope:'prediction',evidence:[...evidence,'미확정 결과 요청'],excludedRoutes};
 const mind=/(속마음|마음|표정|말수|말없|반응|싫어하|좋아하|못마땅|별로라|질투)/.test(text)&&/(그사람|상대|친구|선배|동료|그애|나를|선배|그분|(?:옆|그|맞은).{0,8}분)/.test(text);
 if(mind)return {intent:'another_person_feelings',route:'uncertain',locked:true,scope:'other_person_state',evidence:[...evidence,'확인되지 않은 상대 상태'],excludedRoutes};
 const publication=publicationEvidence(scoped);
 if(publication&&!publication.certain)return {intent:'consent_boundary',route:'consent',scope:publication.scope,locked:true,evidence:[...evidence,'게시 대상·행동에 대한 명시 동의 미확인'],excludedRoutes};
 if(publication?.certain)return {intent:'task_start',route:'oracle',scope:publication.scope,locked:false,evidence:[...evidence,'같은 요청 절의 명시 공개 동의'],excludedRoutes};
 const shared=/(같이|함께|여럿|동행|다같이)/.test(text)&&/(취향|의견|입맛|먹을|먹는|먹을거|고르는사람)/.test(text)&&!/(같이|함께|여럿).{0,12}(아니|않)/.test(text);
 if(shared)return {intent:'shared_preference',route:'oracle',scope:'shared_choice',locked:false,evidence:[...evidence,'함께 고르는 상대와 취향'],excludedRoutes};
 const equalConditions=/(가격|품질|속지|성능|조건).{0,12}(같|동일)/.test(text)&&/(색|표지|디자인|모양)/.test(text);
 if(equalConditions)return {intent:'preference_choice',route:'oracle',scope:'equal_conditions',locked:false,evidence:[...evidence,'조건이 같은 취향 선택'],excludedRoutes};
 const positiveContact=!!permittedTarget||/(연락.{0,8}기다|근황.{0,12}(궁금|알려달)|반갑|연락해달|보내달|연락.{0,8}부탁)/.test(text)&&/(연락|전화|보내|전해|메시지)/.test(text);
 if(positiveContact){return {intent:'casual_contact',route:'oracle',scope:'permitted_contact',locked:false,evidence:[...evidence,permittedTarget?'명시한 실제 수신자의 동의':'실제 연락 대상의 긍정 맥락'],excludedRoutes};}
 if(figurative&&/(일|작업|보고서|정리|폴더|표|끝내|고치)/.test(text))return {intent:'task_start',route:'oracle',scope:'figurative_task',locked:false,evidence,excludedRoutes};
 if(/(가격|용도|제품|무엇|어떤).{0,20}(말안|말하지않|설명안|설명하지않|아직안|안말|모르|생략)/.test(text)&&/(물건|구매|제품|가격|살|사려)/.test(text))return {intent:'missing_details',route:'oracle',scope:'missing_purchase',locked:false,evidence:[...evidence,'구매 핵심 조건 누락'],excludedRoutes};
 return {scope:'unresolved',locked:false,evidence,excludedRoutes};
}
export const V2_DEFAULTS={denseWeight:.85,ordinaryFloor:.38,protectedFloor:.58,protectedGap:.025};
export function routeRankings(ranked){const groups=new Map();for(const row of ranked){const route=row.intent.route;const prior=groups.get(route);if(!prior||row.score>prior.score)groups.set(route,{...row,route});}return [...groups.values()].sort((a,b)=>b.score-a.score);}
export function hierarchyChoice(ranked,{protectedGap=.025}={}){
 const top=ranked[0];if(protectedRoutes.has(top.intent.route))return {intent:top.intent,locked:true,reason:'상위 보호 경로 안내 유지'};
 const close=routeRankings(ranked).filter(r=>protectedRoutes.has(r.route)&&top.score-r.score<=protectedGap);
 if(close.length){close.sort((a,b)=>precedence.indexOf(a.route)-precedence.indexOf(b.route));return {intent:close[0].intent,locked:true,reason:'보호 경로 backoff'};}
 return {intent:top.intent,locked:false};
}
export function planContextAnswer(question,ranked,records,{variant='full',lexical=[],source='semantic',...options}={}){
 const cfg={...V2_DEFAULTS,...options},context=options.useContext===false?{scope:'unresolved',locked:false,evidence:[],excludedRoutes:new Set()}:analyzeContext(question);let chosen;
 if(variant==='hierarchy'){chosen=hierarchyChoice(ranked,cfg);}
 else{
  const lexicalByID=new Map(lexical.map(r=>[r.intent.id,r.score]));const adjusted=ranked.map(r=>({...r,score:source==='semantic'?cfg.denseWeight*r.score+(1-cfg.denseWeight)*(lexicalByID.get(r.intent.id)||0):r.score})).sort((a,b)=>b.score-a.score);
  if(context.intent)chosen={intent:intents.find(i=>i.id===context.intent),locked:context.locked,reason:context.evidence.join(' · '),scope:context.scope};
  else{
   let top=adjusted[0];
   // Parent-route gate uses every route's best score; a strong protective parent
   // does not disappear because two child/route scores are close.
   const parents=routeRankings(adjusted).filter(r=>protectedRoutes.has(r.route)&&r.score>=cfg.protectedFloor&&top.score-r.score<=cfg.protectedGap);
   if(parents.length){parents.sort((a,b)=>precedence.indexOf(a.route)-precedence.indexOf(b.route));top=parents[0];}
   const floor=source==='semantic'?protectedRoutes.has(top.intent.route)?cfg.protectedFloor:cfg.ordinaryFloor:protectedRoutes.has(top.intent.route)?.42:.15;
   chosen=top.score>=floor?{intent:top.intent,locked:top.intent.route!=='oracle'}:{intent:intents.find(i=>i.id==='unclear_question'),locked:true,reason:'응답 경로의 개발용 점수 기준 미달',scope:'low_evidence'};
  }
 }
 const intent=chosen.intent;let record=chooseCompatible(intent,records),candidates=candidatesFor(intent,records);
 if(variant!=='hierarchy'){
  const preferred={start_hobby:/(무료|체험)/.test(question)?'hobby_trial':null,casual_contact:'contact_short',light_food_choice:'food_taste',small_purchase:'purchase_small',preference_choice:'preference_equal',shared_preference:'shared_taste',missing_details:context.scope==='missing_purchase'?'clarify_purchase':'clarify_conditions'}[intent.id];
  const scopeID={unsupported_transform:'route_scope',publication_permission_unconfirmed:'route_consent_confirm',helping_other:'route_self_harm_other',danger_gas:'route_safety_gas',danger_water:'route_safety_water',danger_driving:'route_safety_driving',other_person_threat:'route_safety_threat'}[context.scope]||null;
  if(scopeID||preferred){const better=records.find(r=>r.id===(scopeID||preferred));if(better){record=better;candidates=[better,...candidates.filter(r=>r.id!==better.id)].slice(0,8);}}
 }
 // A protected/uncertain/factual/scope response is a policy decision, not a Laya choice.
 if(chosen.locked)candidates=[record];
 return {record,candidates:candidates.length?candidates:[record],intent,route:intent.route,locked:chosen.locked,abstained:intent.route==='unknown',reason:chosen.reason||null,context:{scope:context.scope,evidence:context.evidence,excludedRoutes:[...context.excludedRoutes]}};
}
export function explicitGuard(question,records){const context=analyzeContext(question);if(!context.locked||!context.intent)return null;return planContextAnswer(question,[{intent:intents.find(i=>i.id===context.intent),score:1}],records,{source:'lexical'});}
