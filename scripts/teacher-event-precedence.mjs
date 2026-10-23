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
const REFERENCE_YEAR=2000;
const REFERENCE_YEAR_DAYS=366;
function schoolDayOrdinal(value) {
  const match=String(value||'').match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s*(\d{1,2})\b/i);
  if(!match)return null;
  const month=monthIndexes[match[1].toLowerCase()];
  const day=Number(match[2]);
  if(month===undefined||day<1||day>31)return null;
  // The teacher/planner strings intentionally omit a year. Compare their
  // source-provided month/day values on a leap-safe reference calendar rather
  // than pinning them to one school year. This keeps Dec→Jan corrections local.
  const millis=Date.UTC(REFERENCE_YEAR,month,day);
  const date=new Date(millis);
  if(date.getUTCMonth()!==month||date.getUTCDate()!==day)return null;
  return Math.floor((millis-Date.UTC(REFERENCE_YEAR,0,1))/86400000);
}
function schoolDayDistance(left,right) {
  const difference=Math.abs(left-right);
  return Math.min(difference,REFERENCE_YEAR_DAYS-difference);
}
export function supersededByReviewedPlanner(row,uploaded) {
  if(row?.source!=='teacher-home'||!uploaded?.sourcePrecedence?.authoritativeCurrentDocument)return false;
  const id=uploaded.sourcePrecedence.authoritativeCurrentDocument;
  const authority=(uploaded.documents||[]).find(doc=>doc?.id===id);
  if(authority?.review?.status!=='reviewed'||!authority.review?.reviewedBy)return false;
  const currentDay=schoolDayOrdinal(row.date);
  if(currentDay===null)return false;
  const authoritativeRows=(uploaded.importantDates||[]).filter(item=>item.sourceDocument===id);
  for(const correction of uploaded.replacements||[]) {
    const sameEvent=eventPatterns[correction?.topic];
    if(!sameEvent||!sameEvent.test(String(row.label||'')))continue;
    const approvedDay=schoolDayOrdinal(correction.date);
    if(approvedDay===null||approvedDay===currentDay||schoolDayDistance(approvedDay,currentDay)>14)continue;
    if(authoritativeRows.some(item=>sameEvent.test(String(item.label||''))&&schoolDayOrdinal(item.date)===approvedDay)) {
      return true;
    }
  }
  return false;
}
