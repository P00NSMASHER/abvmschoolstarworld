# ABVM premium consolidated release review — October 11, 2026

## Decision status: REVIEW ONLY / NO PRODUCTION AUTHORIZATION

This draft is a **single reviewable PR targeting `main`** for the fully tested premium app stack. It combines the prior draft PR histories rather than releasing them automatically. It does not change protected school sources, private student histories, scheduled tasks, secrets, credentials, production Pages or curriculum approvals.

### Exact review history

| Layer | PR | Exact reviewed source SHA | Purpose |
| --- | --- | --- | --- |
| Production base | main | `7cdc2047855ccf5b849e8e8d67e765164864a583` | Current protected source and anonymous privacy baseline |
| Premium integration | #296 | `62409fee8355690c630db633252816fe729c852e` | Today, Calendar, Study, Test Prep, Progress; main-privacy reconciliation |
| QA hardening | #299 | `18214bb1dfff80fabd4a033cba1f847f2f97418d` | Exact-head checkout and decoded badge-image QA |
| Teacher-source usability | #302 | `6fb0519eef4d108db148b8ebf3e2ac5db902354f` | Official teacher link when source checks stale; compact iPhone and screenshot-evidence validation |
| Consolidated review | This draft | **See actual PR head** | Read-only parity coverage and review signoff documentation only |

The previous exact PR #302 head completed **10/10 automated workflows SUCCESS**, including [full App QA](https://github.com/P00NSMASHER/abvmschoolstarworld/actions/runs/38113979852) and [independent reproduction](https://github.com/P00NSMASHER/abvmschoolstarworld/actions/runs/38113980130), each with **893 browser tests passed, 2 skipped, 0 failed**. Those receipts validate `6fb0519eef4d108db148b8ebf3e2ac5db902354f` only. They are not a substitute for fresh checks on this new branch.

### Repository/source comparison

The reviewed #302 tree is **100 commits ahead / 0 behind** the checked `main` base with **37 changed files** (premium presentation, Playwright tests, release QA and workflow files). Compared with `main`, the following protected paths remain unchanged, verified by the authoritative read-only source-parity gate:

- `pages/data/**`, including `study-pack.json`, schoolwork and lunch evidence.
- `pages/school-updates.js`, `pages/weekly-learning.js`, `pages/styles.css`, `pages/manifest.webmanifest`.
- Official school photos, lunch artwork, illustrations, badges and `scripts/refresh-teacher-pages.mjs`.

The new consolidated review adds only `.github/workflows/preview-source-parity.yml`, `tests/preview-source-parity-workflow.test.mjs` and this release-review document relative to #302. Both head and base selectors of this draft branch are registered with the **unchanged, fail-closed** school-source comparison logic.

### Evidence-based functional review

- Native-quality premium navy/gold experience across Today, Calendar Month/Week, Study, Question Player, Test Prep and Progress.
- Exact-date Calendar continuity and accessible busy-day event summaries.
- 44px-or-greater key teacher-link touch target with compact 375px/390px iPhone and enlarged text coverage; original Chromium/WebKit evidence retained by the Today workflow.
- Anonymous learner identity and truthful device-only Study Star ranks, not school grades.
- Official teacher-source link only when the verified teacher-page check is stale/needs attention while online. Opening the link does **not** refresh, verify or publish academic data.
- Latest teacher-page timestamp and parent notices are separate data provenance streams; newly received notices do not reset teacher freshness.

### Required gates before any approved production release

- [ ] This consolidated PR's exact-head **source parity, full App QA, independent reproduction and all premium UI/privacy tests** complete SUCCESS. Never substitute earlier stacked-branch runs.
- [ ] Independent reviewer examines actual current-head iPhone Safari/WebKit and iPad screenshot artifacts and keyboard/scroll/contrast behavior. Real physical-device smoke test remains outstanding.
- [ ] Confirm production `main` has not advanced. If it has, reconcile newer main commits before final candidate acceptance; rerun fresh parity and QA.
- [ ] Maintain honest teacher-source freshness and educator approval controls. Reading/ELA [#270](https://github.com/P00NSMASHER/abvmschoolstarworld/pull/270) remains HOLD until independent authorized educator review, privacy-safe usage evidence and explicit manual curriculum authorization. No automatic promotion.
- [ ] Obtain a separate **explicit user release decision** after reading evidence. Passing automation does not grant merge/deploy permission.
- [ ] If approved later, deploy exactly the accepted tree to GitHub Pages and validate actual live iPhone navigation, fresh/old/offline source behavior, learning state, school calendar and PWA caching; report any mismatch without falsely claiming success.

**No immediate merge, auto-merge, publish, task/notification change, source timestamp change, educational approval or spending is permitted by this draft.**
