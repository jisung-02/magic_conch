import {pipeline,env} from '@huggingface/transformers';
import wasmURL from '../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.wasm?url';
import mjsURL from '../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.mjs?url';
import {examples} from './korean-retrieval.js';
env.allowLocalModels=false;env.backends.onnx.wasm.numThreads=1;env.backends.onnx.wasm.wasmPaths={wasm:new URL(wasmURL,self.location.href).href,mjs:new URL(mjsURL,self.location.href).href};
let extractor,prefix;
self.onmessage=async({data})=>{try{
 if(data.type==='load'){prefix=data.model.includes('e5')?'query: ':'';extractor=await pipeline('feature-extraction',data.model,{dtype:'q8',device:'wasm',revision:data.revision,progress_callback:p=>self.postMessage({type:'status',message:`내려받는 중 · ${p.file||'모델'}${Number.isFinite(p.progress)?' · '+Math.round(p.progress)+'%':''}`})});const vectors=[];
 for(let i=0;i<examples.length;i++){self.postMessage({type:'status',message:`한국어 질문 예시 계산 중 · ${i+1}/${examples.length}`});vectors.push(Array.from((await extractor(prefix+examples[i].text,{pooling:'mean',normalize:true,truncation:true,max_length:128})).data));}
 self.postMessage({type:'loaded',vectors});
 }else if(data.type==='query'){if(!extractor)throw Error('검색 모델이 준비되지 않았어요.');self.postMessage({type:'vector',id:data.id,vector:Array.from((await extractor(prefix+data.question,{pooling:'mean',normalize:true,truncation:true,max_length:128})).data)});}
 }catch(e){self.postMessage({type:'error',id:data.id,message:String(e.message||e)});}};
