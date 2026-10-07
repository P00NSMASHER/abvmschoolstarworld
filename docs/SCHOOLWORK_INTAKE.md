# Schoolwork intake through ChatGPT

The parent sends schoolwork photos in ChatGPT and, when a batch is complete, asks
for the schoolwork to be integrated into the ABVM app. If the parent says to wait
until they are finished sending a batch, wait. Intake begins only after that signal.

This is the canonical school-photo workflow. It is intentionally cumulative: every
new page is evaluated against prior evidence so the system can distinguish a one-off
mistake from a persistent skill need, improvement, retention, or mastery.

The public ABVM repository is not a private student record. Raw photos, OCR dumps,
student names, handwritten answers, teacher marks, grades/scores, handwriting
profiles, and child-specific performance histories must not be committed here.
Steps that inspect those details happen in the private review context. Only
privacy-safe educational material and non-identifying provenance may be published
to this repository. If a private longitudinal archive is configured, child-specific
learning evidence belongs there. If it is not configured, prepare the private
archive delta separately and do not weaken this boundary just to finish intake.

## The 12-step school-photo workflow

### 1. Preserve the original source

Inspect every supplied attachment directly and preserve its source identity before
doing educational analysis. Compute a SHA-256 digest of the original bytes and
reconcile it against the existing `sourceManifest`. Exact duplicates and semantic
rephotographs must be accounted for rather than silently counted twice.

Do not commit the raw image itself to this public repository. If an attachment is
missing or unreadable, keep it held with a precise reason.

### 2. Identify the assignment and supported date

Determine the subject, worksheet or assignment title, assessment type when known,
chapter/lesson when supported, and any date that is actually evidenced by the page
or trusted school source.

Do not infer a classroom date from upload time, file metadata, page number, or
worksheet sequence. `studiedOn` remains `null` when the date is unknown.

### 3. Extract the questions and printed task

Read the printed questions, directions, diagrams, vocabulary, or task structure
needed to understand what the page is assessing. OCR may assist, but OCR alone is
never authoritative.

Extract only what is necessary for educational review. Full OCR dumps and answer
sheets are private working material and must not be published.

### 4. Identify the student's responses

Privately identify the student's written or selected response for each scorable
item that can be read confidently. Mark unreadable or ambiguous responses as
unknown rather than guessing.

Student responses are evidence for analysis, not public content. Do not commit
handwritten answers or a reconstructed answer sheet to this repository.

### 5. Identify teacher markings and corrections

Privately record visible teacher checks, crosses, circles, corrections, comments,
or other scoring signals when they are legible. Treat them as evidence about how
the page was graded, not as the answer key.

Teacher markings, grades, and comments that identify or evaluate the student are
not published to this public repository.

### 6. Determine correct and incorrect independently

Check each scorable response independently using the underlying academic content.
A student's answer or a teacher mark is never accepted blindly as the answer key.

For each reviewed item, distinguish at minimum:
- correct,
- incorrect,
- partially correct when the task genuinely permits it,
- unreadable/insufficient evidence,
- not scorable.

When an incorrect response is interpretable, classify the likely error as one of:
knowledge gap, concept gap, procedure error, reading/comprehension, recall,
careless/attention, or unknown. Error classifications are evidence, not diagnoses.

### 7. Map every scorable problem to academic skills

Map each reviewed item to one or more stable skill IDs at the most useful level of
specificity. Prefer skills that can recur across assignments, such as regrouping,
fact families, place value, short-i/long-i discrimination, sentence subjects, or
reading comprehension, rather than one-off worksheet labels.

Keep the educational content layer separate from the performance layer: public
ABVM practice may reference the skill, while child-specific success/error evidence
stays private.

### 8. Compare the skills with longitudinal history

Before deciding what the page means, compare each observed skill with prior
evidence. Look for:
- frequency of success and errors,
- recency,
- improvement or regression,
- retention after a gap,
- transfer to a different question format,
- repeated error types,
- evidence across multiple assignments.

One worksheet does not establish mastery or a persistent problem by itself.

### 9. Update mastery and confidence states

For every skill with new evidence, update the longitudinal state using:

`not-enough-evidence -> learning -> improving -> mastered`

A state change must be supported by repeated evidence across separate assignments,
not a single correct or incorrect item. Track confidence separately from state so
thin evidence cannot masquerade as certainty.

A later miss after prior mastery should create a retention/review signal rather
than automatically erasing the whole history.

The child-specific evidence and mastery state belong in the private longitudinal
archive, not in the public ABVM repository.

### 10. Decide whether targeted practice is warranted

Generate or select practice from the cumulative evidence, not merely from the most
recent page. Practice should target the smallest useful need and then include one
or more transfer items to verify that the skill generalizes.

Examples:
- repeated regrouping errors -> focused regrouping practice plus mixed subtraction,
- vocabulary recall weakness -> spaced retrieval rather than unrelated reading,
- isolated careless slip with otherwise strong evidence -> no remediation flood.

Do not turn every wrong answer into a large practice set.

### 11. Update the cumulative ABVM learning record

