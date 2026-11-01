# Source Hunters B | source-calendar civil-day validation | 2026-10-31

## Scope and coordination
Repository: `P00NSMASHER/abvmschoolstarworld`, `pages/app.js`, isolated Hunter B branch `hunters/calendar-event-civil-date-validation-20261031`. The prior #443 Study date-integrity work guards **Study Model** but does not validate the separate descriptive calendar parser used by `eventDateRange`, important dates, family notices, and month/week calendar. Current source/teacher data and calendar view structure are unchanged. Portfolio Brain observation and trading execution remain untouched.

## Reproduced defect and risk
Original `parseDate('Feb 30')` constructed `new Date(2027, 1, 30, 12)`, which JavaScript normalized to **March 2, 2027**. `eventDateRange('Oct 30–Oct 1')` returned a reversed interval, and a ranged end like `Nov 31` normalized into December 1. These are synthetic negative controls, **not evidence of erroneous live school postings**. The failure could silently manufacture false calendar timing from malformed source text.

The patch validates each local civil day against its specific month/year (including leap years), rejects reversed same-month intervals, and preserves the existing school-year boundary and public calendar UI. No data records, schemas, source hash, publication workflows, paid services, or dependencies changed.

## Open-source candidate evaluation (reviewed 2026-10-31)
1. [date-fns/date-fns](https://github.com/date-fns/date-fns), MIT license at `pkgs/core/LICENSE.md`, active upstream repository (pushed 2026-10-26). Full library useful for extensive calendar/date manipulation, unjustified for two native day-boundary guards.
2. [moment/luxon](https://github.com/moment/luxon), MIT license at `LICENSE.md`, package version 3.7.2, active upstream (pushed 2026-08-09). Date/time-zone utilities likewise add bundle size and dependency audit surface without solving the source-integrity policy by themselves.

**Decision:** Write two dependency-free browser-native boundary checks; import no external code. No transitive packages, lockfile, license/NOTICE, or telemetry changes. Neither unimported candidate is represented as dependency-vulnerability-cleared. Review each upstream commit and advisory state before any future adoption.

## Verification and costs
Run `node --test tests/app-calendar-source-dates.test.mjs` then the existing `npm run qa` exact-head GitHub QA and independent browser checks. Three test groups cover invalid month days, leap years, December/January, valid ranges and reverse/overflow bounds. Before: invalid days rolled forward; after: excluded as unverifiable. Hosted CI and production release must be evaluated separately. No observed live incident, user-time reduction, or measured deployment outcome has been established.

Estimated integration/review effort avoided vs adding a full date package: **0.5–2 engineer-hours, low confidence**; this is a reasoned planning estimate, not measured labor savings.

## Rollback and next checks
Revert this single isolated PR if downstream parsing expectations differ; there is no migration or release configuration to undo. Next: audit the live public-source normalizer for impossible descriptive dates and ensure event-date source provenance remains intact. Do not merge until all actual exact-head required tests pass and existing owner-authorized release governance is followed.
