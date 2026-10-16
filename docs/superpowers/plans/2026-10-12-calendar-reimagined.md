# Calendar Reimagined Implementation Plan

> Execute inline using the existing application architecture and exact-head release checks.

**Goal:** Replace the monthly Calendar experience with a compact, readable, iPhone-first planner and direct day exploration.

**Architecture:** The existing app controller remains the sole authority for school events, date resolution, meals, homework and freshness. Move month presentation into `pages/product-view.js`; use civil-date keys for presentation navigation. Reuse existing script/style files and the 14-resource service-worker shell.

**Tech stack:** Existing vanilla JavaScript/CSS, Node tests, Playwright Chromium/WebKit; no new production dependencies.

**Spec:** User's October 12 execution request authorizes an independent complete visual redesign without intermediate design approval. Source accuracy, privacy, ingestion, notifications, offline behavior and release gates remain nonnegotiable.

## Design

A white and warm-gray planner with deep teal selection, coral Today marker, quiet borders and flat readable surfaces replaces the glossy navy cards. A compact Calendar header, Month/Week switch, large month title with picker and always-visible Today action precede a full-week date grid. Text previews replace unexplained letter icons. Adjacent-month dates are muted but actionable. Selected-day events expand to exact source details; verified lunch text/art remains intact. Wider screens place the agenda beside the month. Month summaries, weekly information, specials and official sources remain available below.

## Global constraints

- No changes to school data, school photos, source timestamps, private learner data, importer cadence or notification policies.
- Preserve `#calendar`/`#week`, selected-date continuity and existing school-year authority.
- No UTC parsing of date-only navigation keys; month arithmetic clamps invalid month-end dates.
- Preserve all source/content tests; replace only obsolete visual assertions with stronger new behavior/geometry checks.
- Never bypass exact-head QA, independent reproduction, source parity or Pages admission.

## Review focus

- Six-row months, leap years and December/January navigation render each real date once.
- Arrow-key, swipe, Today and month-picker navigation preserve focus without unwanted scroll jumps.
- Busy days reveal every original event; source disclosures escape text and never invent times.
- Small phones, 200% text and desktop avoid horizontal clipping and bottom-bar obstruction.
- Source refresh and first-install offline behavior continue working with synchronized cache versions.

## Tasks

- [x] Inspect current release, source safeguards, renderer and existing Calendar tests; isolate branch from main `0f34105d9e88183e37c3a468905e3f4ce9fabb2d`.
- [x] Capture baseline screenshots with an October 12 clock and October 14 selection.
- [x] Add civil-date/grid/source-parity unit contracts; observe all nine fail because the new implementation is absent.
- [ ] Add browser contracts for compact layout, actual labels, picker, keyboard, swipe and source detail.
- [ ] Implement the view and controller navigation; replace obsolete Calendar CSS instead of adding another external sheet.
- [ ] Update cache versions and admit this exact branch to the unchanged source-parity comparison.
- [ ] Run targeted and whole-suite tests; independently inspect real phone/desktop screenshots.
- [ ] Push one review branch/PR; verify exact-head remote gates and release only through the existing process.

## Execution ledger

- Baseline on Windows: workflow text tests assume LF; checkout normalization repairs this without altering Git content. Shell release-admission tests use POSIX paths and require Linux CI. Do not weaken these tests for the local environment.
- Ruling: keep current-month `data-cal-day` selectors stable; use `data-cal-jump` for adjacent dates. This preserves existing source-backed date tests while completing the visible week grid.
- Ruling: unspecified event times display “Time not listed,” not a fabricated “All day.”

- User scope update: month navigation only. Removed year controls; picker offers twelve months in the viewed year, while December/January transitions remain normal month steps.
- Month-only acceptance test first failed with two year controls, as expected. Removed the unused year UI, handler, and styles.

- Visual review found clipped No school/Dress down labels; a failing geometry test precedes wrapping these labels without changing date targets or source titles.
- Playwright documents service-worker testing as Chromium-only (https://playwright.dev/docs/service-workers). New cold offline reload coverage runs on Chromium; a separately named in-session network-outage test runs on both Chromium and WebKit. Physical iPhone offline acceptance is not claimed. Existing offline gates remain unchanged.
