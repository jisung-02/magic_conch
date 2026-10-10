export const MODEL = 'Xenova/multilingual-e5-small';
export const CONFIG = {model:MODEL, revision:'761b726dd34fb83930e26aab4e9ac3899aa1fa78', dimensions:384, pooling:'mean', normalize:true, query_prefix:'query: ', passage_prefix:'passage: '};
export const demo = [
{id:'1',text:'새로운 도전 시작 용기 지원 신청 망설임 해볼까',answer:'해봐. 생각보다 잘될지도 몰라.',tag:'작은 용기'},
{id:'2',text:'피곤 지침 번아웃 쉬어 휴식 잠 밤 야근',answer:'오늘은 쉬어도 괜찮아.',tag:'잠깐의 쉼'},
{id:'3',text:'결정 고민 선택 확신 답 모르겠어 불안',answer:'조금 더 마음이 가는 쪽으로.',tag:'마음의 방향'},
{id:'4',text:'구매 살까 쇼핑 충동 돈 비싼 지출',answer:'내일도 갖고 싶다면, 그때 다시 생각해.',tag:'한 박자 천천히'},
{id:'5',text:'친구 연락 문자 전화 보고싶어 먼저 안부',answer:'먼저 안부를 건네봐.',tag:'다정한 시작'},
{id:'6',text:'실패 실수 후회 자책 망쳤어 틀렸어',answer:'한 번의 실수가 너의 전부는 아니야.',tag:'다시 시작'},
{id:'7',text:'일 미루기 할일 작업 공부 집중 시작하기',answer:'딱 5분만 시작해봐.',tag:'아주 작은 한 걸음'},
{id:'8',text:'산책 바깥 햇빛 답답 기분전환 나갈까',answer:'바깥 공기를 조금 만나고 와.',tag:'새로운 공기'},
{id:'9',text:'밥 점심 저녁 음식 뭐 먹을까 메뉴 배고파',answer:'오늘은 가장 좋아하는 걸 먹어.',tag:'오늘의 작은 행복'},
{id:'10',text:'함께 부탁 도움 혼자 어려움 힘들어',answer:'혼자 다 하지 않아도 돼. 도움을 청해봐.',tag:'함께라면'},
{id:'11',text:'서두름 급하게 조급 기다려 시간 언제',answer:'서두르지 마. 네 속도로 가도 괜찮아.',tag:'너의 속도'},
{id:'12',text:'행복 기쁨 축하 성공 잘했어 좋은 소식',answer:'이 순간을 충분히 기뻐해도 좋아.',tag:'반짝이는 순간'},
];
export function validateRecords(input, metadata = null) {
 if (!Array.isArray(input) || !input.length || input.length > 2000) throw new Error('선택지는 1~2,000개여야 해요.');
 const ids = new Set();
 const records = input.map((r,i) => {
  if (!r || typeof r.text !== 'string' || typeof r.answer !== 'string' || !r.text.trim() || !r.answer.trim() || r.text.length>4000 || r.answer.length>2000) throw new Error(`${i+1}번째 선택지의 text와 answer를 확인해 주세요.`);
  const id=String(r.id ?? i+1); if(!id.length||id.length>200) throw new Error('id는 1~200자여야 해요.'); if(ids.has(id)) throw new Error('id가 중복되어 있어요.'); ids.add(id);
  const out={id,text:r.text.trim(),answer:r.answer.trim(),tag:String(r.tag || '나의 선택지').slice(0,60)};
  if(r.embedding != null){if(!Array.isArray(r.embedding)||r.embedding.length!==384||!r.embedding.every(x=>Number.isFinite(x)&&Number.isFinite(Math.fround(x)))||!r.embedding.some(x=>Math.fround(x)!==0))throw new Error(`${i+1}번째 임베딩은 384개의 유한한 숫자여야 해요.`);out.embedding=r.embedding.map(Math.fround);}
  return out;
 });
 if (records.some(r=>r.embedding)) {
  if(!metadata || Object.keys(CONFIG).some(k=>metadata[k]!==CONFIG[k])) throw new Error('임베딩 모델 설정이 달라요. 샘플의 metadata와 맞추거나 embedding을 제외해 주세요.');
 }
 return records;
}
export function cosine(a,b){let dot=0,aa=0,bb=0;for(let i=0;i<a.length;i++){dot+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i];}return aa&&bb?dot/Math.sqrt(aa*bb):0;}
export function lexicalSearch(q,records){
 const terms=q.toLowerCase().match(/[\p{L}\p{N}]+/gu)||[];
 let best=null,score=0;
 for(const r of records){const text=r.text.toLowerCase();let n=0;for(const t of terms){if(text.includes(t)) n+=t.length;else if(t.length>=2){for(let i=0;i<t.length-1;i++)if(text.includes(t.slice(i,i+2)))n+=.25;}} if(n>score){score=n;best=r;}}
 return {record:best||records[Math.floor(Math.random()*records.length)],matched:!!best,score};
}
