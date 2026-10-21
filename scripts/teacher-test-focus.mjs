/** Determine the upcoming source-announced tests by Eastern school day.
 * Date interpretation stays with the existing validated teacher event parser.
 * Do not carry past test focus into a current study pack.
 */
/** A date on the teacher Tests page must match its stated weekday in
 * the current Eastern school year. An old or mistyped "Friday, Oct. 20"
 * must never appear as an upcoming test on Tuesday, October 20, 2026.
 * Validate the actual date; do not silently move the test to another day.
 */
export function teacherTestDateMatchesWeekday(item, timestamp) {
  if (!Number.isFinite(timestamp) || timestamp === Number.MAX_SAFE_INTEGER) return false;
  const label = String(item?.date || '');
  const weekday = label.match(/^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\b/i);
  const monthDay = label.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s*(\d{1,2})\b/i);
  if (!weekday || !monthDay) return false;
  const monthNumbers = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,sept:8,oct:9,nov:10,dec:11};
  const weekdays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const date = new Date(timestamp);
  return Number.isFinite(date.getTime()) &&
    date.getUTCDay() === weekdays.findIndex(day => day.toLowerCase() === weekday[1].toLowerCase()) &&
    date.getUTCMonth() === monthNumbers[monthDay[1].toLowerCase()] &&
    date.getUTCDate() === Number(monthDay[2]);
}

export function upcomingTeacherTests(tests, checkedAt, eventTimestamp) {
  const now = new Date(checkedAt);
  if (!Number.isFinite(now.getTime())) throw new Error('Invalid teacher source check timestamp');
  if (typeof eventTimestamp !== 'function') throw new Error('Teacher event timestamp parser required');
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now).map(part => [part.type, part.value]));
  const today = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
  return (Array.isArray(tests) ? tests : [])
    .map((item, index) => ({item, index, date: eventTimestamp(item)}))
    .filter(row => row.date >= today && teacherTestDateMatchesWeekday(row.item, row.date))
    .sort((a, b) => a.date - b.date || a.index - b.index)
    .map(row => row.item);
}
