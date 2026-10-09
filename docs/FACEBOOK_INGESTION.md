# ABVM school and HSA Facebook ingestion

The two user-supplied links are **different sources**. The daily school refresh is
the existing .github/workflows/sync-study-pack.yml job, not another scheduler.
It calls scripts/sync-facebook-feeds.mjs after teacher retrieval, retaining
source-specific results in pages/data/facebook-updates.json.

## Current source verification (2026-10-08)

- ABVM_SCHOOL_FACEBOOK: share URL https://www.facebook.com/share/1USvBxRNwD/?mibextid=wwXIfr.
  Facebook blocked independent resolution behind login. **Pending identity**.
  Do not guess that another page (including ABVM11) is this exact share target.
- ABVM_HSA_FACEBOOK: share URL https://www.facebook.com/share/1MwtxVZMSq/?mibextid=wwXIfr.
  Public share redirect resolves to the Pottsville **Assumption BVM Home &
  School Association** page, canonical URL
  https://www.facebook.com/p/Assumption-BVM-Home-School-Association-61552549763989/
  and page ID 61552549763989. The public About snippet describes this as the
  school's HSA. Page identity is verified by public URL/metadata, not by
  privileged account access. **Retrieval remains disabled**.

The public HSA preview exposed some post links but not reliable complete post
bodies, edits or publication timestamps. No Facebook announcement has been
entered into the reviewed manifest based on a partial public preview.
The school link remains blocked. Neither feed is operating live.

## Windsor.ai Facebook Organic authorization audit (2026-10-08)

The user's Windsor.ai account is connected, but **the connected Facebook Page
is RETALLY, not either ABVM source**. A live connector discovery reported:

| Windsor source | Authorized account | ABVM ingest eligibility |
| --- | --- | --- |
| `facebook_organic` | `Retally`, Page ID `1423089780881432` | **DENIED: Page ID does not match ABVM source** |
| `instagram` | `amuhricaaa`, account `17841450188230798` | **DENIED: different platform and identity** |
| `facebook_organic` ABVM school | No ABVM school account returned | **NOT AUTHORIZED** |
| `facebook_organic` ABVM HSA | No HSA account returned | **NOT AUTHORIZED** |

Windsor's Facebook Organic connector exposes `account_id`, `account_name`,
`page_id`, `page_name`, `post_id`, `post_message`,
`post_created_time` and `permalink_url` fields. A live read of the
connected RETALLY account for October 1–8 and a separate Page identity
read returned **no post rows**. These results do not establish that the
ABVM pages have no posts; they establish that neither ABVM page is among
the connected accounts. Do not interpret a connected personal Facebook
login or a RETALLY Page as authorization to fetch the school or HSA Pages.

**Required source-matching rule for any future Windsor handoff:**
`Windsor account_id/page_id === the verified canonical ABVM source.pageId`,
and the returned Page name must also identify the same original
organization. Source IDs must be determined from this match, **never**
from post text, keywords, reposts, or the currently connected user's
Facebook profile. The HSA Page is `61552549763989`; the school's Page
ID is still unknown. Do not import data from `1423089780881432` into
the ABVM repository.

Windsor's ChatGPT connector reads data on demand. Its ChatGPT connection
is **not** itself a GitHub Actions secret, a Meta Graph token, or proof
of an unattended scheduler. This project must not claim daily automated
Facebook retrieval simply because Windsor can access RETALLY. Keep the
existing Graph/manual-review gates and current schedules unchanged.

To add an authorized ABVM Page **only if the user has an account permitted
to manage/read that Page**, the Windsor Facebook Organic OAuth setup is:

https://onboard.windsor.ai/connect?connector=facebook_organic&client=CHATGPT&next=/facebook_organic/authorize

Windsor's provider-specific setup instructions are: Log in with the
Facebook profile that has access to the Page. When Facebook asks which
Pages Windsor.ai can access, select the Page. If Facebook says you
previously logged in to Windsor.ai, click "Edit previous settings"
(or "Edit settings") and select the Page there: "Continue" alone keeps
the old Page choice. On a phone, open the link in your browser app
(Chrome or Safari), not inside the assistant app. Back on Windsor.ai,
select the Page before clicking "Done, close this tab" or "Finish".

If the user does not have Page access, obtaining an OAuth token for
RETALLY cannot grant it. Use independently approved public Page access
or the existing human-reviewed import fallback; never bypass Facebook
permissions or request administrative school access unnecessarily.

**Verified release status:** Independent QA and full application QA
completed successfully on PR #274 head `05768fc5d1ed57d264c58a7affdd1fec42d887fc`
(GitHub runs 37870351430 and 37870351449). This is code quality evidence,
**not** operational proof of live ABVM Facebook ingestion. Source activation
remains blocked until exact-Page access and review are established.

## Authority and privacy

- Teacher pages and reviewed classroom material alone control schoolwork,
  spelling, grammar, questions and tests.
- Verified official school communications can add independently reviewed
  community announcements, not override teacher assignments.
- HSA posts may describe HSA fundraisers, meetings, volunteer calls and events;
  they cannot set academic obligations or school-wide policies.