Update the cumulative record so future schoolwork can be interpreted in context.
The longitudinal record should preserve, per skill, the evidence timeline,
mastery state, confidence, recurring error patterns, improvement, retention, and
the interventions that were tried.

Public `pages/data/schoolwork.json` remains the privacy-safe educational layer:
reviewed lesson notes, stable skill IDs, original practice, source hashes and
non-identifying provenance only. It is not the child-specific performance ledger.

If a private archive is available, update it in the same intake run. If it is not,
produce a private archive delta and explicitly report that persistence is pending;
never publish private performance history here as a workaround.

### 12. Update the current week and test-prep views only when relevant

Use the newly reviewed material in the current weekly section only when a supported
classroom date places it in that week. Use it in test prep only when an existing
verified assessment or trusted school source establishes that the material is
relevant to that test.

The cumulative archive always retains useful evidence even when the worksheet is
undated or no longer current. Weekly and test-prep views are projections of that
history, not the history itself.

## Public reviewed-batch schema

The privacy-safe batch still uses the same public schema as
`pages/data/schoolwork.json`:

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

Every integrated source needs a reviewed lesson. Each lesson requires `id`,
`title`, `subject`, `sources`, `skills`, `notes`, `studiedOn`,
`addedOn`, `dateStatus`, and `questions`; Religion lessons may include an exact
integer `chapter`.

Each question requires an ID, subject, skill, prompt, answer, choices, explanation,
source fact and provenance. Public practice questions must be original reviewed
practice, not copied worksheet answers.

Public JSON is fail-closed by object shape. The validator permits only these keys:

- root: `schemaVersion`, `uploadedPhotoCount`, `distinctWorksheetNote`,
  `lessons`, `sourceManifest`
- lesson: `id`, `title`, `subject`, `sources`, `skills`, `notes`,
  `studiedOn`, `addedOn`, `dateStatus`, optional `chapter`, `questions`
- question: `id`, `subject`, `skill`, `prompt`, `answer`, `choices`,
  `explanation`, optional `hint`, `sourceFact`, optional `tier`,
  `questionType`, `difficulty`, `dok`, `domain`, `standards`, and
  `provenance`
- manifest source: `id`, `sha256`, `status`, optional `duplicateOf`,
  optional `reason`

Unknown keys are rejected rather than silently published. This blocks accidental
metadata variants such as alternate student-name fields, raw OCR transcripts,
teacher marks, private URLs, or nested metadata objects. Manual privacy review is
still required because a schema cannot prove that allowed free text is safe.

Manifest statuses:

- `integrated`: the source is linked to a reviewed lesson.
- `duplicate`: it links directly to an integrated canonical source using
  `duplicateOf`; semantic rephotographs require a reason.
- `held`: the source is accounted for but cannot safely be integrated; include a
  precise `reason`.

Held sources may later resolve only under the same source ID and exact SHA-256.
Digest changes, status downgrades, duplicate chains, and renaming the same bytes to
launder an uncertain source are rejected.

## Religion source handling

For Religion, establish the exact chapter from source evidence. Prioritize the
verified official Christ Our Life interactive review for that chapter. The known
entry point is https://isr.christourlife.com/col_g2_s2.

Use the repository's current religion adapter and chapter contracts rather than
guessing URL semantics. Official review is a prioritized link experience, not a
copied third-party question bank. Keep source-backed original practice available as
a clearly labeled fallback.

For a new chapter, add its exact worksheet-supplied publisher URL and chapter to
`pages/data/religion-sources.json`, then run:

```sh
node scripts/check-religion-sources.mjs
```

A guessed or mismatched URL never qualifies.

## Validate, merge and publish

From repository root:

```sh
node scripts/integrate-schoolwork.mjs pages/data/schoolwork.json /tmp/reviewed-batch.json
node scripts/integrate-schoolwork.mjs pages/data/schoolwork.json /tmp/reviewed-batch.json --write
node scripts/validate-schoolwork.mjs
node --test tests/schoolwork-intake.test.mjs
node --test tests/schoolwork-workflow-contract.test.mjs
npm run qa:static
npm run qa:unit
```

Dry-run is the default. The writer validates before mutation, uses an exclusive
intake lock, checks for concurrent changes, and atomically renames a temporary
file. Identical replays are no-ops. Do not commit temporary batches or lock files.

Then run relevant browser tests for cumulative/weekly filtering, next-test rollover,
religion priority, practice selection and mobile layout. Inspect the diff manually
for private information and educational accuracy. Use the established GitHub
workflow and required checks. Verify the deployed revision and a live study smoke
check before saying it is live.

The parent-facing completion report should cover: photos received, source
dispositions, lessons added/reused, skills observed, whether any longitudinal
states changed, targeted-practice changes, missing dates/held content, and
publication status. Keep private answer-level evidence out of that public commit.

## Lunch menus in the batch

Lunch menu photos still follow `docs/LUNCH_ART.md` as part of the same integration
run. After the official menu transcription is reviewed, complete its illustrations
through reviewed asset reuse or built-in high-quality image creation, then test and
publish menu and artwork together through a pull request. This requires no separate
parent request.
