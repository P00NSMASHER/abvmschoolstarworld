# Reproducible ABVM bug audit — November 16, 2026

## Scope and evidence standard

The audit started from main `3368aacc164502fedc23f435d8278a50c38b9fd7`
and inspected the live GitHub Pages app. Routine code repair and the existing
protected release path are authorized by `AGENTS.md`. The later unrelated main
changes were retained before preparing this repair branch.

The five defects below each have a failing execution of the original code and
a regression that exercises the corrected behavior. Passing a source-level
test is not browser acceptance. The PR's exact-head App QA and independent
reproduction runs provide browser verdicts and screenshots. Production acceptance
also requires the existing guarded Pages release and actual live verification.

## Reproductions and changes

| ID | User impact and original reproduction | Repair and retained boundaries |
| --- | --- | --- |
| ABVM-01 | On the linked November practice paper, enter `37` for Math question 1, switch to Religion, then return. The live browser displayed `37,`. Erasing the input still counted it as answered. Single-answer inputs were accidentally saved as two-part arrays. | Use scalar values for single-answer questions. Recover existing malformed arrays without clearing other answers, submission state, or scores. Test tab switching, reload, blank counts, recovered editing, and scoring. |
| ABVM-02 | Hold the Study engine script response without completing or rejecting it. The actual loader promise never settles; Study remains on its loading screen and never offers retry. | Apply an eight-second deadline with cleanup of failed and sibling requests. Preserve loaded components, allow a fresh retry, and ignore callbacks from retired attempts. The existing error/retry interface remains the recovery path. |
| ABVM-03 | The November 20 long-a spelling announcement has an existing original question bank, but the matcher rejects every item in the combined long/short-a family. Test Prep shows zero matching questions. | Select only the three individual questions that explicitly target long a. Preserve exclusion of short-only, mixed, ambiguous, different-vowel, and incorrectly dated photo-derived questions. The model, player, printable questions, and separate answer key use the same selected bank. |
| ABVM-04 | Keep Week open across Eastern midnight with a current Monday homework posting. The real feed rejects it on Tuesday, but the unchanged rendered page still shows Monday's actionable task as current. | Redraw Week and Calendar when the Eastern civil date changes, including offline. Rebase relative offsets from the selected civil date so month, weekend, and DST transitions preserve navigation. Active Study answers are not replaced. |
| ABVM-05 | A January 12–22 assessment window appears on January 12 before 3 PM, then vanishes at dismissal and on January 13 even though the verified window remains open. | Keep the assessment eligible through its range, select the next school day, skip weekends and verified closures, group same-day tests, and retire after the final school day. Preserve original source dates and range endpoints. |

## Automated reproductions

- `tests/november-practice-answer-state.test.mjs`: all three cases failed before
  the repair; they execute the actual inline paper script.
- `tests/study-engine-recovery.test.mjs`: the original loader produced two
  `hung` results instead of retryable errors; additional cleanup coverage checks
  that an earlier attempt cannot interfere with a retry.
- `tests/spelling-single-sound.test.mjs`: three positive model/matching cases
  failed before the repair; the photo-date exclusion passed throughout.
- `tests/planner-clock-regressions.test.mjs`: actual application callbacks,
  presentation functions, and Homework logic reproduced stale homework and
  missing Calendar rollover. Independent review additionally reproduced three
  selected-date regressions; those were corrected before release.
- `tests/today-assessments.test.mjs`: two new range cases failed before the
  repair, while the existing single-day assessment cases passed.

The four corresponding browser spec files run in mobile Chromium, desktop
Chromium, and the explicit iPhone-sized WebKit project. They cover the real UI,
controlled offline/date/network conditions, a complete scored spelling round,
the printable worksheet and separate key, and restored Math answers.

## Release and privacy boundaries

No teacher facts, test announcements, source documents, schoolwork answers,
learner grades, photos, or private history are added or changed by these fixes.
Synthetic test fixtures stay inside the test harness. Existing content gaps are
not converted into invented lesson coverage.

The existing 60 KB application-controller ceiling, offline asset-version parity,
source/privacy validation, PR checks, and guarded publication remain enforced.
The service-worker cache and one-time reload identity advance together so an
installed app can receive the repaired code.

Local Node execution is available. Local Chromium cannot create the sockets it
requires in this command environment; its launch failure is recorded as an
environment limitation, never as an application pass. The existing hosted
Chromium/WebKit QA is the browser execution path for this candidate. Physical
iPhone acceptance and the repository's separate 24-hour production observation
cannot be inferred from automated browser tests.

Final commit/run/deployment URLs and the observed live outcome are recorded in
the repair PR and the delivery response, so this source snapshot does not claim
future CI or publication success.
