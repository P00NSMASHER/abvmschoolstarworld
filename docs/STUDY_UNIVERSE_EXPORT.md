# Study Universe content export

`scripts/build-study-universe.mjs` converts the reviewed public study pack into one
content-only JSON bundle for reuse outside the web app. It produces current-subject
practice, a mixed review, selectable verified-test practice, printable one-page guide
inputs, 9:16 short-form learning storyboards, and server-authoritative Roblox classroom
packets.

Run:

```sh
node scripts/build-study-universe.mjs artifacts/study-universe.json
```

The deterministic priority is current school material, then cumulative reviewed
material, then original STAR-style fallback. The export says explicitly that fallback
items are original practice rather than official STAR content or score predictions.
Named-test packets are skill practice only; they do not claim to reproduce hidden
teacher-test questions.

The exporter fails closed on malformed choices or answer keys. Its schema contains no
learner responses, grades, teacher marks, private learning history, student identifiers,
or private targeting reasons. A private learning queue may choose a skill before the
export runs, but that evidence must stay in the private layer described in
`docs/LEARNING_HISTORY.md`.

## Version 2 classroom contract

The exporter consumes the same QA-passed teacher pack, provenance-backed cumulative
archive, reviewed original `schoolwork.json` practice, and original `buildStarBank`
used by the web app. Undated worksheets remain cumulative; they are never relabeled
as this week's lessons. A parent-confirmed school `weekOf` is separately
reviewed evidence of weekly relevance without inventing an exact practice
day; questions in that week are current until the week ends, then cumulative. Raw worksheets, source photo names/hashes, response history,
grades, and private targeting reasons do not enter the bundle.

Every subject packet and the mixed queue contains the complete pool in strict
current → cumulative → STAR order, with stable source question IDs. A consumer must
exhaust unseen questions in an earlier tier before presenting the next tier; it
must not randomly weight all three tiers together. Duplicate IDs with different
content and conflicting keys for the same prompt fail. Reordered choices keep the
same identity. Capitalization choices remain distinct when the skill requires it.

Named test IDs include date and the full teacher announcement. The existing web
matcher supplies the grammar/spelling/reading/chapter boundaries; the export also
restricts named arithmetic to the announced operation and recognizes `Ch. 3`.
Test packets exclude STAR and unrelated chapters. Unsupported/incomplete test scope
is explicitly unavailable, not filled with plausible-looking unrelated questions.
These are original skill questions, never an assertion about hidden teacher tests.
The teacher announcement is independent of the game NPC who delivers a question.

The schema uses an explicit field allowlist, strict string/numeric checks, exact
teacher-page hashes and reviewed archive source hashes. It includes a deterministic
SHA-256 content receipt. The Git source SHA must be pinned by consumers in addition
to that receipt; a self-declared hash or QA flag alone is not review authorization.
Missing dates fail instead of using the current wall clock. Source-date filtering
uses America/New_York. The packet is content-only; local web progress and Roblox
DataStore progress remain separate and private.

`Study Universe Contract` checks the exact PR head, deterministic output and real
repository compatibility. Full App QA and independent reproduction remain merge
gates. The bundle is an exchange artifact, not another editable question authority.
No Roblox publishing is triggered by this exporter.
