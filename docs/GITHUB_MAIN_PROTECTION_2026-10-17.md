# ABVM main-branch release protection

Checked 2026-10-17: GitHub reports `main.protected=false` and no repository rulesets. The exact-main Pages workflow fails closed on stale SHAs, but this **does not prevent someone from pushing unreviewed code directly to main**.

## Owner action required in GitHub Settings

1. Open **Settings → Rules → Rulesets → New branch ruleset**, targeting the default `main` branch.
2. Set the ruleset to **Active**. Require a pull request before merging, disallow force pushes and deletions, require linear history if squash/rebase is preferred, and require the branch to be up to date before merging.
3. Require both always-triggered status checks from the connected GitHub Actions app:
   - `ABVM App QA / qa`
   - `Independent QA reproduction bundle / independent-reproduction`
4. Keep bypass permissions minimal. Let the repository's existing verified teacher/Homework/notice automation identities publish **only governed generated school data** through their current independently tested workflows, or adapt the bot-write flow to a safe auto-merge PR design before activating a rule that blocks those automated writes.
5. Verify that a deliberate branch PR without green checks cannot merge, then verify that official source refresh and Pages publication still work end to end. Do not disable source verification or full release QA to satisfy a ruleset.

The companion application cannot safely enable this setting through the connected GitHub connector, which currently offers rule/protection reads but no administrative write action. **Do not claim branch protection is active until GitHub returns `main.protected=true` or an active `main` ruleset.**

## Why QA is always triggered

Both production QA and independent reproduction now run on every pull request; path-filtered workflows could otherwise leave mandatory checks missing on documentation or automation changes. Teacher-source acceptance remains a separately governed source-check lane.

## Promotion guardrails

Never push application code directly to `main`. Use a review branch, immutable candidate SHA, passing exact-head checks, a non-draft PR, and the existing Pages current-main recheck. A successful PR test is not live verification.