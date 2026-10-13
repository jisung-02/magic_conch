// Conservative evidence spans. This is a limited clause recognizer, not a
// Korean parser: a denial invalidates only its own cue, never a route globally.
export function evidenceClauses(text) {
 return text.split(/[.!?,。！？]|(?:하지만|그러나|반면|그런데)|(?<=지만)|(?<=아니라)|(?<=아니고)|(?=지금은|현재는|오늘은)/u).filter(Boolean);
}
// Only grammatical material may connect the cue to its denial. Arbitrary
// intervening words (e.g. nowhere to escape) cannot negate the danger itself.
const denial=/^(?:(?:가|이|를|을|는|은|한|할|하려는|려는|하고싶은|고싶은|다는|다고한|지는|게|건|것은|것이|생각은|의도는)){0,5}(?:아니|아님|아냐|없|못받|받지않|하지않|지않|안했|안받|안마|안먹)/;
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
export function publicationEvidence(clauses) {
 const publication=/(?:인터넷|온라인|게시판|누리집|SNS)?(?:게시|공개|업로드|올리|올릴|올려)/;
 const request=/(?:할까|볼까|해도|될까|올릴까|올려도|올릴지|게시할지|공개할지|올리자|게시하자)/;
 const affected=/(허락|동의|사진|영상|녹음|촬영|당사자|상대|친구|동료)/;
 const relevant=clauses.filter(c=>publication.test(c));
 if(!relevant.some(c=>request.test(c))||!clauses.some(c=>affected.test(c)))return null;
 // Positive permission must be an explicit completed affirmation in the very
 // clause requesting publication. Earlier permission can concern another
 // object, recipient, action or time; do not infer an affirmative link.
 const affirm=/(허락(?:을)?받았|허락받았|동의(?:를)?받았|동의받았|허락한|동의한|허락해준|동의해준|게시까지동의받음)/;
 const unsure=/(아직|모르|안받|못받|받지않|받은게아니|받은것이아니|없|거절|싫|하지말|받았는지|받았을까|받았나|아니|않|확실하지않)/;
 const permissionClauses=clauses.filter(c=>/(허락|동의)/.test(c));
 const certain=relevant.length===1&&permissionClauses.length===1&&
  request.test(relevant[0])&&affirm.test(relevant[0])&&!unsure.test(relevant[0]);
 return {certain,scope:certain?'permitted_public_action':'publication_permission_unconfirmed'};
}
