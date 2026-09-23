# ABVM Grade 2 Parent Companion

Parent-facing GitHub Pages app for the current ABVM Grade 2 week.

## Included
- Current homework with simple parent checkoff
- Current reminders
- Source freshness / fallback status
- Validated teacher-page refresh every day at 1:00 PM Eastern
- Upcoming assessment dates
- Subject-by-subject study guides
- Vocabulary
- Review questions with reveal-answer controls
- IndexedDB/local fallback for homework checkoff and last-good school pack
- PWA shell caching

## Parent-only experience

The product has one parent-focused surface with five clear destinations: Today, Week, Calendar, Study, and Family. The former game build, game deployment route, promotional calls to action, avatar/catalog code, and obsolete game assets have been removed. The source-grounded school pack and study-guide refresh pipeline remain intact.

The interface is mobile-first, supports deep links and browser history, keeps checklists on-device, works offline after the first visit, and uses compressed custom artwork for each primary section.

The refresh job reads the public Grade 2 Homework, Home, Reading Work, Weekly Spelling List, Tests, and Religion pages. It publishes only after every expected page and required homework section passes validation, so an incomplete teacher-page response cannot erase the last reliable school information.

Information transcribed from school flyers or reminders is stored separately in `pages/data/uploaded-notices.json`. Those uploaded notices take priority when they clarify or correct a matching calendar item, and the daily teacher-page refresh reapplies them on every run so they are never overwritten.
