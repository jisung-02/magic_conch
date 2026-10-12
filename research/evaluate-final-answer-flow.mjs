import crypto from 'node:crypto';
import fs from 'node:fs';import path from 'node:path';import {pipeline,env} from '@huggingface/transformers';
import {intents,denseRanks,planBuiltinAnswer,candidatesFor,CONFLICT_MARGIN,examples} from '../src/korean-retrieval.js';import {demo} from '../src/data.js';
import {Agent,tokenizerFromHF} from '../src/vendor/laya/agent.js';import {buildLayaQuestion} from '../src/laya-choice.js';
env.cacheDir=path.resolve('model-cache');env.allowLocalModels=false;
const fixture=JSON.parse(fs.readFileSync('research/final-answer-validation.json'));
const dev=JSON.parse(fs.readFileSync('research/results/ko-sroberta-multitask-intent-dev.json'));
const model=JSON.parse(fs.readFileSync('public/search-model.json'));
if(process.env.CONCH_VERIFIED_CACHE==='1'){
 const verification=JSON.parse(fs.readFileSync('research/results/ko-cache-verification.json'));
 if(verification.revision!==model.revision)throw Error('Verified revision mismatch');
 for(const [name,f] of Object.entries(verification.files)){const bytes=fs.readFileSync(path.join('model-cache',model.model,name));const hash=crypto.createHash(f.algorithm==='sha256'?'sha256':'sha1');if(f.algorithm==='git-blob-sha1')hash.update('blob '+bytes.length+'\0');hash.update(bytes);if(hash.digest('hex')!==f.digest)throw Error('Cached digest mismatch '+name);}
 env.localModelPath=path.resolve('model-cache/verified-pin');env.cacheDir=path.resolve('model-cache/verified-pin');env.allowLocalModels=true;env.allowRemoteModels=false;
}
const p=await pipeline('feature-extraction',model.model,{dtype:'q8',device:'cpu',revision:model.revision});const cases=[];
const verifiedVectors=[];
for(const ex of examples)verifiedVectors.push(Array.from((await p(ex.text,{pooling:'mean',normalize:true,truncation:true,max_length:128})).data));
const historicalIndexMaxDrift=Math.max(...verifiedVectors.flatMap((v,i)=>v.map((x,j)=>Math.abs(x-dev.indexVectors[i][j]))));
for(const c of fixture.cases){const vector=Array.from((await p(c.query,{pooling:'mean',normalize:true,truncation:true,max_length:128})).data);const ranked=denseRanks(vector,verifiedVectors,'balanced'),plan=planBuiltinAnswer(ranked,demo);const expected=intents.find(i=>i.id===c.intent);const allowed=candidatesFor(expected,demo).filter(r=>r.id!=='route_unknown').map(r=>r.id);if(c.intent==='unclear_question')allowed.push('route_unknown');cases.push({...c,allowed,record:plan.record,abstained:plan.abstained,candidates:plan.candidates,ranked:ranked.slice(0,3).map(r=>({id:r.intent.id,score:r.score})),strictPass:allowed.includes(plan.record.id)});}
await p.dispose();
const root=process.argv[2]||'../../laya-onnx-packed';const tok=tokenizerFromHF(JSON.parse(fs.readFileSync(root+'/tokenizer.json'))),cfg=JSON.parse(fs.readFileSync(root+'/rl_agent_config.json'));const batches=[];
const agent=new Agent({tok,cfg,max_len:1024,head_max_len:640,provider:{async runEncoder(b){batches.push(b);return {lastHidden:[[[]]]};},async runHead(h,b){return {logits:[b.markerPos[0].map(()=>0)],act:[[0,0]]};}}});
for(const c of cases){const result=await agent.predict(c.query,buildLayaQuestion(c.candidates),{lang:'ko'});if(result.usage.truncated||result.usage.options)throw Error('Truncated shipping candidates '+c.id);}
const summary={count:cases.length,strictAnswerAccept:cases.filter(c=>c.strictPass).length,additionalAbstentions:cases.filter(c=>!c.strictPass&&c.record.id==='route_unknown').length,conflictMargin:CONFLICT_MARGIN,scope:fixture.purpose,historicalIndexMaxDrift,indexSource:'88 example vectors recomputed with verified pinned files; CPU not browser'};
fs.writeFileSync('research/results/final-answer-flow.json',JSON.stringify({summary,cases,batches},null,2));console.log(summary);console.log(cases.filter(c=>!c.strictPass).map(c=>({query:c.query,got:c.record.id,abstained:c.abstained,expected:c.allowed})));
