# Core Engineering Hunters: homework observation timestamp provenance (2026-10-31)

## Ownership and independently reproduced defect

- Canonical code: `P00NSMASHER/abvmschoolstarworld`, `main`; existing draft PRs #451 (calendar), #453 (preview server) and #454 (reading guides) modify different files. This change does not touch their PRs or the calendar.
- Prior base `pages/homework-feed.js` blob `759303a49727125ae0edb39e4694d55c86628c32`. The old `Number.isFinite(Date.parse(value))` check accepted **2026-02-30T12:00:00Z** (silently normalized by JS) and **2026-02-28T12:00:00** (host-local time without an offset). Reproduced against the actual exported validator with chronologically valid fixture times, not a hypothetical example.
- Impact: invalid observation dates could be considered verified feed provenance, while unzoned timestamps may change the school-day decision between environments. No observed production incident is claimed.

## Smallest compatible implementation

- Add exact ISO-style civil/clock/explicit-zone validation before parsing for each of the three verification timestamps (`checkedAt`, `firstObservedAt`, `contentChangedAt`).
- Reject nonexistent month dates, illegal time fields, invalid zone offsets, timezone-less strings and nonstrings. Allow existing UTC `Z`, explicit numeric offsets, fractional seconds, and actual leap days.
- Preserve valid feed schema, status, assignments, local Eastern-day presentation and all existing app APIs. No new runtime dependencies.
- Add deterministic unit regression including invalid inputs for **all three** fields plus `forDate` fail-closed behavior and positive leap-day/offset examples.

## Source survey and reuse decision

| Candidate | Actual license evidence | Fit / integration decision |
| --- | --- | --- |
| [Luxon](https://github.com/moment/luxon) | MIT license blob `2d560a6433eb68f3b1277d58a819ce56a01f9dd5`; package snapshot `ed1f34b9c013c8913c83cce8cc65c62850434a14` advertises 3.7.2 | Maintained date API but extra browser dependency/bundle for a fixed, narrow timestamp schema; not imported. |
| [Day.js](https://github.com/iamkun/dayjs) | MIT license blob `caf9315493c66640ca870078cb54fcc762921db6`; package snapshot `fbfa18e89b49c632f04c54b46dc28cf77af80699` | Timezone/strict parsing requires additional plugins and lockfile maintenance; not imported. |

The targeted implementation is an original small validator and uses built-in Date/Intl functionality, **not copied** library code. No third-party attribution or dependency-lockfile change is required. Maintenance/activity and transitive advisories would need dedicated verification before using either dependency.

## Evidence, measurement and rollback

- Baseline V8 reproduction: both invalid examples accepted on the previous validator.
- Post-change focused in-memory reproduction: 8 malformed variants rejected and 3 legitimate samples accepted. The repository's new unit tests additionally exercise 3 timestamp fields and Eastern-day failure behavior.
- Full GitHub CI and branch protection determine merge readiness; until then, this is a **draft** isolated change. It has **not** been deployed.
- Estimated engineering time avoided vs selecting, pinning, bundling, auditing and upgrading an external date library: **0.5–1.5 hours**, judgmental low confidence, not a measured stopwatch result.
- Revert the narrowly scoped patch/PR to roll back. Never modify observation baselines or unrelated school-content PRs.

## Hunter A cross-lane coordination

Portfolio Brain `main` and open PRs #809/#810/#812/#813 were inspected. Observation authorization is disputed by recent repair checkpoints, so **no Brain baseline changes** were made; active observation/repair ownership remains with its dedicated automation. Trading platform has independently owned draft research PRs #509–#524; no trades or conflicting changes were made.

## Next verified action

Run all required repository checks for this PR, resolve any genuine failures, and merge only when standard branch protections and owner authorization permit. Then separately inspect offline unversioned ESM cache integrity after coordinating with the ABVM refresh owner.