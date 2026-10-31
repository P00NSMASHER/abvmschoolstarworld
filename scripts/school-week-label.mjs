// Eastern-time school-week labels and forward lunch coverage.
// Keep a teacher posting's check-week distinct from the Calendar's weekend rollover.
const easternParts=new Intl.DateTimeFormat('en-US',{
  timeZone:'America/New_York',year:'numeric',month:'numeric',day:'numeric',
});
const dateLabel=new Intl.DateTimeFormat('en-US',{
  timeZone:'UTC',year:'numeric',month:'long',day:'numeric',
});
const closureDateLabel=new Intl.DateTimeFormat('en-US',{
  timeZone:'UTC',weekday:'long',month:'short',day:'numeric',
});
const isoDate=date=>date.toISOString().slice(0,10);
const canonical=value=>String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();

export function schoolWeekStart(at,{calendarDisplay=false}={}){
  // Date(null), Date(false) and Date([]) all silently become the Unix epoch.
  // Only explicit date/time inputs may select a school week.
  if(!(typeof at==='string'||typeof at==='number'||at instanceof Date))
    throw new TypeError('Invalid school-week instant');
  const instant=new Date(at);
  if(Number.isNaN(instant.getTime()))throw new TypeError('Invalid school-week instant');
  const parts=Object.fromEntries(easternParts.formatToParts(instant).map(part=>[part.type,part.value]));
  const localDay=new Date(Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day),12));
  const weekday=localDay.getUTCDay();
  // Calendar shows the upcoming Monday-Friday when opened on Saturday or Sunday.
  const advance=calendarDisplay&&(weekday===0||weekday===6)?7:0;
  localDay.setUTCDate(localDay.getUTCDate()-((weekday+6)%7)+advance);
  return localDay;
}

export function schoolWeekLabel(at,options={}){
  return 'Week of '+dateLabel.format(schoolWeekStart(at,options));
}

export function displayedSchoolWeekDates(at){
  const monday=schoolWeekStart(at,{calendarDisplay:true});
  return Array.from({length:5},(_,index)=>{
    const date=new Date(monday);
    date.setUTCDate(date.getUTCDate()+index);
    return isoDate(date);
  });
}

// The "current-week" lunch array can be last week on weekends; archived,
// independently reviewed entries must count toward next week's coverage.
export function assessUpcomingLunchCoverage(pack,at){
  const dates=displayedSchoolWeekDates(at);
  // A malformed or partial source pack must not crash the forward-coverage
  // health check or turn an unverified closure into a published lunch day.
  const sourceRows=value=>Array.isArray(value)?value:[];
  const menus=[...sourceRows(pack?.lunchMenu),...sourceRows(pack?.lunchArchive)];
  const importantDates=sourceRows(pack?.importantDates);
  const publishedDates=new Set(menus.map(row=>row?.date).filter(date=>/^\d{4}-\d{2}-\d{2}$/.test(date)));
  const closures=new Set();
  for(const date of dates){
    const display=canonical(closureDateLabel.format(new Date(date+'T12:00:00Z')));
    if(importantDates.some(event=>
      /\bno school\b|\bschool closed\b/i.test(String(event?.label||''))&&
      (event?.date===date||canonical(event?.date)===display)
    ))closures.add(date);
  }
  return {
    weekLabel:'Week of '+dateLabel.format(new Date(dates[0]+'T12:00:00Z')),
    dates,
    missingDates:dates.filter(date=>!publishedDates.has(date)&&!closures.has(date)),
    noSchoolDates:[...closures],
  };
}

// Preserve an undated teacher posting's observed week across unchanged scans.
// Only changed source content may acquire a new week; calendar rollover is not proof.
export function preservedPostingWeek({observedWeek,previousWeek,previousFingerprint,currentFingerprint}){
  const validWeek=value=>/^Week of [A-Za-z]+ \d{1,2}, \d{4}$/.test(String(value||''));
  if(!validWeek(observedWeek))throw new TypeError('Invalid observed posting week');
  const same=typeof currentFingerprint==='string'&&currentFingerprint.length>0&&previousFingerprint===currentFingerprint;
  return same&&validWeek(previousWeek)?previousWeek:observedWeek;
}