- The script never writes study-pack.json, study-archive.json,
  uploaded-notices.json or curriculum source files.
- Reviewed posts retain page-specific IDs, publisher, original URL, postedAt,
  optional editedAt, source text SHA-256, collectedAt, classification,
  original event and deadline dates, audience, confidence, correction/cancellation
  state, verified identity state, review details and audit provenance.
- No student names, photo contents, personal emails, handwriting, or full raw
  Facebook responses are committed to this public repository.
- Every approved summary must be manually screened for private student/family
  information and match the underlying post evidence.
- Social content remains **untrusted text** and is HTML-escaped in the UI.
  It is never interpreted as operational instructions.

## Enabling authorized retrieval

1. Independently resolve the *exact supplied school share URL* to a canonical
   Page and numeric Page ID, with verifiable evidence. Update only that source
   in facebook-sources.json; do not reuse the HSA ID.
2. Obtain an authorized Facebook Graph API access token and any required
   Page Public Content Access / Page permissions. Store it only as the
   **source-specific** GitHub Actions repository secrets
   `ABVM_SCHOOL_FB_ACCESS_TOKEN` and `ABVM_HSA_FB_ACCESS_TOKEN`, respectively.
   The scheduled production workflow never supplies one shared token.
   Never commit
   credentials, use private-account scraping or bypass a login wall.
3. Confirm Graph /{pageId}?fields=id,name returns the exact approved ID/name.
   Set that source's retrieval.enabled to true after authorization. Use an
   ABVM_FACEBOOK_GRAPH_VERSION repository variable if an explicit supported
   version other than the default v25.0 is required.
4. The existing refresh job will check a 14-day overlapping window, at most
   the newest 100 posts per Page. This is intentionally bounded; if the API
   provides a next page, the job reports pagination limitation instead of
   claiming full coverage. One Page's failure does not cross-label the other.
5. The API does **not auto-publish** raw post content. It verifies previously
   approved content hashes and quarantines changed messages until re-review.
   New posts require review in facebook-reviewed-posts.json.
   Edited posts are quarantined on message-hash or newer updated_time changes,
   with hashes, edit timestamps and a privacy-safe audit trail;
   an API outage cannot re-publish a previously quarantined revision.
   Restoring a post requires a fresh review plus an authorized check against
   the updated original message.

## Manual reviewed-post fallback

Where authorized API retrieval is unavailable, add a **reviewed, sanitized**
entry to pages/data/facebook-reviewed-posts.json. Only a *verified* source can
publish; the school remains blocked until identity resolution. Example fields:

    {
      "sourceId": "ABVM_HSA_FACEBOOK",
      "postId": "61552549763989_123456789",
      "postUrl": "https://www.facebook.com/permalink.php?story_fbid=123456789&id=61552549763989",
      "postedAt": "2026-10-08T13:00:00.000Z",
      "editedAt": null,
      "sourceContentHash": "<actual SHA-256 of the original source text>",
      "summary": "<human-reviewed, privacy-safe, non-academic summary>",
      "category": "HSA event",
      "audience": "families",
      "confidence": "high",
      "noticeStatus": "active",
      "eventDates": ["2026-10-20"],
      "deadlineDates": [],
      "eventKey": "2026-10-20-hsa-fall-event",
      "review": {
        "status": "approved",
        "piiReviewed": true,
        "reviewedAt": "2026-10-08T19:00:00.000Z",
        "reviewedBy": "<responsible reviewer>"
      }
    }

The example uses placeholders, not real published post IDs or event details.
Original dates must be explicitly verified; relative dates or partial dates
must be held for review, never inferred from collection time. A second Page's
separately approved post may share the reviewed eventKey: the UI shows one
event with two named source links while source records stay independent.
Conflicting dates, status, deadlines, or summary details on one eventKey remain distinct with a conflict flag.

Run npm run qa:static, npm run qa:unit, and
node scripts/sync-facebook-feeds.mjs --write. Do not edit output JSON by hand.
A reviewed-manifest change also triggers the existing school refresh workflow.

## Fail-closed behavior

No token, pending identity, denied Graph permission, unavailable page, missing
review approval, mismatched owner, invalid timestamp, outdated edited-post
review, or malformed evidence does **not** generate a Facebook announcement.
Missing social data never blocks legitimate teacher study information.
Manual summaries are never promoted into the academic study pack.
Academic-classified social imports are rejected, even when the source claims teacher corroboration.
There are no new scheduled tasks, push alerts or chat notifications.

## Public school website: useful but not a Facebook credential

The school's official website, https://www.assumptionbvmschool.net/,
publishes school/HSA news. Its articles can independently corroborate
dates and community announcements, but they must be labeled as **official
website sources**, not as Facebook posts or proof of Facebook Page control.
Do not use this website as a backdoor to infer restricted post content.

Windsor.ai's connected `facebook_organic` account is RETALLY, Page ID
`1423089780881432`, not an authorized ABVM school or HSA Page. Windsor's
organic connector requires access to the Page being selected. Using
RETALLY's access or token in the ABVM collection would violate source
isolation. Even a legitimately connected Windsor Page does not itself
provide the unattended Graph API token for the existing GitHub Action.
