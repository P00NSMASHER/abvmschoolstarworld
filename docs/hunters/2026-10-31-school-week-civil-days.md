# Source Hunters B: bare ISO school civil dates (2026-10-31)

## Provenance, ownership, and reproducible failure
- Canonical repository: `P00NSMASHER/abvmschoolstarworld`, default branch `main`, base commit `0175971fdfd0d06768566739aa583769b305ce42`.
- Exact pre-patch source: `scripts/school-week-label.mjs` blob `ab7319bbbebadf5bb05bcee3acae5e358d2f493b`; test blob `9f962c70cf08b63c8f929adf15a6f45f441219a5`.
- V8 baseline: `new Date('2026-10-19')` is `2026-10-19T00:00:00Z`, which renders as **Sunday October 18** in America/New_York. Thus `schoolWeekLabel('2026-10-19')` previously selected **Week of October 12** instead of **October 19**. Bare Saturday `2026-10-17` was classified as Friday in New York, suppressing the `calendarDisplay` upcoming-week rollover. `new Date('2026-02-30')` silently becomes March 2.
- This is a verified JavaScript runtime failure mode and a directly inspectable code path, **not** evidence of an observed teacher-feed production incident.
- Related main-branch ledger `docs/hunters/2026-10-31-school-week-instant-integrity.md` already fixed invalid input *types*. This PR addresses a distinct **ISO date-only meaning and invalid day** gap; no concurrent PR matching this target was found during the pull-request review.

## Repair and tests
- Interpret **only** exact bare ISO `YYYY-MM-DD` as a New York school-local civil day, using UTC midday as a calendar-preserving representative instant. A noon UTC anchor is within that same date in New York through DST transitions.
- Require the resulting UTC date to match the source string. Impossible bare dates are rejected instead of normalized.
- Full `YYYY-MM-DDTHH:mm:ssZ` or offset-bearing instants and numeric epochs retain their existing instant semantics. Public API, calendar feed, curriculum, published menus, package lock, workflow schedules and dependency graph are unchanged.
- New regression covers Monday, Saturday calendar-forward rollover, both DST transitions, invalid February and month-end dates, true leap-day and a full UTC timestamp control.
- Reproduce: `node --test tests/school-week-label.test.mjs`, then `npm run qa:static && npm run qa:unit && npm run qa:e2e`. Exact-head hosted CI required. Tests on initial code are expected to fail the Monday/week-label assertions; full project CI result must be read from GitHub separately.

## External source scan (evaluated, not imported)
| Candidate | Current license evidence | Suitability |
| --- | --- | --- |
| [js-joda/js-joda](https://github.com/js-joda/js-joda) | [BSD-3-Clause-style LICENSE](https://github.com/js-joda/js-joda/blob/main/LICENSE); active and unarchived 2026-10-31, upstream last push 2026-10-31 UTC | Strong calendar local-date types, but unnecessary additional package/lockfile and maintenance for a single narrow parsing boundary. |
| [moment/luxon](https://github.com/moment/luxon) | [MIT LICENSE](https://github.com/moment/luxon/blob/master/LICENSE.md); unarchived, last push 2026-08-09 UTC | Rich zone-aware time model but importing it would add code surface without improving this narrowly bounded contract. |

No third-party code copied, dependencies added, or transitive licenses introduced. No comprehensive external dependency CVE or benchmark claims. Rewritten logic is original native Date/Intl. No additional NOTICE requirements.

## Risk, measured delta and governance
- Baseline: 1 verified Monday wrong-week classification, 1 Saturday calendar rollover wrong-week classification, 1 nonexistent February-date acceptance.
- Expected post-change: those examples correct/rejected with all existing time-instant tests retained. Hosted exact-head automated CI is the acceptance gate; not yet a mobile-device acceptance or production release.
- Estimated debugging effort avoided: 0.5–2 engineering hours **if** this bug is reached (low confidence, scenario estimate only). No measured engineer-hours saved and no observed customer impact asserted.
- Existing draft homework, preview server, calendar, and reading/content PRs remain untouched. Portfolio Brain 12-hour governance/repair state is owner-controlled; no observations, variables, protected branches, trading scripts or schedules touched.
- Rollback: revert this focused feature PR; no migration, data, asset, or external-service side effects.
