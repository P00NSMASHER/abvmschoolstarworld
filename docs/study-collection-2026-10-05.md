# Study collection release

The Study surface now has This Week, Cumulative, STAR Practice, and Study Games.
The 20 submitted photographs are accounted for in `pages/data/schoolwork.json`
using SHA-256 source hashes. Day 23 was photographed twice and produces one
lesson. Twelve lessons contain original questions grounded in the printed work.
Names, grades, handwriting, and original photographs are not published.

Cumulative history is recovered from 66 repository snapshots and extended on
every pack build. The three content refresh workflows stage the archive with
the current pack, preventing weekly replacements from erasing prior material.
Archive dates represent when content was captured, not when a lesson was taught.
Undated photographed pages remain in Cumulative and are clearly labelled
undated. Source-supported lesson dates determine weekly inclusion. Future-dated work is
withheld until its date.

Test prep includes every test on the next scheduled date and uses equal quotas
with overlap-aware question deduplication. Precise end timestamps are supported;
date-only tests remain until the next local calendar day or the user marks the
tests finished. The app cannot infer the actual classroom finish time. Teacher-
announced short-i/long-i spelling uses matching original practice when a posted
word list is unavailable; grammar practice targets subject/predicate separately.

Religion links prioritize the first listed teacher chapter when its publisher
review is verified. Chapters 1–4 were checked against their matching publisher
page and data schema. The official review opens at the publisher; its proprietary
question bank is not copied into the app. Uploaded Chapter 2 has separate original
in-app practice. `scripts/check-religion-sources.mjs` performs repeatable checks
without executing retrieved JavaScript. Other chapters must be verified before
being presented as available.

STAR practice adds 158 original items (90 math, 68 reading), supplemented by the
existing checked fallback catalog. It includes 10 original reading passages and
40 questions about those passages. Neither questions nor scores claim official
Renaissance test status. Games offer quiz and flip-card formats with one or more
study-source pools and no duplicate questions in a round. Quiz responses feed the
existing on-device learning evidence and SkillCoco-derived review scheduler;
viewing a flip card does not count as independent mastery.

## Reuse decision

The existing repository hunt report identifies SkillCoco, MasteryTrace, and qti3.
This release reuses the already attributed SkillCoco SM-2 scheduler through the
existing learning engine. Adding a second scheduler or full assessment framework
would add complexity without helping this collection workflow. The OCR lane's
Zerox and gmft candidates were reviewed: hosted model dependencies and PDF table
focus are unsuitable for this static child-facing app. The final user preference
is ChatGPT-assisted intake, so **no OCR runtime, photo input, account integration,
or upload UI is shipped**. See `SCHOOLWORK_INTAKE.md` and root `AGENTS.md` for the
repeatable process future assistants must follow when asked to integrate photos.

## Verification

Node unit and existing static validation run locally. New browser tests cover
four sections, date rollover, equal test allocation, mixed games, no uploader,
and mobile bounds in Chromium and iPhone WebKit. Local browser launch is blocked
by the workspace's socket restriction, so hosted GitHub QA is required before
claiming browser verification or publication. No existing QA gate is bypassed.
