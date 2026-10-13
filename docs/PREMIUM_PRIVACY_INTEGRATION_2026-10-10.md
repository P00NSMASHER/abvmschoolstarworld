# ABVM premium release — main privacy integration review (2026-10-10)

## Exact inputs (do not reinterpret historical approvals)

- Latest checked public production `main`: `7cdc2047855ccf5b849e8e8d67e765164864a583`.
- Fully tested, unmerged premium Calendar candidate: `7ab1dc38d7967311857215168bd4f90c65f70507`, draft PR #293, 10/10 exact-head automated PASS, including full QA, independent reproduction, source parity, mobile WebKit and public-privacy suites.
- Previous common-base main: `996d4d192d16baef72897736b9daec49b32751ee`.
- Production main has nine privacy/freshness hardening commits since that common base. No school curriculum, teacher-pack, source clock, lunch or uploaded worksheet files were changed by those nine commits.

## Reconciliation policy

This **draft-only** integration has the reviewed premium candidate tree as the starting point, with both that candidate and current `main` recorded as merge parents. Main-privacy behavior was compared against the candidate before combining commit histories. No conflict is resolved by deleting main's privacy safeguards, and the protected school sources and 14-entry offline shell are preserved.

Of the 13 paths changed by those nine main commits, four are byte-identical in the premium candidate:

1. `docs/PUBLIC_LEARNER_PRIVACY.md`
2. `pages/study-games-view.js`
3. `tests/public-learner-privacy.spec.mjs`
4. `tests/study-games-async-materials.spec.mjs`

The nine remaining paths have reviewed premium-specific differences and must pass exact-head tests, not be assumed safe solely from this document:

| Production privacy path | Premium candidate reconciliation |
| --- | --- |
| `.github/workflows/public-privacy-visual-acceptance.yml` | Preserves the read-only privacy gate, source-age check and mobile Chromium/WebKit checks; separates output directories for independent artifacts. |
| `pages/app.js` | Retains anonymous “Let’s learn, eagle!” and v15 anonymous finish-view binding; adds reviewed premium Calendar date handling. |
| `pages/index.html` | Retains the existing mobile meta and PWA setup, advancing script and reload revisions in sync with premium assets. |
| `pages/product-view.js` | Retains “Ready for today?”, “STUDY RANK” and “STUDY RANK JOURNEY”, plus practice-not-grade explanation; adds visually reviewed premium presentation and accessible busy-day lists. |
| `pages/sw.js` | Preserves the 14-entry shell and v15 study-games view while advancing paired cache and asset versions. |
| `playwright.config.mjs` | Keeps public-learner privacy in the iPhone WebKit project and adds premium screen visual suites. |
| `tests/app.spec.mjs` | Keeps the independently intercepted Yahoo/teacher-freshness fixture and original assertions, plus newer semantic month-summary checks. |
| `tests/gold-standard.spec.mjs` | Keeps non-identifying Study greeting assertions, plus selected-month preservation regressions. |
| `tests/public-learner-privacy.test.mjs` | Keeps anonymous greeting, rank-label and practice-finish checks; uses stricter paired script/cache revision checks without hardcoding older versions. |

## Release gates (all independent and mandatory)

- [ ] Verify current `main` SHA remains the second parent; reconcile any further changes separately.
- [ ] Authoritative, read-only source-parity workflow must run on this exact integration head and compare protected school sources to latest main.
- [ ] Full ABVM App QA, independent reproduction, Calendar mobile/WebKit, all other premium visual QA and anonymous privacy checks must PASS on the new integration SHA.
- [ ] Inspect real rendered mobile and tablet snapshots at the integration SHA; do not count static/automated checks as human/device acceptance.
- [ ] Preserve educator-review/source-freshness holds, including the unpublished Reading/ELA material.
- [ ] Obtain explicit user release authorization before any merge or publication; verify the live Pages build and real on-device Safari afterward.

No branch-protection change, credentials, spend, scheduled task, school source, private student record or production deployment is authorized by this draft.
