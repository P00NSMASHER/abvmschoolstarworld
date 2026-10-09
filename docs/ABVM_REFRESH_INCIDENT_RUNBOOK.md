# ABVM refresh incident runbook

## Source freshness vs curriculum promotion

The scheduled **Refresh ABVM teacher pages** job scans six teacher pages,
checks lunch sources, and generates the current pack candidate. If a teacher
skill is not represented by an approved curriculum family, the
**Block publication while curriculum candidates are unresolved** step must
fail. Its draft candidate PR does not authorize publication: educator review,
page-exact evidence, safe-usage evidence, manual approval, and promotion QA
remain mandatory.

The **Monitor ABVM refresh health** watchdog compares the published and
repository pack source timestamps and hashes using the strict 16-hour limit.
A stale pack remains stale even if the Pages website deploys successfully.
Do not backdate or advance a source check without real verified retrieval,
increase the freshness threshold to hide a blockage, or rewrite approved
schoolwork to make it green.

## Incident handling (October 9, 2026 example)

- Teacher refresh run [37936203689](https://github.com/P00NSMASHER/abvmschoolstarworld/actions/runs/37936203689) stopped at the
  unresolved-coverage gate for four Reading/ELA skills: long i / short i,
  possessives, ask/answer questions, and main idea/details.
- Draft educator-review [PR #270](https://github.com/P00NSMASHER/abvmschoolstarworld/pull/270) holds 32 authored candidates; all four
  remain disabled and unpromoted. A passing QA test is **not** educator approval.
- Watchdog [37936260051](https://github.com/P00NSMASHER/abvmschoolstarworld/actions/runs/37936260051) reported 22.4 hours since the last genuine teacher source check
  in both repository and deployed pack, exceeding 16 hours.
- Official-calendar [PR #279](https://github.com/P00NSMASHER/abvmschoolstarworld/pull/279) successfully deployed separately; that source-labeled link
  does not imply teacher-source freshness or Facebook retrieval approval.
- Facebook [PR #274](https://github.com/P00NSMASHER/abvmschoolstarworld/pull/274) remains a draft with both Page retrieval flags disabled,
  no approved or published Facebook posts, and separate school/HSA IDs.

## Health dashboard fail-closed observability

The dashboard is triggered by every **completed main-branch** watchdog run,
including failures and cancellations. This fixes the earlier configuration
where failed watchdogs left the operational dashboard skipped. The dashboard
still computes strict operational health, preserves the source-age and
curriculum gates, and exits with failure when its verdict is critical.
Its summary and machine-readable artifact are retained with \`if: always()\`
even if the verdict is critical. Other branches remain excluded.

To recover:
1. Review the actual failing refresh steps and linked curriculum candidate,
   not a previous successful or unrelated run.
2. Complete independent source/educator/safe-usage review and manual promotion
   when warranted. Until then, keep the unsupported-skill block.
3. Allow the existing refresh workflow to fetch real teacher and lunch sources,
   validate the candidate pack, and publish only through its normal QA process.
4. Verify repository and deployed pack checkedAt/source hashes and watchdog
   freshness. Inspect the generated health summary whether the watchdog
   succeeded or failed. Do not create a replacement schedule.
