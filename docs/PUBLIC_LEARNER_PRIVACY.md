# Public learner identity — privacy release gate

A read-only, unauthenticated mobile browser inspection of the publicly hosted ABVM Grade 2 companion found a hard-coded child's first name in the Today and Study headings, and a non-contextual `YOUR RANK · 1 OF 22` label. The rank counter is the app's on-device **Study Stars gamification level**, not a classroom grade or ranking. First-load visitors had no saved learning data.

## Remediation

- Replace the personal first-name greetings with school-themed, non-identifying greetings.
- Explicitly label the rank ladder and Today teaser as **study progression**, not a school leaderboard. Preserve existing earning/penalty thresholds, device-local balances, histories, and rank-order semantics.
- Keep the Today/Study/Progress layout structure and navigational actions, as well as all schoolwork, curriculum, event, lunch, and Facebook sources unchanged.
- Advance the app script resource URLs and paired SW cache/reload versions; keep the existing 14-resource offline shell footprint.
- Add anonymous-view browser tests, textual provenance checks, and cache-version contract tests.

This is a public-static-site privacy hardening, **not** an authentication system. If device-specific personalized names are later desired, require opt-in on that device or proper account access; never ship a learner identifier as a hard-coded public default.

This patch is intentionally restricted to publicly visible wording. It neither changes teacher-data authority nor authorizes any Facebook post retrieval.
