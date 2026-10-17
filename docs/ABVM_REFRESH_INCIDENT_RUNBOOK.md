# ABVM refresh incident runbook

## Current source freshness and curriculum policy (October 17, 2026)

The scheduled **Refresh ABVM teacher pages** job scans six public teacher pages,
checks source/provenance integrity, verifies the current pack and publishes through
independent QA and protected release gates. Source-matched curriculum families
with complete original practice and evidence are promoted through the existing
automatic pipeline. Unsupported or incomplete lesson/question candidates remain
isolated while verified teacher data and independently checked homework continue
to refresh; a draft candidate PR is not a publication approval.

**No teacher, educator, school, parent or owner verification/signoff is required
for routine private-companion app updates.** Do not request educator credentials or
fabricate a teacher review. Do not bypass independent source-date, academic-answer,
reuse-rights, public child-privacy, exact-commit, browser, accessibility or Pages
verification gates. Where an original photo or source evidence is unavailable,
hold only the unsupported claim or candidate and report the evidence gap; never
invent the missing source or redate an assignment.

The **Monitor ABVM refresh health** watchdog compares published and repository
source timestamps and hashes against the configured strict freshness limit.
Successful Pages deployment cannot make a stale teacher pack fresh. Never
backdate a source check, relax age limits to suppress incidents or silently
rewrite governed source material.

## Historical incident: October 9, 2026 (superseded workflow)

The former coverage gate held the six-page refresh for unsupported Reading/ELA
topics, including long/short i, possessives, asking/answering and main ideas.
Historical [refresh run #37936203689](https://github.com/P00NSMASHER/abvmschoolstarworld/actions/runs/37936203689)
and candidate [PR #270](https://github.com/P00NSMASHER/abvmschoolstarworld/pull/270)
document that failure. Its former *educator approval and manual promotion*
instructions are **retired** and must not be applied to current routine refreshes.
The correction is to isolate unresolved curriculum safely while continuing to
publish verified teacher-page and homework facts. Do not label an archived incident
or PR as a current blocker without verifying current Actions.

The operational dashboard runs after completed main-branch watchdog runs,
including failed/cancelled watchdogs, and retains its machine-readable health
evidence. A green snapshot alone is not live publication proof.

## Recovery procedure

1. Inspect the actual newest failing workflow, source URL, candidate report,
   deployment SHA and timestamp; distinguish source outage from candidate isolation.
2. Independently resolve page-exact evidence and original question accuracy; keep
   unsupported candidates out of production **without stopping safe source updates**.
   Never wait for teacher/educator approval.
3. Allow the existing bounded source-recovery and refresh workflows to recheck real
   teacher and lunch sources and run the existing static, unit and browser gates.
4. Verify exact published main SHA, actual source-check time/hash, homework evidence,
   GitHub Pages deployment and live freshness; inspect health evidence even for
   a failed watchdog. Do not create replacement schedules or false receipt evidence.
