# Hunter Network 2.0: PWA Cache Storage failure isolation (2026-10-31)

## Ownership / release boundaries
- Authoritative repo: `P00NSMASHER/abvmschoolstarworld`, protected `main` at `3b6da272e0e240ff0c4ac96c3462c72fbcff851b`.
- Active integration PRs [#457](https://github.com/P00NSMASHER/abvmschoolstarworld/pull/457) and [#458](https://github.com/P00NSMASHER/abvmschoolstarworld/pull/458) modify homework and local QA preview files only. This branch changes no overlapping paths, curriculum, calendar or school sources.
- Portfolio Brain `P00NSMASHER/portfolio-brain` and trading research `P00NSMASHER/trading-platform` are governed by separate running owners. No edits, observation resets or live orders.
- No accessible repository named for the Pottsville cheer app was identified by owner-repo inventory and a `cheer user:P00NSMASHER` search; no guessed repository modified.

## Reproduced defect and bounded fix
The existing `staleWhileRevalidate` sends a successful asset fetch into the same `try` block as its best-effort Cache Storage update. Rejected `caches.open`, `cache.match` or `cache.put` can thus produce a rejected fetch response or incorrect offline failure even though the network served the asset.

A source-executing isolated V8 harness using the actual `pages/sw.js` reproduces:
| Injected failure | Before | After |
| --- | --- | --- |
| Cache Storage open rejection while online | rejected request | network response |
| cache.put quota rejection while online | offline error response | network response |
| cache.match rejection while online | rejected request | network response |
| network offline + valid cached response | cached response | cached response |
| network offline + unavailable Cache Storage | rejected request | explicit offline error response |
| normal cached asset with online revalidation | cached response | cached response |

The narrowly scoped change isolates Cache Storage read/write errors from network success, preserving existing caching strategies, response identity and safe offline failure. It adds no dependencies and no new caching privileges. Seven deterministic Node tests exercise the actual worker, including negative controls; CI must verify them on the exact PR head.

## Considered public source / license comparison
1. [GoogleChrome/workbox](https://github.com/GoogleChrome/workbox) at `4ea3138a120fd2c87389b54130e25f47e0fd7089` (last observed commit 2026-09-02): MIT `LICENSE`, blob `845b545fd0f5031a944cda8cf9018eb066500040`. Mature featureful caching framework. Rejected adoption because a full worker rewrite would be disproportionate to a localized exception-boundary fix. No code imported.
2. [serwist/serwist](https://github.com/serwist/serwist) at `1b2ea2b397999c6a579a777988f5f401e5969296` (observed 2026-10-04): MIT `LICENSE`, blob `6af66043c3a85f6cef5b5715c00eee8486d27eb4`. Actively maintained Workbox-family ecosystem, but its build-time integration and new dependencies offer no advantage for this narrow existing vanilla service-worker defect. No code imported.

Decision: independent dependency-free repair; no transitive license or vulnerability chain introduced. External source assessments are snapshots, not comprehensive upstream security audits or adoption endorsements.

## Verification and rollback
- Reproduction: original worker yielded two rejected cases and one misleading offline response under three online storage failures; patched worker returned the successful online response for all three.
- Preserved controls: offline cache hit, offline unavailable cache, normal stale-while-revalidate remain semantically correct under injected failures.
- New `tests/pwa-cache-storage-failure.test.mjs` should run with `node --test tests/pwa-cache-storage-failure.test.mjs`, then full `npm run qa`. Source-independent production/Safari validation is not claimed.
- Rollback: revert only this branch's worker change and new test/doc; no schema or stored-state migration.
- Engineer-hours saved: **not yet measured** (no fabricated estimate). Reproduced failures avoided: 3 synthetic Cache Storage error classes. No claim of real-user incident frequency.

## Next checkpoint
1. Inspect exact-head GitHub CI, resolve any genuine test failures, and merge only through protected authorized workflows. Avoid colliding with active ABVM integration owners.
2. Test actual Safari offline/online transitions and quota exhaustion when device coverage is available; synthetic harness is not hardware acceptance.
3. Hunter A: read Portfolio Brain's active protected observation and independent release attestations without touching baseline; prioritize a genuinely isolated follow-up after its owner clears the window. Tradier stays paper-only.
4. Hunter B: inspect independent non-game/non-commercial owner repositories for accessibility and mobile defects; verify any cheer repo ownership rather than guessing.
