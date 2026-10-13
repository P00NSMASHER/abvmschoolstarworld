# ABVM Reading/ELA PR #270 — privacy-safe pilot handoff

**Status:** Prepared protocol only; no pilot conducted here. All 32 questions remain held, unpublished and disabled by default. This document is neither student-use evidence nor a publication authorization.

## Immutable question set

Review the complete 32-question packet in REVIEW_PR270.md and the four held JSON manifests. Use the current PR head and run "node scripts/audit-held-curriculum-pilot.mjs" to obtain a content fingerprint of the precise edited question set. A new question, answer, hint or DOK edit requires an updated content fingerprint and renewed human review. A Git merge that does not alter the question content may change the commit SHA but not the fingerprint.

The owner reports renewed approval from a teacher. That statement is recorded in the PR discussion but is **not independently authenticated** by automated tooling. Confirm reviewer identity, authority and the reviewed content fingerprint through the approved private process before promotion.

## 1 — Synthetic preflight (safe to run without a learner)

Run "node scripts/audit-held-curriculum-pilot.mjs" and "node --test tests/curriculum-pilot-gates.test.mjs".

These checks exercise all 32 questions with 96 deterministic synthetic answer selections (32 keyed correct, 64 incorrect) and inspect all 32 hints. The synthetic checks detect malformed manifests, missing sources, duplicate options, broken answer references, questionable DOK labels and release-gate tampering. They do **not** test real student comprehension, grade-level reading fluency, educational suitability, or the live learning interface. All results are aggregate, ephemeral and free of learner information.

### Offline practice preview for an authorized educator

From a private local checkout run `node scripts/build-private-curriculum-pilot.mjs`. The command emits a temporary, owner-only `educator-pilot.html` outside the repository. Open that file locally in a browser; it uses only embedded data/styles/scripts, a locked-down Content Security Policy, no networking, no service worker, no browser storage and no telemetry. Practice choices and hint/explanation toggles exist only in the currently open tab and clear on refresh or the Reset button. The file contains **no real pilot observations**. Its content fingerprint is displayed for matching the exact questions to the separately retained educator review.

Never upload the preview to the public app, host it online, or store filled-in student results in the repository. The script refuses to write under this Git checkout and refuses to overwrite an existing output file. Only qualified, permissioned human observations retained privately can contribute to genuine safe-usage evidence.

## 2 — Private human pilot (cannot be simulated into existence)

Only an authorized educator/guardian should decide whether and how to conduct a short, supervised pilot in a suitable private environment. No experimental curriculum is placed in the public app. The examiner should use the exact revised packet, manually review every question, and assess comprehension, reading load, distractor plausibility, answer explanations and strategy hints.

Record evidence securely outside this public repository. **Do not commit student names, school identifiers, accounts, individual responses, scores, photos, dates tied to a child or other identifiable observations to GitHub.** Avoid small-group breakdowns or other details that could re-identify a learner. Obtain any appropriate permission before collecting real data; do not assume reported approval authorizes pilot participation. If a question is ambiguous or causes repeated confusion, stop and revise the item under a new immutable version.

## 3 — Human evidence handoff (blank until genuinely observed)

The responsible reviewer records in an access-controlled location:

- **Content fingerprint and immutable PR head reviewed:** ________
- **Authorized educator/guardian reviewer role and securely retained approval evidence:** ________
- **Permission and privacy safeguards verified:** ________
- **Pilot method, real observations and limitations:** ________
- **Issues found, item-level decisions and corrective actions:** ________
- **Decision on whether safe-usage evidence is sufficient:** Pending
- **Evidence location (private; publicly reference only an opaque, non-identifying ID):** ________
- **Written release authorization:** Pending

**Never substitute** this template, synthetic-answer totals, a passing GitHub workflow, an owner-reported teacher approval or fabricated learner scores for actual pilot evidence.

## 4 — Governed release gate

A separate, reviewed curriculum-registry integration PR and exact-head application/independent QA must succeed after evidence approval. Preserve the original teacher/source metadata and all blocked defaults. Only a qualified authorized human may approve a release through the governed manual promotion mechanism. All four candidates remain in HOLD, with enabledByDefault=false and automaticPromotion=false, until then.

The scheduled teacher refresh, existing privacy policy, notification behavior and public Pages deployment are out of scope.
