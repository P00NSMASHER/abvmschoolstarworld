# ABVM school companion

## Schoolwork received in ChatGPT

When the user sends schoolwork photos and asks to integrate/update the app, follow
`docs/SCHOOLWORK_INTAKE.md` and `docs/LEARNING_HISTORY.md`. The canonical intake is
the 12-step cumulative workflow: preserve source → identify assignment → extract
printed tasks → identify learner responses privately → identify teacher marks
privately → independently determine correctness → map skills → compare with cumulative
history → update private learning state → choose targeted practice → publish only
privacy-safe ABVM material → update weekly/test-prep only when source evidence warrants.

Read the current `pages/data/schoolwork.json` and its source manifest before changing
content.

- If the user is sending a batch and asks you to wait until they say “finished”,
  wait. Do not begin extraction or modifications until that signal and instructions.
- An explicit request such as “Integrate this schoolwork into the app” authorizes
  the normal intake, validation and existing GitHub publication workflow. Do not
  add redundant permission prompts for reversible edits or established deployment.
- Inspect every attachment. Preserve source IDs and SHA-256 hashes, and report
  unreadable/missing pages precisely. Never fabricate extracted content.
- Keep raw photos, OCR dumps, names, grades/marks, student identifiers, handwriting
  profiles, answer sheets, teacher-mark details and private performance history out
  of this public repository.
- Learner responses, correctness observations, error types, trend and operational
  mastery state belong only in the private learning-history layer. The processor
  refuses history/batch paths inside this public repository.
- Public ABVM material may contain reviewed educational notes and original checked
  practice, but it must not reveal why a private performance observation caused a
  skill to be prioritized.
- Retain cumulative material; do not date undated worksheets as the current week.
- Prioritize official Christ Our Life review links for the exact known chapter;
  do not bulk-copy its question bank. Verify supported links and preserve the
  approved original-practice fallback when official material is unavailable.
- There is no in-app upload control and no autonomous ChatGPT upload watcher.
  Intake runs when requested in a chat with attachments and repository access.
- Dry-run the private history update before writing it. Dry-run the public schoolwork
  integration before `--write`. Run both intake test suites and existing QA gates.
  Check current remote state, avoid conflicting work, and verify publication before
  claiming the app is updated. Never weaken gates to get a deployment.

## Lunch menus received in ChatGPT

When the user uploads a lunch menu and asks to integrate/update the app, follow
`docs/LUNCH_ART.md` in the same run. Menu import includes the missing-illustration
work automatically; do not wait for a separate artwork request. Verify the exact
printed menu, update the reviewed lunch catalog, reuse exact reviewed meal art in the approved tray style
only when the exact source ID and complete menu are verified, generate missing artwork with the built-in
high-quality image generator, visually inspect it, and run the existing QA before
publishing through a pull request. Never invent unspecified ingredients. Use
`pendingArtMenus(plan, currentNewYorkMonth, {styleId:TRAY_STYLE_ID})` from the lunch-art builder to avoid
expired-month backlog. Preserve existing menu source and closure rules.
The 20 October tray illustrations were completed and production-verified in PR #378.
The former “Complete lunch artwork” merge-event task was repurposed on October 16,
2026 as “Protect ABVM learning reliability”, preserving its existing repository
merge trigger. Future missing-menu artwork remains part of the existing hourly
ABVM School Data Intake task and normal menu-import workflow; no new task is needed.
Follow `docs/LUNCH_ART.md` and `docs/LUNCH_TRAY_STYLE.md`, the style-aware queue,
exact source/menu proof and privacy-safe generated references. Private originals
and people never enter this repository.
Do not change unrelated tasks to make room. If artwork generation or review is blocked,
retain accurate text-only cards and report the specific incomplete coverage.

## Current product design authority

The user's October 7, 2026 directive authorizes a complete frontend reinvention and
supersedes the October 6 concept board and five-tab information architecture.
Read `docs/PRODUCT_REDESIGN_2026-10-07.md` for the current product direction and
shared design system. Do not restore legacy visual layers or use old snapshot
assertions as a reason to retain inferior presentation.

