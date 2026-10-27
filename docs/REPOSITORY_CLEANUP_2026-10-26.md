# ABVM repository cleanup — October 26, 2026

## Repairs

- PR #418: reviewed planner precedence across school-year boundaries. Merged at
  `9054982835eee5617dd2ee2eb392574712a923ba` after exact-head App QA,
  independent reproduction and fresh teacher candidate acceptance passed.
- PR #423: independent reviewed-lunch rollover and bounded recovery. Merged at
  `842fb6cd7497c14811bed52a1fd36cb6c8aa0156` after exact-head App QA and
  independent reproduction passed. Combined local static and 813 unit checks passed.
- Dashboard incident reproduced from run `40435209138`: current live parity,
  successful watchdog and a fully verified Homework publication were reported
  CRITICAL because standalone App QA dated October 24 was older than 48 hours.
  The dashboard now reads the actual guarded publisher job and every required
  release step before using its full QA receipt. Missing, skipped or failed gates
  cannot certify success; newer standalone failures remain failures.
- Replace the dated preview branch allowlist with stable review namespaces.
  Existing and future stacked review branches retain exact-head, latest-main,
  read-only source comparison. No protected path or source check is removed.

## Open PR disposition

These older branches are preserved as history; closing a superseded PR does not
mean its old head was merged or passed today's checks. Do not merge historical
source snapshots over newer school data.

| PRs | Evidence and disposition |
| --- | --- |
| #275–278, #280–281, #283–284, #286, #290, #292–293, #296, #299, #302, #308–309 | Premium UI and its QA stack were consolidated in merged #317 (`0f34105`); Calendar was subsequently replaced by #323/#324. Current premium browser suites remain. Close superseded proposals. |
| #291, #294–295, #297–298, #300–301, #303–306, #311–314, #316 | Schoolwork privacy, deduplication, learning history, source verification and workbook safeguards were consolidated through #306/#309 into #317. Main retains intake, cross-layer, public-value, photo-verification, review-report and workbook tests. Close superseded proposals. |
| #289 | Direct official teacher-source fallback superseded by #302 and #317; current fallback unit/browser tests retained. |
| #315, #318 | Approved original sign and its integrity tests are already on main through #322/#317. Old integration/parity-exception drafts are obsolete. |
| #320 | Exact-main Pages admission and Yahoo permission separation are already present; both workflow blobs matched the #317 release before later hardening. Preserve current guarded admission and exact source SHA handoff. |
| #321 | Reviewed Melissa dates were integrated by #322/#317 and later #319. Preserve current source JSON and current Calendar regression tests. |
| #327 | Teacher-week fixture, no-school lunch handling and rollover tests are already on main through #338 and subsequent changes; current fixture additionally respects teacherPostingWeekLabel. |
| #344 | Empty historical charts candidate has zero questions and no publishable implementation. Current verified Reading source lists diagrams and labels, supported by merged #419. Close obsolete source-revision proposal, without falsely treating charts as diagrams or adding unsupported questions. |
| #274 | Deferred, unshipped Facebook integration. No authorized school/HSA feed credentials or reviewed posts were established; official calendar link shipped independently in #279. Close obsolete integration proposal, preserve branch, do not enable feeds or claim ingestion works. |

## Acceptance limits

Each new code candidate still requires full exact-head App QA and independent
reproduction before merging. Production acceptance requires guarded publication
and live source parity. The existing 24-hour observation must use actual elapsed
operation; neither cleanup nor a green unit suite proves a flawless application.
Physical iPhone/offline acceptance remains unobserved unless separately recorded.
