# Schoolwork intake through ChatGPT

The parent sends photos in ChatGPT and says:

> Integrate this schoolwork into the ABVM app. I’m finished sending the batch.

If they give a wait-until-finished instruction, collect the batch without beginning
work until that signal. This process is executed by the next requested agent run;
it is not an always-on chat watcher. No in-app upload section, paid OCR service,
new account or background task is required. A future chat must have the photos and
access to this repository; the agent discovers this process in root `AGENTS.md`.

The canonical workflow is now **cumulative**. Every reviewed schoolwork photo must
contribute to a private longitudinal learning record before privacy-safe material is
published to ABVM. Read `docs/LEARNING_HISTORY.md` before processing a batch.

## Canonical 12-step school-photo workflow

### 1. Preserve the source and reconcile prior intake

Read root instructions, current remote state, `pages/data/schoolwork.json`, its
`sourceManifest`, existing weekly sources, the religion source adapter, and the
private cumulative learning history when available.

Inspect every supplied photo directly. OCR may assist reading but is not evidence of
accuracy on its own. Preserve the original photo privately and compute its SHA-256.
Record a stable non-identifying source ID and digest. Do not recreate material already
integrated.

Raw photos, OCR dumps, names, grades/marks, student identifiers, handwriting profiles,
answer sheets and private learning history never belong in this public repository.

A missing or unreadable file stays held with a precise reason. Do not silently claim
all photos were incorporated. If attachments cannot be read, finish other available
work and report the specific missing filenames.

### 2. Identify assignment context

For each readable source, identify only what the source supports:

- assignment or worksheet identity
- subject
- printed topic/chapter
- supported classroom date, if any
- source/publisher context when relevant

`studiedOn` is the supported classroom date or `null`. `addedOn` is the actual
intake day in America/New_York and does not imply classroom timing. Use
“Undated schoolwork” when timing is unknown.

### 3. Extract the printed questions/tasks

Extract the printed task structure needed to understand what was being assessed.
Do not publish full OCR transcripts. Collapse exact repeated photos and semantic
rephotographs into the same lesson while accounting for every photo in the manifest.

### 4. Identify the learner's responses privately

Record the learner's answer or response only in the reviewed **private observation
batch** described in `docs/LEARNING_HISTORY.md`. A concise response summary is
optional. Never copy the learner's raw response into public ABVM data.

### 5. Identify teacher markings/corrections privately

Record visible teacher corrections or marks only as private evidence. Teacher marks
may help interpret the page, but they are never treated as an answer key and are
never published to this repository.

### 6. Determine correctness independently

Check each assessable item independently against the academic content. Classify the
result as `correct`, `incorrect`, `partial`, or `unknown`.

When a miss has a supported explanation, use the private error taxonomy:

- `knowledge-gap`
- `concept-gap`
- `procedure-error`
- `reading-comprehension`
- `recall`
- `careless-attention`
- `unknown`

Do not infer a learning/attention problem from a single item. Use `unknown` when
the evidence does not justify a narrower category.

### 7. Map each item to academic skills

Map each assessable item to one or more stable skill identifiers. Prefer existing
skill vocabulary when it accurately fits; avoid inventing near-duplicate labels.

For Religion, establish the exact chapter from source evidence. Prioritize the
verified official Christ Our Life interactive review link for that chapter. The
known entry point is https://isr.christourlife.com/col_g2_s2. Check the repository's
current religion adapter and chapter contracts rather than guessing URL semantics.
Official review is a prioritized link experience, not a copied third-party bank.
Keep source-backed original practice available as a clearly labeled fallback.

For a new chapter, add its exact worksheet-supplied publisher URL and chapter to
`pages/data/religion-sources.json`, then run `node scripts/check-religion-sources.mjs`.
The verifier checks the page and matching question-data identity before marking it
available; a guessed or mismatched URL never qualifies.

### 8. Compare with cumulative private history

Compare the newly mapped skills with all prior reviewed observations. Look for:

- duplicate photographs of the **same assignment item** (reuse the private
  observation ID; do not score it again)
- repeated misses
- improvement over time
- retention after apparent mastery
- recurring error categories
- generalization across different assignments
- skills with too little evidence to classify

