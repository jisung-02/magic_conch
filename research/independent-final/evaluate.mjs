import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {execFileSync} from 'node:child_process';
import {pipeline,env} from '@huggingface/transformers';
import {intents,denseRanks,planBuiltinAnswer,CONFLICT_MARGIN} from '../../src/korean-retrieval.js';
import {demo} from '../../src/data.js';import {Agent,tokenizerFromHF} from '../../src/vendor/laya/agent.js';import {buildLayaQuestion} from '../../src/laya-choice.js';
const frozen='b6224b70b72d8e51456f81d1fcd115096ab26b3d';
if(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()!==frozen)throw Error('Candidate commit mismatch');
const file=process.argv[2];const bytes=fs.readFileSync(file);const sha=crypto.createHash('sha256').update(bytes).digest('hex');
if(sha!=='0801097594a7d2a534c9b7854eae0ef37bcc1e64dbbc7d94cea649ea730ed49f')throw Error('Dataset checksum mismatch');
const dataset=JSON.parse(bytes),spec=JSON.parse(fs.readFileSync('public/search-model.json')),verification=JSON.parse(fs.readFileSync('research/results/ko-cache-verification.json'));
for(const [name,f] of Object.entries(verification.files)){const data=fs.readFileSync(path.join('model-cache',spec.model,name));const hash=crypto.createHash(f.algorithm==='sha256'?'sha256':'sha1');if(f.algorithm==='git-blob-sha1')hash.update('blob '+data.length+'\0');hash.update(data);if(hash.digest('hex')!==f.digest)throw Error('Cache digest mismatch '+name);}
if(verification.revision!==spec.revision)throw Error('Cache revision mismatch');
env.localModelPath=path.resolve('model-cache/verified-pin');env.cacheDir=path.resolve('model-cache/verified-pin');env.allowLocalModels=true;env.allowRemoteModels=false;
const extractor=await pipeline('feature-extraction',spec.model,{dtype:'q8',device:'cpu',revision:spec.revision});
// These archived index vectors were rechecked against the pinned files with max drift=0.
const vectors=JSON.parse(fs.readFileSync('research/results/ko-sroberta-multitask-intent-dev.json')).indexVectors;
const rows=[];
for(const c of dataset.cases){const start=performance.now();const vector=Array.from((await extractor(c.query_ko,{pooling:'mean',normalize:true,truncation:true,max_length:128})).data);const ranked=denseRanks(vector,vectors,'balanced');const plan=planBuiltinAnswer(ranked,demo);const candidateRecords=plan.candidates.length?plan.candidates:[plan.record];rows.push({...c,ood:c.phenomena.includes('out_of_domain'),rawTop3:ranked.slice(0,3).map(r=>({intent:r.intent.id,route:r.intent.route,score:r.score})),retrievalTop1:ranked[0].intent.id,record:plan.record,policyAbstained:plan.abstained,abstentionReason:plan.reason||null,candidates:candidateRecords,ms:performance.now()-start});}
await extractor.dispose();
const root=process.argv[3]||'../../laya-onnx-packed';const tok=tokenizerFromHF(JSON.parse(fs.readFileSync(root+'/tokenizer.json'))),cfg=JSON.parse(fs.readFileSync(root+'/rl_agent_config.json'));const batches=[];
const agent=new Agent({tok,cfg,max_len:1024,head_max_len:640,provider:{async runEncoder(b){batches.push(b);return {lastHidden:[[[]]]};},async runHead(h,b){return {logits:[b.markerPos[0].map(()=>0)],act:[[0,0]]};}}});
for(const row of rows){const result=await agent.predict(row.query_ko,buildLayaQuestion(row.candidates),{lang:'ko'});row.layaUsage=result.usage;if(result.usage.truncated||result.usage.options)throw Error('Shipping worker would reject truncated input '+row.id);}
const out={candidateCommit:frozen,checksum:sha,configuration:{...spec,aggregation:'0.75 max + 0.25 centroid',maxLength:128,conflictMargin:CONFLICT_MARGIN},execution:'Node CPU q8; verified pinned cache; archived example vectors previously verified max drift0. No browser execution.',rows,batches};
fs.writeFileSync('research/independent-final/raw-retrieval.json',JSON.stringify(out,null,2));console.log('Saved raw retrieval / shipping candidate batches:',rows.length);
