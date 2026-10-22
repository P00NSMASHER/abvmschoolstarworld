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

**Owner-amended production observation (October 22, 2026): 24 consecutive elapsed hours**, replacing the former fourteen-school-day criterion. This is a real-world release-acceptance observation, not a source freshness timeout, GitHub Actions schedule, retry budget, human approval, or prerequisite that can be marked complete at merge.

Start the clock only at the first completed, successful guarded production Pages deployment of the applicable exact protected-main commit, followed by a successful real live-source watchdog that establishes complete teacher-study-pack and Homework JSON parity. Record the exact publisher run, admitted commit, production URL, verified source hashes/timestamps, watchdog run, and start time in UTC. Neither a source commit, queued publisher, synthetic replay, prior successful release, nor an earlier 24-hour period starts or satisfies the new window.

Through the following **86,400 consecutive seconds**, inspect real existing scheduled teacher and Homework refreshes and their publication/monitoring receipts. At least three consecutive scheduled successful source-check opportunities are required, including the Homework schedule and a teacher scan when due. Unchanged verified scans count as source checks, never as fresh content or deployments. Any changed verified data must pass its existing QA and guarded Pages release and become live with exact JSON parity; existing grace, freshness, retry and failure caps are unchanged. A superseded publisher rejected by the final main recheck is not by itself disqualifying if a later authorized publisher actually completes and the watchdog verifies current parity.

Any unremediated missed or failed due scan, failed required release/live parity, unauthenticated or unknown source evidence, loss of main protection, unresolved critical dashboard incident, or manual repair during the observation disqualifies that interval. Record the original failure and restart a **new full 24-hour window** only after confirmed recovery and a fresh qualifying publication/watchdog baseline; never backdate or erase failures. A subsequent safe school-data commit with fully verified publication need not restart a healthy interval; a code/release-policy change requires a new baseline. The dashboard must reflect actual current evidence, not historical failures already proven superseded.

Completion requires a timestamped 24-hour start/end and auditable real provider run history, current repository/live bytes, passing source-health watchdog and accurate dashboard. Preserve unresolved UNKNOWNs as UNKNOWN. Physical-iPhone/offline testing and the separate quality scorecard remain additional unverified requirements when not performed; this change alone cannot earn 10/10. No 24-hour observation is claimed completed by this policy update.

Rollback is a normal tested revert of the coordination PR; do not reset main, remove source verification, change teacher facts or disable the healthy existing schedules. The last verified school data must remain available with honest source dates during outages.

Recovery must explicitly reject unavailable, malformed or incomplete workflow history before evaluating its budgets. Do not rely on Bash `set -e` inside a function invoked with `||`: that shell context suppresses implicit error termination.
