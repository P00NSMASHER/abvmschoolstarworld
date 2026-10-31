# Source Hunter B | civil-date integrity | 2026-10-31

## Baseline defect and narrowly scoped fix

Authoritative repository: `P00NSMASHER/abvmschoolstarworld`, default `main`, read on 2026-10-31. Latest open owners checked: #436 (curriculum), #442 (PWA cache), #434 (Homework). This repair does **not** touch their files, the source-refresh scheduler, live app state, child records, or protected release behavior.

Before the patch, `schoolDay('2026-02-30')` returned the impossible date unchanged. `weekBounds()` could silently normalize it; `nextTests()` accepted impossible date-only entries and could display them ahead of verified tests. Baseline reproducer (Node 22): a date-only regex accepted `2026-02-29`, `2026-02-30`, `2026-04-31`, and `2026-13-01` despite those dates not existing.

The patch applies one shared strict YYYY-MM-DD round-trip at UTC noon to date-only school-day inputs, future assessment filtering and existing historical-archive validation. Invalid date-only inputs fail closed or are excluded from malformed event collections. Existing UTC-instant conversion, timezone choice, 3pm Eastern dismissal and regular archived instant treatment are unchanged.

## Upstream source scan (two verified licenses, no code imported)

1. [moment/luxon](https://github.com/moment/luxon), inspected at upstream commit `f427515a38f6a671f8de663e6bcc040ed81f114e` (2026-08-09). [MIT LICENSE](https://github.com/moment/luxon/blob/master/LICENSE.md), blob `2d560a6433eb68f3b1277d58a819ce56a01f9dd5`; package `3.7.2` reviewed. Full datetime dependency adds unnecessary browser bytes and lockfile risk for a single civil-day guard.
2. [js-temporal/temporal-polyfill](https://github.com/js-temporal/temporal-polyfill), inspected at upstream commit `c55b211de913320d8aba32c456bb45914739f414` (2026-09-22). [ISC LICENSE](https://github.com/js-temporal/temporal-polyfill/blob/main/LICENSE), blob `75c4ded485dee91270b2c06a75ed12e4b560fb85`; package `0.5.1` includes runtime `jsbi ^4.3.0`. Comprehensive Temporal semantics are valuable but not justified for this isolated compatibility fix.

**Decision:** independent minimal implementation using existing browser APIs; no upstream code or new dependency, hence no copied-code NOTICE or transitive dependency chain. The already-shipped archive round-trip rule is consolidated, not replaced with external source.

## Reproducible validation

Run `node --test tests/study-civil-dates.test.mjs tests/study-model.test.mjs` and standard `npm run qa` in the PR exact-head CI. Added independent adversarial checks for impossible leap days, 30/31 overflows, null/malformed rows, DST, valid centuries, earliest verified test selection, archive history and 3pm school dismissal preserved by existing tests.

Baseline observed: four impossible date-only strings were accepted (synthetic test values; not real school postings). Expected post-patch: every one is rejected or skipped. **No production deployment or field observation is implied.** No course data or test facts altered.

## Engineering economics, limitations, rollback

Zero new runtime dependencies. Estimated **1–3 engineering hours avoided** relative to integrating and auditing a new date dependency; low-confidence planning estimate, not measured labor hours or commercial value. Main risk: any out-of-policy invalid YYYY-MM-DD input previously passed through will now be rejected, intentionally fail-closed. JavaScript timestamp strings containing an invalid civil component are not comprehensively validated by this patch; those should be separately governed at the source-ingestion boundary.

Rollback: revert this isolated PR; no schema, offline cache version, data or migration changes.

## Next ranked investigations

1. Independently verify full release QA and browser/mobile tests after PR head advances; merge only if exact-head protection and owner standing release policy permit.
2. Review upstream Homework event-date ingestion for strict invalid timestamp normalization, with separate repo-owner coordination. Do not weaken source checks.
3. Hunter A: continue trading-platform reproducibility research through its existing Tradier/Golden Goose PR owners; **do not** merge or modify Portfolio Brain's paused 12-hour observation baseline.

## Follow-on source-scope regression, same PR (2026-10-31)

A second baseline defect remained in `pages/study-notes-scope.mjs`: `explicitlyInWeek` required only a valid-looking date plus finite `Date.parse`, and `weeklySourceNotes` used only a date-shaped regex. Node 22 normalizes synthetic `2026-02-30T12:00:00Z` into March 2 instead of rejecting it; its unnormalized text sorts inside the February 23–March 1 school week. That could promote an impossible dated note or invented test to current-week source evidence.

Repair shares the existing `validCivilDay` function from Study Model (export only, no behavioral change to existing callers), and uses it in both evidence gates. Also excludes malformed event rows without throwing. The dedicated `tests/study-weekly-scope-civil-dates.test.mjs` checks February 29/30 rejection, a conflicting explicit week, valid same-week dates, malformed rows, and valid assessment selection. All fixture names are synthetic. Expected baseline: invalid `studiedOn` and invalid test-date entries are accepted; expected fixed behavior: neither can select weekly material. Exact-head hosted CI remains authoritative; do not treat this note as confirmation of passing CI.

Upstream dependency comparison and no-import/no-notice decision remain as documented above. No new dependencies or child data. Estimated incremental engineering effort avoided: 0.5–1.5 hours versus a separate validator and its review, low confidence. Rollback the whole date-integrity PR if necessary, preserving preexisting upstream owner branches.

## Third follow-on: impossible ISO timestamps fail closed (2026-10-31)

**Reproduced before patch:** Node 22 parses `new Date('2026-02-30T12:00:00Z')` as `2026-03-02T12:00:00.000Z`. The prior date-only guard did not inspect date components in ISO timestamps, so a malformed archive `firstSeenAt` could enter historical Study evidence under the wrong day. This does not claim any actual school source contained that timestamp.

**Patch:** `schoolDay` checks strict YYYY-MM-DD calendar components whenever input is a date-only string or begins with an ISO-like date-time prefix, before native Date timezone conversion. The existing `validCivilDay` round-trip supplies the exact rejection rule. Downstream archive validation automatically inherits it. Five malformed instant variants and preserved valid leap-day/New York DST controls are tested. No new dependency, collected student data, public calendar fact or deployment.

**Independence and outside code:** Prior exact-commit Luxon (MIT) and Temporal-polyfill (ISC) comparisons still govern. A fresh Day.js comparison (MIT, `iamkun/dayjs`, upstream dev SHA `436bde0bcded312781cbe45dc2b0ef079a36d8e3`, inspected 2026-10-31) likewise favors this minimal native-code adaptation over adding a full browser date library. No upstream code copied, NOTICE or lockfile change. Security advisories for unimported candidates are not construed as a verified clean bill of health.

**Proof:** Baseline native parser normalized impossible February 30; new `tests/study-civil-dates.test.mjs` asserts all five impossible timestamp inputs throw, a bad archive record is excluded, and correct leap-day/DST inputs retain the established contract. Hosted exact-head QA, independent reproduction and guarded Pages publish remain separate required gates; passing synthetic regression does not prove live device acceptance.

**Economics / rollback:** Estimated incremental 0.5–1.0 engineering hours avoided (low confidence, rough integration-and-retest effort relative to adopting a date package, not tracked labor). Revert this follow-on commit if timestamp-source policy changes; previous date-only and weekly evidence protections remain separately traceable in this PR.
