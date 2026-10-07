# ABVM school companion

## Schoolwork received in ChatGPT

When the user sends schoolwork photos and asks to integrate/update the app, follow
`docs/SCHOOLWORK_INTAKE.md`. It is the canonical **12-step cumulative** intake
process. Read the current `pages/data/schoolwork.json`, its `sourceManifest`,
and current longitudinal context before changing content.

The required order is:

1. preserve the original source and SHA-256 identity;
2. identify the assignment and only source-supported date;
3. extract the printed questions/task;
4. identify the student's responses privately;
5. identify teacher markings/corrections privately;
6. determine correctness independently and classify interpretable errors;
7. map every scorable item to stable academic skills;
8. compare those skills with longitudinal history;
9. update mastery/confidence state using repeated evidence;
10. decide whether targeted practice is warranted;
11. update the cumulative learning record;
12. update the current week/test-prep views only when supported and relevant.

- If the user is sending a batch and asks you to wait until they say “finished”,
  wait. Do not begin extraction or modifications until that signal and instructions.
- An explicit request such as “Integrate this schoolwork into the app” authorizes
  the normal intake, validation and existing GitHub publication workflow. Do not
  add redundant permission prompts for reversible edits or established deployment.
- Inspect every attachment. Preserve source IDs and SHA-256 hashes, and report
  unreadable/missing pages precisely. Never fabricate extracted content.
- Keep raw photos, OCR dumps, names, grades/marks, student identifiers, handwritten
  answers, teacher comments and child-specific performance history out of this
  public repository. Steps 4-6 may inspect them in the private review context.
- Public `pages/data/schoolwork.json` is the privacy-safe educational layer, not
  the student performance ledger. Store child-specific longitudinal evidence only
  in a configured private archive. If no private archive is configured, prepare a
  private archive delta and explicitly report persistence as pending rather than
  publishing private performance data here.
- Retain cumulative material; do not date undated worksheets as the current week.
  A single worksheet must not establish mastery or a persistent weakness.
- Prioritize official Christ Our Life review links for the exact known chapter;
  do not bulk-copy its question bank. Verify supported links and preserve the
  approved original-practice fallback when official material is unavailable.
- There is no in-app upload control and no autonomous ChatGPT upload watcher.
  Intake runs when requested in a chat with attachments and repository access.
- Use `scripts/integrate-schoolwork.mjs` for the privacy-safe reviewed batch:
  dry-run first, inspect the result, then `--write`. Run the intake tests and
  existing QA gates. Check current remote state, avoid conflicting work, and verify
  publication before claiming the app is updated. Never weaken gates to get a
  deployment.

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


## Authoritative visual gold standard

The user's October 6, 2026 ABVM concept board is the current visual authority for the entire web app. Read GitHub issue #237 before any UI work. The private reference is stored in ChatGPT Library at `/ABVM/References/ABVM-Web-Gold-Standard-2026-10-06.jpeg` (`libfile_56ea842a9f948191a0204afa8bae438f`). Never commit the private reference image or copied private content to this public repository.

Use one shared design language across Today, Week, Calendar, Study Games, the question player/results, Family, test prep, print guides, loading/error and offline states. Preserve the approved real ABVM photography, governed school data, learning/scoring semantics, source provenance, privacy, accessibility and offline behavior. The Week screen must include a simple governed-data summary that lists every Monday-Friday lunch and every verified test/assessment for the displayed school week. Do not create a duplicate manual lunch/test authority.

Rendered phone and tablet evidence is required for visual acceptance. Passing static/browser tests alone is not aesthetic approval. Release only the exact reviewed head through the normal QA, independent-review and Pages gates.
