export const LAYA_LIMIT=8;
export function buildLayaQuestion(records){
 if(!records.length||records.length>LAYA_LIMIT)throw new Error('Laya 후보는 1~8개여야 해요.');
 const criteria=Object.fromEntries(records.map((r,i)=>[String.fromCharCode(65+i),`${r.answer} (상황: ${r.text})`]));
 criteria.NONE='이 질문에 적합한 답이 없음. 사실 확인이나 중요한 개인 결정에 필요한 정보가 부족함.';
 return {answer:{type:'choice',instructions:'사용자의 고민에 어울리는 짧은 응답을 선택하세요. 상황의 부정 표현과 의도를 구분하세요. 개인의 중대한 결정을 대신 단정하지 마세요. 적절한 응답이 없으면 NONE을 고르세요.',criteria}};
}
export function resolveLayaChoice(choice,records){if(choice==='NONE')return null;const i=choice?.charCodeAt(0)-65;if(choice?.length!==1||!Number.isInteger(i)||i<0||i>=records.length)throw new Error('Laya가 유효하지 않은 선택지를 반환했어요.');return records[i];}
