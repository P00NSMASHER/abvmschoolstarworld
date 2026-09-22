(()=>{"use strict";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const stack=()=>$("#app-content");
let envelope=null, pack=null, activeTab="today", selectedDay=null, calendarDay=null;

const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
const SHORT_MONTHS={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,sept:8,oct:9,nov:10,dec:11};
const WEEKDAY=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

function toast(message){
  let t=$("#toast");
  if(!t){t=document.createElement("div");t.id="toast";t.className="toast";document.body.append(t);}
  t.textContent=message;t.classList.add("show");
  clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove("show"),1700);
}
function parseDate(text){
  if(!text)return null;
  const m=String(text).match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s*(\d{1,2})/i);
  if(!m)return null;
  const month=SHORT_MONTHS[m[1].toLowerCase()], day=Number(m[2]);
  const now=new Date(); let year=now.getFullYear();
  if(now.getMonth()>=7&&month<=5)year++;
  else if(now.getMonth()<=5&&month>=7)year--;
  return new Date(year,month,day,12);
}
function sameDay(a,b){return a&&b&&a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate()}
function fmtDate(d){return d?WEEKDAY[d.getDay()]+", "+MONTHS[d.getMonth()]+" "+d.getDate():"";}
function fmtShort(d){return d?WEEKDAY[d.getDay()].slice(0,3)+" "+d.getDate():"";}
function schoolLogo(){return '<img class="school-mark" src="https://abvm-grade2-week.amuricaaa.chatgpt.site/icon-192.png" alt="Assumption BVM Catholic School logo">';}
function header(kicker,title){
  return '<header class="app-header"><div><p>'+esc(kicker)+'</p><h1>'+esc(title)+'</h1></div>'+schoolLogo()+'</header>';
}
function freshness(){
  const raw=envelope?.sourceLastSeenAt||pack?.sourceCapturedAt||pack?.generatedAt;
  const d=raw?new Date(raw):null;
  const label=d&&!Number.isNaN(d.getTime()) ? "Verified&nbsp;&nbsp;"+d.toLocaleDateString(undefined,{month:"short",day:"numeric"})+" at "+d.toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"})+" ET" : "Verified";
  return '<div class="freshness"><span></span>'+label+'</div>';
}
function kindClass(item){
  const k=(item?.kind||"").toLowerCase(), l=(item?.label||"").toLowerCase();
  if(/test|assessment/.test(k)||/test|star reading/.test(l))return "test";
  if(/mass|relig|faith/.test(k)||/mass/.test(l))return "faith";
  if(/deadline|due/.test(k)||/due|money|order|rsvp/.test(l))return "due";
  if(/club/.test(k)||/lego/.test(l))return "club";
  if(/holiday|closed/.test(k)||/no school|closed/.test(l))return "closed";
  return "family";
}
function eventItemsForDate(date){
  return (pack?.importantDates||[]).filter(x=>sameDay(parseDate(x.date),date));
}
function lunchForDate(date){
  return (pack?.lunchMenu||[]).find(x=>sameDay(parseDate(x.day),date))||null;
}
function checkKey(item,index){return "abvm-old-look:"+String(pack?.sourceHash||"pack")+":"+index+":"+(item.task||item.label||"");}
function checked(item,index){return localStorage.getItem(checkKey(item,index))==="1";}
function toggleChecked(item,index){const k=checkKey(item,index);localStorage.getItem(k)==="1"?localStorage.removeItem(k):localStorage.setItem(k,"1");render();}
function taskHtml(item,index){
  const done=checked(item,index);
  const optional=/parent|if participating/i.test((item.subject||"")+" "+(item.task||"")) || /forms|cover books/i.test(item.task||"");
  const tag=optional?"IF PARTICIPATING":"REQUIRED";
  return '<button class="check-item'+(done?' is-done':'')+'" data-check="'+index+'"><span class="check-box">'+(done?"✓":"")+'</span><span class="check-copy"><span class="task-tag '+(optional?"if-participating":"required")+'">'+tag+'</span><strong>'+esc(item.task||"Task")+'</strong>'+(item.subject?'<small>'+esc(item.subject)+'</small>':'')+'</span></button>';
}
function today(){
  const d=new Date(); d.setHours(12,0,0,0);
  return d;
}
function weekDays(){
  const base=today(), day=base.getDay();
  const mon=new Date(base); mon.setDate(base.getDate()-(day===0?6:day-1));
  return Array.from({length:5},(_,i)=>{const x=new Date(mon);x.setDate(mon.getDate()+i);return x;});
}
function currentTest(){
  const now=today();
  const upcoming=(pack?.importantDates||[]).map(x=>({x,d:parseDate(x.date)})).filter(o=>o.d&&o.d>=now&&kindClass(o.x)==="test").sort((a,b)=>a.d-b.d);
  return upcoming[0]||null;
}
function readingSubject(){return (pack?.subjects||[]).find(s=>/Reading \/ ELA/i.test(s.subject||""));}
function religionSubject(){return (pack?.subjects||[]).find(s=>/^Religion$/i.test(s.subject||""));}
function mathSubject(){return (pack?.subjects||[]).find(s=>/^Math$/i.test(s.subject||""));}
function spellingSubject(){return (pack?.subjects||[]).find(s=>/Spelling/i.test(s.subject||""));}
function readingRoutine(){return (pack?.subjects||[]).find(s=>/Reading Routine/i.test(s.subject||""))?.topics?.[0]||"Read for 20 minutes every day.";}

