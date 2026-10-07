# ABVM product redesign — October 7, 2026

The October 7 user directive supersedes the October 6 concept board as presentation authority. Accurate source data, privacy, lineage, scoring, source gates, offline delivery and release validation remain authoritative. The existing five-tab architecture and historical CSS are no longer design constraints.

## Product direction

ABVM becomes a calm, warm school companion: ivory canvas, ABVM blue, crisp native typography, thoughtful school photography and controlled subject colors. Useful facts lead; brand decoration and technical status become secondary. The school seal remains genuine.

Four primary destinations:

- **Today:** school day, nearest verified test (deadlines remain in the daily plan), a focused study action, full lunch and important reminders.
- **Week:** five-day selector, all verified tests and lunches, full selected-day agenda, homework, reminders and a nested monthly Calendar.
- **Study:** choose a test or a subject. Reading/ELA, Spelling/Handwriting, Math, Religion and Mix replace the mini-game metaphor. Notes, cumulative lessons, official resources, completion controls and printable guides sit below practice.
- **Progress:** honest practice evidence stored on the device, current class topics, cumulative learning access, family notices and unread teacher updates. No invented mastery, marks, private worksheet analysis or improvement curves.

Existing `#games` and `#family` routes continue to work; `#progress` aliases Progress. `#study?notes` opens learning notes. Calendar remains reachable from Week and by its original deep link.

## Design system

Shared tokens in `pages/styles.css`: ink `#202c3a`, canvas `#f6f5ef`, paper `#fff`, brand action blue `#254fbd`, brand navy `#173773`, quiet borders `#e0e4e6`. Subjects use accessible coral, teal and lilac; state colors supplement plain labels. A 4px spacing rhythm, 12/20/28px radius family, rare soft shadows, unified stroke icons, readable native typography, 44px targets and reduced-motion support replace the stacked patch layers.

Phone uses a compact four-item navigation bar with safe-area padding. Tablet uses a rail and responsive content composition. Desktop caps content width and adds a wider rail. Page titles, source status, notice disclosures, event rows, controls and cards share one language.

The original approved school hero was recovered at 1024×683, replacing the blurred 320px export. No generated replacement building or private reference image is published. Weekly meal summaries display the exact governed main meal; the selected-day view retains every menu item.

## Reliability

School/date/lunch decisions remain in the existing controller and governed pack. `product-view.js` is a presentation boundary, receiving those decisions as inputs. Practice ranking preserves current → recent reviewed → cumulative reviewed → original Grade 2 STAR fallback; strict test mapping stays fail closed. Assessment windows remain selectable even when mapped questions are unavailable. Evidence and data gates are not weakened by presentation migration.

Legacy CSS files replaced by the shared system are removed. Exact teaching diagrams are isolated in `study-teaching.css`; Study owns its player and notes presentation. No new production dependencies or web fonts are required.

## Acceptance

Rendered screenshot review is separate from functional checks. Required widths: 375,390,430,744,820,1024,1440; portrait and landscape; main screens, questions, results, notes, notices, loading/error and offline states. Accessibility checks cover contrast, semantics, focus, target sizing, keyboard, reduced motion and 200% text. Static/unit/importer/browser QA and exact-head independent reproduction must pass before the normal Pages release. CI green alone is not aesthetic acceptance.

## Implementation and review

The inherited interface split the school plan across five equal destinations, put technical freshness before useful content, buried notes and printable guides, and repeated headings and broad source controls before a child could start. Multiple visual override sheets competed, and the approved school photograph was too small for tablet presentation.

Today, Week, Progress, the Study launch pad, questions, feedback, results, test chooser, notes, resources and printable guide controls were rebuilt. Calendar is a secondary Week view. Source selection and daily mini-game controls were removed from the launcher; current → recent → cumulative → original Grade 2 fallback is selected automatically. Existing deep links and learning records remain supported.

Deleted five retired visual sheets and the abandoned Study hub renderer/style sheet. The old hub and room modules now retain only the pure test-mapping and read-aloud functions used by the live product. The support bundle no longer injects styles. No production package or font dependency was added. The full static app remains the build artifact, with the existing governed runtime pack generated before validation/deployment.

Rendered review covered seven widths, phone landscape, tablet portrait/landscape, saved progress, practice, notes, test selection, unsupported tests, loading and errors. Review revisions compressed Today’s study action, put lunch above the long agenda, prioritized the nearest test, shortened the launcher, restored notes/guides and removed tablet loading movement. Test Prep loading → ready movement measured 0px at 393px and 768px. Enlarged text repairs covered headers, agenda labels and note disclosures.

Pre-release checks: 270 unit checks and 11 Yahoo parser checks pass; static source/privacy/notice/CSS/offline contracts pass. Focused browser checks cover keyboard, screen-reader semantics, safe areas, seven responsive widths, offline practice, score/learning persistence and notice state. The candidate publication verifier passes exact asset hashes, governed lunch visibility and the complete eight-question scoring/hint/retry workflow. Full browser QA, independent reproduction and normal Pages deployment remain required for the exact release commit; their final run links belong in the pull request.

Private worksheet history is deliberately absent from the public build. Progress describes actual on-device practice evidence and current class topics, without inventing grades, mastery or trend data. Missing strict test coverage remains explicitly unavailable. Existing lunch-art coverage stays honest and falls back to accurate menu text.

Final refinement adds matched topics and source-scoped best practice to the selected test, using a pure preview that never advances session counters or alters history. Removing the generic Study introduction gives that useful context space while keeping the four primary subjects above navigation. Selection regression repairs only relax cooldown for an alternative within the same source tier; mixed fallback remains after current material. Question metadata and result controls meet their existing legibility gates, and completion feedback remains bounded and respects reduced motion.

The native test picker uses a 16.32px default font to prevent small-control focus zoom on iPhone; the responsive acceptance suite enforces a 16px minimum while preserving text scaling.

Safari release refinement reproduces the real native-picker anonymous overflow at doubled text size. A paint boundary on the select contains its native text while retaining the full native menu and focus indicator. Enlarged navigation reflows into two rows; tablet/desktop rails grow with text; Study subjects retain two balanced columns at default size and collapse to one where enlarged labels need space. The date label grows or becomes horizontal instead of splitting words. Closed nested notes explicitly exclude their non-summary content, preserving visibility, accessibility, focus and reopening semantics in WebKit. The regression assertions retain their original strict overflow tolerance and now report dimensions.

Class notes now display exact trimmed repetitions once within each subject, retaining the first source wording and order. Distinct wordings, other subjects and separate lesson sequences remain available; all underlying notes, archive IDs and provenance records stay intact. The Study renderer uses an explicit module version with network-first delivery, app version 128 and offline cache 135, so this presentation correction reaches existing installations reliably.
