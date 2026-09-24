import {SHORT_MONTHS,WEEKDAY,sameDay,today} from "./date-utils.js";
import {kindClass,scheduleSecondaryEvents} from "./events.js";

export function schoolYearMonthDate(month,day){
  const now=today();
  let year=now.getFullYear();
  if(now.getMonth()>=7&&month<=5)year++;
  else if(now.getMonth()<=5&&month>=7)year--;
  return new Date(year,month,day,12);
}

export function eventSpan(text){
  if(!text)return null;
  const value=String(text);
  const match=value.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s*(\d{1,2})/i);
  if(!match)return null;
  const month=SHORT_MONTHS[match[1].toLowerCase()];
  const day=Number(match[2]);
  const start=schoolYearMonthDate(month,day);
  const tail=value.slice((match.index||0)+match[0].length);
  const endMatch=tail.match(/(?:–|-)\s*(?:(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s*)?(\d{1,2})\b/i);
  let end=new Date(start);
  if(endMatch){
    const endMonth=endMatch[1]?SHORT_MONTHS[endMatch[1].toLowerCase()]:month;
    end=schoolYearMonthDate(endMonth,Number(endMatch[2]));
    if(end<start)end.setFullYear(end.getFullYear()+1);
  }
  return{start,end};
}

export function parseDate(text){
  return eventSpan(text)?.start||null;
}

function sameEventWindow(a,b){
  const aa=eventSpan(a?.date),bb=eventSpan(b?.date);
  return Boolean(aa&&bb&&sameDay(aa.start,bb.start)&&sameDay(aa.end,bb.end));
}
function semanticEventClasses(item){
  return [...new Set([kindClass(item),...scheduleSecondaryEvents(item).map(x=>kindClass(x))])];
}
function eventWindowsOverlap(a,b){
  const aa=eventSpan(a?.date),bb=eventSpan(b?.date);
  return Boolean(aa&&bb&&aa.start<=bb.end&&bb.start<=aa.end);
}
function sameSchoolMonth(a,b){
  const aa=eventSpan(a?.date),bb=eventSpan(b?.date);
  return Boolean(aa&&bb&&aa.start.getFullYear()===bb.start.getFullYear()&&aa.start.getMonth()===bb.start.getMonth());
}

export function mergeAnnualCalendarItems(dynamicItems,annualItems){
  const merged=[...(dynamicItems||[])];
  for(const base of annualItems||[]){
    const baseClass=kindClass(base),baseLabel=String(base?.label||"").toLowerCase();
    const exists=merged.some(item=>{
      const itemClasses=semanticEventClasses(item),itemLabel=String(item?.label||"").toLowerCase();
      if(!itemClasses.includes(baseClass))return false;
      if(sameEventWindow(item,base))return true;
      if(baseClass==="conference"&&eventWindowsOverlap(item,base))return true;
      if(baseClass==="test"&&/star/.test(baseLabel)&&/star/.test(itemLabel)&&sameSchoolMonth(item,base))return true;
      return false;
    });
    if(!exists)merged.push(base);
  }
  return merged;
}

export function createSchoolModel(getPack){
  const currentPack=()=>getPack?.()||{};

  function eventItemsForDate(date){
    return(currentPack().importantDates||[]).filter(item=>{
      const span=eventSpan(item.date);
      return span&&date>=span.start&&date<=span.end;
    });
  }
  function eventIsPast(item,ref=today()){
    const span=eventSpan(item?.date);
    return span?span.end<ref:false;
  }
  function currentReminders(){
    const now=today();
    return(currentPack().reminders||[]).filter(text=>{
      const span=eventSpan(text);
      return !span||span.end>=now;
    }).sort((a,b)=>{
      const aSpan=eventSpan(a),bSpan=eventSpan(b);
      if(aSpan&&bSpan)return aSpan.start-bSpan.start;
      if(aSpan)return-1;
      if(bSpan)return 1;
      return 0;
    });
  }
  function reminderForDate(date){
    const dated=(currentPack().reminders||[]).map((text,index)=>({text,index,span:eventSpan(text)}))
      .filter(item=>item.span&&date>=item.span.start&&date<=item.span.end)
      .sort((a,b)=>(a.span.end-a.span.start)-(b.span.end-b.span.start)||a.index-b.index)[0];
    if(dated)return dated.text;
    const deadline=eventItemsForDate(date).find(item=>kindClass(item)==="due");
    return deadline?deadline.label+".":"Check the homework folder and reading log.";
  }
  function currentParentNotices(){
    const pack=currentPack();
    const now=today(),picture=(pack.importantDates||[]).find(x=>/picture day/i.test(x.label||""));
    return(pack.parentNotices||[]).filter(text=>{
      const span=eventSpan(text);
      if(span&&span.end<now)return false;
      if(/^Picture (ordering|backgrounds)/i.test(text)&&picture&&eventIsPast(picture,now))return false;
      return true;
    });
  }
  function lunchForDate(date){
    return(currentPack().lunchMenu||[]).find(x=>sameDay(parseDate(x.day),date))||null;
  }
  function weekDays(){
    const base=today(),day=base.getDay(),mon=new Date(base);
    mon.setDate(base.getDate()-(day===0?6:day-1));
    return Array.from({length:5},(_,i)=>{
      const date=new Date(mon);
      date.setDate(mon.getDate()+i);
      return date;
    });
  }
  function currentWeekRange(){
    const days=weekDays();
    return[days[0],days[4]];
  }
  function upcomingTests(limit=6){
    const now=today();
    return(currentPack().importantDates||[]).map(x=>({x,span:eventSpan(x.date)}))
      .filter(o=>o.span&&o.span.end>=now&&kindClass(o.x)==="test")
      .sort((a,b)=>a.span.start-b.span.start)
      .slice(0,limit)
      .map(o=>({x:o.x,d:o.span.start<now?new Date(now):o.span.start,span:o.span}));
  }
  function currentTest(){
    return upcomingTests(1)[0]||null;
  }
  function nextDeadline(){
    const now=today();
    return(currentPack().importantDates||[]).map(x=>({x,span:eventSpan(x.date)}))
      .filter(o=>o.span&&o.span.end>=now&&kindClass(o.x)==="due")
      .sort((a,b)=>a.span.start-b.span.start)[0]||null;
  }
  function subject(re){
    return(currentPack().subjects||[]).find(item=>re.test(item.subject||""));
  }
  function readingSubject(){return subject(/Reading \/ ELA/i)}
  function religionSubject(){return subject(/^Religion$/i)}
  function mathSubject(){return subject(/^Math$/i)}
  function spellingSubject(){return subject(/Spelling/i)}
  function readingRoutine(){return subject(/Reading Routine/i)?.topics?.[0]||"Read for 20 minutes every day."}
  function specialForDate(date){
    const prefix=WEEKDAY[date.getDay()]+":";
    const line=(subject(/^Specials$/i)?.topics||[]).find(x=>String(x).startsWith(prefix));
    return line?String(line).slice(prefix.length).trim():"";
  }

  return{
    eventItemsForDate,currentReminders,reminderForDate,currentParentNotices,lunchForDate,
    weekDays,currentWeekRange,currentTest,nextDeadline,readingSubject,religionSubject,
    mathSubject,spellingSubject,readingRoutine,specialForDate,
  };
}
