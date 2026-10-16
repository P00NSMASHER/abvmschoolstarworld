const months={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
const month='(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\\.?';
const rangePattern=new RegExp('\\b'+month+'\\s*(\\d{1,2})(?:\\s*[–-]\\s*(?:'+month+'\\s*)?(\\d{1,2}))?(?:,?\\s*(20\\d{2}))?','i');
function includesDate(text,date){
  const value=String(text||'');
  const iso=value.match(/\b(20\d{2}-\d{2}-\d{2})\b/g);
  if(iso?.length)return date>=iso[0]&&date<=iso.at(-1);
  const match=value.match(rangePattern);
  if(!match)return false;
  const startMonth=months[match[1].slice(0,3).toLowerCase()],endMonth=match[3]?months[match[3].slice(0,3).toLowerCase()]:startMonth;
  const target=Date.parse(date+'T12:00:00Z'),year=Number(date.slice(0,4));
  const years=match[5]?[Number(match[5])]:[year-1,year];
  return years.some(startYear=>{
    const start=Date.UTC(startYear,startMonth,Number(match[2]),12);
    const end=Date.UTC(startYear+(endMonth<startMonth?1:0),endMonth,Number(match[4]||match[2]),12);
    return target>=start&&target<=end;
  });
}
// Independent release expectation: verified school closures override district
// catering menus, just as they must on Today, Week and Calendar.
export function publishedMealForDate(pack, date) {
  const meal=[...(pack.lunchArchive || []), ...(pack.lunchMenu || [])]
    .findLast(meal => meal.date === date);
  const closure=(pack.importantDates||[]).find(row=>
    (/holiday|closed/i.test(row.kind||'')||/no school|closed/i.test(row.label||''))&&includesDate(row.date,date));
  return closure?{...meal,date,status:'no-school',items:[],closure:closure.label}:meal;
}
