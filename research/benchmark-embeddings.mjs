import fs from 'node:fs';import path from 'node:path';
import {pipeline,env} from '@huggingface/transformers';
env.cacheDir=path.resolve('model-cache');env.allowLocalModels=false;
const b=JSON.parse(fs.readFileSync('research/korean-embedding-benchmark.json'));
const specs=[{id:'Xenova/multilingual-e5-small',prefix:'query: '},{id:'anpigon/ko-sroberta-multitask',prefix:''},{id:'Xenova/paraphrase-multilingual-MiniLM-L12-v2',prefix:''}];
const cos=(a,b)=>{let d=0,aa=0,bb=0;for(let i=0;i<a.length;i++){d+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i];}return d/Math.sqrt(aa*bb);};
fs.mkdirSync('research/results',{recursive:true});
for(const spec of specs){try{const start=performance.now();console.log('loading',spec.id);const p=await pipeline('feature-extraction',spec.id,{dtype:'q8',device:'cpu'});const texts=[...new Set([...b.pairs.flatMap(p=>[p.a,p.b]),...b.retrieval_corpus.map(r=>r.text),...b.retrieval_cases.map(r=>r.query)])];const vectors={};const times=[];
 for(const text of texts){const t=performance.now();const result=await p(spec.prefix+text,{pooling:'mean',normalize:true,truncation:true,max_length:spec.id.includes('e5')?512:128});vectors[text]=Array.from(result.data);times.push(performance.now()-t);}
 const output={model:spec.id,prefix:spec.prefix,elapsed:performance.now()-start,times,vectors};const rows=[];
 for(const n of b.pairs.filter(x=>x.relation!=='paraphrase')){const positive=b.pairs.find(p=>p.id===n.positive_pair_id);const a=cos(vectors[n.a],vectors[positive.b]),z=cos(vectors[n.a],vectors[n.b]);rows.push({id:n.id,split:n.split,pass:a>z,positive:a,contrast:z});}
 const corpusVectors={};for(const r of b.retrieval_corpus){corpusVectors[r.text]=spec.prefix?Array.from((await p('passage: '+r.text,{pooling:'mean',normalize:true})).data):vectors[r.text];}output.corpusPrefix=spec.prefix?'passage: ':'';output.pairs=rows;output.retrieval=b.retrieval_cases.map(c=>{const ranked=b.retrieval_corpus.map(r=>({id:r.id,score:cos(vectors[c.query],corpusVectors[r.text])})).sort((a,b)=>b.score-a.score);return {...c,ranked};});
 const filename=spec.id.split('/')[1];fs.writeFileSync('research/results/'+filename+'.json',JSON.stringify(output,null,2));console.log('DEV',spec.id,'triplets',rows.filter(r=>r.split==='dev'&&r.pass).length,'/',rows.filter(r=>r.split==='dev').length,'retrieval',output.retrieval.filter(r=>r.split==='dev'&&r.relevant_ids.includes(r.ranked[0].id)).length,'/',output.retrieval.filter(r=>r.split==='dev'&&r.relevant_ids.length).length);await p.dispose();
}catch(error){console.log('FAILED',spec.id,String(error));fs.writeFileSync('research/results/'+spec.id.split('/')[1]+'-error.txt',String(error));}}
