import {kindClass} from "./events.js";

const CALENDAR_VISUAL_LIBRARY={
  picture:{variants:["./assets/calendar/picture-day.svg","./assets/calendar/picture-day-2.svg"],alt:"Picture Day illustration"},
  mass:{variants:["./assets/calendar/mass-1.svg","./assets/calendar/mass-2.svg"],alt:"Mass and church illustration"},
  gym:{variants:["./assets/calendar/gym-1.svg","./assets/calendar/gym-2.svg"],alt:"Gym class illustration"},
  art:{variants:["./assets/calendar/art-1.svg","./assets/calendar/art-2.svg"],alt:"Art class illustration"},
  music:{variants:["./assets/calendar/music.svg"],alt:"Music class illustration"},
  computer:{variants:["./assets/calendar/computer.svg"],alt:"Computer class illustration"},
  library:{variants:["./assets/calendar/library.svg"],alt:"Library illustration"},
  guidance:{variants:["./assets/calendar/guidance.svg"],alt:"Guidance class illustration"},
  dress:{variants:["./assets/calendar/dress-down-1.svg","./assets/calendar/dress-down-2.svg"],alt:"Dress Down Day illustration"},
  closed:{variants:["./assets/calendar/closed-1.svg","./assets/calendar/closed-2.svg"],alt:"No-school illustration"},
  halfday:{variants:["./assets/calendar/half-day-1.svg","./assets/calendar/half-day-2.svg"],alt:"Half-day dismissal illustration"},
  conference:{variants:["./assets/calendar/conference-1.svg","./assets/calendar/conference-2.svg"],alt:"Parent-teacher conference illustration"},
  progress:{variants:["./assets/calendar/progress-1.svg","./assets/calendar/progress-2.svg"],alt:"Progress report illustration"},
  testing:{variants:["./assets/calendar/testing-1.svg","./assets/calendar/testing-2.svg"],alt:"School assessment illustration"},
  celebration:{variants:["./assets/calendar/celebration-1.svg","./assets/calendar/celebration-2.svg"],alt:"School celebration illustration"},
  meeting:{variants:["./assets/calendar/meeting-1.svg","./assets/calendar/meeting-2.svg"],alt:"School meeting illustration"},
  club:{variants:["./assets/calendar/club-1.svg","./assets/calendar/club-2.svg"],alt:"School club illustration"},
  halloween:{variants:["./assets/calendar/halloween.svg"],alt:"Halloween school celebration illustration"},
  thanksgiving:{variants:["./assets/calendar/thanksgiving.svg"],alt:"Thanksgiving break illustration"},
  christmas:{variants:["./assets/calendar/christmas.svg"],alt:"Christmas break illustration"},
  newyear:{variants:["./assets/calendar/new-year.svg"],alt:"New Year's Day illustration"},
  mlk:{variants:["./assets/calendar/mlk-day.svg"],alt:"Martin Luther King Jr. Day illustration"},
  presidents:{variants:["./assets/calendar/presidents-day.svg"],alt:"Presidents' Day illustration"},
  easter:{variants:["./assets/calendar/easter.svg"],alt:"Easter break illustration"},
  memorial:{variants:["./assets/calendar/memorial-day.svg"],alt:"Memorial Day illustration"},
  catholic:{variants:["./assets/calendar/catholic-schools-week.svg"],alt:"Catholic Schools Week illustration"},
  santa:{variants:["./assets/calendar/santa-workshop.svg"],alt:"Santa Workshop illustration"},
  lastday:{variants:["./assets/calendar/last-day.svg"],alt:"Last day of school illustration"},
  weather:{variants:["./assets/calendar/weather-makeup.svg"],alt:"Weather makeup day illustration"},
  generic:{variants:["./assets/calendar/school-event.svg"],alt:"School event illustration"}
};

function calendarVisualCategory(primary,special,schedule){
  const pk=primary?kindClass(primary):"",p=String(primary?.label||"").toLowerCase();
  const s=String(special||"").toLowerCase(),sl=String(schedule?.label||"").toLowerCase();
  if(schedule&&kindClass(schedule)==="closed"){
    if(/thanksgiving/.test(sl))return"thanksgiving";
    if(/christmas/.test(sl))return"christmas";
    if(/new year/.test(sl))return"newyear";
    if(/martin luther king|mlk/.test(sl))return"mlk";
    if(/president/.test(sl))return"presidents";
    if(/easter/.test(sl))return"easter";
    if(/memorial/.test(sl))return"memorial";
    return"closed";
  }
  if(pk==="picture"||/picture day/.test(p))return"picture";
  if(pk==="dress"||/dress down|dress-down/.test(p))return"dress";
  if(pk==="conference")return"conference";
  if(pk==="report"||/progress report/.test(p))return"progress";
  if(pk==="test")return"testing";
  if(pk==="meeting")return"meeting";
  if(pk==="club")return"club";
  if(/halloween/.test(p))return"halloween";
  if(/santa workshop/.test(p))return"santa";
  if(/catholic schools week/.test(p))return"catholic";
  if(/last day/.test(p))return"lastday";
  if(/weather makeup/.test(p))return"weather";
  if(pk==="celebration"||/dance|movie night|family night|party|s[’']?more|schwartz farm/.test(p))return"celebration";
  if(pk==="faith"||/\bmass\b|church/.test(p)||/\bmass\b|church/.test(s))return"mass";
  if(/library/.test(s))return"library";
  if(/computer/.test(s))return"computer";
  if(/music/.test(s))return"music";
  if(/guidance/.test(s))return"guidance";
  if(/gym/.test(s))return"gym";
  if(/art/.test(s))return"art";
  if(schedule&&kindClass(schedule)==="halfday")return"halfday";
  return(primary||special||schedule)?"generic":null;
}
function stableCalendarVisualIndex(date,count){
  if(count<=1)return 0;
  const key=(date.getFullYear()*372)+(date.getMonth()*31)+date.getDate();
  return Math.abs(key)%count;
}
export function calendarVisualFor(date,primary,special,schedule){
  const category=calendarVisualCategory(primary,special,schedule);
  const entry=category?CALENDAR_VISUAL_LIBRARY[category]:null;
  if(!entry?.variants?.length)return null;
  const index=stableCalendarVisualIndex(date,entry.variants.length);
  return{src:entry.variants[index],alt:entry.alt,category,index};
}
