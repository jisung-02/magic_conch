import corpus from './korean-corpus.json' with {type:'json'};
export const MODEL = 'Xenova/multilingual-e5-small';
export const CONFIG = {model:MODEL, revision:'761b726dd34fb83930e26aab4e9ac3899aa1fa78', dimensions:384, pooling:'mean', normalize:true, query_prefix:'query: ', passage_prefix:'passage: '};
export const demo = corpus.records;
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