Do not turn a single worksheet into a trend. Separate verified `studiedOn`
dates from intake-only `addedOn` dates; uploading old work on multiple days
must never establish a new assessment date or mastery. Likewise, uploading
an older undated worksheet cannot become a verified recent miss or reset a
retention review interval. Keep undated misses visible in the private
`review-undated` queue without assigning an unsupported schoolwork date.
A verified `studiedOn` date cannot fall after the `addedOn` intake date,
and no observation can have
`addedOn` later than its batch's `asOf`. Distinct photographs of the same
identified assignment do not count as distinct assignments toward mastery. Supply stable private
`assignmentId` and `questionId` identifiers where the reviewed page supports
them, even when different photographs show the same question.

### 9. Update private learning state

Run the private learning-history processor. It maintains the operational states:

- `not-enough-evidence`
- `learning`
- `improving`
- `mastered`

“Mastered” is a conservative household study-planning flag, not a diagnosis, school
grade, standardized score or psychometric claim. See `docs/LEARNING_HISTORY.md` for
the exact evidence rule.

The private history and observation batch must resolve outside the public
repository even when paths pass through symbolic links. The processor creates
new history files with owner-only 0600 permissions and new directories with
0700 permissions on POSIX systems; secure existing private folders separately.
Never place a private batch in the public repository.

The private history must resolve outside this public repository:

```sh
node scripts/learning-history.mjs \
  /path/to/private-learning/history.json \
  /path/to/private-learning/reviewed-observations.json

node scripts/learning-history.mjs \
  /path/to/private-learning/history.json \
  /path/to/private-learning/reviewed-observations.json \
  --write
```

Dry-run first. Review the derived status/trend/practice queue, then write.

### 10. Determine targeted practice

Use the private practice queue to decide what practice is useful now. Prefer small,
specific practice sets aimed at the evidenced skill rather than generic subject-wide
worksheets. Include retention checks for older mastered skills when appropriate.

The private reason for targeting a skill is not published. Public ABVM content may
contain original practice for the skill, but it must not say that the learner is weak,
behind, incorrect, or struggling.

### 11. Publish privacy-safe cumulative material to ABVM

Write concise notes and original age-appropriate practice, with one correct choice,
plausible distinct distractors, an explanation and source fact. Retain existing
cumulative history.

The public batch continues to use the same schema as `pages/data/schoolwork.json`:

```json
{
  "schemaVersion": 1,
  "uploadedPhotoCount": 1,
  "sourceManifest": [
    {
      "id": "worksheet-2026-10-12-01.jpeg",
      "sha256": "<64 lowercase hex characters>",
      "status": "integrated"
    }
  ],
  "lessons": []
}
```

Every integrated source needs a reviewed lesson. Each lesson requires `id`, `title`,
`subject`, `sources`, `skills`, `notes`, `studiedOn`, `addedOn`,
`dateStatus` and `questions`; match the existing question schema. Religion lessons
may include an exact integer `chapter`.

The standalone release validator (`node scripts/validate-schoolwork.mjs`) **requires**
`sourceManifest` even if a legacy library caller explicitly uses the validator's
optional no-manifest mode. Never publish a manifest-free JSON pack merely because
the lesson source count appears to match `uploadedPhotoCount`.

