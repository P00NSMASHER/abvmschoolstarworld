export const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
export const SHORT_MONTHS={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,sept:8,oct:9,nov:10,dec:11};
export const WEEKDAY=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

export function sameDay(a,b){
  return Boolean(a&&b&&a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate());
}
export function today(){
  const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",year:"numeric",month:"numeric",day:"numeric"}).formatToParts(new Date());
  const value=Object.fromEntries(parts.map(part=>[part.type,part.value]));
  return new Date(Number(value.year),Number(value.month)-1,Number(value.day),12);
}
export function fmtDate(d){return d?WEEKDAY[d.getDay()]+", "+MONTHS[d.getMonth()]+" "+d.getDate():""}
export function fmtShort(d){return d?WEEKDAY[d.getDay()].slice(0,3)+" "+d.getDate():""}
export function fmtCompactDate(d){return d?WEEKDAY[d.getDay()].slice(0,3)+", "+MONTHS[d.getMonth()].slice(0,3)+" "+d.getDate():""}
