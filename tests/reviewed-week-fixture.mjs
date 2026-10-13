// Test-only school clock: pins homework and checklist scenarios to the dated
// teacher evidence, NOT the independently refreshed lunch calendar week.
export function reviewedSchoolMonday(document) {
  const label=String(document?.pack?.weekLabel||'');
  const match=/^Week of ([A-Z][a-z]+) (\d{1,2}), (20\d{2})$/.exec(label);
  if(!match)throw new Error('School source has no dated reviewed teacher week');
  const date=new Date(`${match[1]} ${match[2]}, ${match[3]} 12:00:00 GMT`);
  if(Number.isNaN(date.getTime())||date.getUTCDay()!==1)
    throw new Error('Teacher review week must begin on Monday');
  const iso=date.toISOString().slice(0,10);
  if(Number(match[2])!==date.getUTCDate()||Number(match[3])!==date.getUTCFullYear())
    throw new Error('Invalid teacher review date');
  return iso;
}
