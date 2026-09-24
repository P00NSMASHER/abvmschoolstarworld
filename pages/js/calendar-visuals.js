import {kindClass} from "./events.js";

const CALENDAR_VISUAL_LIBRARY={
  picture:{variants:["./assets/calendar/picture-day.svg","./assets/calendar/picture-day-2.svg"],alt:"Premium school Picture Day camera visual"},
  mass:{variants:["./assets/calendar/mass-1.svg","./assets/calendar/mass-2.svg"],alt:"Premium Mass and church visual"},
  gym:{variants:["./assets/calendar/gym-1.svg","./assets/calendar/gym-2.svg"],alt:"Premium gym class visual"},
  art:{variants:["./assets/calendar/art-1.svg","./assets/calendar/art-2.svg"],alt:"Premium art class visual"},
  dress:{variants:["./assets/calendar/dress-down-1.svg","./assets/calendar/dress-down-2.svg"],alt:"Premium Dress Down Day visual"},
  closed:{variants:["./assets/calendar/closed-1.svg","./assets/calendar/closed-2.svg"],alt:"Premium no-school visual"},
  halfday:{variants:["./assets/calendar/half-day-1.svg","./assets/calendar/half-day-2.svg"],alt:"Premium half-day dismissal visual"},
  conference:{variants:["./assets/calendar/conference-1.svg","./assets/calendar/conference-2.svg"],alt:"Premium parent-teacher conference visual"},
  progress:{variants:["./assets/calendar/progress-1.svg","./assets/calendar/progress-2.svg"],alt:"Premium progress report visual"},
  testing:{variants:["./assets/calendar/testing-1.svg","./assets/calendar/testing-2.svg"],alt:"Premium school assessment visual"},
  celebration:{variants:["./assets/calendar/celebration-1.svg","./assets/calendar/celebration-2.svg"],alt:"Premium school celebration visual"},
  meeting:{variants:["./assets/calendar/meeting-1.svg","./assets/calendar/meeting-2.svg"],alt:"Premium school meeting visual"},
  club:{variants:["./assets/calendar/club-1.svg","./assets/calendar/club-2.svg"],alt:"Premium school club visual"},
  halloween:{variants:["./assets/calendar/halloween.svg"],alt:"Premium Halloween school celebration visual"},
  thanksgiving:{variants:["./assets/calendar/thanksgiving.svg"],alt:"Premium Thanksgiving break visual"},
  christmas:{variants:["./assets/calendar/christmas.svg"],alt:"Premium Christmas break visual"},
  newyear:{variants:["./assets/calendar/new-year.svg"],alt:"Premium New Year's Day visual"},
  mlk:{variants:["./assets/calendar/mlk-day.svg"],alt:"Premium Martin Luther King Jr. Day visual"},
  presidents:{variants:["./assets/calendar/presidents-day.svg"],alt:"Premium Presidents' Day visual"},
  easter:{variants:["./assets/calendar/easter.svg"],alt:"Premium Easter break visual"},
  memorial:{variants:["./assets/calendar/memorial-day.svg"],alt:"Premium Memorial Day visual"},
  catholic:{variants:["./assets/calendar/catholic-schools-week.svg"],alt:"Premium Catholic Schools Week visual"},
  santa:{variants:["./assets/calendar/santa-workshop.svg"],alt:"Premium Santa Workshop visual"},
  lastday:{variants:["./assets/calendar/last-day.svg"],alt:"Premium last day of school visual"},
  weather:{variants:["./assets/calendar/weather-makeup.svg"],alt:"Premium weather makeup day visual"}
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
  if(pk==="picture")return"picture";
  if(pk==="dress")return"dress";
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
  if(pk==="celebration")return"celebration";
  if(pk==="faith"||/mass|church/.test(s))return"mass";
  if(/gym/.test(s))return"gym";
  if(/art/.test(s))return"art";
  if(schedule&&kindClass(schedule)==="halfday")return"halfday";
  return null;
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
