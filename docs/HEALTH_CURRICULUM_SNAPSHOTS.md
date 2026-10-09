# Health-report curriculum snapshot distinction

The operational dashboard compares **two independent evidence epochs**:

1. **Last published Grade 2 content pipeline.** This is the version in `pages/data/study-pack.json`. An unsupported count of zero applies **only** to that previously published pipeline snapshot. It does not prove that a more recent teacher scan contains no new curriculum gaps.
2. **Latest governed teacher refresh.** A failed curriculum-coverage step, matched to the exact failed workflow run and an open draft curriculum candidate PR, is separately reported as `approval-blocked`. That explicitly means **not approved**; it is not treated as student practice evidence or a production publication.

The dashboard now labels these sources distinctly in both Markdown and JSON. When exact hold evidence is missing, it says `not-established`, not “no gaps.” Source freshness, the 16-hour watchdog threshold, academic publication gates, and the critical process exit status remain unchanged.

The October 9 teacher refresh was blocked by four unpublished Reading/ELA families held in educator-review PR #270. This note does not approve those families or assert that the refresh has succeeded. The reviewer must complete educator and safe-usage requirements before the separately governed curriculum registry is promoted.

No new schedule, automatic notification, personal data, Facebook access, or application asset is added by this reporting-only change.
