import wasmURL from '../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.wasm?url';
import mjsURL from '../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.mjs?url';
import { pipeline, env } from '@huggingface/transformers';
import {MODEL} from './data.js';
env.allowLocalModels = false;
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.wasmPaths = {wasm:new URL(wasmURL,self.location.href).href,mjs:new URL(mjsURL,self.location.href).href};
let extractor;
self.onmessage=async({data})=>{
 try{
  if(data.type==='load'){
   extractor=await pipeline('feature-extraction',MODEL,{dtype:'q8',device:'wasm',revision:'761b726dd34fb83930e26aab4e9ac3899aa1fa78',progress_callback:p=>self.postMessage({type:'progress',file:p.file,progress:p.progress,status:p.status})});
   self.postMessage({type:'loaded'});
  }else if(data.type==='embed'){
   if(!extractor)throw new Error('모델이 준비되지 않았어요.');
   const results=[];
   for(let i=0;i<data.texts.length;i++){
    const output=await extractor(data.texts[i],{pooling:'mean',normalize:true});results.push(Array.from(output.data));
    self.postMessage({type:'index-progress',done:i+1,total:data.texts.length});
   }
   self.postMessage({type:'embedded',id:data.id,results});
  }
 }catch(e){self.postMessage({type:'error',message:String(e.message||e),id:data.id});}
};
