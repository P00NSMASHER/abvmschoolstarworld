# Hunter Network 2.0: Core engineering checkpoint (2026-10-31)

## Ownership, baseline and scope
- Hunter B, ABVM: dedicated feature branch from protected `main` at `79e853a0bbd0447cffc186d81f90dbe60516c9ca`. Existing academic/civil-date PRs #451 and #452 own unrelated files; neither was changed.
- Hunter A, Portfolio Brain / Tradier: inspected Brain `main` (`2b4fb0566938f32ef49deda2f056d1a766ab1d88`) and active observation-related PRs #809/#812. No Brain baseline edits, CI manipulation, merges or observation resets. Trading PR #521 has a completed successful `pr-ci` run but is still draft, and several other research/source PRs remain open. Respect existing owners; do not manufacture a parallel merge or research run.
- GitHub reports all three named repositories as **public**, despite project names and product wording suggesting private use. Keep secrets, child personal data, PHI, financial credentials and proprietary assets out of these repositories.

## Reproduced defect, minimal integration
- Existing `scripts/serve-pages.mjs` checked a **lexical** path prefix before `statSync`, which follows links. An on-disk symlink inside `pages/` targeting a file outside `pages/` passed lexical containment and could be served by the development/QA preview endpoint. This is a local-preview security defect, **not evidence that any production file leaked**.
- The same server responded to unsupported HTTP methods as though they were GET. New logic permits only GET and HEAD (405 + `Allow` for others), sets `X-Content-Type-Options: nosniff`, and resolves both the requested path and its canonical real path before serving.
- Added `scripts/preview-path.mjs`, Node adversarial tests and Playwright HTTP smoke. No runtime dependency or asset was introduced; production Pages, curriculum, child records and caching behavior were not touched.
- Local Node 22 check on 2026-10-31: **3/3 unit tests passed** (sibling prefix traversal, escaped symlink, legitimate in-root link and missing file); `node --check` passed on server and smoke test. Separate local HTTP check: GET=200, HEAD=200, POST=405, nosniff header present. Full GitHub PR CI is authoritative before any merge.

## Licensed source comparison (no code copied)
- [`lukeed/sirv`](https://github.com/lukeed/sirv/tree/1135207e92c40354543cbd15c763c7a61d79d432), MIT [license](https://github.com/lukeed/sirv/blob/1135207e92c40354543cbd15c763c7a61d79d432/license), `sirv` 3.0.2: mature static middleware; package brings three runtime dependencies. Considered but inappropriate for a tiny QA-only server.
- [`vercel/serve-handler`](https://github.com/vercel/serve-handler/tree/ead85eb0819cde32eed2bc5726ff6c8ac895f975), MIT [license](https://github.com/vercel/serve-handler/blob/ead85eb0819cde32eed2bc5726ff6c8ac895f975/LICENSE), 6.1.8: maintained publicly, broader routing and 7 runtime dependencies, substantially larger than required.
- Decision: original implementation with built-in Node `realpathSync` and standard path API; no license import or new dependency, so no new transitive license/advisory exposure. Dependency advisories for unadopted candidates were not treated as proof of safety or audited exhaustively.

## Hunter A tooling candidates and conflict handling
- [`jd/tenacity`](https://github.com/jd/tenacity/tree/32ac68f0941319c0d2f4fb927f96e4ee29bb46c6) is Apache-2.0 and supports bounded retry/backoff; [`urllib3/urllib3`](https://github.com/urllib3/urllib3/tree/2aa7e9c35234a90a1ce09b84dc7b706a6d604674) is MIT and provides mature HTTP connection/retry primitives. Both were reviewed as possible research ingestion helpers only; no addition to `requirements.lock` without an exact source-specific failing test and independent PR-owner coordination.
- Rejected: archived [`litl/backoff`](https://github.com/litl/backoff) as a new integration candidate. Deferred all trading-code imports while open #521/#522 and release-integrity ownership remain unresolved.

## Verification, risks and rollback
- Local validation does not substitute for CI or physical-phone tests. Symlink regression uses temporary synthetic files only and skips symlink-specific cases where a Windows account lacks privilege; no real school or patient data.
- Behavior change: POST/PUT/DELETE to the local preview now get 405; legitimate static GET/HEAD remain compatible. A symlink escaping the public tree now gets 403. Missing assets still return 404.
- Rollback: revert only this PR's `serve-pages.mjs` changes and remove `preview-path.mjs`, `preview-path.test.mjs`, `preview-server.spec.mjs` and this note; no data migration or deployment.
- Engineering time saved: **unverified estimate 0.5–1.5 engineer-hours** if an unexpected preview leak or method bug would otherwise require debugging. Method: one focused helper and automated regression replaces a future ad hoc security investigation; not measured throughput or profit.

## Next tests ranked
1. Complete exact PR-head Node/unit, full App QA and Chromium/WebKit CI, repair real failures, then seek permitted protected merge.
2. Keep Portfolio Brain observation baseline untouched pending explicit owner and automation state verification; inspect open Brain PR #812 before any future integration.
3. For trading, first consolidate current open source/replay PRs with their owners, then write an isolated failing retry/clock-budget test before evaluating Tenacity or urllib3 adoption.
4. Search other owner repositories only after confirming canonical product ownership; do not create parallel games, learning apps, or patient simulators.
