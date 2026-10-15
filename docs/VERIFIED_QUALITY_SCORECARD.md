# Verified quality scorecard

Updated: 2026-10-15. Historical baseline: 6/10; no new overall score established yet. Passing code checks alone cannot earn 10/10.

## Scoring

Each of the ten domains has five binary requirements below, worth two points each. A requirement earns points only when its evidence is linked to the exact release or observed production cycle. Unknown and unverified requirements earn zero verified points, without implying a diagnosed defect. Overall score is total verified points divided by ten. All requirements, no unresolved critical defects, and the observation window are mandatory for 10/10. Never infer visual acceptance from passing browser tests.

| Domain | Five independently verifiable requirements |
| --- | --- |
| Deployment | Exact protected-main admission; full release QA; successful Pages publish; live curriculum/homework timestamp and hash parity; three consecutive successful update/publication cycles over at least 24 hours |
| Source automation | Six official pages verified; hourly homework scheduler enabled; unchanged checks retain truthful provenance; no manual curriculum promotion; source failure recovers within bounded policy |
| Recovery and monitoring | Success does not exhaust failure budget; at most two unsuccessful dispatches/day; active refresh prevents duplicates; stale homework fails dashboard; live source mismatch is detected and subsequently clears after real publication |
| Daily planning | Today uses correct Eastern school date; old undated homework does not roll forward; Week includes five lunch states; latest authoritative event precedence passes; notifications remain accurate and dismissible |
| Calendar and navigation | Month/week switching works; deep links preserve route; selected-day details match governed data; keyboard/focus works; phone/tablet/desktop rendered review passes |
| Study and progress | Current/recent/cumulative fallback correct; strict test mapping fails closed; scoring/hints/retries verified; cumulative progress survives reload; offline practice retains truthful source state |
| Print materials | Every verified upcoming test has guide and worksheet or explicit source gap; complete supported topic coverage; checked answer key; readable illustrated print layout; print opens/closes without trapping app |
| Curriculum accuracy | Upcoming test dates match current official source; source-backed words/topics match; every generated question has lineage; no invented passage/definition content; unsupported or insufficient coverage is explicit |
| Responsive accessibility | iPhone WebKit core flows; iPad portrait/landscape; desktop core flows; no serious/critical accessibility violations; 200% text/reduced-motion/44px controls verified |
| Resilience and privacy | Offline update/recovery works; cache invalidation verified; performance regression thresholds pass; public-data privacy/security gates pass; no unhandled core-flow errors |

## Current evidence and continuation checkpoint

- PR #369 merged at 8b305393219c4ebb4c1fe1942b9df3fc5e148683 after exact-head App QA 38809333423 and independent reproduction 38809332953 succeeded. Fifteen focused homework/recovery tests passed locally.
- Homework workflow 38822953862 successfully fetched and committed checkedAt 2026-10-15T23:20:20.011Z. Its gated Pages publication is pending verification; do not claim live homework parity until checked.
- Six-page curriculum checkedAt 2026-10-15T22:41:19.043Z matched live production in direct check-refresh-health verification during this execution.
- PR #370 fixes the observed daily recovery-budget failure in run 38821090531. Three dispatcher regressions pass and its branch has 566 passing unit tests. Hosted App QA 38823089703 and independent reproduction 38823089873 must pass before merge.
- This branch adds stale-homework dashboard gating, using the same eight-hour/Eastern-date policy as recovery. It has 565 passing unit tests, including a complete dashboard fresh-versus-stale integration test; static QA passed.
- Local browser installation failed because the browser download was truncated. Hosted Chromium/WebKit QA is the browser acceptance authority for these candidates; no local browser pass is claimed.
- Do not merge while an active exact-main Pages release is still validating: advancing main can correctly invalidate its admission and require another release.

Next actions: finish the current homework release and verify live homework parity; merge #370 only after exact-head checks pass; verify a real recovery run after merge without bypassing its budget; validate and merge the dashboard change through protected workflow; inspect the next actual UI/print/offline defect and collect rendered phone/tablet evidence. Reassess all domains and accumulate three successful cycles across 24 hours before considering 10/10. Preserve the existing active PRs and do not duplicate completed fixes.
