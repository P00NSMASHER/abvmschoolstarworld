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
printed menu, update the reviewed lunch catalog, reuse suitable reviewed entrée art
with explicit new source/menu approvals, generate missing artwork with the built-in
high-quality image generator, visually inspect it, and run the existing QA before
publishing through a pull request. Never invent unspecified ingredients. Use
`pendingArtMenus(plan, currentNewYorkMonth)` from the lunch-art builder to avoid
expired-month backlog. Preserve existing menu source and closure rules. The
GitHub merge-event task “Complete lunch artwork” is configured but paused because
the account has 15 active tasks. Once enabled it provides a backup for current and
future missing illustrations after merged PRs; it does not trigger on direct pushes.
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
tests alone are not aesthetic approval. Keep independent review separate from
implementation and release only the exact reviewed head through normal QA,
independent reproduction and Pages gates. No routine design approval is required.
