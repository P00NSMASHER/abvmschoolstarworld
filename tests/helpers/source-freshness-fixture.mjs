const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

/**
 * Keep a teacher source check within the app's 8–30-hour stale-warning band,
 * while making its Eastern school date distinct from a freshly imported notice.
 * A 27-hour gap handles the longest (25-hour) daylight-saving civil day.
 */
export function olderTeacherCheckWithNewNotice(now = Date.now()) {
  if (!Number.isFinite(now)) throw new TypeError('Expected a finite millisecond timestamp');
  return {
    checkedAt: new Date(now - 27 * HOUR_MS).toISOString(),
    noticeAt: new Date(now - MINUTE_MS).toISOString(),
  };
}
