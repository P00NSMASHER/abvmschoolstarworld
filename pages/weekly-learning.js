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
function weeklyOverviewHtml(days,eventsFor,lunchFor,kind){
  const WEEKDAY=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
  const iso=date=>date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0")+"-"+String(date.getDate()).padStart(2,"0");
  const lunchRows=days.map(date=>{
    const events=eventsFor(date),lunch=lunchFor(date);
    const closed=events.some(item=>kind(item)==="closed")||lunch?.status==="no-school";
    const meal=closed?"No school lunch":lunch?.items?.length?lunch.items.join(", ").replace(/, ([^,]*)$/,", and $1"):"Lunch menu not yet verified for "+MONTHS[date.getMonth()]+" "+date.getDate()+".";
    return '<div class="weekly-overview-row"><time datetime="'+iso(date)+'">'+esc(WEEKDAY[date.getDay()]+" "+date.getDate())+'</time><p>'+esc(meal)+'</p></div>';
  }).join("");
  const testGroups=days.map(date=>({date,items:eventsFor(date).filter(item=>kind(item)==="test")})).filter(group=>group.items.length);
  const tests=testGroups.length?testGroups.map(group=>'<div class="weekly-overview-row"><time datetime="'+iso(group.date)+'">'+esc(WEEKDAY[group.date.getDay()]+" "+group.date.getDate())+'</time><ul>'+group.items.map(item=>'<li>'+esc(item.label)+'</li>').join("")+'</ul></div>').join(""):'<p class="weekly-overview-empty">No tests are currently listed for this week.</p>';
  return '<section class="weekly-overview" aria-labelledby="weekly-overview-title"><div class="weekly-overview-head"><p>WEEKLY SUMMARY</p><h2 id="weekly-overview-title">This week at a glance</h2></div><div class="weekly-overview-grid"><section class="weekly-overview-card weekly-lunches" aria-labelledby="weekly-lunches-title"><div class="weekly-overview-card-title"><span aria-hidden="true">🍎</span><h3 id="weekly-lunches-title">Lunches this week</h3></div>'+lunchRows+'</section><section class="weekly-overview-card weekly-tests" aria-labelledby="weekly-tests-title"><div class="weekly-overview-card-title"><span aria-hidden="true">✓</span><h3 id="weekly-tests-title">Tests this week</h3></div>'+tests+'</section></div></section>';
}
window.WO=weeklyOverviewHtml;
window.ABVMWeeklyLearning=Object.freeze({snapshot,render,renderChanges});
})();