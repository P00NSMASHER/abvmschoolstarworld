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

## Authoritative visual gold standard

The user's October 6, 2026 ABVM concept board is the current visual authority for the
entire web app. Read GitHub issue #237 before any UI work. The private reference is
stored in ChatGPT Library at
`/ABVM/References/ABVM-Web-Gold-Standard-2026-10-06.jpeg`
(`libfile_56ea842a9f948191a0204afa8bae438f`). Never commit the private reference image
or copied private content to this public repository.

Use one shared design language across Today, Week, Calendar, Study Games, the question
player/results, Family, test prep, print guides, loading/error and offline states.
Preserve the approved real ABVM photography, governed school data, learning/scoring
semantics, source provenance, privacy, accessibility and offline behavior. The Week
screen must include a simple governed-data summary that lists every Monday-Friday
lunch and every verified test/assessment for the displayed school week. Do not create
a duplicate manual lunch/test authority.

Rendered phone and tablet evidence is required for visual acceptance. Passing
static/browser tests alone is not aesthetic approval. Release only the exact reviewed
head through the normal QA, independent-review and Pages gates.
