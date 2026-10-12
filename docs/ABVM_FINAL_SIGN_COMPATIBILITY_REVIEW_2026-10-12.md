# ABVM final-candidate sign restoration — integration review (October 12, 2026)

**DRAFT QA ONLY. Do not merge, deploy, approve curriculum, or alter scheduled tasks.**

- Parent: final comprehensive ABVM premium/schoolwork review [PR #317](https://github.com/P00NSMASHER/abvmschoolstarworld/pull/317), exact `bd2c68850cde40b0d49bcced1326b82398d8e95e`.
- Exact approved asset: school sign from reviewed [PR #315](https://github.com/P00NSMASHER/abvmschoolstarworld/pull/315), exact `a2079e2643abaf0b89e595862c290155be3d7e0c` Git blob and SHA-256 `e0ba8feebe0ca8484492a85f686d64774ad6603a846469d7a29b584912d4ff11`. It is 24,164 bytes and 420 × 280 pixels. Never a generated/re-encoded substitution.
- Truncated original in main: Git blob `5a3489367ffc277737aa64a6669662541bea95d3` (15,009 bytes), whose RIFF length disagrees with the file size.
- Preserve all original 23 photo manifest references, 13 lessons, 67 original-practice questions, teacher timestamps, privacy boundaries and educator HOLDs. Do not commit any original private worksheet images or child responses.

## Protected source parity: narrow additional verification, NOT general bypass

The existing read-only source-parity workflow still compares **every protected path** to newest main. Only on this exact named review-head branch may it accept a **single modified file** at `pages/assets/school/abvm-school-sign.webp`, and only when both Git blobs and the decoded bytes match pinned reviewed values. Any other protected modification, new main asset version, wrong hash, alternate filename, or missing expected asset fails closed. The original parity behavior is unchanged on main and every other PR.

New unit tests exhaustively exercise alternate protected modifications, deletions, wrong blobs and corrupt bytes. Dedicated browser test calls `Image.decode()` to prove that the restored sign can render in Chromium and WebKit. Full App and independent QA must pass at the new combined head; the preserved original photo is expected in the PWA shell for offline cache. Human educational/privacy and physical-device review remain required.

## Release gate

Even if these checks pass, this integration is **NOT an approved production release**. Confirm issue #307 date discrepancies, external education/source/photo privacy signoffs, real physical iPhone Safari testing, explicit owner release approval on the final composite SHA, and up-to-date main reconciliation. Keep all four Reading/ELA families on HOLD. Do not merge the parent reviews or this one until separately authorized.
