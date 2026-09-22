(()=>{"use strict";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)], stack=()=>$("#app-content");
let envelope=null, pack=null, activeTab="today", selectedDay=null, calendarDay=null, calendarOffset=0, calendarMode="month";

const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
const SHORT_MONTHS={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,sept:8,oct:9,nov:10,dec:11};
const WEEKDAY=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

function toast(message){
  const t=$("#toast"); if(!t)return;
  t.textContent=message;t.classList.add("show");
  clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove("show"),1700);
}
function parseDate(text){
  if(!text)return null;
  const m=String(text).match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s*(\d{1,2})/i);
  if(!m)return null;
  const month=SHORT_MONTHS[m[1].toLowerCase()],day=Number(m[2]),now=new Date();
  let year=now.getFullYear();
  if(now.getMonth()>=7&&month<=5)year++;
  else if(now.getMonth()<=5&&month>=7)year--;
  return new Date(year,month,day,12);
}
function sameDay(a,b){return a&&b&&a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate()}
function today(){const d=new Date();d.setHours(12,0,0,0);return d}
function fmtDate(d){return d?WEEKDAY[d.getDay()]+", "+MONTHS[d.getMonth()]+" "+d.getDate():""}
function fmtShort(d){return d?WEEKDAY[d.getDay()].slice(0,3)+" "+d.getDate():""}
function schoolYearMonthDate(month,day){
  const now=today();let year=now.getFullYear();
  if(now.getMonth()>=7&&month<=5)year++;
  else if(now.getMonth()<=5&&month>=7)year--;
  return new Date(year,month,day,12);
}
function schoolHeader(){
  return '<div class="school-bar"><div class="school-identity"><img class="school-mark" src="https://abvm-grade2-week.amuricaaa.chatgpt.site/icon-192.png" alt="Assumption BVM Catholic School logo"><div class="school-name"><span>Assumption BVM</span><span>Catholic School</span></div></div><button class="bell-button" type="button" aria-label="Notifications"><svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg></button></div>';
}
function scene(kind,kicker,title,subtitle,light=true,extra=""){
  return '<section class="top-scene '+kind+' scene-'+kind+'">'+schoolHeader()+
    '<div class="scene-title '+(light?'light':'ink')+'"><div class="section-label">'+esc(kicker)+'</div><h1>'+esc(title)+'</h1>'+(subtitle?'<p>'+esc(subtitle)+'</p>':'')+'</div>'+extra+'</section>';
}
function freshness(){
  const raw=envelope?.sourceLastSeenAt||pack?.sourceCapturedAt||pack?.generatedAt;
  const d=raw?new Date(raw):null;
  const label=d&&!Number.isNaN(d.getTime())
    ?"Verified&nbsp;&nbsp;"+d.toLocaleDateString(undefined,{month:"short",day:"numeric"})+" at "+d.toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"})+" ET"
    :"Verified";
  return '<div class="freshness"><span></span>'+label+'</div>';
}
function kindClass(item){
  const k=(item?.kind||"").toLowerCase(),l=(item?.label||"").toLowerCase();
  if(/test|assessment/.test(k)||/test|star reading/.test(l))return"test";
  if(/mass|relig|faith/.test(k)||/mass/.test(l))return"faith";
  if(/deadline|due/.test(k)||/due|money|order|rsvp/.test(l))return"due";
  if(/club/.test(k)||/lego/.test(l))return"club";
  if(/holiday|closed/.test(k)||/no school|closed/.test(l))return"closed";
  return"family";
}
function eventEmoji(item){
  const k=kindClass(item),l=(item?.label||"").toLowerCase();
  if(/reading/.test(l))return"📖";
  if(/spelling|handwriting/.test(l))return"✏️";
  if(/math|addition/.test(l))return"➕";
  if(k==="faith")return"✝️";
  if(k==="due"&&/pretzel/.test(l))return"🥨";
  if(k==="due")return"📌";
  if(k==="club")return"🧱";
  if(k==="closed")return"🏫";
  if(k==="test")return"📝";
  return"📅";
}
function taskEmoji(item){
  const s=((item?.subject||"")+" "+(item?.task||"")).toLowerCase();
  if(/read/.test(s))return"📚";
  if(/spell/.test(s))return"✏️";
  if(/math/.test(s))return"➕";
  if(/folder/.test(s))return"🎒";
  if(/form|cover/.test(s))return"📄";
  return"✅";
}
function eventItemsForDate(date){return(pack?.importantDates||[]).filter(x=>sameDay(parseDate(x.date),date))}
function lunchForDate(date){return(pack?.lunchMenu||[]).find(x=>sameDay(parseDate(x.day),date))||null}
function weekDays(){
  const base=today(),day=base.getDay(),mon=new Date(base);
  mon.setDate(base.getDate()-(day===0?6:day-1));
  return Array.from({length:5},(_,i)=>{const d=new Date(mon);d.setDate(mon.getDate()+i);return d});
}
function currentWeekRange(){const days=weekDays();return[days[0],days[4]]}
function upcomingTests(limit=6){
  const now=today();
  return(pack?.importantDates||[]).map(x=>({x,d:parseDate(x.date)}))
    .filter(o=>o.d&&o.d>=now&&kindClass(o.x)==="test")
    .sort((a,b)=>a.d-b.d).slice(0,limit);
}
function currentTest(){return upcomingTests(1)[0]||null}
function subject(re){return(pack?.subjects||[]).find(s=>re.test(s.subject||""))}
function readingSubject(){return subject(/Reading \/ ELA/i)}
function religionSubject(){return subject(/^Religion$/i)}
function mathSubject(){return subject(/^Math$/i)}
function spellingSubject(){return subject(/Spelling/i)}
function readingRoutine(){return subject(/Reading Routine/i)?.topics?.[0]||"Read for 20 minutes every day."}
function checkKey(item,index){return"abvm-gold:"+String(pack?.sourceHash||"pack")+":"+index+":"+(item?.task||"")}
function checked(item,index){return localStorage.getItem(checkKey(item,index))==="1"}
function taskHtml(item,index){
  const done=checked(item,index);
  const optional=/parent|if participating/i.test((item.subject||"")+" "+(item.task||""))||/forms|cover books/i.test(item.task||"");
  return '<button class="check-item '+(done?'is-done':'')+'" type="button" data-check="'+index+'">'+
    '<span class="check-box">'+(done?'✓':'')+'</span>'+
    '<span class="check-copy"><span class="task-tag '+(optional?'if-participating':'')+'">'+(optional?'IF PARTICIPATING':'REQUIRED')+'</span><strong>'+esc(item.task||"Task")+'</strong>'+(item.subject?'<small>'+esc(item.subject)+'</small>':'')+'</span>'+
    '<span class="task-deco" aria-hidden="true">'+taskEmoji(item)+'</span></button>';
}
function eventRow(item){
  return '<div class="event-row"><span class="event-icon '+kindClass(item)+'" aria-hidden="true">'+eventEmoji(item)+'</span><span class="kind">'+esc((item.kind||"School").replace(/\b\w/g,m=>m.toUpperCase()))+'</span><strong>'+esc(item.label||"School item")+'</strong></div>';
}
function lunchCard(lunch){
  if(!lunch)return"";
  return '<section class="lunch-card"><div class="lunch-art" aria-hidden="true">🍎</div><div><p>SCHOOL LUNCH</p><strong>'+esc((lunch.items||[]).join(", ").replace(/, ([^,]*)$/,", and $1"))+'</strong></div></section>';
}
function weekPriority(){
  const next=currentTest();
  if(next){
    const isToday=sameDay(next.d,today());
    return{
      title:isToday?next.x.label:"Prepare for "+next.x.label,
      detail:isToday?"Keep review short and calm. Focus on the teacher-posted material.":"Use short review sessions before "+fmtShort(next.d)+". Keep required reading in the normal routine."
    };
  }
  return{title:"Keep the week organized.",detail:"Use the teacher-posted work first and keep reading in the normal routine."};
}

