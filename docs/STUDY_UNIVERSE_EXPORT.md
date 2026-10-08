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
