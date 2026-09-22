(()=>{"use strict";
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
let envelope=null,pack=null;
const toast=m=>{const t=$("#toast");t.textContent=m;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),1700)};
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
const taskKey=(h,i)=>"abvm-week:"+String(pack?.sourceHash||"pack")+":"+i+":"+h.task;
const isDone=(h,i)=>localStorage.getItem(taskKey(h,i))==="1";
const setDone=(h,i,v)=>v?localStorage.setItem(taskKey(h,i),"1"):localStorage.removeItem(taskKey(h,i));

function showTab(tab){
  $$(".panel").forEach(p=>p.classList.toggle("active",p.dataset.panel===tab));
  $$(".nav-item").forEach(b=>{
    const active=b.dataset.tab===tab;
    b.classList.toggle("active",active);
    active?b.setAttribute("aria-current","page"):b.removeAttribute("aria-current");
  });
  history.replaceState(null,"","#"+tab);
  scrollTo({top:0,behavior:"smooth"});
}

function parseSchoolDate(text){
  if(!text)return null;
  const match=String(text).match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s*(\d{1,2})/i);
  if(!match)return null;
  const months={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,sept:8,oct:9,nov:10,dec:11};
  const month=months[match[1].toLowerCase()];
  const day=Number(match[2]);
  const now=new Date();
  let year=now.getFullYear();
  if(now.getMonth()>=7&&month<=5)year+=1;
  else if(now.getMonth()<=5&&month>=7)year-=1;
  const d=new Date(year,month,day,12,0,0,0);
  return Number.isNaN(d.getTime())?null:d;
}

function sameDay(a,b){return a&&b&&a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate()}

function nextImportant(){
  const items=pack?.importantDates||[];
  if(!items.length)return null;
  const today=new Date();today.setHours(0,0,0,0);
  const future=items.map((item,index)=>({item,index,date:parseSchoolDate(item.date)}))
    .filter(x=>!x.date||x.date>=today)
    .sort((a,b)=>{
      if(a.date&&b.date)return a.date-b.date;
      if(a.date)return -1;if(b.date)return 1;return a.index-b.index;
    });
  return (future[0]||{item:items[0]}).item;
}

function upcomingDateCount(){
  const today=new Date();today.setHours(0,0,0,0);
  return (pack?.importantDates||[]).filter(x=>{const d=parseSchoolDate(x.date);return !d||d>=today}).length;
}

function sourceLabel(){
  if(envelope?.delivery==="live")return {short:"Updated",family:"School info is up to date",stale:false};
  if(envelope?.delivery==="verified")return {short:"Updated",family:"School info is up to date",stale:false};
  if(envelope?.delivery==="cache")return {short:"Saved update",family:"Using the latest saved school update",stale:true};
  return {short:"School info ready",family:"School info is ready",stale:true};
}

function formatUpdated(){
  const raw=envelope?.sourceLastSeenAt||pack?.sourceCapturedAt||pack?.generatedAt;
  if(!raw)return "Homework, dates, and study material are available.";
  const d=new Date(raw);
  if(Number.isNaN(d.getTime()))return "Homework, dates, and study material are available.";
  return "Last updated "+d.toLocaleDateString(undefined,{month:"short",day:"numeric"})+" at "+d.toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"})+".";
}

function render(){
  if(!pack)return;
  $("#weekTitle").textContent=pack.weekLabel||"Current school week";
  const status=sourceLabel(),badge=$("#sourceBadge");
  badge.textContent=status.short;
  badge.className="source-badge"+(status.stale?" stale":"");

  const subjects=pack.subjects||[];
  $("#glanceDates").textContent=String(upcomingDateCount());
  $("#glanceStudy").textContent=String(subjects.length);

  const next=nextImportant();
  $("#upNextTitle").textContent=next?.label||"No upcoming school date listed";
  $("#upNextWhen").textContent=next?.date||"This week";
  $("#upNextText").textContent=next?"Keep this on the radar while you work through the week.":"You’re caught up on the dates currently in the school update.";

  renderHomework();renderWeek();renderCalendar();renderStudy();renderLunch();renderParentNotices();

  $("#familySource").textContent=status.family;
  $("#familySourceDetail").textContent=formatUpdated();
  $("#familyStatusDot").className="status-dot"+(status.stale?" stale":"");
}

function readingRoutine(){
  const s=(pack.subjects||[]).find(x=>/reading routine/i.test(x.subject||""));
  return s?.topics?.[0]||"";
}