function renderToday(){
  const d=today(), events=eventItemsForDate(d), lunch=lunchForDate(d), next=currentTest();
  const tests=events.filter(e=>kindClass(e)==="test");
  const headline=tests.length?tests.map(e=>e.label.replace(/\s*\/\s*/g," and ")).join(", "):events[0]?.label||"School day";
  let timeline=events.map(e=>'<div class="timeline-row"><time>School</time><span class="timeline-pin '+kindClass(e)+'"></span><div><strong>'+esc(e.label)+'</strong>'+(e.kind?'<small>'+esc(e.kind)+'</small>':'')+'</div><i></i></div>').join("");
  if(!timeline) timeline='<div class="timeline-row"><time>School</time><span class="timeline-pin family"></span><div><strong>No special school events are listed for this date.</strong></div></div>';
  const tasks=(pack?.homework||[]);
  const html='<div class="screen" role="region" aria-label="Today">'+
    header("ABVM GRADE 2 · "+(pack?.weekLabel||"CURRENT WEEK").replace(/^Week of /i,"").toUpperCase(),"Hi, school star!")+
    freshness()+
    '<section class="hero-card"><span class="spark spark-one">★</span><span class="spark spark-two">♥</span><div class="hero-copy"><p class="pill">ONE STEP AT A TIME</p><h2>A calm plan for the week</h2><p>Start with what is due soon. Check off one item, then keep going when you are ready.</p></div><div class="book-buddy"><span>📚</span></div></section>'+
    '<div class="section-heading"><h2><span class="heading-dot pink"></span>Up next</h2></div>'+
    (next?'<section class="priority-card"><div class="date-tile"><strong>'+esc(WEEKDAY[next.d.getDay()].slice(0,3).toUpperCase())+'</strong><span>'+next.d.getDate()+'</span></div><div><p>CLOSEST TEST</p><h3>'+esc(next.x.label)+'</h3><span>Keep review short and focused.</span></div></section>':'<section class="priority-card"><div class="date-tile"><strong>★</strong><span>✓</span></div><div><p>UP NEXT</p><h3>No upcoming test is currently listed</h3><span>Keep up with the posted homework and reading routine.</span></div></section>')+
    '<div class="section-heading"><h2><span class="heading-dot blue"></span>'+esc(fmtDate(d))+'</h2></div>'+
    '<section class="today-panel"><div class="timeline">'+timeline+'</div><div class="task-list">'+tasks.map(taskHtml).join("")+'</div></section>'+
    (lunch?'<section class="lunch-card"><span>🍎</span><div><p>SCHOOL LUNCH</p><strong>'+esc(lunch.items.join(", ").replace(/, ([^,]*)$/,", and $1"))+'</strong></div></section>':'')+
    '</div>';
  stack().innerHTML=html;
}

