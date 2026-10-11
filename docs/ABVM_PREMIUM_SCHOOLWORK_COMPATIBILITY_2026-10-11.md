# ABVM premium + cumulative schoolwork cross-release integration review

**Status: DRAFT REVIEW ONLY. No production merge, Pages deployment, curriculum promotion or scheduled-task changes authorized.**

## Provenance

- Protected `main` at review start: `7cdc2047855ccf5b849e8e8d67e765164864a583`.
- Premium app, privacy, Calendar, Study and teacher-source fallback release candidate: [PR #308](https://github.com/P00NSMASHER/abvmschoolstarworld/pull/308), exact head `d21e410fa5568211fefffe36caee5e680e7dac54`. Its own 10/10 workflows passed.
- Cumulative schoolwork evidence, source-manifest, replay and history safeguards: [PR #306](https://github.com/P00NSMASHER/abvmschoolstarworld/pull/306), exact head `631431e3f8367add4e41cc1e377e59df55b7d8e7`. Its own App and independent QA passed.
- This isolated merge candidate retains both PR heads as Git commit parents. Standalone success does not prove that the combined code works.

## Reconciliation of overlapping files

The starting tree is PR #308. Nine disjoint PR #306 changes to the source-integrity scripts, schoolwork and learning-history unit tests and documentation were added as original Git blobs. Two shared paths were reconciled deliberately:

1. `.github/workflows/qa-reproduction.yml`: retain the premium candidate's **exact-head checkout, fail-closed SHA equality check, read-only credentials and independent QA steps**. Add PR #306's triggers for the learner-history scripts, published schoolwork manifest, integration script and cross-layer tests. Never downgrade to a synthetic merge checkout.
2. `tests/iphone-polish.spec.mjs`: keep PR #308's **stronger time-frozen test**, which checks both the active October 9 reminder and its later expiry while retaining the historic source-change record. PR #306 contains the same initial frozen clock but no later expiry assertion; the premium version is the safe superset.

The protected source-parity workflow and its test explicitly cover this new integration branch and any further stacked review. Parity remains read-only against fresh `main`.

## Required exact-head acceptance

- Full `qa:static`, `qa:unit`, Yahoo importer and standard Playwright/browser/accessibility tests; independent reproduction must pass on the final **combined commit**, not on either older head.
- Preserve source and screenshot artifacts and review real Chromium/iPhone WebKit Calendar, Today, Study, Progress and teacher-link evidence. Confirm exact PWA cache and asset versions.
- Verify public `pages/data/schoolwork.json`, approved curriculum and schoolwork sources, teacher-checked timestamp, lunch and family notices are byte-identical to protected `main`. Do not mix published provenance with locally private practice outcomes.
- Four unapproved Reading/ELA families remain on educator HOLD under #270. Teacher links must never imply new teacher verification.
- An **explicit separate human release decision**, physical iPhone Safari signoff and live Pages QA would be required before any production action. This compatibility PR alone is not authorization.

## Interim local rehearsal

- `npm run qa:unit`: **376 passed, 0 failed**.
- `npm run qa:static`: **PASS**, including 23 schoolwork photo sources, 13 lessons, 67 public original-practice questions, PWA, data and CSS/code hygiene.
- `python3 -m unittest discover -s tests -p test_yahoo_weekly_import.py`: **11 passed**.

**Remote joint exact-head acceptance: pending. Do not publish from this draft.**
