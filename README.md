# ABVM Grade 2 Parent Companion

Mobile-first parent/student companion for the current Assumption BVM Grade 2 school week.

## Production architecture

- **Frontend:** static PWA deployed by GitHub Pages from `pages/`
- **School-data refresh:** GitHub Actions validates the six public Grade 2 teacher pages before publishing
- **Refresh schedule:** 6:17 AM, 9:47 AM, 1:17 PM, and 3:47 PM Eastern, plus manual workflow runs
- **Lunch source:** reviewed school lunch documents, verified through the ABVM AppDeploy source bridge
- **Local state:** checklist completion and Study Games learning state use browser `localStorage`
- **Offline behavior:** the service worker retains the app shell and the latest verified school pack

## App sections

The bottom navigation has six destinations:

1. **Today** — current date, priority test, focused tasks, events, and lunch
2. **Week** — weekday picker, events, checklist, reminders, and lunch
3. **Calendar** — month grid, selected-day details, full agenda, specials, and upcoming dates
4. **Study** — current subject material, sight words, vocabulary, and study priorities
5. **Study Games** — short adaptive practice generated from current verified class skills
6. **Family** — current actions, notices, test-day count, privacy/source information

## Data safety and reliability

The refresh job reads the public Grade 2 Homework, Home, Reading Work, Weekly Spelling List, Tests, and Religion pages. It publishes only after every expected page and required homework section passes validation, so an incomplete teacher-page response cannot erase the last reliable school information.

Information transcribed from school flyers or reminders is stored in `pages/data/uploaded-notices.json`. Those notices take priority when they clarify or correct a matching calendar item, and the teacher-page refresh reapplies them on every run.

The app distinguishes reviewed lunch data from automated source verification and retains previously reviewed meals if a live source check is temporarily unavailable.

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
44-point-or-larger control heights, and a compact five-tab navigation bar. Week
opens the coming Monday on weekends. Repeated calendar entries are merged for
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
