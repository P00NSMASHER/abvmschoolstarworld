# Phase 2: scheduled recall in ordinary subject practice

## Decision
Preserve the existing on-device adapted SM-2 review engine and its version-1
\`Review\` schedules. Do not install \`ts-fsrs\` as a drop-in replacement:
its current scheduler package requires Node 24, whereas the ABVM QA/build
runner uses Node 22 and the app is an offline static JavaScript PWA.
FSRS additionally expects rated review histories; converting first-try /
assisted binary evidence into a calibrated four-grade FSRS history would
invent missing data.

## Implemented
Each ordinary **weekly subject** round reserves up to two of its eight
questions for previously reviewed skills that are actually due under the
existing scheduler. Only eligible, already-reviewed saved/review questions
are considered. Prefer not-recently-shown question variants, then higher
review priority, and select at most one per skill. Fill the remaining slots
through the existing current-first staged selector. If nothing is due,
behavior remains current-first. Practice drawn from a saved lesson remains
identified as older learning, not newly assigned teacher material.

This change does NOT modify learner scores, previous \`Review\` records, due
dates, storage keys, current curriculum, schoolwork sources, Test Prep
selection, answer keys, rewards, or source-date authority. It does not
make retention/accuracy forecasts or imply FSRS has been integrated.
No learner data is sent to a remote service.

## Acceptance
- two distinct overdue older skills return in a Math round, with six
  current questions and no duplicated question identities;
- future, corrupted and unobserved review states do not cause injections;
- no recent-item starvation, cross-subject leakage or contamination of
  strict exam prep;
- DST-sensitive existing scheduler, offline persistence and on-device
  historical learning regression tests remain green;
- exact-head static/unit/browser, phone render, independent QA and
  verified GitHub Pages publication must pass before calling this live.
