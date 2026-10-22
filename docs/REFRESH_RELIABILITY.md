# Teacher-data refresh reliability

## Single coordination contract

All source writers and the Pages publisher use the job-level `abvm-verified-school-state` concurrency group with `cancel-in-progress: false` and `queue: max`. Parent workflow locks remain distinct. Never put the common lock on a reusable caller's whole workflow: that can block the child publisher behind its own parent.

Teacher, reviewed lunch, Homework, reviewed notices and Yahoo jobs retain their independent source validation. A completed collection stays on main even if publication later fails. Queued trusted source workflows hand their verified source SHA to Pages with `reconcile_latest_main: true`. Admission selects the then-current immutable main SHA and runs the full existing release QA, final main-identity guard, deployment and live checks. Arbitrary refs and non-main callers remain rejected. Human code merges can still advance main during QA; that final guard must remain.

## Recovery controller

`scripts/source-freshness-recovery.mjs` remains the executable entry point. Its pure schedule policy is `scripts/refresh-controller.mjs`. It combines verified source timestamps, complete main/live JSON equality, the official Homework observation, and the actual configured New York schedules. A missed scan is due after a 90-minute delivery grace, not only when the older daily/8-hour age limit is exceeded. The age/schema/source-identity gates remain in force.

The plan records one of `current`, `refresh-required`, `publish-required` or `evidence-incomplete`, plus the expected school date/time, real observed time, prior verified check timestamps and reasons. It never changes school facts or invents a successful check. Recovery runs hourly at :11 between 6 a.m. and 11 p.m. Eastern, after the existing watchdog, and on relevant main-branch policy changes. Actual source schedules remain unchanged.

Before standalone Pages recovery, inspect both its own history and the four main-branch source workflows that call Pages. An active teacher, Homework, reviewed-notice or Yahoo parent defers redundant publication; missing or malformed parent history blocks dispatch rather than inventing an idle queue. Deferral is not a successful deployment. Completed parents do not suppress a needed recovery.

Before dispatch, the existing recovery workflow checks active runs and preserves its caps of two failed on-demand recoveries and six total on-demand runs per workflow per UTC day. Pages recovery remains conditional on current verified repository sources. The report artifact is retained for 30 days. Missing provider evidence is UNKNOWN, not healthy or repaired.

## Existing independent supervision

Keep the already-enabled hourly ABVM School Data Intake task as the independent scheduling path; no new task, paid service or credentials are needed. It must read current main, the current recovery plan, active runs and real live content before intervening. Do not start a competing publisher or re-open a resolved old failure. Report only a material unresolved incident, a verified recovery, or an unavoidable decision. Its existing schedule and notification settings are unchanged by this work.

The source and release logs remain the execution evidence. An accepted dispatch, a test fixture or a successful source job is not proof of live deployment. A superseded Pages attempt is not an ongoing outage if a later validated publisher and watchdog establish current live parity.

## Acceptance and rollback

Before merging: passing exact-head App QA, independent automated reproduction, applicable teacher candidate checks, executable admission adversarial tests, schedule/DST/invalid-clock tests, and existing source/parity/failure-budget regressions. After merging: inspect actual queued writer/publisher execution, source timestamps, live full-JSON parity and watchdog results.

Fourteen consecutive school days without manual repairs remain an observation requirement. Preserve failed attempts and actual interventions; do not count elapsed calendar time, simulated runs or a new source SHA as an already-completed reliability period. Retain the original failure and the exact merged source fingerprint in the canonical PR checkpoint. This document does not claim that observation has passed.

Rollback is a normal tested revert of the coordination PR; do not reset main, remove source verification, change teacher facts or disable the healthy existing schedules. The last verified school data must remain available with honest source dates during outages.

Recovery must explicitly reject unavailable, malformed or incomplete workflow history before evaluating its budgets. Do not rely on Bash `set -e` inside a function invoked with `||`: that shell context suppresses implicit error termination.
