# Weekly planner import: October 16, 2026

The October 19 planner was delivered by the existing school sender and inspected
visually. Its SHA-256 is
`8547ef5adaf4d45264fa71f05083843e67d12ed3e79f5e2b390dad5af0634fa1`.
It places Lego Club on Friday, October 23, matching the retained parent-confirmed
date. No source-precedence override is required or introduced.

The importer joined two touching light regions: Friday and the reminder column.
OCR then placed Lego Club after the reminder for October 28. The existing date
guard correctly rejected that incorrect proposed date, blocking import.

Separate wide connected regions using the observed weekday columns and a nearby
word-free seam. Never cut an OCR word or invent a date; ambiguous seams still
fail closed. Keep the existing PDF size/host/deadline limits, fixed event labels,
privacy review and parent/date precedence. Explicit upper-grade closures cannot
become Grade 2 no-school days. Preserve printed football qualifiers so a 5-8
notice is not presented as an unqualified Grade 2 event.

Local evidence: the original bytes reproduce the incorrect October 28 Lego
proposal; corrected extraction produces October 23 and the K-4 October 20 closure,
without a Grade 2 October 19 closure. Actual September 21, September 28 and October
5 PDFs were also rerun and visually inspected. Their dates remain unchanged;
only explicit football qualifiers become more precise. Raw PDFs, OCR dumps,
recipient URLs, unrelated winners documents and private records stay out of git.

Pure regressions exercise the observed geometry, word preservation, ambiguous
seam rejection, Grade 2 closure scope, decorative date prefix and bounded football
qualifiers/hours. Existing source/date/privacy tests remain required. Merge only
after exact-head protected QA and after the active Notes/Homework publication
finishes; then retry the existing bounded importer and verify live calendar parity.
