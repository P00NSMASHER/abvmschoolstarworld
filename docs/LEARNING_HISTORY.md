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
scored observations to be independently correct, spanning at least two source photos
and two observed dates. It is a household study-planning flag, not a diagnosis,
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

Both paths are required to resolve outside this public repository. The processor is
idempotent and fails closed if the same observation ID is reused for different
evidence.

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
