// Editorial repair to an identified original practice item, never teacher text.
export const SUBTRACTION_CHECK_PROMPT='Sam says 9 - 4 = 6. Which addition fact checks the correct difference?';
const legacy=new Set([
 'Sam says 9 - 4 = 6. Which fact shows that his answer is one too high?',
 'Sam says 9 - 4 = 6. Which fact shows his answer is one too high?',
]);
export function knownSubtractionCheck(q){
 return q?.subject==='Math'&&q.skill==='math-subtraction'&&typeof q.id==='string'&&/^auto-math-subtraction-/.test(q.id||'')&&q.answer==='5 + 4 = 9'&&
  Array.isArray(q.choices)&&q.choices.length===3&&[...q.choices].sort().join('|')==='5 + 4 = 9|6 + 4 = 10|9 + 4 = 13'&&
  (legacy.has(q.prompt)||q.prompt===SUBTRACTION_CHECK_PROMPT);
}
function revisionFingerprint(value){
 let hash=2166136261>>>0;
 for(const ch of value){hash^=ch.charCodeAt(0);hash=Math.imul(hash,16777619)>>>0;}
 return hash.toString(16).padStart(8,'0');
}
// A wording revision gets its own identity; archive history stays stable.
export function correctOriginalQuestion(q){
 if(!knownSubtractionCheck(q))return q;
 const fixed={...q,id:q.id.endsWith('-wording-v2')?q.id:q.id+'-wording-v2',prompt:SUBTRACTION_CHECK_PROMPT};
 if(q.contentFingerprint)fixed.contentFingerprint=revisionFingerprint(`${q.skill}|${q.questionType||'direct'}|${fixed.prompt}`);
 if(q.variantFingerprint)fixed.variantFingerprint=revisionFingerprint(`${fixed.prompt}|${q.answer}|${q.choices.join('|')}`);
 return Object.keys(fixed).every(key=>fixed[key]===q[key])?q:fixed;
}
