# ABVM #225: implemented visual foundation, disjoint preparation

Status: **PREPARED, not independently approved, not merged, not deployed.**

This is implemented source plus tests, not a new planning proposal. It is stored outside runtime paths so it cannot alter the current scoring producer or create a competing product PR. Integrate only after the chosen scoring release and explicit ownership handoff, per #204 comment 6008500455. Do not merge this preparation branch into main as a substitute for the intended product integration.

## Exact starting point

- Scoring candidate: `b86ba69bec225994717c1fe12074af286df0f1ab`.
- Tracked source tree: `2dface4dfca647aa368de885c5eacbebfb225f1d`.
- Source recovered from successful Actions reproduction run `37406960189`, artifact `11387664389`. Its original tested merge was `344c734272b0d5ac0829c3362818141d07f70e72`.
- Local reconstructed Git tree was verified identical before editing.
- Decoded preparation SHA-256: `bb0d77b7c0c7b7221f007be7785a6b0ce79c09b31eb90add9e0a6d8124c8e56d`.

## Implemented changes

1. Semantic typography, spacing, color, control, focus and state tokens use the existing `study-games-materials.css`, not another global override file. Selected Radix sRGB colors and one Open Props easing value have pinned source blobs and MIT notices.
2. A compact introduction replaces the large decorative panel. The complete source-priority explanation moves to the existing information footer; no source facts are dropped. Familiar game names, grid identities and native source selection remain.
3. Game tiles, practice controls, question text, answer/feedback states and results share the new presentation values. Four choices fit above phone navigation at 393x852 in the tested snapshot; the tablet retains two columns.
4. Daily Practice has a distinct primary-action treatment. Other source/test and recovery controls remain available.
5. The rejected-answer `Tried` marker has a reserved badge lane. It no longer creates an extra grid row that changes answer heights and moves remaining tap targets. A deliberate reintroduction of the old row produced a detected approximately 30.56 CSS-pixel shift.
6. Six old tile/grid `!important` locks are removed only for migrated layout properties. Existing retired-file and CSS hygiene gates are unchanged.
7. The prepared shell, CSS, controller and service-worker identities are synchronized. The accepting producer must recheck identities against the actual released main before integration.
8. Twenty additional dependency-free unit checks and eight hosted Playwright cases cover contrast pairs, source/cache contracts, responsive geometry, keyboard focus, enlarged text, reduced motion and stable rejected-answer targets.

## Actual evidence

- Existing static/source/hygiene gates: **PASS** on the prepared files.
- Node unit tests: **263 passed, zero failed**, including 20 new tests.
- Local Chromium presentation replay: **7 scenario groups passed**: phone, narrow phone, landscape, tablet, wide, 200% text and a complete scored round/return.
- The complete round still shows **6/8 = 75%**, two corrected retries and one hint. Disabled re-taps do not add attempts; return preserves selected source.
- One intentional old-badge mutation was **detected as an expected failure**. It was not left in the patch.
- Controlled rendering used the actual app/controller/engine/views and real repository school snapshot. The harness embeds local code and data, substitutes Blob module URLs and ephemeral Storage, and does not change product logic.
- Localhost HTTP navigation is denied by the managed browser. Container external Git/network DNS is unavailable. No policies were disabled or bypassed. Therefore this replay is **not** HTTP delivery, IndexedDB durability, installed-PWA, offline reload, Safari/WebKit, VoiceOver, physical-device or actual-user proof. New full hosted QA is **not run**.
- Required published scripts/styles add approximately **1,980 gzip bytes**, measured deterministically against the source baseline, with no new runtime package or asset request. This is a byte-count comparison, not field INP/CLS performance evidence.
- Source/learning/score authority modules and governed school JSON were byte-compared and remain unchanged. `app.js` changes only the introduction/provenance copy; it is 21 bytes smaller.

The source attachment includes before/after phone/tablet screens, retry/result screens, a replay recording, exact hashes and test logs. They are candidate preparation evidence, not a live deployment claim. Independent aesthetic acceptance remains pending.

## Safe integration by the existing implementation owner

The encoded parts are ordinary gzip/base64 transport for a UTF-8 JSON change set. They are split solely for reliable connector transport. `apply.mjs` decodes them and checks the complete payload checksum. It does not access the network, mutate Git refs or publish anything.

From the authorized repository worktree, with this directory available:

```sh
node preparation/visual-foundation-225/apply.mjs --check
node preparation/visual-foundation-225/apply.mjs --write
npm run qa:static
npm run qa:unit
npx playwright test tests/visual-foundation.spec.mjs tests/study-score-feedback.spec.mjs
npm run qa
```

Default execution is check-only. Each of the eight target files must match its recorded original SHA-256 or be absent when new; every computed output must match its expected SHA-256 before any file is written. The applicator refuses reapplication and refuses changed inputs rather than force-overwriting them. Validate against current main and reconcile a mismatch explicitly. No full-suite gate is removed or weakened.

After integration: obtain fresh full exact-head CI and independent visual/accessibility/functional/source reviews, then normal Release Integrator merge, Pages release QA and live version/cache/flow proof. Do not reuse the old scoring candidate's CI as approval for these changes.

## Scope within the 50-item plan

P01 has an implemented/tested foundation, not final acceptance. P05/P06 have bounded presentation improvements and P09/P10/P11 have partial evidence. This does not close whole packages or mark any item independently ACCEPTED/DEPLOYED. Phosphor replacement, original game artwork, component/dialog comparison, native transition/Motion evaluation, parent-page migration, full visual baselines and live/device acceptance remain open. The retired `pages/design-tokens.css` path remains absent; the existing guard was honored by putting new semantic values in the current owning stylesheet.

The interactive preparation producer hands this immutable package to the existing Executive Director. No current scoring branch, school data, task schedule, enabled state, credential, security setting or live deployment was changed.
