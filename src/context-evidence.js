// Conservative evidence spans. This is a limited clause recognizer, not a
// Korean parser: a denial invalidates only its own cue, never a route globally.
export function evidenceClauses(text) {
 return text.split(/[.!?,。！？]|(?:하지만|그러나|반면|그런데)|(?<=지만)|(?<=아니라)|(?<=아니고)|(?=지금은|현재는|오늘은)/u).filter(Boolean);
}
// Only grammatical material may connect the cue to its denial. Arbitrary
// intervening words (e.g. nowhere to escape) cannot negate the danger itself.
const denial=/^(?:(?:가|이|를|을|는|은|한|할|하려는|려는|하고싶은|고싶은|다는|다고한|지는|게|건|것은|것이|생각은|의도는|생각|의도)){0,5}(?:아니|아님|아냐|없|못받|받지않|하지않|지않|안했|안받|안마|안먹)/;
export function affirmativeCue(clause,pattern) {
 const re=new RegExp(pattern.source,pattern.flags.replace('g','')+'g');
 for(const m of clause.matchAll(re)) {
  // Only the same cue's local span can be explicitly denied. Retain all other
  // clauses, including other actors/rooms/times and contradictory risk reports.
  const after=clause.slice(m.index+m[0].length,m.index+m[0].length+18);
  if(!denial.test(after))return true;
 }
 return false;
}
export function reportedRefusal(clauses) {
 // Korean negative imperatives describe the refused action, irrespective of
 // which conjugated action verb preceded them. They do not prove permission.
 return clauses.some(c=>affirmativeCue(c,/(?:지|지는|진)말(?:라고|랬|라|아)|싫다|싫대|싫어|거절|원하지않|원치않|안된다고|차단/));
}
export function hazardEvidence(clauses) {
 // Reusable physical co-evidence, not isolated domain words: hazardous state
 // plus a real exposure/place. Fictional/teaching nouns alone are insufficient.
 for(const c of clauses) {
  const place=/(건물|집|실내|방|주방|부엌|복도|계단|길|바닥|차량|전기|콘센트|숨|기침)/.test(c);
  if(place&&affirmativeCue(c,/화재|불길|연기(?:가|는|로)?(?:차|가득|퍼|나|기침|확산|들어(?:오|온|와))|불(?:이|은|가)?(?:났|붙|번|타)/))return {scope:'danger_fire',evidence:'실제 공간의 화재·연기 노출'};
  const electrical=/(전선|전기선|전깃줄|콘센트|플러그|전기기기|전기설비)/.test(c);
  const damaged=affirmativeCue(c,/(끊어|끊긴|끊어진|벗겨|노출|떨어|불꽃|스파크|감전|파손|젖)/);
  if(electrical&&damaged)return {scope:'danger_electric',evidence:'전기 설비의 손상·노출·발화 위험'};
 }
 return null;
}
export function reflexiveHarmEvidence(clauses) {
 // Bind an explicit reflexive body target to the grammatical actor. No name
 // list or evaluation text: another actor harming their own body needs support.
 for(const c of clauses) {
  const target=/(?:자기|자신|스스로)(?:의)?(?:몸)?(?:을|를)?(?:해치|해칠|해쳐|다치|다칠)/;
  if(!affirmativeCue(c,target))continue;
  const subject=/^(?:지금|오늘|현재|방금)?([가-힣]{1,12}?)(?:이가|가|이는|은|는|이)/.exec(c);
  const actor=subject?.[1];const other=actor&&!['나','내','저','제','자신','스스로'].includes(actor);
  return {scope:other?'helping_other':'active',evidence:other?'다른 행위자가 자기 몸을 해칠 위험':'자기 대상으로 한 해칠 위험'};
 }
 return null;
}
export function publicationEvidence(clauses) {
 const publication=/(게시|공개|업로드|올리|올릴|올려)/;
 const request=/(할까|볼까|해도|될까|올릴까|올려도|할지|하자)/;
 const relevant=clauses.filter(c=>publication.test(c));
 if(!relevant.some(c=>request.test(c)))return null;
 const all=clauses.join('.');
 const materials=all.match(/사진|영상|글|그림|정보|일기|녹음|음성|모습/g)||[];
 const permission=/(허락|동의|거절)/.test(all);
 const thirdParty=/(친구|상대|당사자|동료|타인|다른사람|그사람|남의|가족|지인|연인|누나|동생|선배|후배)|[가-힣]{2,6}(?:에게|한테)/.test(all);
 // Only an explicitly personal item on one's own destination, with no mixed
 // person/permission/material references, is a clear ordinary scope. Merely
 // being the photographer/owner does not prove a depicted person's permission.
 const ownItem=/(?:내|제|나의|저의)(?:사진|영상|글|그림|정보|일기|녹음|음성|모습)/.test(all);
 const ownDestination=/(?:내|제|나의|저의)(?:블로그|계정|게시판|sns)/.test(all);
 const ownRequest=/^(?:오늘|지금|나는|내가|제가)?(?:내|제|나의|저의)(?:사진|영상|글|그림|정보|일기|녹음|음성|모습)(?:을|를)?(?:내|제|나의|저의)(?:블로그|계정|게시판|sns)(?:에|으로)?(?:게시|공개|업로드|올리|올릴|올려)(?:할까|해도될까|도될까|도돼|까|할지|하자)\??$/;
 const ownOnly=ownItem&&ownDestination&&materials.length===1&&!permission&&!thirdParty&&clauses.length===1&&ownRequest.test(all);
 if(ownOnly)return {ownOnly:true,scope:'own_publication'};
 // Unstructured words cannot prove the actor/material/action/audience link,
 // even if an affirmative permission phrase occurs in the same clause.
 if(permission||thirdParty||materials.length)return {ownOnly:false,scope:'publication_permission_unconfirmed'};
 return null;
}
