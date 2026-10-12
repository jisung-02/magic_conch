import * as ort from 'ort-laya/wasm';
import wasmURL from '../node_modules/ort-laya/dist/ort-wasm-simd-threaded.wasm?url';
import mjsURL from '../node_modules/ort-laya/dist/ort-wasm-simd-threaded.mjs?url';
import {Agent,tokenizerFromHF} from './vendor/laya/agent.js';
import {buildLayaQuestion,resolveLayaChoice} from './laya-choice.js';
ort.env.wasm.numThreads=1;
ort.env.wasm.wasmPaths={wasm:new URL(wasmURL,self.location.href).href,mjs:new URL(mjsURL,self.location.href).href};
let agent;
const status=(message)=>self.postMessage({type:'status',message});
async function artifact(base,file){
 const url=new URL(file.path,base).href;let cache;
 try{cache=await caches.open('magic-conch-laya-v1');const hit=await cache.match(url);if(hit){status(`캐시에서 읽는 중 · ${file.path}`);return new Uint8Array(await hit.arrayBuffer());}}catch{}
 status(`내려받는 중 · ${file.path}`);const response=await fetch(url);if(!response.ok)throw new Error(`${file.path}: HTTP ${response.status}`);
 const reader=response.body.getReader(),chunks=[];let done=0;
 for(;;){const {done:end,value}=await reader.read();if(end)break;chunks.push(value);done+=value.length;status(`내려받는 중 · ${file.path} · ${Math.round(done/file.bytes*100)}%`);}
 const bytes=new Uint8Array(done);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
 if(done!==file.bytes)throw new Error('모델 파일 크기가 달라요.');
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');if(digest!==file.sha256)throw new Error('모델 파일 무결성 검사에 실패했어요.');
 try{await cache?.put(url,new Response(bytes));}catch{status('캐시 저장 실패 · 이번 세션에서는 사용할 수 있어요.');}
 return bytes;
}
const int64=(values,dims)=>new ort.Tensor('int64',BigInt64Array.from(values.flat(),x=>BigInt(x)),dims);
function nested(t){let p=0;return Array.from({length:t.dims[0]},()=>Array.from({length:t.dims[1]},()=>Array.from({length:t.dims[2]},()=>Number(t.data[p++]))));}
function createProvider(encoder,head){return {
 async runEncoder(b){const n=b.inputIds.length,l=b.inputIds[0].length;const out=await encoder.run({input_ids:int64(b.inputIds,[n,l]),attention_mask:int64(b.attentionMask,[n,l])});const t=out.last_hidden_state;const lastHidden=nested(t);t.dispose();return {lastHidden};},
 async runHead(hidden,b){const n=hidden.length,l=hidden[0].length,d=hidden[0][0].length,k=b.markerPos[0].length;
 const feeds={hidden_states:new ort.Tensor('float32',Float32Array.from(hidden.flat(2)),[n,l,d]),marker_pos:int64(b.markerPos,[n,k]),marker_mask:new ort.Tensor('bool',Uint8Array.from(b.markerMask.flat(),Number),[n,k]),qtype:int64(b.qtype,[n,1]),attention_mask:int64(b.attentionMask,[n,l])};
 const out=await head.run(feeds);const logits=Array.from({length:n},(_,i)=>Array.from(out.logits.data.slice(i*k,(i+1)*k)));const a=out.act_logits;const act=Array.from({length:n},(_,i)=>Array.from(a.data.slice(i*a.dims[1],(i+1)*a.dims[1])));for(const t of Object.values(feeds))t.dispose();for(const t of Object.values(out))t.dispose();return {logits,act};}
};}
self.onmessage=async({data})=>{try{
 if(data.type==='load'){
 const base=new URL(data.base,self.location.href);const res=await fetch(new URL('manifest.json',base));if(!res.ok)throw new Error('Laya 모델 배포 파일을 찾지 못했어요.');const manifest=await res.json();
 const config=JSON.parse(new TextDecoder().decode(await artifact(base,manifest.files.config)));
 const raw=JSON.parse(new TextDecoder().decode(await artifact(base,manifest.files.tokenizer)));const tok=tokenizerFromHF(raw);if(!tok)throw new Error('토크나이저 형식 오류');
 status('Laya encoder 준비 중 · WASM · FP32 계산');let bytes=await artifact(base,manifest.files.encoder);const encoder=await ort.InferenceSession.create(bytes,{executionProviders:['wasm'],graphOptimizationLevel:'basic'});bytes=null;
 status('학습된 Laya decision head 준비 중');bytes=await artifact(base,manifest.files.head);const head=await ort.InferenceSession.create(bytes,{executionProviders:['wasm'],graphOptimizationLevel:'basic'});bytes=null;
 agent=new Agent({provider:createProvider(encoder,head),tok,cfg:config,max_len:1024,head_max_len:640,revision:manifest.revision});self.postMessage({type:'loaded',manifest});
 }else if(data.type==='decide'){
 if(!agent)throw new Error('Laya 모델이 준비되지 않았어요.');const start=performance.now();const result=await agent.predict(data.question,buildLayaQuestion(data.records),{lang:'ko'});
 if(result.usage.truncated||result.usage.options)throw new Error('질문이나 선택지가 토큰 제한을 넘었어요. 더 짧은 선택지를 사용해 주세요.');
 const choice=result.answers.answer.choice;const record=resolveLayaChoice(choice,data.records);
 self.postMessage({type:'decided',id:data.id,record,choice,usage:result.usage,probabilities:result.answers.answer.probabilities,elapsedMs:performance.now()-start});
 }
 }catch(error){self.postMessage({type:'error',id:data.id,message:String(error.message||error)});}};
