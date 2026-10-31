# Hunter Core Engineering source evaluation | 2026-10-31

## Scope and ownership
- Hunter B's bounded target: ABVM Grade 2 Study archive history, `P00NSMASHER/abvmschoolstarworld`, not teacher announcements or the ongoing lesson-generator PRs #434 and #436.
- Hunter A inspected `P00NSMASHER/portfolio-brain` and `P00NSMASHER/trading-platform`. Portfolio Brain's observation controls are owned by its separate active automation and must not be changed here; trading has active research and dependency PRs. Neither repo was modified.
- `P00NSMASHER/StarBlox` has numerous active school/game PRs; leave their ownership unchanged.

## Reproducible bug and selected change
Before this patch, `visibleArchive` throws `TypeError: Invalid study date` on an archived row with an invalid `firstSeenAt`. `weeklyArchive` independently throws on invalid provenance timestamps or non-array provenance. A malformed historical entry can interrupt other valid Study records.

The change isolates malformed historical items, rejects impossible date-only strings such as `2026-02-31`, preserves all independently valid records and maintains failure on an invalid *current viewing date*. No source data, verified test dates, learning progress, cache schema, scheduling, deployment settings, or external dependencies change.

Added regression tests in `tests/study-model.test.mjs` for valid/invalid mixed records, malformed provenance, null/incorrect category shapes, impossible civil dates, future records and invalid view dates. Isolated V8 JavaScript preflight passed these cases and sampled the existing DST, weekday dismissal and sampling contracts. Full Node/Playwright CI is required before merge.

## Public GitHub candidates evaluated
1. [date-fns/date-fns](https://github.com/date-fns/date-fns) | package `pkgs/core` v4.4.0, [MIT LICENSE](https://github.com/date-fns/date-fns/blob/main/pkgs/core/LICENSE.md), latest examined commit `a9739fb3e5384a810e90d7376446f6d84ecc5029` (2026-10-23). Useful for extensive date manipulation, excessive for a no-dependency archived-row guard.
2. [moment/luxon](https://github.com/moment/luxon) | v3.7.2, [MIT LICENSE](https://github.com/moment/luxon/blob/master/LICENSE.md), latest examined commit `f427515a38f6a671f8de663e6bcc040ed81f114e` (2026-08-09). Full timezone/date parsing toolkit, unnecessary bundle/dependency weight for this issue.

**Decision:** Retain native `Intl.DateTimeFormat` and add a small independently written guard. No third-party code was imported, therefore no new runtime license, transitive advisory, lockfile or NOTICE obligations. The two repositories were considered, not adopted; do not represent this as an external-code integration.

## Impact and gates
- Confirmed: three classes of before-fix exceptions replaced by isolated fail-closed handling; deterministic local scenarios verify valid history survives.
- Actual CI, phone/offline/browser and production publication status: **not established until exact-head GitHub checks and release parity complete**.
- Estimated engineering time saved if this prevents a real corrupted-history incident: 1–3 hours of diagnosis/regression work. This is a *speculative estimate*, not observed savings.
- Rollback: revert the focused PR; no state migration or third-party dependency to unwind.

## Follow-up
1. Confirm exact-head App QA and independent reproduction, fix any new failures before merging.
2. Keep unrelated #434/#436, live school data, protected branch policies and Portfolio Brain observation authority untouched.
3. On the next Hunter A cycle, investigate a reproducible shared-HTTP rate-limit or evidence-digest defect in trading infrastructure only after consulting its current PR owners; compare candidates and implement only if nonduplicative.

## Exact-head CI regression triage
- Initial candidate head `06b5d1c6bef71c32d859632d4620dae58a3e78b3` failed [App QA](https://github.com/P00NSMASHER/abvmschoolstarworld/actions/runs/41194472103) and [independent reproduction](https://github.com/P00NSMASHER/abvmschoolstarworld/actions/runs/41194472102) in the same two existing operational-health fixture cases. The new Study archive test did **not** fail.
- Source-specific cause: the synthetic health tests set the published `lunchMenuSource.weekStart/weekEnd` to `displayedSchoolWeekDates(now)`. On Saturdays and Sundays, this is **next** week's classroom planning dates; the real dashboard correctly validates the published **current** week using `schoolWeek(new Date(now))`. Consequently the simulated supposedly healthy publication failed with exit 1. Future school-week archive coverage remains legitimately next-week-facing.
- Repaired only two fixture assignments in `tests/health-evidence.test.mjs` and `tests/refresh-stage-health.test.mjs` to use the existing actual `schoolWeek` published-week rule, while preserving `displayedSchoolWeekDates` for the future archive. No production dashboard state rules or reliability gates were relaxed.
- New exact-head CI, independent reproduction, visual/offline smoke checks and eventual guarded publication must be independently assessed before merge or acceptance.
