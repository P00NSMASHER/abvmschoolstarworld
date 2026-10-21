# ABVM Grade 2 Parent Companion

Mobile-first parent/student companion for the current Assumption BVM Grade 2 school week.

## Production architecture

- **Frontend:** static PWA deployed by GitHub Pages from `pages/`
- **School-data refresh:** GitHub Actions validates the six public Grade 2 teacher pages before publishing
- **Teacher refresh:** four scheduled UTC source scans (06:17, 09:47, 13:17 and 15:47 UTC), with manual dispatch and bounded recovery
- **Homework refresh:** independent hourly source checks from 06:23–23:23 UTC; unchanged pages preserve their first-observed dates
- **Lunch source:** reviewed school lunch documents, verified through the ABVM AppDeploy source bridge
- **Local state:** checklist completion and Study Games learning state use browser `localStorage`
- **Offline behavior:** the service worker retains the app shell and the latest verified school pack

## App sections

The bottom navigation has **four** destinations:

1. **Today** — school-day homework, verified upcoming tests, events and lunch
2. **Calendar** — Month/Week switch, selected-day agenda, five weekday lunches, school events and homework
3. **Study** — subject practice, Test Prep, notes, official resources, printable guides and worksheets
4. **Progress** — saved practice evidence, achievements, current study context and family notices

Older `#week`, `#games` and `#family` deep links remain supported. Week is a view inside Calendar, not a fifth tab.

## Data safety and reliability

The teacher refresh reads the six public Grade 2 Home, Homework, Reading Work, Weekly Spelling List, Tests and Religion pages and validates their content and provenance before promotion. Independently checked homework may publish without waiting for curriculum promotion. Unverified lesson candidates stay isolated; verified current school information continues refreshing. No teacher/educator signoff or manual curriculum promotion is required for routine, source-matched updates. Original-question, date, copyright, privacy and QA safeguards remain in place.

An undated homework assignment is shown as today's work only when first observed on that Eastern school date. A source check today can truthfully show an unchanged “no specific assignments listed” or “no homework” page status without carrying forward yesterday's actionable assignments.

Information transcribed from school flyers or reminders is stored in `pages/data/uploaded-notices.json`. Those notices take priority when they clarify or correct a matching calendar item, and the teacher-page refresh reapplies them on every run.

The app distinguishes reviewed lunch data from automated source verification and retains previously reviewed meals if a live source check is temporarily unavailable.

## Release authority and reviewers

The owner's October 20, 2026 standing authorization permits routine current and
future ABVM repairs, source-backed improvements, checked curriculum updates and
production publication **without mandatory human reviewers or case-by-case owner
approval**. An independent person, educator, device tester or external reviewer
may provide optional feedback, but is not a merge or deployment prerequisite.
Automated independent reproduction is a software test, not a human approval.

A successful exact-head PR QA, provenance/child-privacy checks and bounded Pages
release are still mandatory. Incomplete sources or ambiguous learner records remain
held, never invented. The source-freshness watchdog must confirm genuine live
recovery; a green PR is not a completed production recovery. No background code
merging is implied without an authorized operational workflow.

## Quality gates

Before candidate code or refreshed school data reaches `main`, the repository runs:

- static JavaScript and data validation
- CSS/code hygiene checks
- unit tests
- Chromium browser tests
- responsive/mobile tests
- accessibility checks
- publication verification

GitHub Pages deployment repeats release QA and then verifies the live lunch/mobile flows.

## iPhone experience

The phone layout prioritizes the next dated action, readable school information,
44-point-or-larger control heights, and a compact four-tab navigation bar. Calendar's Week
view opens the coming Monday on weekends. Repeated calendar entries are merged for
presentation while distinct dates and detailed event variants remain available.

New school notices, teacher lessons, homework, and teacher calendar changes show
an in-app unread indicator after the first visit establishes a baseline. Read
status is saved only on the current device and changes only when **Mark updates
as read** is selected. This indicator is not a background push notification.

The installed app receives versioned shell updates through its service worker.
On iPhone, install from Safari using **Share → Add to Home Screen**. Physical
VoiceOver and preferred-text-size checks remain part of device acceptance;
headless mobile and WebKit checks do not replace those checks.

## Integrating schoolwork from ChatGPT

When asked to integrate uploaded worksheets, start with [AGENTS.md](AGENTS.md)
and follow [the schoolwork intake process](docs/SCHOOLWORK_INTAKE.md).
The app has no photo uploader; reviewed content is published through this repository.
