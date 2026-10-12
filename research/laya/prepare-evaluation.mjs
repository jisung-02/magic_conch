import fs from 'node:fs';
import {Agent,tokenizerFromHF} from '../../src/vendor/laya/agent.js';
import {buildLayaQuestion} from '../../src/laya-choice.js';
import {demo} from '../legacy-data.js';
const root=process.argv[2]||'../../laya-onnx-int8';
const tok=tokenizerFromHF(JSON.parse(fs.readFileSync(root+'/tokenizer.json'))),cfg=JSON.parse(fs.readFileSync(root+'/rl_agent_config.json'));
const records=[...demo.filter(r=>['1','2','3','4','5','7','10','11'].includes(r.id))];
const questions=['직장을 옮길까요?','이직할까?','이직하지 않고 지금 회사에 남고 싶어요.','퇴사해서 쉬고 싶어.','친구에게 먼저 연락할까?','친구에게 먼저 연락하지 말까?','그 사람이 연락하지 말라고 했는데 다시 연락할까?','너무 피곤한데 오늘 쉬어도 될까?','오늘 쉬고 싶지 않고 일을 끝내고 싶어.','새로운 취미를 시작해 볼까?','취미를 시작하고 싶지 않아요.','이 물건을 살까?','이 물건은 사고 싶지 않아.','약을 마음대로 끊어도 될까?','오늘 몇 시야?'];
const batches=[];const agent=new Agent({tok,cfg,max_len:1024,head_max_len:640,provider:{async runEncoder(b){batches.push(b);return {lastHidden:[[[]]]};},async runHead(h,b){return {logits:[b.markerPos[0].map(()=>0)],act:[[0,0]]};}}});
for(const question of questions){const out=await agent.predict(question,buildLayaQuestion(records));if(out.usage.truncated||out.usage.options)throw Error('truncation '+question);}
fs.writeFileSync('research/laya/inputs.json',JSON.stringify({questions,records,cfg,batches},null,2));console.log('Prepared',questions.length,'Korean sequences; token counts',batches.map(b=>b.inputIds[0].length));
