# Study upgrade review — 2026-10-04

## Scope and decision

Searched the complete checked-out hunt ledger at `P00NSMASHER/github-value-hunt-ledger@b1cc47094460ef8ba54566898d7c10e7fe8eeeaa`: 722 Markdown/JSON files containing 2,035 distinct GitHub repository links. Screened the 52 distinct candidates linked from `hunters/25.md` and `lanes/13-games-education-starblox.md`, plus the September 23 StarBlox handoff. This is catalog-wide discovery, not a fresh code audit of all 2,035 repositories. Fresh source/license inspection focused on the three best fits below. The first empty-panel release incorporated no third-party code. The follow-up daily-practice release adapts the small SkillCoco SM-2 calculation with its MIT notice; no third-party test-bank content is included.

The immediate defect was in the Study panel renderer, not a missing Math question bank. The app already has original STAR-style Math/Reading questions, hints, worked support, delayed comeback questions, local learning evidence, rotation and a heuristic review priority. Empty subject notes now show original Grade 2 micro-lessons, worked examples and a direct practice action. Teacher content remains primary. An empty Religion panel offers explicitly labelled reading enrichment, not a fabricated Religion assignment. The app does not estimate a STAR score or claim official test alignment/certification.

## Ranked recommendations

| Repository, freshly inspected revision | Concrete upgrade | Fit and remaining work | Decision |
| --- | --- | --- | --- |
| [skillcoco/skillcoco](https://github.com/skillcoco/skillcoco/tree/805c6c784db5ad60a02d450dc1711f1b3e1381c6) | Durable review due dates and a short daily practice queue | `skillcoco-core/src/sm2.rs` has a pure SM-2 calculation and boundary/sequence tests; `microlearning.rs` combines review due state and recency with an injected clock. Port only the small scheduler into browser-local storage. Map independent correct, hinted and retried answers separately; do not treat an assisted answer as perfect recall. Existing `reviewPriority()` uses a 1/2/4-day heuristic rather than a durable schedule. | **Best next upgrade.** Small integration, no backend or paid service needed. Preserve notices if porting. |
| [RudrenduPaul/MasteryTrace](https://github.com/RudrenduPaul/MasteryTrace/tree/f8e59ece3deeef9f404d446604583ea5515617c2) | Skill-level progress estimates and better selection of the next practice skill | Read `src/models/bkt.ts`, `src/core/event-schema.ts`, package metadata and MIT license. The BKT core sorts events by learner/skill and updates posterior knowledge. Current app keeps aggregate independent/assisted counts, so an adapter needs a bounded chronological evidence log and migration. Defaults are not calibrated to ABVM Grade 2 items. | **Useful after review scheduling.** Benchmark first; keep estimates internal and do not display “mastered” or predicted STAR scores from uncalibrated probabilities. |
| [LongsightGroup/qti3](https://github.com/LongsightGroup/qti3/tree/ece67118e4d74f83ca2c0481039993a32f174421) | Matching, ordering and richer accessible question interactions; future QTI import | Inspected README, package architecture and MIT license. Framework-neutral item engine/player, scoring, state restoration and conformance/browser tests. ABVM currently uses its own original item schema and already supports structured rich content. Requires a renderer/answer-state adapter, accessible touch tests and a small original-content pilot. | **Best larger feature expansion**, but not needed to fix empty panels. Do not replace the whole app or import commercial question banks. |

All three have permissive code licenses at the inspected revisions. Third-party dependencies and separately sourced content remain separate. No paid model calls, hosting migration, learner uploads, or school account integrations are needed for the recommended narrow browser-side adaptations.

## Other catalog candidates

- `woodstocksoftware/adaptive-question-selector`, `dfsp-spirit/catjs-irt`, `GoktuGumus/cat-irt-engine`: adaptive assessment candidates, but IRT needs calibrated question parameters. Original practice items currently have pedagogical difficulty tags, not measured discrimination/difficulty. Do not produce placement scores from these tags.
- `douglasrizzo/catsim`, `Feng-Ji-Lab/BKT`, `thiagofmiranda/cdCAT`, `philchalmers/mirtCAT`, `JuliaPsychometricsBazaar/ComputerAdaptiveTesting.jl`, `Hongchen030/mstATA`, `AnthonyRaborn/caMST`, `cran/RSCAT`: potentially useful offline research/validation tools; R/Python/Julia/solver runtimes and assessment administration add little immediate value to this free iPhone PWA.
- `LongsightGroup/oneroster`, `Cvmcosta/ltijs`: useful only if the school requests roster/LMS integration. No current need to collect student identities or add a server.
- `opengamedata/ogd-core`: educational telemetry reference; current single-device local progress is sufficient, and remote analytics is unnecessary.
- Broad AI tutors, GraphRAG platforms and large assessment stacks: much greater hosting/content-validation burden than the current need; not a shortcut to reliable Grade 2 material.
- CharacterStudio, diffusion/image-processing tools and 3D/art findings: not a substantial learning improvement for Study. Preserve the compact iPhone design.

## Content reference and limits

Renaissance describes Star as assessing reading, math and early-literacy skills across multiple domains. The original enrichment here targets number sense, operations, contextual vocabulary, phonics and comprehension. These are practice activities, not reproduced test questions, official test preparation, a diagnostic or a promise of score improvement.

- https://www.renaissance.com/products/assessment/star-assessments/learning-progressions/
- https://www.renaissance.com/products/assessment/star-assessments/star-math/

## Release checks

Regression coverage includes all six empty panels, blank/null notes, preserving real teacher notes, direct Math practice navigation, both numerical question variants, offline shell asset inclusion, and iPhone WebKit rendering. Two existing rotating Math defects were corrected: variant 2 asked about a 6 that was absent from its number, and compared two six-tens numbers using a five-tens explanation.

## Authorized follow-up: daily study upgrade

Rechecked current source heads for SkillCoco, MasteryTrace and qti3; all three matched the revisions above. Also searched and screened `open-spaced-repetition/ts-fsrs`, a browser-capable alternative. Chose the small already-inspected SkillCoco SM-2 calculation for a bounded integration with the app's existing independent/assisted answer evidence. FSRS and BKT remain future alternatives requiring a separately evaluated response mapping; adding multiple competing schedulers would not help this release.

Implemented a browser-local schedule stored within existing learning rows: independent correct answers advance at due reviews; hinted/retried/incorrect answers reset to a one-day review; early repeats cannot extend the interval; intervals cap at 30 days. The original 1/6/multiplied-interval behavior comes from the attributed SM-2 calculation. These are practice scheduling decisions, not calibrated mastery or STAR-score estimates.

The new Daily Practice card starts eight questions with up to three due-skill review questions followed by current school work and original fallback practice. It uses only skills with playable catalog items, prefers current-source items for the same skill, preserves hints/rewards, and does not alter existing named games. Completing a daily round changes the card to a calm completion state for the school day, without a streak penalty, timer or notifications. Teacher information and subject details remain available below a compact game chooser.

Regression gates cover schedule boundaries, assisted answers, repeated/early attempts, corrupt storage, legacy progress, school timezone/DST, daily selection, first-use and completed states, 200% text, iPhone WebKit, and offline shell assets. No external learner telemetry or paid infrastructure added.

### Release integration repairs

The broader browser suite caught an assisted-answer priority regression; scheduled but assisted resolutions retain higher near-term practice priority than independent success. Source modules and study CSS now compile to one bounded offline support script, preserving the existing 12-file service-worker shell limit and the original CSS/app budgets. The browser screenshot was reviewed at 393 × 852 in WebKit.

A separate live refresh failure was traced to the teacher topic `characters`. The parser now recognizes that exact standalone/list alias through the existing approved main-character practice family. New negative tests keep `character traits` and `character motivations` unsupported instead of falsely accepting them. The teacher-refresh workflow now installs both Chromium and WebKit before running the full candidate QA suite; schedules and curriculum publication gates are unchanged.

Fresh source verification at 2026-10-05T00:19:55Z succeeded for all six teacher pages. The candidate pack contains 23 source-backed skills, 116 validated generated questions, zero unsupported skills and zero unresolved lineage. Source-insufficient topics remain explicitly withheld. Repository freshness passed; live deployment verification is still required before claiming publication.
