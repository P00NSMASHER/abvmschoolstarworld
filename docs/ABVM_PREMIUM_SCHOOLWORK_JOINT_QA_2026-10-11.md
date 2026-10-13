# ABVM premium + cumulative schoolwork: joint integration QA (October 11, 2026)

## Intent and release authority

This branch is a **non-deploying, draft integration test candidate**. It combines two separately green, unmerged, review-only PRs, **not** a joint source approval or permission to publish. Do not merge this branch, deploy GitHub Pages, promote curriculum, add user/student records, change existing ChatGPT scheduled tasks, or reconfigure GitHub production permissions.

## Exact source inputs

- Current production baseline `main` (the branch currently reports `protected: false`; no settings altered): `7cdc2047855ccf5b849e8e8d67e765164864a583` (verify again before any release decision).
- [Schoolwork PR #306](https://github.com/P00NSMASHER/abvmschoolstarworld/pull/306): `631431e3f8367add4e41cc1e377e59df55b7d8e7`, 11 changed files, independent and standard QA each SUCCESS.
- [Premium UX PR #308](https://github.com/P00NSMASHER/abvmschoolstarworld/pull/308): `d21e410fa5568211fefffe36caee5e680e7dac54`, ten distinct exact-head workflows SUCCESS.
- This branch begins with the **complete premium candidate tree**, then ports all **nine non-overlapping schoolwork files byte-for-byte** from PR #306 by Git blob identity.
- Two overlapping paths are reconciled:
  1. `tests/iphone-polish.spec.mjs`: retain PR #308's full premium-tested version, including both dated-notice active/expired assertions. PR #306's Oct 8 frozen-time expectation is already included.
  2. `.github/workflows/qa-reproduction.yml`: retain PR #308's exact PR-head checkout and SHA assertion, plus PR #306's independent source-manifest/learning-history path filters. No QA gate is weakened.
- `.github/workflows/preview-source-parity.yml` and `tests/preview-source-parity-workflow.test.mjs`: add this integration **head and base branch** to the existing fail-closed, read-only authoritative main-source parity check, with a unit assertion preventing a silently skipped gate.

## Required joint testing and evidence

Run standard App QA, independent reproduction, authoritative teacher/source parity (must run, **not skip**), all premium Calendar/Today/Study/Player/Resources/Progress/anonymous privacy visual QA, mobile and Safari-WebKit accessibility, and cumulative schoolwork cross-layer provenance/mastery/date/deduplication regressions **on the exact final integration head**. Inspect failures and ensure zero unexpected skips. Capture exact SHA and retained workflow artifacts. Since both original branches were reviewed separately, their prior green results do not approve this combined tree.

## Protected data, review and deployment holds

The integration must keep `pages/data/**`, approved teacher-source freshness, school photos, lunch and official curriculum content **byte-identical to main**. Original learner photos and private performance histories remain outside this public repository; never publish learner marks, raw answers, grade/identity metadata, or unapproved source evidence. Do not assert that the original 23 image contents have been independently verified from only their SHA manifest; **human photo/source signoff remains open**.

**Disposition:** QA integration only, not a release. Both #306 and #308 remain open drafts. Before any future release, obtain explicit approval, reconcile any main drift, perform human source/privacy review, and verify actual live behavior after a separately authorized deployment.
