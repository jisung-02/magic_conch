import {isBuiltin,lexicalRanks,denseRanks,candidatesFor,chooseCompatible} from './korean-retrieval.js';
import {lexicalSearch} from './data.js';
const $=id=>document.getElementById(id);
export function attachAdvancedModes({notify,onActive}){
 $('open-model').insertAdjacentHTML('afterend','<button class="model-pill" id="open-advanced">한국어 검색 / Laya 비교 ↗</button>');
 document.body.insertAdjacentHTML('beforeend',`<dialog id="advanced-dialog"><div class="dialog-head"><div><span class="eyebrow small">LOCAL MODEL LAB</span><h2>한국어 문장과 Laya</h2></div><button class="close" id="advanced-close" aria-label="닫기">×</button></div><p class="dialog-copy">한국어 문장 검색은 자연스러운 질문 예시에서 의도를 찾고, Laya는 후보 답을 실제 decision head로 평가해요. 답을 새로 생성하지 않아요.</p><div class="model-info"><strong>한국어 문장 검색</strong><p id="korean-model-info">검색 모델을 준비 중입니다.</p><button class="secondary wide" id="load-korean">검색 모델 내려받고 켜기</button><p id="korean-status" class="fine-print" role="status">다운로드 전에는 기본 키워드 / 기존 E5 모드를 사용해요.</p></div><div class="model-info"><strong>Laya Multilingual · 실험 모드</strong><p>학습된 mmBERT-base 322M + decision head. 저장 가중치만 손실 없이 FP16으로 압축하고, 기기 내 WASM에서 FP32로 계산해요. 최초 약 681MB + 실행 파일. 실행 메모리는 다운로드 크기보다 크며 휴대폰에서는 실패할 수 있어요.</p><p>검색 후보 최대 8개 + 해당 없음. 중요한 결정은 안내 답으로 제한해요. 한국어 판단 품질을 보장하지 않으며, 모델이 항상 검색보다 좋은 것은 아니에요.</p><button class="primary wide" id="load-laya">Laya 내려받고 켜기 ↓</button><p id="laya-status" class="fine-print" role="status">명시적으로 켠 뒤에만 모델 파일을 받아요. 질문은 이 기기에서 계산해요.</p></div><button class="secondary wide" id="disable-advanced">기본 키워드 / E5로 돌아가기</button></dialog>`);
 let mode=null,desired=null,koreanWorker,layaWorker,vectors,readyKorean=false,readyLaya=false,id=0;const pending=new Map();
 const show=()=>{$('mode-label').textContent=mode==='laya'?'Laya · 기기 내 결정':mode==='korean'?'한국어 문장 검색':'가벼운 키워드 모드';};
 const setMode=value=>{desired=value;mode=value;onActive(!!mode);show();};
 function rejectWorker(kind,message){const w=kind==='laya'?layaWorker:koreanWorker;w?.terminate();if(kind==='laya'){layaWorker=null;readyLaya=false;}else{koreanWorker=null;readyKorean=false;vectors=null;}for(const [key,p] of pending){if(p.kind===kind){clearTimeout(p.timer);p.reject(Error(message));pending.delete(key);}}$('load-'+kind).disabled=false;$('load-'+kind).textContent='다시 시도';$(kind+'-status').textContent=message+' 기본 검색을 계속 사용할 수 있어요.';if(mode===kind)setMode(null);}
 function request(kind,type,data){return new Promise((resolve,reject)=>{const key=++id;const timer=setTimeout(()=>{pending.delete(key);rejectWorker(kind,'추론 시간이 너무 길어 중단했어요.');reject(Error('추론 시간 초과'));},90000);pending.set(key,{resolve,reject,timer,kind});(kind==='laya'?layaWorker:koreanWorker).postMessage({type,id:key,...data});});}
 function listen(w,kind){w.onerror=()=>rejectWorker(kind,'모델 실행 오류.');w.onmessage=({data})=>{if(data.type==='status')$(kind+'-status').textContent=data.message;
 if(data.type==='loaded'){if(kind==='laya')readyLaya=true;else{readyKorean=true;vectors=data.vectors;}$('load-'+kind).disabled=false;$('load-'+kind).textContent='이 모드 켜기';$(kind+'-status').textContent='모델 준비 완료 · 기기 내 실행';if(desired===kind)setMode(kind);}
 if(data.type==='vector'||data.type==='decided'){const p=pending.get(data.id);if(p){clearTimeout(p.timer);p.resolve(data);pending.delete(data.id);}}
 if(data.type==='error')rejectWorker(kind,'모델 실패: '+data.message);
 };}
 const legacyOpen=$('open-model').onclick;$('open-model').onclick=()=>mode?$('advanced-dialog').showModal():legacyOpen();
 $('open-advanced').onclick=()=>$('advanced-dialog').showModal();$('advanced-close').onclick=()=>$('advanced-dialog').close();$('disable-advanced').onclick=()=>{setMode(null);$('advanced-dialog').close();};
 $('load-korean').onclick=async()=>{desired='korean';if(readyKorean){setMode('korean');return;}$('load-korean').disabled=true;try{const spec=await (await fetch(new URL('search-model.json',import.meta.env.BASE_URL.startsWith('/')?location.origin+import.meta.env.BASE_URL:location.href))).json();koreanWorker=new Worker(new URL('./korean-worker.js',import.meta.url),{type:'module'});listen(koreanWorker,'korean');koreanWorker.postMessage({type:'load',...spec});}catch(e){rejectWorker('korean',String(e.message||e));}};
 $('load-laya').onclick=()=>{desired='laya';if(readyLaya){setMode('laya');return;}$('load-laya').disabled=true;try{layaWorker=new Worker(new URL('./laya-worker.js',import.meta.url),{type:'module'});listen(layaWorker,'laya');layaWorker.postMessage({type:'load',base:new URL(import.meta.env.BASE_URL+'models/laya/',location.origin).href});}catch(e){rejectWorker('laya',String(e.message||e));}};
 fetch(import.meta.env.BASE_URL+'search-model.json').then(r=>r.json()).then(s=>$('korean-model-info').textContent=s.label+' · '+s.downloadLabel+' · 자연문장 질문 예시 88개').catch(()=>$('korean-model-info').textContent='검색 모델 배포 정보를 찾지 못했어요.');
 return {disable(){desired=null;mode=null;},async ask(question,records){if(!mode)return null;const active=mode;try{
 let ranked=lexicalRanks(question),source='자연문장 키워드 후보';if(readyKorean){const {vector}=await request('korean','query',{question});ranked=denseRanks(vector,vectors);source='한국어 의미 후보';}
 const top=ranked[0];let candidates;
 if(isBuiltin(records)){candidates=candidatesFor(top.intent,records);if(!candidates.length)candidates=[chooseCompatible(top.intent,records)];}
 else{const rankedRecords=records.map(r=>({r,score:lexicalSearch(question,[r]).score})).sort((a,b)=>b.score-a.score);candidates=rankedRecords.slice(0,8).map(x=>x.r);source='내 선택지 키워드 후보';}
 if(active==='korean'){if(!isBuiltin(records))throw Error('한국어 의도 검색은 제공된 예시에 적용돼요. 내 파일은 E5 또는 Laya를 사용해 주세요.');return {record:chooseCompatible(top.intent,records),mode:'한국어 문장 검색 · 저장된 답'};}
 const decision=await request('laya','decide',{question,records:candidates});$('laya-status').textContent=`기기 내 결정 완료 · ${(decision.elapsedMs/1000).toFixed(2)}초 · ${decision.usage.input_tokens}토큰`;
 return {record:decision.record||{answer:'지금 질문에는 맞는 답을 찾지 못했어. 상황과 원하는 선택을 조금 더 알려 줘.',tag:'Laya · 해당 없음'},mode:`Laya 결정 · ${source} ${candidates.length}개 · ${(decision.elapsedMs/1000).toFixed(2)}초`};
 }catch(e){notify('이 모드 실행 실패: '+e.message+' 기본 검색으로 전환했어요.');setMode(null);return null;}}};
}