A dated *week* may be supplied through optional `weekOf` (ISO date for that
week's Monday) **only** when the parent or source independently identifies the
school week. Leave `studiedOn: null` when no exact homework day is known, and
write a `dateStatus` mentioning the unknown day. For example, the photographed
October 9 spelling practice confirms the week of 2026-10-05 but not the day.
This week-only evidence enters weekly review during that week and remains
cumulative afterward. It must not be relabeled as an exact Monday assignment.

Every question requires an ID, subject, skill, prompt, answer, choices, explanation,
sourceFact and provenance.

Public JSON remains fail-closed by object shape. The validator permits only:

- root: `schemaVersion`, `uploadedPhotoCount`, `distinctWorksheetNote`,
  `lessons`, `sourceManifest`
- lesson: `id`, `title`, `subject`, `sources`, `skills`, `notes`,
  `studiedOn`, optional verified Monday `weekOf`, `addedOn`, `dateStatus`, optional `chapter`, `questions`
- question: `id`, `subject`, `skill`, `prompt`, `answer`, `choices`,
  `explanation`, optional `hint`, `sourceFact`, optional `tier`,
  `questionType`, `difficulty`, `dok`, `domain`, `standards`, and
  `provenance`
- manifest source: `id`, `sha256`, `status`, optional `duplicateOf`,
  optional `reason`

Unknown keys are rejected rather than silently published. This blocks accidental
student-name fields, raw OCR transcripts, answer-sheet text, teacher marks, private
URLs and nested metadata. Structural validation does not prove allowed free text is
private-data-free, so manual value-level privacy review remains required.

Manifest statuses:

- `integrated`: the source must be linked to a reviewed lesson, and its exact
  SHA-256 may have only one `integrated` canonical ID, regardless of manifest
  ordering. The canonical identity cannot be duplicated under another name.
- `duplicate`: link directly to an `integrated` canonical using `duplicateOf`;
  differing hashes require a `reason` (semantic rephotograph). Every lesson
  citing the duplicate must also cite that canonical ID. A duplicate does not
  authorize a separate lesson, question bank, or invented source coverage.
  Duplicate chains are not accepted.
- `held`: provide a `reason`; the image is accounted for but **must not**
  appear in any published lesson's `sources`. Its unclear content cannot
  justify public notes, questions, weekly materials, or test preparation.
  Only duplicate entries may contain `duplicateOf`.

A held source is not permanently frozen. If later review can safely resolve it, keep
the **same source ID and exact SHA-256**. A `held → integrated` transition must include
a valid reviewed lesson that references that source. A `held → duplicate` transition
must point directly to an `integrated` canonical source and include a reason. Digest
changes, status downgrades, duplicate chains, and renaming the same bytes to work
around a held record are rejected.

Each public batch must be self-contained for validation. When a new photo adds
provenance to an existing lesson, include an unchanged reviewed copy of that lesson
with the new source(s). The merger preserves the existing `addedOn` and unions
sources. Different educational content under an existing lesson ID is rejected for
explicit review, not silently overwritten. Potential semantic duplicate lesson titles
are also held for consolidation.

### 12. Update weekly and test-prep surfaces only when warranted

Only source-supported dates/topic mapping place material in the weekly section or a
specific test. Upload date alone never makes material current-week work.

Never infer upcoming tests from a worksheet number, file timestamp, upload date, or
private performance history. Test prep follows the existing verified calendar,
including equal coverage for multiple tests on the next test day.

After the public batch is merged, verify cumulative/weekly filtering, next-test
rollover, Religion priority, game selection and mobile layout.

## Validate, merge and publish

For the public ABVM batch, from repository root:

```sh
node scripts/integrate-schoolwork.mjs pages/data/schoolwork.json /tmp/reviewed-public-batch.json
node scripts/integrate-schoolwork.mjs pages/data/schoolwork.json /tmp/reviewed-public-batch.json --write
node scripts/validate-schoolwork.mjs
node --test tests/schoolwork-intake.test.mjs
node --test tests/learning-history.test.mjs
npm run qa:static
npm run qa:unit
```

Dry-run is the default. The public writer validates before mutation, uses an exclusive
intake lock, checks for concurrent changes, and atomically renames a temporary file.
Identical replays are no-ops. Do not commit temporary batches, private observation
batches, private histories or lock files.

Then run relevant browser tests. Inspect the diff for private information manually:
schema validation cannot prove privacy or educational accuracy. Use the established
GitHub workflow, preserving required checks. Verify the deployed revision and a live
study smoke check before saying it is live. If blocked, report what is prepared versus
published and the exact failed gate.

Report photos received, source dispositions, private observations added, skill-history
changes at a high level, new/reused public lessons, public question count, missing
dates or held content, and publication status. Keep the parent-facing answer short and
never imply a background watcher.

## Lunch menus in the batch

Lunch menu photos follow `docs/LUNCH_ART.md` as part of this same integration run.
After the official menu transcription is reviewed, automatically complete its
illustrations through reviewed asset reuse or built-in high-quality image creation,
then test and publish the menu and artwork together through a PR. This requires no
separate parent request. The GitHub merge-event backup is configured but paused at the
account task limit; see `docs/LUNCH_ART.md`. It is not a watcher of private chat
attachments.
