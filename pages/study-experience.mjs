/** Pure presentation/selection helpers. Existing engines own all learning writes. */
export const practiceIdentity = q => JSON.stringify([q.prompt, q.answer]);
const cleanCount = value => Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
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
export function learningRows(learning={}) {
  if(!learning||typeof learning!=='object'||Array.isArray(learning))return [];
  return Object.entries(learning).filter(([,r])=>r&&cleanCount(r.Seen)>0).map(([skill,r])=>{
    const answered=cleanCount(r.Seen),independent=Math.min(answered,cleanCount(r.IndependentCorrect));
    const assisted=Math.min(answered-independent,cleanCount(r.CorrectAfterRetry));
    return {skill,label:skill.replace(/-/g,' '),answered,independent,assisted,review:!r.LastResolution?.independent};
  }).sort((a,b)=>Number(b.review)-Number(a.review)||a.label.localeCompare(b.label));
}
export function learningSummaryMarkup(learning={}) {
  const rows=learningRows(learning);
  if(!rows.length)return '<section class="room-learning-summary"><h3>Learning on this device</h3><p>No answered practice is saved yet. A short round will add a starting point.</p></section>';
  return '<section class="room-learning-summary"><h3>Learning on this device</h3><p>These are answered questions within each skill, not grades or proof of mastery. Hints and retries count as supported practice.</p><ul>'+rows.slice(0,8).map(r=>'<li><strong>'+esc(r.label)+'</strong><span>'+r.answered+' answered · '+r.independent+' independently · '+r.assisted+' with support</span><small>'+(r.review?'Revisit with a short practice.':'Try again on another day to check recall.')+'</small></li>').join('')+'</ul><p>No names or results are sent to school. These results do not predict a STAR score.</p></section>';
}