Preserve accurate school content, governed pack/date/lunch authority, provenance,
privacy, learning/scoring semantics, retries, accessibility, and offline behavior.
Week must still list every Monday–Friday lunch (including honest unavailable/no-school
states) and every verified test for the displayed school week. Main-meal summaries
are allowed; selected-day details retain the complete governed menu.

Rendered phone and tablet evidence is required for visual acceptance. Static/browser
tests are objective release checks, not proof of hands-on physical-device review.

## Standing ABVM release authorization — October 20, 2026

The owner has authorized current and future routine ABVM fixes, curriculum refreshes,
source-matched schoolwork, accessibility improvements and deployments without any
mandatory human reviewer, second-person code review, educator signoff or repeated
owner approval/release decision. Human advice, visual feedback and pilots are optional,
not blocking conditions. Do not request or invent an independent human review or
represent automated test reproduction as a human approval. This applies to future
ABVM changes until the owner explicitly changes the policy.

Release code through an exact-head pull request with passing automated App QA,
independently reproducible tests, source/privacy/provenance checks and guarded Pages
publication. Existing verified teacher/Homework/notice automation may publish its
strictly scoped source-backed data using its own bounded, tested workflows. Do not
merge a red or incomplete candidate. Missing or ambiguous teacher facts, academic
answers, rights, original photos or learner evidence stay isolated or text-only;
no reviewer can be demanded as a way around missing verification. Keep student
records private, retain actual physical-device acceptance as an outstanding
quality observation when it has not been performed, and never fabricate proof.


## Refresh reliability coordination (October 21, 2026)
Read `docs/REFRESH_RELIABILITY.md` before editing teacher/Homework intake, recovery or Pages. Source writers and Pages share one job-level queue; do not introduce a competing publisher or a parent/child concurrency deadlock. Preserve the immutable admitted main SHA, full automated QA and final main recheck. Use the existing schedule-aware recovery report and active-run/budget checks before manual redispatch. Retain last verified source facts on outages; never claim freshness from a dispatch acknowledgment. Do not treat a superseded run as a continuing incident after later exact-content publication and watchdog verification. The existing hourly intake task owns follow-through; do not create another task or require human review.

## ABVM 24-hour production observation (owner amendment, October 22, 2026)

The owner shortened the post-release unattended acceptance observation from 14 consecutive school days to **24 consecutive elapsed hours**. The authoritative eligibility, baseline, failure/reset and evidence rules are in `docs/REFRESH_RELIABILITY.md`; do not revive the older 14-day period from historical plans, tasks or PR descriptions. Require a successful guarded exact-main production publication and real live-watchdog source parity before starting the 24-hour clock. Do not backdate, simulate elapsed operation, or treat a PR merge as observed acceptance. All source/privacy, protection, QA, retry and live verification gates remain unchanged. Physical-iPhone offline observation is separate.

## Owner-authorized original teaching for source gaps (October 22, 2026)

When the verified classroom source lists a vocabulary word or a general Grade 2
skill but omits explanatory definitions or worked examples, teach it with checked,
age-appropriate **original ABVM supplemental instruction** rather than repeatedly
requiring the teacher to supply ordinary pedagogical material. This standing owner
authorization applies to original common-word meanings, illustrative sentences,
hints, strategies and original practice. Keep the verified teacher list or named
skill as the current inclusion gate; withdraw supplementation when that gate
disappears. Do not alter the teacher's stored wording, meaning field, source
timestamps, or official-provenance fingerprints.

Mark every original explanation as **not teacher-provided** in displayed Notes,
printable materials, question metadata and curricular coverage. The current
single-source vocabulary supplement lives in
`pages/grade2-original-vocabulary.mjs`; the Grade 2 pipeline consumes only its
reviewed entries. When new words arrive, author and test accurate common meanings
for them under the existing exact-head QA/guarded release path. A term whose
meaning or context cannot be safely established remains explicitly uncovered until
that work is ready. Prefer a stated common-usage sense over pretending to know a
particular story's intended sense.

This authorization never permits inventing teacher announcements, assignments,
dates, school closures, spelling lists, chapter/page facts, copyrighted passages,
student results, or answers to unseen teacher test questions. Do not recast
original teaching as official source facts to suppress an actual source alert.
