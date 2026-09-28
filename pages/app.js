(()=>{"use strict";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const stack=()=>$("#app-content");
let envelope=null, pack=null, activeTab=(["today","week","calendar","study","games","family"].includes(location.hash.slice(1))?location.hash.slice(1):"today"), selectedDay=null, calendarDay=null, weekOffset=0;
let studyGameCatalogCache=null, gameState={screen:"menu",mode:null,questions:[],index:0,score:0,streak:0,bestStreak:0,selectedIndex:null,answered:false,hintOpen:false,saved:false};

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
function schoolLogo(){return '<img class="school-mark" src="./assets/abvm-app-icon-192.png" alt="Assumption BVM Catholic School logo">';}
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
function eventDateRange(text){
  const value=String(text||"");
  const m=value.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s*(\d{1,2})\s*[–-]\s*(?:(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s*)?(\d{1,2})/i);
  if(!m){const d=parseDate(value);return d?[d,d]:null;}
  const start=parseDate(m[1]+" "+m[2]); if(!start)return null;
  const endMonth=SHORT_MONTHS[(m[3]||m[1]).toLowerCase()];
  let endYear=start.getFullYear(); if(endMonth<start.getMonth())endYear++;
  const end=new Date(endYear,endMonth,Number(m[4]),12);
  return [start,end];
}
function eventItemsForDate(date){
  return (pack?.importantDates||[]).filter(x=>{
    const range=eventDateRange(x.date); return range&&date>=range[0]&&date<=range[1];
  });
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
function mondayFor(date){
  const base=new Date(date); base.setHours(12,0,0,0);
  const day=base.getDay(); base.setDate(base.getDate()-(day===0?6:day-1));
  return base;
}
function weekDays(offset=weekOffset){
  const mon=mondayFor(today()); mon.setDate(mon.getDate()+(offset*7));
  return Array.from({length:5},(_,i)=>{const x=new Date(mon);x.setDate(mon.getDate()+i);return x;});
}
function weekRangeLabel(days){
  const first=days[0],last=days[days.length-1];
  const a=MONTHS[first.getMonth()].slice(0,3)+" "+first.getDate();
  const b=(first.getMonth()===last.getMonth()?"":MONTHS[last.getMonth()].slice(0,3)+" ")+last.getDate();
  return a+" – "+b;
}
function isPackWeek(days){
  const sourceStart=parseDate(pack?.weekLabel||"");
  return !!sourceStart&&days.some(d=>sameDay(d,sourceStart));
}
function lunchText(lunch){
  return lunch?.items?.length?lunch.items.join(", ").replace(/, ([^,]*)$/,", and $1"):"";
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
  if(!selectedDay||!days.some(d=>sameDay(d,selectedDay)))selectedDay=weekOffset===0?(days.find(d=>sameDay(d,today()))||days[0]):days[0];
  const events=eventItemsForDate(selectedDay), lunch=lunchForDate(selectedDay);
  const picker=days.map(d=>'<button class="'+(sameDay(d,selectedDay)?"active":"")+'" data-day="'+d.toISOString()+'"><span>'+WEEKDAY[d.getDay()].slice(0,3)+'</span><strong>'+d.getDate()+'</strong></button>').join("");
  const eventRows=events.length?events.map(e=>'<div class="event-row"><time>'+esc((e.kind||"School").replace(/\b\w/g,m=>m.toUpperCase()))+'</time><div><strong>'+esc(e.label)+'</strong></div></div>').join(""):'<div class="event-row"><time>School</time><div><strong>No special school events are listed.</strong></div></div>';
  const sourceWeek=isPackWeek(days), tasks=sourceWeek?(pack?.homework||[]):[];
  const checklist=tasks.length?tasks.map(taskHtml).join(""):'<div class="week-empty"><strong>No checklist has been verified for this week yet.</strong><span>Calendar dates still appear below, and new homework will show here after the school source refreshes.</span></div>';
  const future=(pack?.importantDates||[]).map(x=>({x,d:parseDate(x.date)})).filter(o=>o.d&&o.d>selectedDay).sort((a,b)=>a.d-b.d).slice(0,4);
  stack().innerHTML='<div class="screen" role="region" aria-label="This week">'+
    header("YOUR SCHOOL PLAN","This week")+freshness()+
    '<nav class="week-nav" aria-label="Change displayed week"><button type="button" data-week-step="-1" aria-label="Previous week">‹</button><div aria-live="polite"><span>'+(weekOffset===0?"CURRENT WEEK":"VIEWING WEEK")+'</span><strong>'+esc(weekRangeLabel(days))+'</strong></div><button type="button" data-week-step="1" aria-label="Next week">›</button></nav>'+
    (weekOffset!==0?'<button class="week-today-jump" type="button" data-week-today>Back to this week</button>':'')+
    '<div class="day-picker">'+picker+'</div>'+
    '<section class="day-detail green"><div class="day-detail-title"><div><p>'+MONTHS[selectedDay.getMonth()].toUpperCase()+'</p><h2>'+esc(fmtDate(selectedDay))+'</h2></div><span>School day</span></div><div class="event-stack">'+eventRows+'</div><h3>My checklist</h3>'+checklist+'</section>'+
    (lunch?'<section class="lunch-card"><span>🍎</span><div><p>SCHOOL LUNCH</p><strong>'+esc(lunchText(lunch))+'</strong></div></section>':'')+
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
function monthAgendaDays(year,month){
  const last=new Date(year,month+1,0,12).getDate(),days=[];
  for(let n=1;n<=last;n++){
    const d=new Date(year,month,n,12),weekend=[0,6].includes(d.getDay());
    if(!weekend||eventItemsForDate(d).length||lunchForDate(d))days.push(d);
  }
  return days;
}
function agendaLunchHtml(date,lunch){
  const events=eventItemsForDate(date),closed=events.some(e=>kindClass(e)==="closed"),weekend=[0,6].includes(date.getDay());
  const text=lunch?lunchText(lunch):(closed||weekend?"No school lunch":"Lunch menu not posted in the current verified source.");
  return '<div class="agenda-lunch'+(lunch?"":" is-missing")+'"><span>🍎</span><div><b>Lunch</b><p>'+esc(text)+'</p></div></div>';
}
function agendaDayHtml(date){
  const events=eventItemsForDate(date),lunch=lunchForDate(date),closed=events.some(e=>kindClass(e)==="closed"),weekend=[0,6].includes(date.getDay());
  const status=closed?"No school":(weekend?"Weekend":"School day");
  const rows=events.length?events.map(e=>'<div class="agenda-event"><i class="'+kindClass(e)+'"></i><span><strong>'+esc(e.label)+'</strong>'+(e.kind?'<small>'+esc(e.kind)+'</small>':'')+'</span></div>').join(""):'<div class="agenda-event agenda-regular"><i class="family"></i><span><strong>Regular school day</strong><small>No special event is currently listed.</small></span></div>';
  return '<article class="agenda-day month-agenda-row"><header><div><p>'+WEEKDAY[date.getDay()].toUpperCase()+'</p><h3>'+MONTHS[date.getMonth()]+' '+date.getDate()+'</h3></div><span>'+status+'</span></header><div class="agenda-events">'+rows+'</div>'+agendaLunchHtml(date,lunch)+'</article>';
}

function renderCalendar(){
  const base=today(); if(!calendarDay)calendarDay=new Date(base);
  const y=base.getFullYear(),m=base.getMonth(), events=eventItemsForDate(calendarDay), lunch=lunchForDate(calendarDay);
  const agendaDays=monthAgendaDays(y,m);
  const nextMonthDate=new Date(y,m+1,1,12),nextY=nextMonthDate.getFullYear(),nextM=nextMonthDate.getMonth();
  const nextMonth=(pack?.importantDates||[]).map(x=>({x,d:parseDate(x.date)})).filter(o=>o.d&&o.d.getMonth()===nextM&&o.d.getFullYear()===nextY).sort((a,b)=>a.d-b.d).slice(0,5);
  stack().innerHTML='<div class="screen calendar-screen" role="region" aria-label="'+MONTHS[m]+' calendar">'+
    header("SCHOOL MONTH AT A GLANCE",MONTHS[m]+" "+y)+freshness()+
    '<section class="calendar-card"><div class="calendar-title-row"><div><p>MONTH VIEW</p><h2>'+MONTHS[m]+'</h2></div><span>Tap any date</span></div><div class="calendar-weekdays">'+["S","M","T","W","T","F","S"].map(x=>"<span>"+x+"</span>").join("")+'</div><div class="calendar-grid">'+monthGrid(y,m)+'</div><div class="calendar-legend"><span><i class="test"></i>Test</span><span><i class="faith"></i>Faith</span><span><i class="family"></i>Family</span><span><i class="due"></i>Due</span><span><i class="lunch"></i>Lunch</span></div></section>'+
    '<section class="calendar-day-card"><div class="calendar-day-heading"><div><p>'+WEEKDAY[calendarDay.getDay()].toUpperCase()+'</p><h2>'+MONTHS[calendarDay.getMonth()]+" "+calendarDay.getDate()+'</h2></div></div>'+
      (events.length?'<div class="calendar-event-list">'+events.map(e=>'<div><i class="'+kindClass(e)+'"></i><span><strong>'+esc(e.label)+'</strong></span></div>').join("")+'</div>':'<p class="calendar-empty">No special school events are listed for this date.</p>')+
      agendaLunchHtml(calendarDay,lunch)+
    '</section>'+
    '<section class="month-agenda"><div class="month-agenda-head"><span class="month-agenda-mark" aria-hidden="true">▦</span><div><p>MONTH AGENDA</p><h2>'+MONTHS[m]+' full agenda</h2></div></div><p class="month-agenda-note">Every school day is included. Lunch is shown when it has been verified; otherwise the app says that it has not been posted yet.</p><div class="month-agenda-list">'+agendaDays.map(agendaDayHtml).join("")+'</div></section>'+
    '<section class="specials-card"><div class="specials-head"><span class="specials-mark" aria-hidden="true">★</span><div><p>WEEKLY ROTATION</p><h2>Specials</h2></div></div><div class="specials-list"><div class="special-row"><span>Mon</span><strong>Computer</strong></div><div class="special-row"><span>Tue</span><strong>Music · Art · Guidance</strong></div><div class="special-row"><span>Wed</span><strong>Mass</strong></div><div class="special-row"><span>Thu</span><strong>Gym</strong></div><div class="special-row"><span>Fri</span><strong>Library</strong></div></div></section>'+
    '<section class="next-month-card"><h2>Coming in '+MONTHS[nextM]+'</h2>'+nextMonth.map(o=>'<div><span>'+esc(fmtShort(o.d))+'</span><p>'+esc(o.x.label)+'</p></div>').join("")+'</section>'+
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
    '<section class="study-at-a-glance"><div class="quick-look-head"><span class="quick-look-mark" aria-hidden="true">✓</span><div><p>QUICK LOOK</p><h2>This week’s essentials</h2></div></div><ol>'+essentials.map(x=>'<li><time>'+esc(x[0])+'</time><span>'+esc(x[1])+'</span></li>').join("")+'</ol></section>'+
    '<nav class="study-jumps"><a href="#study-religion">Religion</a><a href="#study-reading">Reading</a><a href="#study-math">Math</a><a href="#study-spelling">Spelling</a><a href="#study-sight">Sight words</a><a href="#games" data-open-games>Study Games</a></nav>'+
    subjectCard("study-religion","religion",rel?.subject||"Religion",rel)+
    subjectCard("study-reading","reading","Reading",r)+
    subjectCard("study-math","math","Math",math)+
    subjectCard("study-spelling","spelling","Spelling and phonics",spell)+
    '<section id="study-sight" class="subject-card sight"><div class="subject-title"><div><p>SIGHT WORDS</p><h2>Sight words</h2></div></div><div class="sight-cloud">'+sight.map(w=>'<span>'+esc(w)+'</span>').join("")+'</div></section>'+
    '<section class="subject-card reading"><div class="subject-title"><div><p>VOCABULARY</p><h2>Words to know</h2></div></div><div class="word-grid">'+vocab.map(w=>'<span>'+esc(w)+'</span>').join("")+'</div></section>'+
    '<section class="calm-card"><h3>STAR reminder</h3><p>Keep assessment preparation calm. Normal reading and a good night’s sleep are enough.</p></section>'+
    '<div id="study-game" class="study-game-heading"><p>LEARN THROUGH A SHORT GAME</p><h2>School Star Quest</h2></div><a class="quest-launcher" href="#games" data-open-games><div class="school-star-avatar compact">★</div><div class="quest-launcher-copy"><strong>Open Study Games</strong><span>Practice current material through short learning games.</span></div></a>'+
    '</div>';
}
function studyGameEngine(){return window.ABVMStudyGames||null}
function studyGameCatalog(){
  const engine=studyGameEngine();
  if(!engine)return null;
  const sourceKey=engine.sourceKeyFromEnvelope(pack,envelope);
  if(!studyGameCatalogCache||studyGameCatalogCache.sourceKey!==sourceKey){
    studyGameCatalogCache=engine.buildCatalog(pack,{sourceKey});
  }
  return studyGameCatalogCache;
}
function studyGameModes(){
  return [
    {id:"quick",title:"Quick Mix",icon:"★",subjects:[],count:8,copy:"A little bit of everything from this week."},
    {id:"math",title:"Math Dash",icon:"−",subjects:["Math"],count:8,copy:"Subtraction practice built from the current math skill."},
    {id:"words",title:"Word Power",icon:"Aa",subjects:["Reading / ELA","Spelling / Handwriting"],count:8,copy:"Sight words, vocabulary, phonics, and grammar."},
    {id:"faith",title:"Faith Quest",icon:"✦",subjects:["Religion"],count:8,copy:"Religion practice from the current class material."}
  ];
}
function gameMode(id){return studyGameModes().find(mode=>mode.id===id)||studyGameModes()[0]}
function gameRecordKey(modeId){
  const catalog=studyGameCatalog();
  return "abvm-study-games:"+String(catalog?.sourceKey||"current")+":"+modeId;
}
function loadGameRecord(modeId){
  try{
    const value=JSON.parse(localStorage.getItem(gameRecordKey(modeId))||"{}");
    return {best:Number(value.best)||0,plays:Number(value.plays)||0,totalCorrect:Number(value.totalCorrect)||0,totalAnswered:Number(value.totalAnswered)||0};
  }catch{return {best:0,plays:0,totalCorrect:0,totalAnswered:0}}
}
function saveGameRecord(){
  if(gameState.saved||!gameState.mode||!gameState.questions.length)return;
  const record=loadGameRecord(gameState.mode);
  const next={
    best:Math.max(record.best,gameState.score),
    plays:record.plays+1,
    totalCorrect:record.totalCorrect+gameState.score,
    totalAnswered:record.totalAnswered+gameState.questions.length
  };
  localStorage.setItem(gameRecordKey(gameState.mode),JSON.stringify(next));
  gameState.saved=true;
}
function nextGameSessionSeed(modeId){
  const catalog=studyGameCatalog();
  const key="abvm-study-games-session:"+String(catalog?.sourceKey||"current")+":"+modeId;
  const next=(Number(localStorage.getItem(key))||0)+1;
  localStorage.setItem(key,String(next));
  return String(catalog?.sourceKey||"current")+"|"+modeId+"|"+next;
}
function gameLearningKey(){return "abvm-study-learning:v2";}
function loadGameLearning(){
  try{
    const parsed=JSON.parse(localStorage.getItem(gameLearningKey())||"{}");
    return parsed&&typeof parsed==="object"?parsed:{};
  }catch{return {}}
}
function recordGameLearning(question,correct){
  if(!question?.skill)return null;
  const all=loadGameLearning(),row=all[question.skill]||{Seen:0,Correct:0,Wrong:0,ConsecutiveCorrect:0,ConsecutiveWrong:0,TargetDifficulty:2};
  row.Seen=(Number(row.Seen)||0)+1;
  if(correct){
    row.Correct=(Number(row.Correct)||0)+1;
    row.ConsecutiveCorrect=(Number(row.ConsecutiveCorrect)||0)+1;
    row.ConsecutiveWrong=0;
    if(row.ConsecutiveCorrect>=2)row.TargetDifficulty=3;
  }else{
    row.Wrong=(Number(row.Wrong)||0)+1;
    row.ConsecutiveWrong=(Number(row.ConsecutiveWrong)||0)+1;
    row.ConsecutiveCorrect=0;
    if(row.ConsecutiveWrong>=2)row.TargetDifficulty=2;
  }
  all[question.skill]=row;
  localStorage.setItem(gameLearningKey(),JSON.stringify(all));
  return row;
}
function startStudyGame(modeId){
  const engine=studyGameEngine(),catalog=studyGameCatalog(),mode=gameMode(modeId);
  if(!engine||!catalog)return;
  const questions=engine.selectQuestions(catalog,{subjects:mode.subjects,count:mode.count,seed:nextGameSessionSeed(mode.id),skillStats:loadGameLearning()});
  gameState={screen:"play",mode:mode.id,questions,index:0,score:0,streak:0,bestStreak:0,selectedIndex:null,answered:false,hintOpen:false,saved:false,learningRow:null};
  renderGames();bindScreen();
}
function answerStudyGame(index){
  if(gameState.screen!=="play"||gameState.answered)return;
  const question=gameState.questions[gameState.index],choice=question?.choices?.[index];
  if(choice===undefined)return;
  const correct=choice===question.answer;
  gameState.selectedIndex=index;gameState.answered=true;gameState.hintOpen=false;
  gameState.learningRow=recordGameLearning(question,correct);
  if(correct){
    gameState.score++;
    gameState.streak++;
    gameState.bestStreak=Math.max(gameState.bestStreak,gameState.streak);
  }else gameState.streak=0;
  renderGames();bindScreen();
}
function advanceStudyGame(){
  if(!gameState.answered)return;
  if(gameState.index>=gameState.questions.length-1){
    gameState.screen="finish";
    saveGameRecord();
  }else{
    gameState.index++;
    gameState.selectedIndex=null;
    gameState.answered=false;
    gameState.hintOpen=false;
    gameState.learningRow=null;
  }
  renderGames();bindScreen();
}
function leaveStudyGame(){gameState.screen="menu";renderGames();bindScreen()}
function toggleStudyHint(){if(gameState.screen==="play"&&!gameState.answered){gameState.hintOpen=!gameState.hintOpen;renderGames();bindScreen()}}
function gameTypeLabel(type){
  return ({direct:"Direct practice",transfer:"Try it a new way",reasoning:"Explain your thinking",source:"Current class material"})[type]||"Practice";
}
function gameMenuHtml(catalog){
  const modes=studyGameModes();
  const equivalent=(catalog?.questions||[]).filter(q=>q.originalEquivalent===true).length;
  const subjects=new Set((catalog?.questions||[]).map(q=>q.subject));
  return '<section class="study-games-hero"><div class="study-games-mascot">★</div><div><p>POWERED BY THE STARBLOX QUESTION SYSTEM</p><h2>Fresh practice, same school skills</h2><span>The engine turns verified skills into original direct, transfer, and reasoning questions.</span></div></section>'+
    '<section class="game-engine-stats"><div><strong>'+String(catalog?.questionCount||0)+'</strong><span>ready questions</span></div><div><strong>'+String(equivalent)+'</strong><span>fresh equivalents</span></div><div><strong>'+String(subjects.size)+'</strong><span>subjects</span></div></section>'+
    '<div class="game-section-heading"><div><p>CHOOSE A GAME</p><h2>What should we play?</h2></div></div>'+
    '<div class="study-game-grid">'+modes.map(mode=>{
      const available=(catalog?.questions||[]).filter(q=>!mode.subjects.length||mode.subjects.includes(q.subject)).length;
      const record=loadGameRecord(mode.id);
      return '<button type="button" class="study-game-tile game-'+mode.id+'" data-game-start="'+esc(mode.id)+'"><span class="study-game-icon">'+esc(mode.icon)+'</span><span class="study-game-copy"><strong>'+esc(mode.title)+'</strong><small>'+esc(mode.copy)+'</small><em>'+available+' questions ready'+(record.plays?' · best '+record.best:'')+'</em></span><b aria-hidden="true">›</b></button>';
    }).join("")+'</div>'+
    '<section class="question-tech-card"><p>HOW THE QUESTIONS GET SMARTER</p><div><span><b>1</b><strong>Direct</strong><small>Practice the skill.</small></span><span><b>2</b><strong>Transfer</strong><small>Use it in a new example.</small></span><span><b>3</b><strong>Reason</strong><small>Explain why it works.</small></span></div><p class="question-quality-note">No list-recognition questions. Grade-2 standards, DOK 1–3, misconception feedback, and adaptive difficulty are enforced before a question can appear.</p></section>'+
    '<p class="game-privacy-note">Questions use verified skill signals and current school material. The equivalent-item engine does not need student answers, grades, or private worksheet text.</p>';
}
function gamePlayHtml(){
  const mode=gameMode(gameState.mode),q=gameState.questions[gameState.index];
  if(!q)return '<section class="game-empty"><h2>No questions are ready for this game yet.</h2><button type="button" data-game-home>Back to games</button></section>';
  const progress=gameState.index+1,total=gameState.questions.length,pct=Math.round((gameState.index/Math.max(1,total))*100);
  const chosen=gameState.selectedIndex;
  const answers=q.choices.map((choice,index)=>{
    let klass="";
    if(gameState.answered){
      if(choice===q.answer)klass=" correct";
      else if(index===chosen)klass=" wrong";
    }
    return '<button type="button" class="game-answer'+klass+'" data-game-answer="'+index+'" '+(gameState.answered?'disabled':'')+'><span>'+String.fromCharCode(65+index)+'</span><strong>'+esc(choice)+'</strong></button>';
  }).join("");
  const selected=chosen===null?null:q.choices[chosen],correct=selected===q.answer;
  const targeted=!correct&&selected?q.choiceDiagnostics?.[selected]?.feedback:null;
  const adaptive=!correct&&(gameState.learningRow?.ConsecutiveWrong||0)>=2?'<small class="adaptive-note">Support mode: the next rounds will favor a simpler same-skill item until this skill stabilizes.</small>':'';
  const feedback=gameState.answered
    ? '<section class="game-feedback '+(correct?'correct':'retry')+'" aria-live="polite"><span>'+(correct?'✓':'↻')+'</span><div><strong>'+(correct?'Nice work!':'Good try — here’s the answer.')+'</strong><p>'+esc(correct?q.explanation:(targeted||q.explanation))+'</p>'+adaptive+'</div></section><button type="button" class="game-next" data-game-next>'+(progress===total?'See my score':'Next question')+' <span>›</span></button>'
    : '<div class="game-hint-wrap"><button type="button" class="game-hint-button" data-game-hint>'+(gameState.hintOpen?'Hide hint':'Need a hint?')+'</button>'+(gameState.hintOpen?'<p class="game-hint">'+esc(q.hint)+'</p>':'')+'</div>';
  return '<div class="game-topbar"><button type="button" data-game-home aria-label="Back to study games">‹</button><div><span>'+esc(mode.title)+'</span><strong>'+progress+' of '+total+'</strong></div><b>★ '+gameState.score+'</b></div>'+
    '<div class="game-progress" aria-label="Game progress"><span style="width:'+pct+'%"></span></div>'+
    '<section class="game-question-card"><div class="game-question-meta"><span>'+esc(q.subject)+'</span><b>'+esc(gameTypeLabel(q.questionType))+'</b></div><h2>'+esc(q.prompt)+'</h2><div class="game-answer-list">'+answers+'</div>'+feedback+'</section>'+
    '<div class="game-streak"><span>Streak <b>'+gameState.streak+'</b></span><span>Best this round <b>'+gameState.bestStreak+'</b></span></div>';
}
function gameFinishHtml(){
  const mode=gameMode(gameState.mode),total=gameState.questions.length,record=loadGameRecord(gameState.mode);
  const pct=total?Math.round((gameState.score/total)*100):0;
  const stars=pct>=90?3:pct>=70?2:pct>=40?1:0;
  return '<section class="game-finish"><div class="game-finish-stars" aria-label="'+stars+' stars">'+[0,1,2].map(i=>'<span class="'+(i<stars?'earned':'')+'">★</span>').join("")+'</div><p>'+esc(mode.title.toUpperCase())+'</p><h2>'+gameState.score+' out of '+total+'</h2><strong>'+pct+'%</strong><span>'+(pct>=90?'Fantastic work!':pct>=70?'Great job — one more round can make it even stronger.':pct>=40?'Good practice. Try another round to build the skill.':'Keep practicing — every round helps.')+'</span><div class="game-finish-actions"><button type="button" class="primary" data-game-start="'+esc(mode.id)+'">Play again</button><button type="button" data-game-home>All study games</button></div><small>Best score on this material: '+record.best+' / '+total+'</small></section>';
}
function renderGames(){
  const engine=studyGameEngine(),catalog=studyGameCatalog();
  if(!engine||!catalog){
    stack().innerHTML='<div class="screen games-screen"><section class="error-card"><p>STUDY GAMES</p><h1>Question engine unavailable</h1><span>Refresh the app to load the study-game engine.</span></section></div>';
    return;
  }
  const body=gameState.screen==="play"?gamePlayHtml():gameState.screen==="finish"?gameFinishHtml():gameMenuHtml(catalog);
  stack().innerHTML='<div class="screen games-screen" role="region" aria-label="Study games">'+header("LEARN THROUGH PLAY","Study games")+freshness()+body+'</div>';
}

function renderFamily(){
  const tests=(pack?.importantDates||[]).filter(x=>kindClass(x)==="test").filter(x=>{const d=parseDate(x.date);return d&&d>=today()&&d<=weekDays()[4]}).length;
  const notices=pack?.parentNotices||[];
  const actions=[...(pack?.homework||[]).map(x=>x.task),...(pack?.reminders||[])].slice(0,8);
  stack().innerHTML='<div class="screen family-screen" role="region" aria-label="Family dashboard">'+
    header("FAMILY VIEW","Family dashboard")+freshness()+
    '<section class="family-hero"><p>WEEKLY PRIORITY</p><h2>Keep the week short, calm, and current.</h2><span>Use the teacher-posted material first. Reading remains part of the standing routine.</span></section>'+
    '<div class="family-stats"><div><strong>'+tests+'</strong><span>test days</span></div><div><strong>$17</strong><span>stationary money due Sept. 23</span></div></div>'+
    '<section class="parent-card family-actions-card"><div class="family-actions-head"><span class="family-actions-mark" aria-hidden="true">✓</span><div><small>THIS WEEK</small><h3>Family actions</h3></div></div><ul>'+actions.map(x=>'<li>'+esc(x)+'</li>').join("")+'</ul></section>'+
    '<section class="policy-card reading-policy-card"><span>20</span><div><small>DAILY HABIT</small><h3>Reading every day</h3><p>Read or be read to for 20 minutes and keep the Reading Log in the homework folder.</p></div></section>'+
    ''+
    '<section class="parent-card sources notices-card"><div class="notices-head"><span class="notices-mark" aria-hidden="true">i</span><div><small>SCHOOL UPDATES</small><h3>Current notices</h3></div></div>'+notices.map(x=>'<div class="notice-row"><span class="status ok"></span><p>'+esc(x)+'</p></div>').join("")+'</section>'+
    '<section class="parent-card game-controls"><h3>Game privacy and controls</h3><p>School Star World keeps game progress on this device unless you export a backup.</p><a href="#games" data-open-games>Open Study Games</a></section>'+
    '<section class="privacy-card policy-card"><span>✓</span><div><h3>Privacy first</h3><p>No student IDs or private classmates’ information are used here.</p></div></section>'+
    '<section class="install-card"><span>⌂</span><div><h3>Put this app on iPhone</h3><p>Use Safari’s Share menu, then choose Add to Home Screen.</p></div></section>'+
    '<p class="unofficial-note">Family planning tool based on current ABVM Grade 2 sources.</p>'+
    '</div>';
}
function render(){
  if(!pack)return;
  ({today:renderToday,week:renderWeek,calendar:renderCalendar,study:renderStudy,games:renderGames,family:renderFamily}[activeTab]||renderToday)();
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
  $$("[data-week-step]").forEach(b=>b.addEventListener("click",()=>{weekOffset+=Number(b.dataset.weekStep||0);selectedDay=null;renderWeek();bindScreen();}));
  $$("[data-week-today]").forEach(b=>b.addEventListener("click",()=>{weekOffset=0;selectedDay=null;renderWeek();bindScreen();}));
  $$("[data-cal-day]").forEach(b=>b.addEventListener("click",()=>{calendarDay=new Date(b.dataset.calDay);renderCalendar();bindScreen();}));
  $$("[data-game-start]").forEach(b=>b.addEventListener("click",()=>startStudyGame(b.dataset.gameStart)));
  $$("[data-game-answer]").forEach(b=>b.addEventListener("click",()=>answerStudyGame(Number(b.dataset.gameAnswer))));
  $$("[data-game-next]").forEach(b=>b.addEventListener("click",advanceStudyGame));
  $$("[data-game-home]").forEach(b=>b.addEventListener("click",leaveStudyGame));
  document.querySelectorAll("[data-game-hint]").forEach(b=>b.addEventListener("click",toggleStudyHint));
  document.querySelectorAll("[data-open-games]").forEach(a=>a.addEventListener("click",event=>{event.preventDefault();activeTab="games";history.replaceState(null,"","#games");gameState.screen="menu";render();}));
}
$$(".bottom-nav button").forEach(b=>b.addEventListener("click",()=>{activeTab=b.dataset.tab;history.replaceState(null,"","#"+activeTab);render();}));
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
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js",{updateViaCache:"none"}).catch(()=>{}));
load();
})();