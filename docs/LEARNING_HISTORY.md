# Private cumulative learning history

The public ABVM repository intentionally does **not** store the learner's answers,
teacher marks, grades, handwriting, or performance history. Those observations are
useful, but they are private educational records. Keep them in a separate private
location and use this repository only for the processor and privacy-safe app content.

## Canonical model

Every reviewed schoolwork photo follows this evidence chain:

1. Preserve the original photo privately and compute its SHA-256.
2. Identify the assignment, subject, supported classroom date, and source.
3. Extract the printed questions or tasks.
4. Identify the learner's responses.
5. Identify teacher markings/corrections when visible.
6. Independently determine correctness; teacher marks are evidence, not an answer key.
7. Map each item to one or more academic skills.
8. Compare those skills with the cumulative private history.
9. Update evidence counts, confidence, trend, and operational learning state.
10. Select targeted practice or a retention check from the evidence.
11. Publish only reviewed, privacy-safe educational notes/practice to ABVM. Never publish
   raw responses, grades, teacher marks, or a label saying a child is weak at a skill.
12. Update weekly/test-prep surfaces only when the source actually supports that week or
   an existing verified test. Upload date alone never creates weekly/test placement.

The private operational states are:

- `not-enough-evidence`
- `learning`
- `improving`
- `mastered`

"Mastered" is deliberately conservative: the processor requires three most-recent
scored observations to be independently correct, spanning at least two distinct
reviewed assignments (falling back to source-photo IDs for legacy observations
without an assignment ID), and two independently verified `studiedOn` dates. An `addedOn` upload/intake date
is **not** evidence of when a worksheet was completed. Without verified studied
dates, correctness observations still support targeted practice, but the
processor cannot assert chronological improvement, slipping, or mastery.
A later upload of older undated work does not reverse already verified
chronological mastery or reset the retention clock. With fully dated scored
work, the private confidence heuristic retains its chronological weighting
over the five most recent scored items. If any scored observations are
undated, all scored items receive equal weight instead: changing the
upload order must not inflate a confidence estimate. This confidence
value is a household planning aid, not a grade or calibrated probability. Dated observations alone
set the chronological order; an undated incorrect/partial item remains
eligible for a separately labeled private `review-undated` practice target,
not a claim of a recent miss. That review target is considered resolved
only when independently dated mastery is established at a study date
**strictly after** the undated worksheet's intake date. A same-day
assessment, or old work uploaded after mastery, retains the conservative
review target. The original private observation is never deleted.

When a worksheet is photographed again, reuse the original observation IDs.
Use stable `assignmentId` and `questionId` in reviewed private observations to
identify an item across source photos; the processor rejects the same assignment
item under a new observation ID, including harmless case/spacing variations.
When assignment identity cannot be established, keep the evidence provisional:
the processor cannot infer that two differently named photos are distinct items.

"Mastered" is a household study-planning flag, not a diagnosis,
standardized score, school grade, or psychometric claim.

## Error taxonomy

Use the narrowest supported category:

- `knowledge-gap`
- `concept-gap`
- `procedure-error`
- `reading-comprehension`
- `recall`
- `careless-attention`
- `unknown`

Do not infer attention, reading difficulty, or any other cause from one miss. Use
`unknown` until repeated evidence supports a more specific category.

## Reviewed private observation batch

Store this file outside the public repository:

```json
{
  "schemaVersion": 1,
  "intakeId": "2026-10-07-schoolwork-01",
  "asOf": "2026-10-07",
  "observations": [
    {
      "id": "obs-2026-10-07-001",
      "sourceId": "IMG_0001.jpeg",
      "assignmentId": "math-page-42",
      "questionId": "4",
      "subject": "Math",
      "skill": "two-digit-addition-regrouping",
      "studiedOn": null,
      "addedOn": "2026-10-07",
      "result": "incorrect",
      "errorType": "procedure-error",
      "independence": "independent",
      "confidence": 0.95,
      "responseSummary": "Optional private summary of the response",
      "teacherMarkSummary": "Optional private summary of the visible correction",
      "note": "Optional private review note"
    }
  ]
}
```

The response and teacher-mark summaries are optional and private. They are never
copied into `pages/data/schoolwork.json`.

## Processor

Dry-run first:

```sh
node scripts/learning-history.mjs \
  /path/to/private-learning/history.json \
  /path/to/private-learning/reviewed-observations.json
```

Then write after review:

```sh
node scripts/learning-history.mjs \
  /path/to/private-learning/history.json \
  /path/to/private-learning/reviewed-observations.json \
  --write
```

Both paths must resolve outside this public repository, including through
symbolic links and existing parent directories. The processor resolves physical
paths before reading/writing private files, creates new history directories
with owner-only permissions (0700), and writes new/replaced history JSON with
owner-only permissions (0600) on POSIX systems. Explicit `--write` replays
also tighten the mode of an unchanged legacy history file. It cannot repair permissions
on pre-existing directories; keep those private too. The processor is
idempotent and fails closed if the same observation ID is reused for different
evidence.

An explicit `--write` intake acquires the exclusive `.lock` **before** reading
the current ledger, so a second intake cannot calculate against an outdated
pre-lock snapshot. The updated ledger replaces the file atomically; failed
temporary writes are cleaned before releasing the lock. A concurrent invocation
may fail with `EEXIST` while the lock is held: retry that reviewed batch
after the first writer finishes. A dry-run does not acquire a lock or mutate
history, and is an informational snapshot rather than a reservation to write.
Do not manually remove an active writer's lock.

The generated private history contains the chronological evidence ledger, derived
skill summaries, common error categories, trend, confidence, and a short prioritized
practice queue. Use that queue to author privacy-safe original practice in the normal
schoolwork batch. The public app does not receive the private queue itself.

## Storage recommendation

A separate **private** repository or encrypted private folder is appropriate for the
history JSON and original photos. Do not use Git history as a photo album in the
public ABVM repository. If a private repository is used, keep original images in
private release/storage assets or another private file store when volume grows, and
commit only the structured evidence plus stable image references/hashes.
