/** Pure presentation/selection helpers. Existing engines own all learning writes. */
export const practiceIdentity = q => JSON.stringify([q.prompt, q.answer]);
const cleanCount = value => Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;
function hash(s) { let n=2166136261;for (const c of String(s)) n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0; }
/** Preserve source turns; prefer due/missed skills, reserve unseen work, avoid recent items. */
export function adaptivePracticeRound(groups, count=8, seed=0, {learning={}, priority=()=>0, recent=[]}={}) {
  const limit=Math.min(8,cleanCount(count)),seen=new Set(),result=[],recentSet=new Set(Array.isArray(recent)?recent:[]);
  const history=learning&&typeof learning==='object'&&!Array.isArray(learning)?learning:{};
  const pools=(Array.isArray(groups)?groups:[]).map(group=>Array.isArray(group)?[...group]:[]);
  const rank=q=>{try {const n=Number(priority(q.skill));return Number.isFinite(n)?n:0;}catch{return 0;}};
  const turns=pools.map(()=>0);
  while(result.length<limit) {
    let progressed=false;
    for(let g=0;g<pools.length && result.length<limit;g++) {
      let candidates=pools[g].filter(q=>q&&typeof q.prompt==='string'&&!seen.has(practiceIdentity(q)));
      if(!candidates.length)continue;
      const fresh=candidates.filter(q=>!recentSet.has(practiceIdentity(q)));
      if(fresh.length)candidates=fresh;
      // The second turn in each source deliberately makes room for an unseen skill.
      const unseen=candidates.filter(q=>!cleanCount(history[q.skill]?.Seen));
      if(turns[g]===1 && unseen.length)candidates=unseen;
      candidates.sort((a,b)=>rank(b)-rank(a)||hash(seed+'|'+practiceIdentity(a))-hash(seed+'|'+practiceIdentity(b)));
      const q=candidates[0];seen.add(practiceIdentity(q));result.push(q);turns[g]++;progressed=true;
    }
    if(!progressed)break;
  }
  return result;
}
