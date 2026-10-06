(()=>{"use strict";
const WINDOW_MS=7*24*60*60*1000;
const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
function snapshot({pack={},learning={},now=Date.now(),timeZone="America/New_York"}={}){
  const formatter=new Intl.DateTimeFormat("en-US",{timeZone,year:"numeric",month:"2-digit",day:"2-digit"});
  const cutoff=now-WINDOW_MS,currentDay=formatter.format(new Date(now)),rows=[];
  const skills=Array.isArray(pack?.contentPipeline?.skills)?pack.contentPipeline.skills:[];
  for(const skill of skills){
    const id=String(skill?.id||"").trim(),row=learning?.[id];if(!id||!row)continue;
    const seenAt=Math.max(Number(row.LastSeenAt)||0,Number(row.LastResolution?.resolvedAt)||0,Number(row.LastComebackAt)||0,Number(row.LastSupportAt)||0);
    if(!seenAt||seenAt<cutoff||seenAt>now+60000)continue;
    const strongAt=Number(row.LastIndependentCorrectAt)||0,rememberedAt=Number(row.LastComebackCorrectAt)||0;
    const resolvedAt=Number(row.LastResolution?.resolvedAt)||0;
    const weakResolution=resolvedAt&&(!row.LastResolution?.correct||row.LastResolution?.independent!==true)?resolvedAt:0;
    const practiceAt=Math.max(weakResolution,Number(row.LastSupportAt)||0,Number(row.LastComebackWrongAt)||0);
    const evidence=[];
    if(strongAt>=cutoff&&strongAt<=now+60000&&formatter.format(new Date(strongAt))===currentDay)evidence.push({status:"strong",at:strongAt,priority:1});
    if(rememberedAt>=cutoff&&rememberedAt<=now+60000)evidence.push({status:"remembered",at:rememberedAt,priority:2});
    if(practiceAt>=cutoff&&practiceAt<=now+60000)evidence.push({status:"practice",at:practiceAt,priority:3});
    if(!evidence.length)evidence.push({status:"practice",at:seenAt,priority:3});
    evidence.sort((a,b)=>b.at-a.at||b.priority-a.priority);
    rows.push({id,label:String(skill.label||id),subject:String(skill.subject||""),status:evidence[0].status,lastAt:evidence[0].at});
  }
  rows.sort((a,b)=>b.lastAt-a.lastAt||a.label.localeCompare(b.label));
  return Object.freeze({
    strong:Object.freeze(rows.filter(row=>row.status==="strong")),
    remembered:Object.freeze(rows.filter(row=>row.status==="remembered")),
    practice:Object.freeze(rows.filter(row=>row.status==="practice"))
  });
}
function render(args={}){
  const data=snapshot(args);
  if(!data.strong.length&&!data.remembered.length&&!data.practice.length)return "";
  const line=(title,rows,empty,klass)=>'<div class="notice-row" role="listitem"><span class="status '+klass+'" aria-hidden="true"></span><p><strong>'+esc(title)+'</strong><br><span>'+esc(rows.length?rows.slice(0,4).map(row=>row.label).join(" · "):empty)+'</span></p></div>';
  return '<section class="parent-card" aria-labelledby="weekly-learning-title"><div class="notices-head"><span class="notices-mark" aria-hidden="true">✓</span><div><small>LAST 7 DAYS</small><h3 id="weekly-learning-title">Weekly learning</h3></div></div><div class="static-notice-list" role="list">'+
    line("Strong today",data.strong,"No current skills here yet.","ok")+
    line("Remembered later",data.remembered,"No comeback evidence yet.","ok")+
    line("Practice again",data.practice,"No recent practice needs another look.","warn")+
    '</div><small>Current school skills only · based on Study Games practice on this device · not a grade.</small></section>';
}
function renderChanges(feed={}){
  const items=Array.isArray(feed?.items)?feed.items:[];
  if(!items.length)return "";
  if(items.every(row=>row.kind==="unchanged"))return '<p class="updates-status">Class lessons were unchanged at the last teacher-page check.</p>';
  const rows=items.slice(0,8).map(row=>'<div class="notice-row" role="listitem"><span class="status '+(row.kind==="unchanged"?"ok":"warn")+'" aria-hidden="true"></span><p>'+esc(row.text)+'</p></div>').join("");
  return '<section class="parent-card notices-card" aria-labelledby="school-change-title"><div class="notices-head"><span class="notices-mark" aria-hidden="true">↻</span><div><small>LATEST VERIFIED REFRESH</small><h3 id="school-change-title">What changed at school?</h3></div></div><div class="static-notice-list" role="list">'+rows+'</div></section>';
}

function renderWeekOverview({days=[],lunchForDate,eventItemsForDate,kindClass,fmtShort,lunchText,lunchUnavailableText}={}){
  const safeDays=Array.isArray(days)?days:[];
  const dateKey=date=>date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0")+"-"+String(date.getDate()).padStart(2,"0");
  const icon=(kind)=>kind==="lunch"
    ?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v7M4.5 3v4.5C4.5 9 5.5 10 7 10s2.5-1 2.5-2.5V3M7 10v11M15 3v18M15 3c3 1.2 4.5 3.5 4.5 6.5V12H15"/></svg>'
    :'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10a2 2 0 0 1 2 2v15H5V6a2 2 0 0 1 2-2Z"/><path d="M8 2v4M16 2v4M8 10h8M8 14h5"/></svg>';
  const lunches=safeDays.map(date=>{
    const events=typeof eventItemsForDate==="function"?(eventItemsForDate(date)||[]):[];
    const closed=events.some(item=>typeof kindClass==="function"&&kindClass(item)==="closed");
    const lunch=typeof lunchForDate==="function"?lunchForDate(date):null;
    const meal=closed||lunch?.status==="no-school"?"No school":lunch
      ?(typeof lunchText==="function"?lunchText(lunch):String(lunch?.items||""))
      :(typeof lunchUnavailableText==="function"?lunchUnavailableText(date):"Lunch not yet verified.");
    return '<div class="week-overview-row"><time datetime="'+dateKey(date)+'">'+esc(typeof fmtShort==="function"?fmtShort(date):"")+'</time><span>'+esc(meal)+'</span></div>';
  }).join("");
  const seen=new Set(),groups=[];
  for(const date of safeDays){
    const labels=[];
    const events=typeof eventItemsForDate==="function"?(eventItemsForDate(date)||[]):[];
    for(const item of events){
      if(typeof kindClass!=="function"||kindClass(item)!=="test")continue;
      const label=String(item?.label||"Test").trim();
      if(seen.has(dateKey(date)+"|"+label))continue;
      seen.add(dateKey(date)+"|"+label);labels.push(label);
    }
    if(labels.length)groups.push({date,labels});
  }
  const testRows=groups.length?groups.map(group=>'<div class="week-overview-row"><time datetime="'+dateKey(group.date)+'">'+esc(typeof fmtShort==="function"?fmtShort(group.date):"")+'</time><ul>'+group.labels.map(label=>'<li>'+esc(label)+'</li>').join("")+'</ul></div>').join("")
    :'<p class="week-overview-empty">No verified tests are listed for this school week.</p>';
  return '<div class="week-overview"><div class="week-overview-heading"><p>WEEKLY SUMMARY</p><h2 id="week-overview-title">This week at a glance</h2></div><div class="week-overview-grid"><div class="week-overview-card week-lunches"><div class="week-overview-card-head"><span class="week-overview-icon lunch">'+icon("lunch")+'</span><h3 id="week-lunches-title">Lunches this week</h3></div><div class="week-overview-list">'+lunches+'</div></div><div class="week-overview-card week-tests"><div class="week-overview-card-head"><span class="week-overview-icon tests">'+icon("tests")+'</span><h3 id="week-tests-title">Tests this week</h3></div><div class="week-overview-list">'+testRows+'</div></div></div></div>';
}

window.ABVMWeeklyLearning=Object.freeze({snapshot,render,renderChanges,renderWeekOverview});
})();