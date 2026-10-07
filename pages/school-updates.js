(()=>{"use strict";
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const normalize=s=>String(s||"").normalize("NFKC").toLowerCase().replace(/pick[ -]+up/g,"pickup").replace(/[^a-z0-9]+/g," ").trim();
function sameEvent(a,b){
  const x=normalize(a.label),y=normalize(b.label);
  if(x===y)return true;
  // A bare event and the same event with an explanatory suffix are one entry.
  // Two different detailed entries remain separate, even on the same date.
  const base=s=>normalize(String(s||"").split(/\s[—–]\s/)[0]);
  return (x===base(b.label)&&x!==y)||(y===base(a.label)&&x!==y);
}
function uniqueEvents(items){
  const out=[];
  for(const item of items){
    const i=out.findIndex(row=>sameEvent(row,item));
    if(i<0)out.push(item);
    else if(String(item.label).length>String(out[i].label).length)out[i]=item;
  }
  return out;
}
function uniqueRows(rows){
  const out=[];
  for(const row of rows){
    const i=out.findIndex(other=>+other.range[0]===+row.range[0]&&+other.range[1]===+row.range[1]&&sameEvent(other.item,row.item));
    if(i<0)out.push(row);
    else if(String(row.item.label).length>String(out[i].item.label).length)out[i]=row;
  }
  return out;
}
// Previews are literal source excerpts, never generated summaries or inferred dates.
function excerpt(text,limit=112){
  const value=String(text||"").replace(/\s+/g," ").trim();
  if(value.length<=limit)return value;
  const end=value.lastIndexOf(" ",limit);
  return value.slice(0,end>limit/2?end:limit).trimEnd()+"…";
}
function disclosure(text,source,renderText=esc){
  return '<details class="family-message"><summary><span class="family-message-copy"><small>'+esc(source)+'</small><strong>'+esc(excerpt(text))+'</strong><span class="family-message-hint">Read full update</span></span><span class="family-message-chevron" aria-hidden="true">›</span></summary><div class="family-message-body">'+renderText(text)+'</div></details>';
}
function noticesCard(notices,renderText=esc){
  return '<section class="parent-card sources notices-card" aria-labelledby="family-current-notices"><div class="notices-head"><span class="notices-mark" aria-hidden="true">i</span><div><small>SCHOOL UPDATES & SIGN-UPS</small><h3 id="family-current-notices">Current notices</h3></div></div><div class="static-notice-list" role="list">'+notices.map(text=>'<div class="notice-row" role="listitem">'+disclosure(text,'School notice',renderText)+'</div>').join('')+'</div></section>';
}
window.ABVMSchoolUpdates=Object.freeze({uniqueEvents,uniqueRows,noticesCard});
})();
