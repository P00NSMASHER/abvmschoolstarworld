# Coordinated ABVM refresh and publication

## Objective and authorization
Implement the owner's approved reliability consolidation. Routine verified refreshes and deployments need no human approval. Preserve exact-head PR QA, source identity, privacy, immutable release checks and last verified school data. No spending or new infrastructure is authorized or needed for this change.

## Reproduced causes
Source writers use separate locks while Pages rejects any main advancement during its lengthy QA. A source writer's captured release SHA can be obsolete before its nested Pages job starts. Default one-pending-run concurrency can also replace waiting source runs. Recovery's daily freshness policy can miss a missed afternoon/hourly scan until much later.

## Design
Use one job-level queued mutex across teacher, reviewed lunch, Homework, reviewed notices, Yahoo ingestion and Pages. Keep parent locks distinct to prevent reusable-workflow deadlock. Trusted main source writers may request current-main reconciliation at queue admission; arbitrary refs and untrusted callers remain rejected. Every admitted SHA receives existing full release QA and the final exact-main recheck.

Retain collection and publication as separate jobs and source-specific verification. Add schedule-aware recovery decisions and explicit phases without fabricating fresh observations. Use the existing recovery workflow, with hourly daytime read-only checks, bounded dispatch counts and duplicate prevention. Reuse an existing independent intake task if available; do not create a second unrelated scheduler or claim GitHub cron is independent of GitHub.

## Acceptance
Regression tests must reproduce shared-lock absence, stale handoff, invalid caller/ref, missed hourly/afternoon scan, Eastern midnight and DST, successful no-op, stale publication and unavailable evidence. Run unit/static checks and exact-head hosted QA/reproduction before merge. Verify main/live JSON and actual source/release runs after deployment. Fourteen school days without manual repairs is a future observation, not a test result obtainable today.
