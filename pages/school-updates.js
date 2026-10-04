(()=>{"use strict";
const KEY="abvm-updates-seen:v1";
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
function fingerprint(text){let h=2166136261;for(const c of text){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return(h>>>0).toString(36)}
function entries(pack){
  const rows=[...(pack?.parentNotices||[]).map(text=>({source:"School notice",text})),
    ...(pack?.subjects||[]).filter(x=>x.subject!=="Specials").map(x=>({source:"Teacher · "+x.subject,text:[...(x.topics||[]),...(x.studyNotes||[])].join(" · ")})),
    ...(pack?.importantDates||[]).filter(x=>/^teacher/.test(x.source||"" )).map(x=>({source:"Teacher · Calendar",text:x.date+": "+x.label})),
    ...(pack?.homework||[]).map(x=>({source:"Teacher · Homework",text:(x.subject?x.subject+": ":"")+x.task}))];
  return rows.filter(x=>x.text).map(x=>({...x,id:fingerprint(x.source+"|"+x.text)}));
}
function read(){try{const x=JSON.parse(localStorage.getItem(KEY));return Array.isArray(x)?x:null}catch{return null}}
function save(ids){try{localStorage.setItem(KEY,JSON.stringify([...new Set(ids)].slice(-1000)));return true}catch{return false}}
function state(pack){const rows=entries(pack),seen=read();if(!seen){save(rows.map(x=>x.id));return{unread:[],available:read()!==null}}return{unread:rows.filter(x=>!seen.includes(x.id)),available:true}}
function markRead(pack){return save([...(read()||[]),...entries(pack).map(x=>x.id)])}
function banner(pack){const {unread}=state(pack);return unread.length?'<button class="updates-banner" type="button" data-open-family><span><strong>'+unread.length+' new school update'+(unread.length===1?'':'s')+'</strong><small>Since you last marked updates as read</small></span><b aria-hidden="true">›</b></button>':''}
function card(pack){
  const {unread,available}=state(pack);
  if(!unread.length)return '<p class="updates-status">'+(available?'No unread updates on this device.':'Update tracking needs browser storage.')+'</p>';
  return '<section class="unread-updates" aria-labelledby="unread-title"><div class="unread-heading"><h2 id="unread-title">New for you</h2><span>'+unread.length+'</span></div><p>Since you last marked updates as read. Source text appears below.</p><ul>'+unread.map(x=>'<li><small>'+esc(x.source)+'</small><p>'+esc(x.text)+'</p></li>').join('')+'</ul><button type="button" data-mark-updates-read>Mark updates as read</button></section>';
}
window.ABVMSchoolUpdates=Object.freeze({uniqueEvents,uniqueRows,state,markRead,banner,card});
})();