function renderToday(){
  const d=today(),events=eventItemsForDate(d),lunch=lunchForDate(d),priority=weekPriority();
  const headline=events.filter(e=>kindClass(e)==="test").map(e=>e.label).join(" and ")||events[0]?.label||"School day";
  const content='<div class="content overlap">'+
    '<section class="date-hero-card"><div class="big-date"><strong>'+WEEKDAY[d.getDay()].slice(0,3).toUpperCase()+'</strong><span>'+d.getDate()+'</span><small>Today at School</small></div><div class="date-hero-copy"><p>TODAY AT SCHOOL</p><h2>'+esc(headline)+'</h2><span>'+esc(events.find(e=>kindClass(e)==="due")?.label||"Stay with the current homework and reading routine.")+'</span></div></section>'+
    '<section class="gold-card glass-card" style="margin-top:13px"><div class="section-label">'+esc(fmtDate(d))+'</div><div class="event-stack" style="margin-top:10px">'+(events.length?events.map(eventRow).join(""):'<div class="empty-note">No special school events are listed for this date.</div>')+'</div>'+
    '<div class="checklist-title"><h3>Checklist</h3><span class="edit-pill">Current posting</span></div><div class="task-list">'+(pack?.homework||[]).map(taskHtml).join("")+'</div></section>'+
    lunchCard(lunch)+
    '</div>';
  stack().innerHTML='<div class="screen" role="region" aria-label="Today">'+scene("today","TODAY","School day",priority.title,true)+freshness()+content+'</div>';
}
function renderWeek(){
  const days=weekDays();
  if(!selectedDay||!days.some(d=>sameDay(d,selectedDay)))selectedDay=days.find(d=>sameDay(d,today()))||days[0];
  const events=eventItemsForDate(selectedDay),lunch=lunchForDate(selectedDay);
  const picker=days.map(d=>'<button class="'+(sameDay(d,selectedDay)?'active':'')+'" type="button" data-day="'+d.toISOString()+'"><span>'+WEEKDAY[d.getDay()].slice(0,3)+'</span><strong>'+d.getDate()+'</strong></button>').join("");
  const future=(pack?.importantDates||[]).map(x=>({x,d:parseDate(x.date)})).filter(o=>o.d&&o.d>selectedDay).sort((a,b)=>a.d-b.d).slice(0,4);
  const note='<div class="week-hero-note">Small Steps<br><b>Big Progress!</b> ♡</div>';
  stack().innerHTML='<div class="screen" role="region" aria-label="This week">'+scene("week","YOUR SCHOOL PLAN","This Week","Your School Plan",false,note)+
    '<div class="content overlap"><div class="day-picker">'+picker+'</div><section class="day-detail"><div class="day-detail-inner"><div class="day-detail-title"><div><p>'+MONTHS[selectedDay.getMonth()].toUpperCase()+'</p><h2>'+esc(fmtDate(selectedDay))+'</h2></div><span class="school-day-pill">School day</span></div>'+
    '<div class="event-stack" style="margin-top:14px">'+(events.length?events.map(eventRow).join(""):'<div class="empty-note">No special school events are listed for this date.</div>')+'</div>'+
    '<div class="checklist-title"><h3>My checklist</h3><span class="edit-pill">Current</span></div><div class="task-list">'+(pack?.homework||[]).map(taskHtml).join("")+'</div></div></section>'+
    lunchCard(lunch)+
    '<section class="reminder-strip"><span class="bang">!</span><p><strong>Don’t forget</strong>'+esc((pack?.reminders||[])[0]||"Check the homework folder and reading log.")+'</p></section>'+
    '<section class="future-card"><h3>Coming soon</h3>'+future.map(o=>'<div class="future-row"><span>'+esc(fmtShort(o.d))+'</span><p>'+esc(o.x.label)+'</p></div>').join("")+'</section></div></div>';
}
function monthGrid(year,month){
  const first=new Date(year,month,1,12),last=new Date(year,month+1,0,12),blanks=first.getDay();
  let html="";
  for(let i=0;i<blanks;i++)html+='<span class="calendar-blank"></span>';
  for(let day=1;day<=last.getDate();day++){
    const d=new Date(year,month,day,12),events=eventItemsForDate(d),lunch=lunchForDate(d);
    const dots=[...events.map(e=>kindClass(e)),...(lunch?["lunch"]:[])].slice(0,3);
    const weekend=[0,6].includes(d.getDay()),closed=events.some(e=>kindClass(e)==="closed");
    html+='<button class="'+(weekend?'weekend ':'')+(closed?'closed ':'')+(calendarDay&&sameDay(d,calendarDay)?'active':'')+'" type="button" data-cal-day="'+d.toISOString()+'"><strong>'+day+'</strong><span class="calendar-dots">'+dots.map(k=>'<i class="'+k+'"></i>').join("")+'</span></button>';
  }
  return html;
}
function renderCalendar(){
  const base=today(),shown=new Date(base.getFullYear(),base.getMonth()+calendarOffset,1,12),y=shown.getFullYear(),m=shown.getMonth();
  if(!calendarDay||calendarDay.getMonth()!==m||calendarDay.getFullYear()!==y){
    calendarDay=(base.getMonth()===m&&base.getFullYear()===y)?new Date(base):new Date(y,m,1,12);
  }
  const events=eventItemsForDate(calendarDay),lunch=lunchForDate(calendarDay);
  const agenda=(pack?.importantDates||[]).map(x=>({x,d:parseDate(x.date)})).filter(o=>o.d&&o.d.getMonth()===m&&o.d.getFullYear()===y).sort((a,b)=>a.d-b.d).slice(0,8);
  const monthPanel='<div class="calendar-month-panel '+(calendarMode==="month"?"active":"")+'">'+
      '<div class="calendar-weekdays">'+["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(x=>"<span>"+x+"</span>").join("")+'</div>'+
      '<div class="calendar-grid">'+monthGrid(y,m)+'</div>'+
      '<div class="calendar-legend"><span><i class="test"></i>Test</span><span><i class="faith"></i>Faith</span><span><i class="family"></i>Family</span><span><i class="due"></i>Due</span></div>'+
    '</div>';
  const listPanel='<div class="calendar-list-panel '+(calendarMode==="list"?"active":"")+'">'+
      (agenda.length?agenda.map(o=>'<button class="calendar-list-row" type="button" data-cal-day="'+o.d.toISOString()+'"><span class="calendar-list-date"><b>'+o.d.getDate()+'</b><small>'+WEEKDAY[o.d.getDay()].slice(0,3)+'</small></span><span class="event-icon '+kindClass(o.x)+'">'+eventEmoji(o.x)+'</span><span class="calendar-list-copy"><strong>'+esc(o.x.label)+'</strong><small>'+esc(o.x.kind||"School event")+'</small></span><span class="chevron">›</span></button>').join(""):'<div class="empty-note">No school dates are listed for this month.</div>')+
    '</div>';

  stack().innerHTML='<div class="screen calendar-screen" role="region" aria-label="'+MONTHS[m]+' calendar">'+
    scene("calendar","SCHOOL MONTH AT A GLANCE",MONTHS[m]+" "+y,"School Month at a Glance",false)+
    '<div class="calendar-wrap"><section class="calendar-card"><div class="calendar-title-row"><button class="month-arrow" data-month="-1" type="button">‹</button><div style="text-align:center"><p>'+esc(calendarMode==="month"?"MONTH VIEW":"LIST VIEW")+'</p><h2>'+MONTHS[m]+" "+y+'</h2></div><button class="month-arrow" data-month="1" type="button">›</button></div>'+
    '<div class="calendar-tabs"><button class="'+(calendarMode==="month"?"active":"")+'" data-cal-mode="month" type="button">Month View</button><button class="'+(calendarMode==="list"?"active":"")+'" data-cal-mode="list" type="button">List View</button></div>'+
    monthPanel+listPanel+'</section>'+
    '<section class="calendar-day-card"><div class="calendar-day-heading"><p>'+WEEKDAY[calendarDay.getDay()].toUpperCase()+'</p><h2>'+esc(fmtDate(calendarDay))+'</h2></div>'+
    (events.length?'<div class="calendar-event-list">'+events.map(e=>'<div><i class="'+kindClass(e)+'"></i><span><strong>'+esc(e.label)+'</strong></span></div>').join(""):'<p class="calendar-empty">No special school events are listed for this date.</p>')+
    (lunch?'<div class="calendar-lunch"><span>🍎</span><div><b>School Lunch</b><p>'+esc((lunch.items||[]).join(", ").replace(/, ([^,]*)$/,", and $1"))+'</p></div></div>':'')+'</section>'+
    '</div></div>';
}
function subjectCard(id,klass,title,icon,subj){
  const notes=[...(subj?.topics||[]),...(subj?.studyNotes||[])];
  return '<section id="'+id+'" class="subject-card '+klass+'"><div class="subject-head"><span class="icon" aria-hidden="true">'+icon+'</span><div><p>'+esc(title.toUpperCase())+'</p><h2>'+esc(title)+'</h2></div></div><ul>'+notes.map(n=>'<li>'+esc(n)+'</li>').join("")+'</ul></section>';
}
function renderStudy(){
  const r=readingSubject(),rel=religionSubject(),math=mathSubject(),spell=spellingSubject();
  const [mon,fri]=currentWeekRange();
  const assessments=(pack?.importantDates||[]).map(x=>({x,d:parseDate(x.date)})).filter(o=>o.d&&o.d>=mon&&o.d<=fri&&kindClass(o.x)==="test").sort((a,b)=>a.d-b.d);
  const essentials=[{when:"Daily",label:readingRoutine(),icon:"📖",klass:"green"},...assessments.slice(0,4).map((o,i)=>({when:fmtShort(o.d),label:o.x.label,icon:["✝️","⭐","➕","✏️"][i]||"⭐",klass:["pink","yellow","blue","pink"][i]||"blue"}))];
  const sight=(r?.topics||[]).find(x=>/^Sight words:/i.test(x))?.replace(/^Sight words:\s*/i,"").split(",").map(x=>x.trim()).filter(Boolean)||[];
  const vocab=(pack?.vocabulary||[]).map(v=>v.term);
  stack().innerHTML='<div class="screen study-screen" role="region" aria-label="Study room">'+
    scene("study","SMALL STEPS, CALM PRACTICE","Study Room","Small Steps, Calm Practice",false)+
    '<div class="study-content"><section class="study-intro"><span class="study-bulb">💡</span><div><h2>Everything for this week</h2><p>All posted words and subjects stay together in this quick guide.</p></div><span class="chevron">›</span></section>'+
    '<section class="study-at-a-glance"><div class="section-label">THIS WEEK’S ESSENTIALS</div><h2>Quick Look</h2>'+essentials.map(e=>'<div class="essential-row"><span class="essential-icon '+e.klass+'">'+e.icon+'</span><div><time>'+esc(e.when)+'</time><strong>'+esc(e.label)+'</strong></div><span class="chevron">›</span></div>').join("")+'</section>'+
    '<nav class="study-jumps"><a href="#study-religion"><span class="jump-icon">✝️</span>Religion</a><a href="#study-reading"><span class="jump-icon">📖</span>Reading</a><a href="#study-math"><span class="jump-icon">🧮</span>Math</a><a href="#study-spelling"><span class="jump-icon">✏️</span>Spelling</a><a href="#study-sight"><span class="jump-icon">👁️</span>Sight words</a><a href="./game/"><span class="jump-icon">🎮</span>Game</a></nav>'+
    subjectCard("study-religion","religion",rel?.subject||"Religion","✝️",rel)+
    subjectCard("study-reading","reading","Reading","📖",r)+
    subjectCard("study-math","math","Math","🧮",math)+
    subjectCard("study-spelling","spelling","Spelling and phonics","✏️",spell)+
    '<section id="study-sight" class="subject-card sight"><div class="subject-head"><span class="icon">👁️</span><div><p>SIGHT WORDS</p><h2>Sight words</h2></div></div><div class="sight-cloud">'+sight.map(w=>'<span>'+esc(w)+'</span>').join("")+'</div></section>'+
    '<section class="subject-card reading"><div class="subject-head"><span class="icon">💬</span><div><p>VOCABULARY</p><h2>Words to know</h2></div></div><div class="word-grid">'+vocab.map(w=>'<span>'+esc(w)+'</span>').join("")+'</div></section>'+
    '<section class="calm-card"><h3>STAR reminder</h3><p>Keep assessment preparation calm. Normal reading, normal routines, and a good night’s sleep are enough.</p></section>'+
    '<a class="quest-launcher" href="./game/"><span class="quest-star">★</span><span><strong>School Star Quest</strong><small>Practice current material through short learning quests.</small></span><span class="chevron">›</span></a>'+
    '</div></div>';
}
function renderFamily(){
  const priority=weekPriority(),[mon,fri]=currentWeekRange();
  const tests=(pack?.importantDates||[]).map(x=>({x,d:parseDate(x.date)})).filter(o=>o.d&&o.d>=mon&&o.d<=fri&&kindClass(o.x)==="test").length;
  const actions=[...(pack?.homework||[]).map(x=>x.task),...(pack?.reminders||[])].slice(0,8),notices=pack?.parentNotices||[];
  stack().innerHTML='<div class="screen family-screen" role="region" aria-label="Family dashboard">'+
    scene("family","FAMILY VIEW","Family Dashboard","A happy, organized school year starts here.",true)+freshness()+
    '<div class="family-content"><section class="family-priority"><p>WEEKLY PRIORITY</p><h2>'+esc(priority.title)+'</h2><span>'+esc(priority.detail)+'</span></section>'+
    '<div class="family-stats"><article><strong>'+tests+'</strong><span>test days this week</span></article><article><strong>$17</strong><span>stationary money due Sept. 23</span></article></div>'+
    '<section class="family-card"><h3>📋 Family Actions</h3><div class="family-actions">'+actions.map(a=>'<div class="family-action"><span class="box"></span><span>'+esc(a)+'</span><b>›</b></div>').join("")+'</div></section>'+
    '<section class="reading-policy"><span class="round">20</span><div><h3>Reading every day</h3><p>Read or be read to for 20 minutes and keep the Reading Log in the homework folder.</p></div></section>'+
    '<section class="family-card"><h3>Current notices</h3><div class="notice-list">'+notices.map(n=>'<div class="notice"><span class="notice-dot"></span><p>'+esc(n)+'</p></div>').join("")+'</div></section>'+
    '<section class="install-card"><span class="install-icon">⌂</span><div><h3>Put this app on iPhone</h3><p>In Safari, use Share → Add to Home Screen for an app-like launch experience.</p></div></section>'+
    '</div></div>';
}
function render(){
  if(!pack)return;
  ({today:renderToday,week:renderWeek,calendar:renderCalendar,study:renderStudy,family:renderFamily}[activeTab]||renderToday)();
  $$(".bottom-nav button").forEach(b=>{const on=b.dataset.tab===activeTab;b.classList.toggle("active",on);on?b.setAttribute("aria-current","page"):b.removeAttribute("aria-current")});
  stack().scrollTop=0;bindScreen();
}
function bindScreen(){
  $$("[data-check]").forEach(b=>b.addEventListener("click",()=>{const i=Number(b.dataset.check),item=(pack.homework||[])[i],k=checkKey(item,i);localStorage.getItem(k)==="1"?localStorage.removeItem(k):localStorage.setItem(k,"1");render()}));
  $$("[data-day]").forEach(b=>b.addEventListener("click",()=>{selectedDay=new Date(b.dataset.day);renderWeek();bindScreen()}));
  $$("[data-cal-day]").forEach(b=>b.addEventListener("click",()=>{calendarDay=new Date(b.dataset.calDay);renderCalendar();bindScreen()}));
  $$("[data-month]").forEach(b=>b.addEventListener("click",()=>{calendarOffset+=Number(b.dataset.month);calendarDay=null;renderCalendar();bindScreen()}));
  $$("[data-cal-mode]").forEach(b=>b.addEventListener("click",()=>{calendarMode=b.dataset.calMode;renderCalendar();bindScreen()}));
  $$(".bell-button").forEach(b=>b.addEventListener("click",()=>toast("School information is current.")));
}
$$(".bottom-nav button").forEach(b=>b.addEventListener("click",()=>{activeTab=b.dataset.tab;render()}));
async function load(){
  try{
    const r=await fetch("./data/study-pack.json",{cache:"no-store"});
    if(!r.ok)throw new Error("HTTP "+r.status);
    const d=await r.json();if(!d?.pack?.sourceSufficient)throw new Error("Incomplete school pack");
    envelope=d;pack=d.pack;render();
  }catch(e){
    stack().innerHTML='<div class="screen"><div class="content" style="padding-top:40px"><section class="gold-card"><div class="section-label">ABVM GRADE 2</div><h2 class="card-title">School info could not be loaded</h2><p class="muted">Refresh the page to try again.</p></section></div></div>';
  }
}
load();
})();