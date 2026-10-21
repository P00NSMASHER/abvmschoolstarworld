# ABVM Refresh Reliability Implementation Plan

> Execute inline with superpowers:executing-plans; tests before product changes.

**Goal:** Remove writer/publication collisions and make missed scans recover through the existing bounded system.
**Architecture:** Shared job-level queue plus guarded latest-main reconciliation; schedule-aware recovery layered over unchanged source validation.
**Tech Stack:** Node 22, GitHub Actions, existing browser QA.
**Spec:** ../specs/2026-10-21-refresh-reliability-design.md

## Global constraints
No fabricated source freshness, privacy changes, approval gates, paid services, unrelated UI work or bypassed QA. Maintain old verified data on errors.

## Review focus
Parent/child lock deadlock; untrusted release input; schedule/DST boundaries; bounded retry feedback; source unavailable versus confirmed stale.

## Tasks
- [x] Reproduce missing shared lock with tests/refresh-coordination.test.mjs (12 failing tests before implementation).
- [ ] Coordinate source-writer jobs and Pages; keep parent locks distinct and queue pending work.
- [ ] Test and implement trusted latest-main admission; retain explicit-ref rejection and final guard.
- [ ] Test and implement source schedule policy and recovery phase evidence.
- [ ] Verify baseline versus new tests, full unit/static checks, hosted exact-head QA and reproduction.
- [ ] Merge only green exact head; inspect real source and Pages outcomes and compare live JSON.
- [ ] Reuse the existing independent ABVM intake check and record the 14-school-day observation boundary without claiming it passed.
