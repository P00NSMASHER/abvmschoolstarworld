# ABVM school companion

## Schoolwork received in ChatGPT

When the user sends schoolwork photos and asks to integrate/update the app, follow
`docs/SCHOOLWORK_INTAKE.md`. This is the canonical intake process. Read the current
`pages/data/schoolwork.json` and its source manifest before changing content.

- If the user is sending a batch and asks you to wait until they say “finished”,
  wait. Do not begin extraction or modifications until that signal and instructions.
- An explicit request such as “Integrate this schoolwork into the app” authorizes
  the normal intake, validation and existing GitHub publication workflow. Do not
  add redundant permission prompts for reversible edits or established deployment.
- Inspect every attachment. Preserve source IDs and SHA-256 hashes, and report
  unreadable/missing pages precisely. Never fabricate extracted content.
- Keep raw photos, OCR dumps, names, grades/marks, student identifiers and personal
  information out of this public repository. Publish only reviewed educational
  notes, original checked practice and non-identifying provenance.
- Retain cumulative material; do not date undated worksheets as the current week.
- Prioritize official Christ Our Life review links for the exact known chapter;
  do not bulk-copy its question bank. Verify supported links and preserve the
  approved original-practice fallback when official material is unavailable.
- There is no in-app upload control and no autonomous ChatGPT upload watcher.
  Intake runs when requested in a chat with attachments and repository access.
- Use `scripts/integrate-schoolwork.mjs` for reviewed batches: dry-run first,
  inspect the result, then `--write`. Run the intake tests and existing QA gates.
  Check current remote state, avoid conflicting work, and verify publication
  before claiming the app is updated. Never weaken gates to get a deployment.

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
Do not change unrelated tasks to make room. If artwork generation or review is blocked, retain
accurate text-only cards and report the specific incomplete coverage.
