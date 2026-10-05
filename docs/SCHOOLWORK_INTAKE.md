# Schoolwork intake through ChatGPT

The parent sends photos in ChatGPT and says:

> Integrate this schoolwork into the ABVM app. I’m finished sending the batch.

If they give a wait-until-finished instruction, collect the batch without beginning
work until that signal. This process is executed by the next requested agent run;
it is not an always-on chat watcher. No in-app upload section, paid OCR service,
new account or background task is required. A future chat must have the photos and
access to this repository; the agent discovers this process in root `AGENTS.md`.

## 1. Reconcile before extracting

Read root instructions, current remote state, `pages/data/schoolwork.json`,
its `sourceManifest`, existing weekly sources and the religion source adapter.
Do not recreate material already integrated. Inspect every supplied photo directly;
OCR may assist reading but is not evidence of accuracy on its own. Hash the original
bytes using SHA-256. Record each non-identifying source ID, digest, and disposition.
Do not put raw images, full OCR transcripts, student names, marks/grades, identifiers,
handwriting profiles or answer sheets in this public repository.

A missing or unreadable file stays held with a precise reason; do not silently
claim all photos were incorporated. If attachments cannot be read, finish other
available work and report the specific missing filenames.

## 2. Review educational content

Extract the printed topic, source-backed concepts, chapter and any supported date.
Check answers independently; a child's written answer or teacher mark is never an
answer key. Write concise notes and original age-appropriate practice, with one
correct choice, plausible distinct distractors, an explanation and source fact.
Retain existing cumulative history. Collapse exact repeated photos and semantic
rephotographs into the same lesson while accounting for every photo in the manifest.

`studiedOn` is the supported classroom date or `null`. `addedOn` is the actual intake
day in America/New_York and does not imply classroom timing. Use “Undated schoolwork”
when timing is unknown. Only source-supported dates/topic mapping place material in
the weekly section or a specific test. Never infer upcoming tests from a worksheet
number, file timestamp or upload date. Test prep follows the existing calendar,
including equal coverage for multiple tests on the next test day.

For Religion, establish the exact chapter from source evidence. Prioritize the
verified official Christ Our Life interactive review link for that chapter. The
known entry point is https://isr.christourlife.com/col_g2_s2. Check the repository's
current religion adapter and chapter contracts rather than guessing URL semantics.
Official review is a prioritized link experience, not a copied third-party bank.
Keep source-backed original practice available as a clearly labeled fallback.
For a new chapter, add its exact worksheet-supplied publisher URL and chapter to
`pages/data/religion-sources.json`, then run `node scripts/check-religion-sources.mjs`.
The verifier checks the page and matching question-data identity before marking
it available; a guessed or mismatched URL never qualifies.

## 3. Prepare a reviewed batch

The batch has the same schema as `pages/data/schoolwork.json`:

```json
{
  "schemaVersion": 1,
  "uploadedPhotoCount": 1,
  "sourceManifest": [
    {"id": "worksheet-2026-10-12-01.jpeg", "sha256": "<64 lowercase hex characters>", "status": "integrated"}
  ],
  "lessons": []
}
```

This skeleton is intentionally incomplete: every integrated source needs a reviewed
lesson. Each lesson requires `id`, `title`, `subject`, `sources`, `skills`, `notes`,
`studiedOn`, `addedOn`, `dateStatus` and `questions`; match existing question schema.
Religion lessons may include an exact integer `chapter`. Every question requires
an ID, subject, skill, prompt, answer, choices, explanation, sourceFact and provenance.

Manifest statuses:

- `integrated`: the source is linked to a lesson.
- `duplicate`: link to the canonical source using `duplicateOf`; differing hashes
  require a `reason`, such as the same worksheet photographed twice. Link both
  photo IDs to the shared lesson. Duplicate chains are not accepted.
- `held`: provide a `reason`; the image is accounted for but its unclear content is
  not invented or silently added to practice.

Each batch must be self-contained for validation. When a new photo adds provenance
to an existing lesson, include an unchanged reviewed copy of that lesson with the
new photo source(s). The merger preserves the existing addedOn and unions sources.
Different educational content under an existing lesson ID is rejected for explicit
review, not silently overwritten. Potential semantic duplicate lesson titles are
also held for consolidation. If revisions to an existing lesson are truly needed,
review a deliberate repository diff and run all the same gates.

## 4. Validate, merge and publish

From repository root:

```sh
node scripts/integrate-schoolwork.mjs pages/data/schoolwork.json /tmp/reviewed-batch.json
node scripts/integrate-schoolwork.mjs pages/data/schoolwork.json /tmp/reviewed-batch.json --write
node scripts/validate-schoolwork.mjs
node --test tests/schoolwork-intake.test.mjs
npm run qa:static
npm run qa:unit
```

Dry-run is the default. The writer validates before mutation, uses an exclusive
intake lock, checks for concurrent changes, and atomically renames a temporary file.
Identical replays are no-ops. Do not commit temporary batches or lock files.

Then run relevant browser tests for cumulative/weekly filtering, next-test rollover,
religion priority, game selection and mobile layout. Inspect the diff for private
information manually: schema validation cannot prove privacy or educational accuracy.
Use the established GitHub workflow, preserving required checks. Verify the deployed
revision and a live study smoke check before saying it is live. If blocked, report
what is prepared versus published and the exact failed gate.

Report photos received, source dispositions, new/reused lessons, question count,
missing dates or held content, and publication status. Keep the parent-facing answer
short and explain any genuine limitation instead of implying a background watcher.
