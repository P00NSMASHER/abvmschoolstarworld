# ABVM Howard Avenue sign — original approved asset restoration

**Review-only repair:** [PR #315](https://github.com/P00NSMASHER/abvmschoolstarworld/pull/315). Do not deploy before the independent human source/privacy checks and physical iPhone review required for the combined premium release.

- The owner uploaded a 650 × 433 photo of the Assumption BVM Howard Avenue entrance sign on 2026-10-11; it confirms the correct location and subject.
- Rather than recompress that JPEG, the exact previously approved 420 × 280 WebP was recovered from an existing ZIP source artifact. It is 24,164 bytes and has SHA-256 `e0ba8feebe0ca8484492a85f686d64774ad6603a846469d7a29b584912d4ff11`, matching the original photo manifest. It is byte-for-byte the approved version, not synthetic imagery.
- The original main asset was truncated at 15,009 bytes and could not decode. The restored photo changes only that one binary image in the original PR. No student identity or learning data is included.
- Dedicated Node regression verifies the complete RIFF length and approved SHA-256; browser regression requires real WebP decoding in the tested engines.
- A previously known, unrelated October 9 school-reminder browser fixture was failing after its expiry. Restore the exact three-line October 8 frozen clock already proven by PR #291; no school notice or expiration semantics change.
- Extend independent-QA triggers for school photos, and require exact candidate source snapshots and full App/independent QA to succeed before considering the repair technically accepted.
- Existing protected source-parity checks are intentionally not bypassed: a merged asset repair would become the reviewed current-main baseline before the combined premium PR #309 is reconsidered. PR #309's own human approval requirements still apply.

**Do not merge** this standalone asset fix or any premium release until the owner-authorized release conditions are satisfied. Four unapproved Reading/ELA curriculum families remain HOLD.
