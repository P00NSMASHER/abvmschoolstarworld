/**
 * Honor a specifically recorded, source-backed Grade 2 calendar correction.
 * The undated teacher Home list cannot override a newer, reviewed dated
 * planner for the SAME event; ordering deadlines and separate events survive.
 */
const eventPatterns=Object.freeze({
  'chick-fil-a-delivery': /chick[\s-]*fil[\s-]*a.*(?:deliver\w*|pick[\s-]*up)/i,
  'lego-club': /\blego club\b/i,
  'term-progress-reports': /\bprogress reports?\b/i,
});

const monthIndexes=Object.freeze({jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,sept:8,oct:9,nov:10,dec:11});
const DAY_MS=86400000;

function reviewedCivilDate(value) {
  const literal=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(literal) {
    const year=Number(literal[1]),month=Number(literal[2])-1,day=Number(literal[3]);
    const date=new Date(Date.UTC(year,month,day));
    return date.getUTCFullYear()===year&&date.getUTCMonth()===month&&date.getUTCDate()===day
      ? {year,month,day}:null;
  }
  const instant=new Date(value);
  if(!Number.isFinite(instant.getTime()))return null;
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{
    timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(instant).map(part=>[part.type,part.value]));
  return {year:Number(parts.year),month:Number(parts.month)-1,day:Number(parts.day)};
}

function schoolDayTime(value,anchor) {
  const match=String(value||'').match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s*(\d{1,2})\b/i);
  if(!match||!anchor)return null;
  const month=monthIndexes[match[1].toLowerCase()];
  const day=Number(match[2]);
  if(month===undefined||day<1||day>31)return null;
  const anchorTime=Date.UTC(anchor.year,anchor.month,anchor.day);
  const candidates=[anchor.year-1,anchor.year,anchor.year+1]
    .map(year=>Date.UTC(year,month,day))
    .filter(millis=>{
      const date=new Date(millis);
      return date.getUTCMonth()===month&&date.getUTCDate()===day;
    });
  if(!candidates.length)return null;
  return candidates.sort((a,b)=>Math.abs(a-anchorTime)-Math.abs(b-anchorTime))[0];
}

export function supersededByReviewedPlanner(row,uploaded) {
  if(row?.source!=='teacher-home'||!uploaded?.sourcePrecedence?.authoritativeCurrentDocument)return false;
  const id=uploaded.sourcePrecedence.authoritativeCurrentDocument;
  const authority=(uploaded.documents||[]).find(doc=>doc?.id===id);
  if(authority?.review?.status!=='reviewed'||!authority.review?.reviewedBy)return false;
  const anchor=reviewedCivilDate(authority.review.reviewedAt);
  if(!anchor)return false;
  const currentDay=schoolDayTime(row.date,anchor);
  if(currentDay===null)return false;
  const authoritativeRows=(uploaded.importantDates||[]).filter(item=>item.sourceDocument===id);
  for(const correction of uploaded.replacements||[]) {
    const sameEvent=eventPatterns[correction?.topic];
    if(!sameEvent||!sameEvent.test(String(row.label||'')))continue;
    const approvedDay=schoolDayTime(correction.date,anchor);
    if(approvedDay===null||approvedDay===currentDay||Math.abs(approvedDay-currentDay)>14*DAY_MS)continue;
    if(authoritativeRows.some(item=>sameEvent.test(String(item.label||''))&&schoolDayTime(item.date,anchor)===approvedDay)) {
      return true;
    }
  }
  return false;
}