function renderWeek(){
  const days=weekDays();
  if(!selectedDay||!days.some(d=>sameDay(d,selectedDay)))selectedDay=days.find(d=>sameDay(d,today()))||days[0];
  const events=eventItemsForDate(selectedDay), lunch=lunchForDate(selectedDay);
  const picker=days.map(d=>'<button class="'+(sameDay(d,selectedDay)?"active":"")+'" data-day="'+d.toISOString()+'"><span>'+WEEKDAY[d.getDay()].slice(0,3)+'</span><strong>'+d.getDate()+'</strong></button>').join("");
  const eventRows=events.length?events.map(e=>'<div class="event-row"><time>'+esc((e.kind||"School").replace(/\b\w/g,m=>m.toUpperCase()))+'</time><div><strong>'+esc(e.label)+'</strong></div></div>').join(""):'<div class="event-row"><time>School</time><div><strong>No special school events are listed.</strong></div></div>';
  const tasks=(pack?.homework||[]);
  const future=(pack?.importantDates||[]).map(x=>({x,d:parseDate(x.date)})).filter(o=>o.d&&o.d>selectedDay).sort((a,b)=>a.d-b.d).slice(0,4);
  stack().innerHTML='<div class="screen" role="region" aria-label="This week">'+
    header("YOUR SCHOOL PLAN","This week")+freshness()+
    '<div class="day-picker">'+picker+'</div>'+
    '<section class="day-detail green"><div class="day-detail-title"><div><p>'+MONTHS[selectedDay.getMonth()].toUpperCase()+'</p><h2>'+esc(fmtDate(selectedDay))+'</h2></div><span>School day</span></div><div class="event-stack">'+eventRows+'</div><h3>My checklist</h3>'+tasks.map(taskHtml).join("")+'</section>'+
    (lunch?'<section class="lunch-card"><span>🍎</span><div><p>SCHOOL LUNCH</p><strong>'+esc(lunch.items.join(", ").replace(/, ([^,]*)$/,", and $1"))+'</strong></div></section>':'')+
    '<section class="reminder-strip"><span>!</span><p><strong>Don’t forget</strong>'+esc((pack?.reminders||[])[0]||"Check the homework folder and reading log.")+'</p></section>'+
    '<section class="future-card"><h3>Coming soon</h3>'+future.map(o=>'<div><span>'+esc(fmtShort(o.d))+'</span><p>'+esc(o.x.label)+'</p></div>').join("")+'</section>'+
    '</div>';
}

