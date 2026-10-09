# Official ABVM calendar — source integrity review (October 9, 2026)

**Verified public source:** https://www.assumptionbvmschool.net/about/calendar
**School:** Assumption BVM School, Pottsville, Pennsylvania

## Verified capability

The school operates a public calendar with date-specific event titles, time intervals and source event IDs. The calendar uses a Finalsite widget. The element titled **Calendar RSS Feeds** currently has \`href="/about/calendar#"\` in the rendered public HTML; this is **not an independently verified RSS/ICS feed URL**. A feed UUID in the HTML does not establish a stable public download endpoint. Do not invent or construct one.

## October 2026 cross-source comparison

These entries were checked directly against the official school calendar and the existing app's reviewed study pack. They are not automatically imported or relabeled as Facebook information.

| Official school calendar | Existing verified notices in app | Disposition |
| --- | --- | --- |
| October 9 — 12 dismissal | October 9 — 12:00 dismissal | Consistent |
| October 9 — Chick Fil A money orders due | October 9 — orders and money due | Consistent |
| October 12 — No School Columbus Day | October 12 — No School | Consistent |
| October 20 — K–4 no school for conferences | October 20 — K–4 No School | Consistent |
| October 23 — Lego Club 2:50–3:50 PM | October 23 — Lego Club 3:00–4:00 PM | **Time discrepancy. Review before changing existing record.** |
| October 5 — Winter Uniform Begins | An additional teacher-home record says winter dress code begins October 15 | **Source-date discrepancy. Do not silently overwrite.** |
| October 22 — Chick Fil A delivery | One teacher-home label reads "Thursday, Oct. 23" for pickup | **Weekday/date discrepancy. Review original teacher source.** |

These are source-comparison findings, not declarations that any teacher instruction was incorrect.

## Safe release scope

Month and Week now offer a compact **Official ABVM calendar** link to the current school-operated source, with an explicit reminder that dates can change. The school website can be consulted directly for the latest event details. Existing teacher/material sources remain authoritative for tests and classroom instructions, and the app does not pretend the uploaded notices were retrieved automatically from the website.

No new event importer, RSS endpoint, cron job, notification, student data, browser credentials or academic edits were added. No Facebook Page feed is enabled.

## Future feed activation

If an official stable RSS/ICS export or authorized event API is demonstrated, validate it independently first. Require exact school identity, bounded date windows, source event IDs, amendments/cancellations, student privacy review, deduplication against existing reviewed notices, and non-authority over teacher assessments. Reuse an existing refresh schedule only after those gates pass.
