// Editorial repair to an identified original practice item, never teacher text.
export const SUBTRACTION_CHECK_PROMPT='Sam says 9 - 4 = 6. Which addition fact checks the correct difference?';
const legacy=new Set([
 'Sam says 9 - 4 = 6. Which fact shows that his answer is one too high?',
 'Sam says 9 - 4 = 6. Which fact shows his answer is one too high?',
]);
export function knownSubtractionCheck(q){
 return q?.subject==='Math'&&q.skill==='math-subtraction'&&/^auto-math-subtraction-/.test(q.id||'')&&q.answer==='5 + 4 = 9'&&
  Array.isArray(q.choices)&&q.choices.length===3&&[...q.choices].sort().join('|')==='5 + 4 = 9|6 + 4 = 10|9 + 4 = 13'&&
  (legacy.has(q.prompt)||q.prompt===SUBTRACTION_CHECK_PROMPT);
}
// A wording revision gets its own question ID; archive identity/provenance stay stable.
export function correctOriginalQuestion(q){
 if(!knownSubtractionCheck(q))return q;
 return q.prompt===SUBTRACTION_CHECK_PROMPT&&q.id.endsWith('-wording-v2')?q:{...q,id:q.id.endsWith('-wording-v2')?q.id:q.id+'-wording-v2',prompt:SUBTRACTION_CHECK_PROMPT};
}