function renderHomework(){
  const root=$("#todayHomework");root.replaceChildren();
  const list=pack.homework||[];let done=0;
  list.forEach((h,i)=>{
    const label=document.createElement("label");
    label.className="task"+(isDone(h,i)?" done":"");
    const cb=document.createElement("input");cb.type="checkbox";cb.checked=isDone(h,i);cb.setAttribute("aria-label","Mark "+(h.task||"homework")+" done");
    const copy=document.createElement("span");copy.className="task-copy";
    copy.innerHTML="<b>"+esc(h.task)+"</b><small>"+esc([h.subject,h.due].filter(Boolean).join(" · "))+"</small>";
    cb.addEventListener("change",()=>{setDone(h,i,cb.checked);renderHomework()});
    label.append(cb,copy);root.append(label);if(cb.checked)done++;
  });
  if(!list.length){
    const routine=readingRoutine();
    root.innerHTML='<div class="empty-note"><b>No new daily homework is posted.</b><span>The school update does not currently show a new homework list.</span>'+(routine?'<div class="routine-note"><b>Standing routine:</b> '+esc(routine)+'</div>':'')+'</div>';
    $("#homeworkCount").textContent="No new list";
    $("#homeworkProgress").style.width="0%";
    $("#glanceHomework").textContent="No new";
    return;
  }
  $("#homeworkCount").textContent=done+" of "+list.length+" done";
  $("#homeworkProgress").style.width=Math.round(done/list.length*100)+"%";
  $("#glanceHomework").textContent=String(list.length-done)+" left";
}

function renderWeek(){
  const root=$("#weekHomework");root.replaceChildren();
  const groups={};(pack.homework||[]).forEach(h=>(groups[h.day||"This week"]??=[]).push(h));
  Object.entries(groups).forEach(([day,items])=>{
    const a=document.createElement("article");a.className="day-card";
    a.innerHTML="<div class='eyebrow'>"+esc(day.toUpperCase())+"</div><h3>"+esc(day)+"</h3><ul>"+items.map(h=>"<li><b>"+esc(h.subject||"Task")+":</b> "+esc(h.task)+" <span class='muted'>"+esc(h.due||"")+"</span></li>").join("")+"</ul>";
    root.append(a);
  });
  if(!Object.keys(groups).length){
    const routine=readingRoutine();
    root.innerHTML='<div class="empty-note"><b>No new daily homework list is posted.</b>'+(routine?'<div class="routine-note"><b>Standing routine:</b> '+esc(routine)+'</div>':'')+'</div>';
  }

  const rem=$("#reminders");rem.replaceChildren();
  (pack.reminders||[]).forEach(x=>{const d=document.createElement("div");d.className="reminder-item";d.textContent=x;rem.append(d)});
  if(!(pack.reminders||[]).length)rem.innerHTML='<div class="muted">No reminders are listed.</div>';
}

function renderLunch(){
  const menu=pack?.lunchMenu||[];
  const today=new Date();today.setHours(0,0,0,0);
  let current=null;
  for(const row of menu){
    const d=parseSchoolDate(row.day);
    if(d&&sameDay(d,today)){current=row;break;}
  }
  const todayRoot=$("#todayLunch");
  const todayTitle=$("#todayLunchTitle");
  if(todayRoot){
    if(current){
      todayTitle.textContent=current.day||"Today’s menu";
      todayRoot.innerHTML=(current.items||[]).map(x=>"<span>"+esc(x)+"</span>").join("");
    }else{
      todayTitle.textContent="School lunch";
      todayRoot.textContent=menu.length?"No lunch entry is listed for today.":"No lunch menu is loaded.";
    }
  }
  const weekRoot=$("#weekLunch");
  if(weekRoot){
    weekRoot.replaceChildren();
    menu.forEach(row=>{
      const card=document.createElement("div");
      card.className="lunch-day";
      card.innerHTML="<b>"+esc(row.day||"School day")+"</b><span>"+esc((row.items||[]).join(" · "))+"</span>";
      weekRoot.append(card);
    });
    if(!menu.length)weekRoot.innerHTML='<div class="muted">No lunch menu is loaded for this week.</div>';
  }
}

function renderParentNotices(){
  const root=$("#parentNotices");
  if(!root)return;
  root.replaceChildren();
  (pack?.parentNotices||[]).forEach(x=>{
    const d=document.createElement("div");
    d.className="reminder-item";
    d.textContent=x;
    root.append(d);
  });
  if(!(pack?.parentNotices||[]).length)root.innerHTML='<div class="muted">No additional parent notices are listed.</div>';
}