function monthGrid(year,month){
  const first=new Date(year,month,1,12), last=new Date(year,month+1,0,12), blanks=first.getDay();
  let html=""; for(let i=0;i<blanks;i++)html+='<span class="calendar-blank"></span>';
  for(let day=1;day<=last.getDate();day++){
    const d=new Date(year,month,day,12), events=eventItemsForDate(d), lunch=lunchForDate(d);
    const dots=[...events.map(e=>kindClass(e)),...(lunch?["lunch"]:[])].slice(0,3);
    const weekend=[0,6].includes(d.getDay()), closed=events.some(e=>kindClass(e)==="closed");
    html+='<button class="'+(weekend?"weekend ":"")+(closed?"closed ":"")+(calendarDay&&sameDay(d,calendarDay)?"active":"")+'" data-cal-day="'+d.toISOString()+'"><strong>'+day+'</strong><span class="calendar-dots">'+dots.map(k=>'<i class="'+k+'"></i>').join("")+'</span></button>';
  }
  return html;
}
function renderCalendar(){
  const base=today(); if(!calendarDay)calendarDay=new Date(base);
  const y=base.getFullYear(),m=base.getMonth(), events=eventItemsForDate(calendarDay), lunch=lunchForDate(calendarDay);
  const agenda=(pack?.importantDates||[]).map(x=>({x,d:parseDate(x.date)})).filter(o=>o.d&&o.d.getMonth()===m&&o.d.getFullYear()===y).sort((a,b)=>a.d-b.d);
  const nextMonth=(pack?.importantDates||[]).map(x=>({x,d:parseDate(x.date)})).filter(o=>o.d&&o.d.getMonth()===m+1).sort((a,b)=>a.d-b.d).slice(0,5);
  stack().innerHTML='<div class="screen calendar-screen" role="region" aria-label="'+MONTHS[m]+' calendar">'+
    header("SCHOOL MONTH AT A GLANCE",MONTHS[m]+" "+y)+freshness()+
    '<section class="calendar-card"><div class="calendar-title-row"><div><p>MONTH VIEW</p><h2>'+MONTHS[m]+'</h2></div><span>Tap any date</span></div><div class="calendar-weekdays">'+["S","M","T","W","T","F","S"].map(x=>"<span>"+x+"</span>").join("")+'</div><div class="calendar-grid">'+monthGrid(y,m)+'</div><div class="calendar-legend"><span><i class="test"></i>Test</span><span><i class="faith"></i>Faith</span><span><i class="family"></i>Family</span><span><i class="due"></i>Due</span></div></section>'+
    '<section class="calendar-day-card"><div class="calendar-day-heading"><div><p>'+WEEKDAY[calendarDay.getDay()].toUpperCase()+'</p><h2>'+MONTHS[calendarDay.getMonth()]+" "+calendarDay.getDate()+'</h2></div></div>'+
      (events.length?'<div class="calendar-event-list">'+events.map(e=>'<div><i class="'+kindClass(e)+'"></i><span><strong>'+esc(e.label)+'</strong></span></div>').join("")+'</div>':'<p class="calendar-empty">No special school events are listed for this date.</p>')+
      (lunch?'<div class="calendar-lunch"><span>🍎</span><div><b>Lunch</b><p>'+esc(lunch.items.join(", ").replace(/, ([^,]*)$/,", and $1"))+'</p></div></div>':'')+
    '</section>'+
    '<section class="month-agenda"><h2>'+MONTHS[m]+' school dates</h2>'+agenda.map(o=>'<div class="calendar-event-list"><div><i class="'+kindClass(o.x)+'"></i><span><strong>'+esc(fmtShort(o.d))+' · '+esc(o.x.label)+'</strong></span></div></div>').join("")+'</section>'+
    '<section class="specials-card"><h2>Specials</h2><p>Monday: Computer · Tuesday: Music, Art, Guidance · Wednesday: Mass · Thursday: Gym · Friday: Library</p></section>'+
    '<section class="next-month-card"><h2>Coming in '+MONTHS[(m+1)%12]+'</h2>'+nextMonth.map(o=>'<div><span>'+esc(fmtShort(o.d))+'</span><p>'+esc(o.x.label)+'</p></div>').join("")+'</section>'+
    '</div>';
}
function subjectCard(id,klass,title,subject){
  const notes=[...(subject?.topics||[]),...(subject?.studyNotes||[])];
  return '<section id="'+id+'" class="subject-card '+klass+'"><div class="subject-title"><div><p>'+esc(title.toUpperCase())+'</p><h2>'+esc(title)+'</h2></div></div><ul>'+notes.map(n=>'<li>✓ '+esc(n)+'</li>').join("")+'</ul></section>';
}
function renderStudy(){
  const r=readingSubject(), rel=religionSubject(), math=mathSubject(), spell=spellingSubject(), next=currentTest();
  const essentials=[
    ["Daily",readingRoutine()],
    next?[fmtShort(next.d),next.x.label]:["This week","Keep up with current class skills"],
    ["Friday","Spelling / Handwriting review"]
  ];
  const sight=(r?.topics||[]).find(x=>/^Sight words:/i.test(x))?.replace(/^Sight words:\s*/i,"").split(",").map(x=>x.trim()).filter(Boolean)||[];
  const vocab=(pack?.vocabulary||[]).map(v=>v.term);
  stack().innerHTML='<div class="screen study-screen" role="region" aria-label="Study room">'+
    header("SMALL STEPS, CALM PRACTICE","Study room")+
    '<section class="study-intro"><span class="study-star">★</span><div><h2>Everything for this week</h2><p>All posted words and subjects stay together in this quick guide. Start with the closest test.</p></div></section>'+
    '<section class="study-at-a-glance"><p>QUICK LOOK</p><h2>This week’s essentials</h2>'+essentials.map(x=>'<div><strong>'+esc(x[0])+'</strong><span>'+esc(x[1])+'</span></div>').join("")+'</section>'+
    '<nav class="study-jumps"><a href="#study-religion">Religion</a><a href="#study-reading">Reading</a><a href="#study-math">Math</a><a href="#study-spelling">Spelling</a><a href="#study-sight">Sight words</a><a href="./game/">Game</a></nav>'+
    subjectCard("study-religion","religion",rel?.subject||"Religion",rel)+
    subjectCard("study-reading","reading","Reading",r)+
    subjectCard("study-math","math","Math",math)+
    subjectCard("study-spelling","spelling","Spelling and phonics",spell)+
    '<section id="study-sight" class="subject-card sight"><div class="subject-title"><div><p>SIGHT WORDS</p><h2>Sight words</h2></div></div><div class="sight-cloud">'+sight.map(w=>'<span>'+esc(w)+'</span>').join("")+'</div></section>'+
    '<section class="subject-card reading"><div class="subject-title"><div><p>VOCABULARY</p><h2>Words to know</h2></div></div><div class="word-grid">'+vocab.map(w=>'<span>'+esc(w)+'</span>').join("")+'</div></section>'+
    '<section class="calm-card"><h3>STAR reminder</h3><p>Keep assessment preparation calm. Normal reading and a good night’s sleep are enough.</p></section>'+
    '<div id="study-game" class="study-game-heading"><p>LEARN THROUGH A SHORT GAME</p><h2>School Star Quest</h2></div><a class="quest-launcher" href="./game/"><div class="school-star-avatar compact">★</div><div class="quest-launcher-copy"><strong>Open School Star World</strong><span>Practice current material through short learning quests.</span></div></a>'+
    '</div>';
}
function renderFamily(){
  const tests=(pack?.importantDates||[]).filter(x=>kindClass(x)==="test").filter(x=>{const d=parseDate(x.date);return d&&d>=today()&&d<=weekDays()[4]}).length;
  const notices=pack?.parentNotices||[];
  const actions=[...(pack?.homework||[]).map(x=>x.task),...(pack?.reminders||[])].slice(0,8);
  stack().innerHTML='<div class="screen family-screen" role="region" aria-label="Family dashboard">'+
    header("FAMILY VIEW","Family dashboard")+freshness()+
    '<section class="family-hero"><p>WEEKLY PRIORITY</p><h2>Keep the week short, calm, and current.</h2><span>Use the teacher-posted material first. Reading remains part of the standing routine.</span></section>'+
    '<div class="family-stats"><div><strong>'+tests+'</strong><span>test days</span></div><div><strong>$17</strong><span>stationary money due Sept. 23</span></div></div>'+
    '<section class="parent-card"><h3>Family actions</h3><ul>'+actions.map(x=>'<li>'+esc(x)+'</li>').join("")+'</ul></section>'+
    '<section class="policy-card"><span>20</span><div><h3>Reading every day</h3><p>Read or be read to for 20 minutes and keep the Reading Log in the homework folder.</p></div></section>'+
    '<section class="parent-card conflicts"><h3>Please verify</h3><div><strong>Current posting</strong><p>The teacher Homework page does not show a posting date, so the app labels those items as the latest posting rather than assigning a weekday.</p></div></section>'+
    '<section class="parent-card sources"><h3>Current notices</h3>'+notices.map(x=>'<div><span class="status ok"></span><p>'+esc(x)+'</p></div>').join("")+'</section>'+
    '<section class="parent-card game-controls"><h3>Game privacy and controls</h3><p>School Star World keeps game progress on this device unless you export a backup.</p><a href="./game/">Open School Star World</a></section>'+
    '<section class="privacy-card policy-card"><span>✓</span><div><h3>Privacy first</h3><p>No student IDs or private classmates’ information are used here.</p></div></section>'+
    '<section class="install-card"><span>⌂</span><div><h3>Put this app on iPhone</h3><p>Use Safari’s Share menu, then choose Add to Home Screen.</p></div></section>'+
    '<p class="unofficial-note">Family planning tool based on current ABVM Grade 2 sources.</p>'+
    '</div>';
}
function render(){
  if(!pack)return;
  ({today:renderToday,week:renderWeek,calendar:renderCalendar,study:renderStudy,family:renderFamily}[activeTab]||renderToday)();
  $$(".bottom-nav button").forEach(b=>{
    const on=b.dataset.tab===activeTab;b.classList.toggle("active",on);
    on?b.setAttribute("aria-current","page"):b.removeAttribute("aria-current");
  });
  stack().scrollTop=0;
  bindScreen();
}
function bindScreen(){
  $$("[data-check]").forEach(b=>b.addEventListener("click",()=>toggleChecked((pack.homework||[])[Number(b.dataset.check)],Number(b.dataset.check))));
  $$("[data-day]").forEach(b=>b.addEventListener("click",()=>{selectedDay=new Date(b.dataset.day);renderWeek();bindScreen();}));
  $$("[data-cal-day]").forEach(b=>b.addEventListener("click",()=>{calendarDay=new Date(b.dataset.calDay);renderCalendar();bindScreen();}));
}
$$(".bottom-nav button").forEach(b=>b.addEventListener("click",()=>{activeTab=b.dataset.tab;render();}));
async function load(){
  try{
    const r=await fetch("./data/study-pack.json",{cache:"no-store"});
    if(!r.ok)throw new Error("HTTP "+r.status);
    const d=await r.json(); if(!d?.pack?.sourceSufficient)throw new Error("Incomplete pack");
    envelope=d;pack=d.pack;render();
  }catch(e){
    stack().innerHTML='<div class="screen"><section class="error-card"><p>ABVM GRADE 2</p><h1>School info could not be loaded</h1><span>Refresh the page to try again.</span></section></div>';
  }
}
load();
})();