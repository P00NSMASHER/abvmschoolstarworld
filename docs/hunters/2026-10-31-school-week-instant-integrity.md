# Source Hunters B: school-week instant provenance | 2026-10-31

## Source / reproducible defect
- Canonical target: `P00NSMASHER/abvmschoolstarworld`, `scripts/school-week-label.mjs`, main source blob `e9ca7f093850bf027c3a706a5d529cb10bb8e3a9`. Tests source blob `4e5e1cccd231d9f33b4939734c5f1c51d9f5c8bc`.
- Before: `new Date(null)`, `new Date(false)`, and `new Date([])` implicitly become 1970-01-01 UTC, so both calendar and lunch-coverage calls can silently select the New York week beginning **1969-12-29** instead of rejecting a missing/invalid timestamp. This is a verified JavaScript/V8 coercion; occurrence in production inputs is **not established**.
- Patch: reject unsupported input types before `new Date(at)`, maintaining valid ISO strings, numeric epoch milliseconds, and `Date` objects. The existing invalid-date guard remains in place. No publication, source feeds, school data, schedules, app UI, or deployments are changed.
- Regression tests: reject null, false, true, array and object inputs in both `schoolWeekLabel` and `displayedSchoolWeekDates`; preserve ISO string / Date object / numeric timestamp equivalence. Run `node --test tests/school-week-label.test.mjs` and full `npm run qa`/hosted CI.
- Local standalone Node 22 before/after reproduction on matching week calculation: null and false map to 1969-12-29 before, reject afterward; valid 2026-10-31T18:00:00Z maps to 2026-10-26 in both versions. Hosted exact-head test status is a separate release gate.

## External source candidates / license decision
- [js-joda/js-joda](https://github.com/js-joda/js-joda), [BSD-3-Clause LICENSE](https://github.com/js-joda/js-joda/blob/main/LICENSE), reviewed license blob `15646764b217179bdbb56efc4ecc9ac3535cbd67`, package license `BSD-3-Clause`: robust typed date API but new dependency would add transitive review and unnecessary bundle changes.
- [moment/luxon](https://github.com/moment/luxon), [MIT LICENSE](https://github.com/moment/luxon/blob/master/LICENSE.md), reviewed license blob `2d560a6433eb68f3b1277d58a819ce56a01f9dd5`: strong zone/date abstractions but unnecessary for this untrusted argument shape boundary.
- Neither candidate copied or installed. Native JavaScript type-check is simpler, keeps lockfile and release assets unchanged, and introduces no third-party advisory, attribution, NOTICE, network, or telemetry obligations. Both repositories accessible and not archived when checked; no comprehensive upstream dependency-vulnerability audit claimed.

## Risk, evidence and rollback
- Before: 3 independently reproduced malformed inputs silently selected a historical week; after: fail-closed `TypeError`. Positive control and existing week-label behavior preserved.
- Baseline and post-patch production incident counts: **unavailable**. Engineering-hours avoided: hypothetical **0.25–1 hour** of diagnosis if such an incident otherwise occurred, **low confidence, not measured savings**.
- GitHub PR: add link after opening; full CI is required. Rollback: revert this focused PR; no migration. Do not change other ABVM task ownership, student records, Portfolio Brain observation, or workflow schedules.
