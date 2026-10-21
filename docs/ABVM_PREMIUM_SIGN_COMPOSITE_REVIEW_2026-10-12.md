# Premium ABVM composite release candidate — sign-integrity review (2026-10-12)

**HISTORICAL ARTIFACT; HUMAN ASSET-SIGNOFF BLOCKER RETIRED.** As of the
owner's October 20, 2026 directive no ABVM human reviewer is required to
approve a fix or release. Exact original-asset checksums, independently
verified source identity, privacy, render quality, QA and Pages parity are
still required. Missing original bytes or failed parity remain blocked on
verifiable evidence, not on someone's signature. The dated report below is
archived evidence, not today's release gate.

Review branch: PR #317. Original image provenance: draft PR #315.

- Restored exact Git blob `a2079e2643abaf0b89e595862c290155be3d7e0c` at `pages/assets/school/abvm-school-sign.webp`, identical to approved SHA-256 `e0ba8feebe0ca8484492a85f686d64774ad6603a846469d7a29b584912d4ff11` (24,164 bytes, 420×280 WebP). No photo was recreated.
- Premium Today shows that same asset in its own accessible card, retaining the existing school hero photo. No learner-data, saved progress, teacher-source, curriculum or school-date mutations.
- Node RIFF/digest test, real browser image decode, responsive school-photo checks, source archive and independent full QA are required on **the composite head commit**, not separate component PR results.
- Service worker cache name, shell CSS/JS URLs and page reload guard move from v166 to v167 to serve repaired bytes to existing offline installs; no localStorage, IndexedDB or learner-progress reset is introduced.
- The existing protected-source-parity workflow intentionally stays **unchanged**. With main still holding the corrupted school photograph, its strict comparison will flag this approved-intent asset delta. Do not mark its failure green, suppress the workflow, expand exclusions or represent parity as passed. Human original-asset approval and reconciliation with main are needed before release.
- Preserve issue #307 unresolved conflicting dates, PR #270 Reading/ELA HOLDs, schoolwork original-value educational/privacy checks and physical iPhone Safari acceptance. No merge, Pages deployment, source timestamp reset or task mutation permitted without final release authorization.
