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

## CI repair checkpoint (2026-11-01 04:00 UTC)
- Prior exact-head CI [Independent QA reproduction run 41270904787](https://github.com/P00NSMASHER/abvmschoolstarworld/actions/runs/41270904787) failed **one** of 1,082 browser tests: `tests/app.spec.mjs:395` (1,078 passed, 3 skipped). The worker regression, unit suite and ordinary App QA passed. No production regression was established.
- Root cause: this pre-existing test's `now-24h` teacher check and `now-1min` Yahoo notice both mapped to **October 31 in America/New_York** when run just after November 1, 00:00 EDT. The assertion requiring different Eastern civil dates failed before exercising the app. Local reproduction at `2026-11-01T04:00:35Z` confirms the collision.
- Repair: one test-only fixture helper uses a 27-hour historical teacher check and one-minute-old Yahoo notice, keeping the source in the expected 8–30-hour warning band while separating the dates across normal and 25-hour DST days. Browser test now imports the helper. No product logic, real teacher content, deployed assets or customer state changed.
- Adversarial unit coverage: **70,080 fifteen-minute points** across 2026 and 2027, the precise October 31/November 1 transition reproducer and invalid timestamp controls. The 3 independent Node tests passed locally on Nov 1 before push; full exact-head CI still required.
- External test-framework candidates checked: [sinonjs/fake-timers](https://github.com/sinonjs/fake-timers) `466d18e2651839370e927957b967ea5eaa172806` (2026-05-05; BSD-3-Clause LICENSE blob `eb84755e17ccd397ef09889a9c689605ef9f5acf`) and [vitest-dev/vitest](https://github.com/vitest-dev/vitest) `42770759fcca4ff82ab4df49e4ee241f4f680e99` (2026-10-30; MIT LICENSE blob `0e5771dddf4e96ebc77c349f53fc763b910e63c0`). Both are maintained and licensed, but rejected for this narrow fix because built-in Node tests and existing Playwright require no new dependencies, supply-chain additions or license obligations. No external source copied; dependency/license chains unchanged.
- Delivery state: isolated PR #459 only; expected-head fast-forward, no main modification. If the independent QA rerun passes, confirm the remaining required checks and current branch-protection release authority before any merge; do not force or bypass checks. No elapsed-time observation claims.


## Follow-up: remaining Cache Storage failure paths (2026-11-01)

The exact PR-head worker review revealed the same storage-versus-network coupling in two paths not covered by the original seven tests:

1. `networkFirst` called `cachedFallback` without guarding failures from `caches.open` or `cache.match`. When offline, a rejected Cache Storage operation produced a rejected service-worker response instead of the worker's defined `Response.error()` fallback. The successful online path was already independent of that background cache write.
2. The final same-origin GET handler (for resources outside its explicit route table, e.g. `robots.txt`) opened Cache Storage **before** considering `fetch`. Rejection prevented a successful network fetch entirely.

The code now handles these failures locally: `networkFirst` returns a safe HTTP/offline result when best-effort fallback reads reject, and the generic GET route attempts network access when cache open/read fails. Normal successful cache hits and the existing route precedence are preserved. Six additional source-executing Node regression tests cover storage-open faults, storage-read faults, offline negative controls, online success, and cache-hit preservation.

- Code commits: `1d568694ccbabbc6698ffd03df698828428b7dbe` and `acc0c865e738a40a9d74f8be6e32d5ae70069837`.
- External candidates: rechecked pinned MIT LICENSE blobs for Workbox `845b545fd0f5031a944cda8cf9018eb066500040` and Serwist `6af66043c3a85f6cef5b5715c00eee8486d27eb4`. Both repositories were accessible and not archived. No upstream implementation imported, no new dependency/lockfile change.
- Measurable improvement: before source inspection, two additional route families were still unguarded; after patch, two route families are protected by six dedicated tests. **Real user incident reduction and engineer-hours saved are not independently measurable.**
- Test status: 13 worker fault-injection tests expected in this PR, plus 3 DST fixture tests; **exact-head CI must be checked after this commit before calling them passed**. Safari/iOS hardware and production deployment remain unverified.
- Safety: no runtime logging, telemetrics, third-party assets, source-feed changes, student records, paid services, release triggers or migrations introduced.
- Rollback: revert the two follow-up source/test commits or abandon the draft PR. No main branch or live deployment was touched.
- Ownership: draft PR #459 remains separate from integration PRs #457/#458; Brain's protected observation and Tradier research code were not modified.

## 2026-11-01 follow-up: uncategorized GET offline negative control

A subsequent audit of the **actual** draft-worker source found another uncovered failure: the generic same-origin GET route could handle denied Cache Storage when online, but if the network was simultaneously unavailable its `respondWith` promise **rejected**, rather than resolving to the worker's defined `Response.error()` result. It affected unclassified paths such as `robots.txt`, not the explicitly routed curriculum/API resources.

Verified in a dependency-free V8 source-executing mock (using the current branch's complete `pages/sw.js`, with synthetic offline/network and storage-error injection). The 3 failing baseline cases all resolved to `Response.error()` after the bounded change; two positive online controls continued to resolve to the successful network response. The test matrix:

| Scenario | Before | After |
| --- | --- | --- |
| Offline network + denied cache open | rejected `respondWith` promise | explicit network error response |
| Offline network + rejected cache match | rejected promise | explicit network error response |
| Offline network + ordinary cache miss | rejected promise | explicit network error response |
| Online network + denied cache open | network response | network response |
| Online network + rejected cache match | network response | network response |

- Implementation commit `d4be22b30440f4a22ecde3a15c0dc6f11b408e51`: guard the final network fetch in the generic handler, retain its on-line response path, and return `Response.error()` after a rejected offline fetch. No service-worker cache-name, routing, dependency, feed, asset, user-data or production changes.
- Test commit `f46c0566cae19f804ae40880b3a84ed8e66e70e9`: add **3 additional source-executing Node regression cases** to `tests/pwa-cache-storage-failure.test.mjs`. Total worker cases now **16**.
- Upstream alternatives: revalidated exact MIT `LICENSE` blobs for [Workbox](https://github.com/GoogleChrome/workbox/blob/4ea3138a120fd2c87389b54130e25f47e0fd7089/LICENSE) and [Serwist](https://github.com/serwist/serwist/blob/1b2ea2b397999c6a579a777988f5f401e5969296/LICENSE); a complete caching framework was again rejected as excessive supply-chain and migration cost for this local error boundary. No external code copied. Security of all transitive dependencies is not asserted because no new dependencies were added.
- Countable benefit: three additional failing simulated offline scenarios made deterministic; **no real-user incident or engineer-hours saved claim**. To estimate hours responsibly, compare review plus CI effort against a manually implemented/retested equivalent; no such independent time study exists.
- Remains **draft**. Full exact-head GitHub CI, hardware Safari/offline acceptance and protected merge authorization must be verified before release. The user has not approved production deployment. Existing integration PRs #457/#458 are not modified. Portfolio Brain main/observation and Tradier research were not touched.
