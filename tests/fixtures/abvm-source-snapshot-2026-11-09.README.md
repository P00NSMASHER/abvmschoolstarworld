# Original ABVM historical curriculum snapshot

This fixture is a public, immutable copy of `pages/data/study-pack.json` from ABVM commit `986ff19d374d282f89b326c7f5862c5e0cd1378b`. It contains original teacher-source-aligned, pre-withdrawal history, **not** current assignments or a private learner record.

Historical regression tests for October Chapter 3, Unit 1 and curriculum family quality must use this fixed snapshot so genuine future topic withdrawals do not turn valid historical behavior tests into false current-teacher failures. Current generated curriculum is still exercised by the fresh-teacher candidate workflow, build/lineage assertions and live-source withdrawal tests. Do not copy old facts back to the deployed pack or alter teacher provenance. This fixture does not authorize turning withdrawn topics into current practice.
