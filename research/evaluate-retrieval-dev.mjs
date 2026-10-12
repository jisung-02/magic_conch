import {embeddingSpecs} from './embedding-specs.mjs';
import fs from 'node:fs';import path from 'node:path';import {pipeline,env} from '@huggingface/transformers';import {intents,examples,lexicalRanks,denseRanks,fuse} from '../src/korean-retrieval.js';import {cosine} from '../src/data.js';import {demo as legacy} from './legacy-data.js';
env.cacheDir=path.resolve('model-cache');env.allowLocalModels=false;
const all=JSON.parse(fs.readFileSync('research/question-cases.ko.json')).cases;
const ids=['walk','message','hobby','choice','purchase','career'];const gold={walk:['reversible_outing'],message:['casual_contact'],hobby:['start_hobby','task_start'],choice:['light_food_choice'],purchase:['small_purchase'],career:['major_career']};
const cases=all.filter(c=>ids.includes(c.id)).flatMap(c=>Object.entries(c.questions).map(([kind,query])=>({id:c.id+'-'+kind,query,accept:gold[c.id]})));
cases.push({id:'career-reported-1',query:'직장을 옮길까요?',accept:['major_career']},{id:'career-reported-2',query:'이직할까?',accept:['major_career']});
const specs=embeddingSpecs;const report=[];
for(const spec of specs){console.log('load',spec.model);const p=await pipeline('feature-extraction',spec.model,{dtype:'q8',device:'cpu',revision:spec.revision});const emb=async(text,prefix=spec.prefix)=>Array.from((await p(prefix+text,{pooling:'mean',normalize:true,truncation:true,max_length:spec.model.includes('e5')?512:128})).data);
 const vectors=[];for(const ex of examples)vectors.push(await emb(ex.text));const rows=[];
 const centroids=intents.map(intent=>{const list=vectors.filter((v,i)=>examples[i].id===intent.id);return {intent,vector:list[0].map((_,j)=>list.reduce((s,v)=>s+v[j],0)/list.length)};});
 for(const c of cases){const start=performance.now();const v=await emb(c.query),max=denseRanks(v,vectors,'max'),top2=denseRanks(v,vectors,'top2'),lex=lexicalRanks(c.query),centroid=centroids.map(r=>({intent:r.intent,score:cosine(v,r.vector)})).sort((a,b)=>b.score-a.score);const methods={max,top2,centroid,lexical:lex,rrf20:fuse(max,lex,20),rrf60:fuse(max,lex,60)};
 rows.push({...c,ms:performance.now()-start,methods:Object.fromEntries(Object.entries(methods).map(([name,rs])=>[name,rs.map(r=>({id:r.intent.id,score:r.score}))]))});}
 const scores=Object.fromEntries(Object.keys(rows[0].methods).map(m=>[m,rows.filter(r=>r.accept.includes(r.methods[m][0].id)).length]));console.log('dev',spec.model,scores,'/',rows.length);
 const result={model:spec.model,revision:spec.revision,prefix:spec.prefix,split:'development; known failure questions included',count:rows.length,scores,rows,indexVectors:vectors};fs.writeFileSync('research/results/'+spec.model.split('/')[1]+'-intent-dev.json',JSON.stringify(result,null,2));report.push({model:spec.model,revision:spec.revision,scores,count:rows.length});await p.dispose();
}
fs.writeFileSync('research/results/dev-comparison.json',JSON.stringify(report,null,2));