function renderCalendar(){
  const root=$("#calendarList");root.replaceChildren();
  const items=(pack.importantDates||[]).map((item,index)=>({item,index,date:parseSchoolDate(item.date)}))
    .sort((a,b)=>{
      if(a.date&&b.date)return a.date-b.date||a.index-b.index;
      if(a.date)return -1;
      if(b.date)return 1;
      return a.index-b.index;
    });
  items.forEach(({item:d})=>{
    const row=document.createElement("article");row.className="calendar-item";
    row.innerHTML="<div class='date-chip'>"+esc(d.date||"Date")+"</div><div><b>"+esc(d.label||"School item")+"</b><div class='muted'>"+esc((d.kind||"event").replaceAll("_"," "))+"</div></div>";
    root.append(row);
  });
  if(!items.length)root.innerHTML='<div class="muted">No important dates are listed in the current school update.</div>';
}

function renderStudy(){
  const sg=$("#subjectGuides");sg.replaceChildren();
  (pack.subjects||[]).forEach(s=>{
    const c=document.createElement("article");c.className="study-card";
    const notes=[...(s.topics||[]),...(s.studyNotes||[])];
    c.innerHTML="<div class='eyebrow'>"+esc((s.subject||"Study").toUpperCase())+"</div><h3>"+esc(s.subject||"Study")+"</h3><ul>"+notes.map(t=>"<li>"+esc(t)+"</li>").join("")+"</ul>";
    sg.append(c);
  });
  if(!(pack.subjects||[]).length)sg.innerHTML='<div class="muted">No study guides are available yet.</div>';

  const vg=$("#vocabList");vg.replaceChildren();
  (pack.vocabulary||[]).forEach(v=>{
    const d=document.createElement("div");d.className="vocab-item";
    d.innerHTML="<b>"+esc(v.term)+"</b><span>"+esc(v.meaning||"")+"</span><div class='muted'>"+esc(v.subject||"")+"</div>";
    vg.append(d);
  });
  if(!(pack.vocabulary||[]).length)vg.innerHTML='<div class="muted">No vocabulary is listed.</div>';

  const pr=$("#practiceList");pr.replaceChildren();
  (pack.questions||[]).slice(0,6).forEach(q=>{
    const d=document.createElement("article");d.className="practice-item";
    const opts=(q.choices||[]).map(x=>"<li>"+esc(x)+"</li>").join("");
    d.innerHTML="<b>"+esc(q.subject||"Practice")+"</b><p>"+esc(q.prompt)+"</p>"+(opts?"<ul>"+opts+"</ul>":"")+"<button class='button soft' type='button'>Show answer</button><div class='answer' aria-live='polite'><b>"+esc(q.answer)+"</b><div>"+esc(q.explanation||"")+"</div></div>";
    const b=d.querySelector("button"),a=d.querySelector(".answer");
    b.addEventListener("click",()=>{const show=!a.classList.contains("show");a.classList.toggle("show",show);b.textContent=show?"Hide answer":"Show answer";b.setAttribute("aria-expanded",String(show))});
    b.setAttribute("aria-expanded","false");pr.append(d);
  });
  if(!(pack.questions||[]).length)pr.innerHTML='<div class="muted">No practice questions are available.</div>';
}

async function load(){
  const badge=$("#sourceBadge");badge.textContent="Updating…";
  try{
    const r=await fetch("./data/study-pack.json",{cache:"no-store"});
    if(!r.ok)throw new Error("HTTP "+r.status);
    const d=await r.json();
    if(!d?.pack?.sourceSufficient)throw new Error("Incomplete school pack");
    envelope=d;pack=d.pack;render();
  }catch(e){
    badge.textContent="Update unavailable";badge.className="source-badge stale";
    $("#todayHomework").innerHTML='<div class="muted">School info could not be loaded right now. Use Refresh in Family to try again.</div>';
    $("#familySource").textContent="School info could not be loaded";
    $("#familySourceDetail").textContent="Try Refresh. Your completed homework checkmarks are still saved on this device.";
    $("#familyStatusDot").className="status-dot stale";
  }
}

$$(".nav-item").forEach(b=>b.addEventListener("click",()=>showTab(b.dataset.tab)));
$("#refreshBtn").addEventListener("click",async()=>{await load();toast("School info refreshed")});
$("#printBtn").addEventListener("click",()=>print());

const requested=location.hash.slice(1);
if(["today","week","calendar","study","family"].includes(requested))showTab(requested);
load();
})();