/** Determine the upcoming source-announced tests by Eastern school day.
 * Date interpretation stays with the existing validated teacher event parser.
 * Do not carry past test focus into a current study pack.
 */
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
    .filter(row => Number.isFinite(row.date) && row.date !== Number.MAX_SAFE_INTEGER && row.date >= today)
    .sort((a, b) => a.date - b.date || a.index - b.index)
    .map(row => row.item);
}
