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


## 2026-11-01 activation failure isolation
- **Reproduced in actual worker source**: if `caches.keys()` rejects, or if deleting any obsolete cache rejects, the `activate` event's `waitUntil` promise rejects **before** `self.clients.claim()`. Synthetic failure injection observed **2/3 failing** activation scenarios before the patch, **3/3 succeeding** after patch.
- Minimal fix: cache enumeration is best-effort; settle individual delete promises; still attempt `clients.claim()`. Healthy cleanup deletes only obsolete ABVM-prefix entries; current and unrelated caches remain untouched. No cache identity or public asset changed.
- Added three source-executing deterministic Node regression cases to existing PR #459; worker suite rises from 16 to **19 cases**. This remains a fault-injection result, **not a measured production incident**. Browser/Safari behavior and post-push full GitHub CI require separate verification.
- Alternatives rechecked at immutable source refs: Workbox MIT LICENSE `845b545fd0f5031a944cda8cf9018eb066500040` and Serwist MIT LICENSE `6af66043c3a85f6cef5b5715c00eee8486d27eb4`. Both not archived; rejected framework replacement for this two-line exception-boundary repair. No source code imported, dependencies, lockfile or licenses changed.
- Engineering time saved: unmeasured; no fabricated estimates. Rollback: revert activation handler edit and remove the three new regression cases, no data migration.
- Exact review remains draft, **no merge, deploy or production changes**. Portfolio Brain and trading research owners untouched.

## 2026-11-01 follow-up: valid null-body cache entries
- **Reproduced failure:** Network-first offline recovery rewrapped cached HTTP 204/205 by passing `cached.blob()` into `new Response`. Even an empty Blob is a forbidden body for these valid HTTP statuses; two synthetic offline-cached cases threw `Response constructor: Invalid response status code` in Node 22.
- **Minimal repair:** supply a literal null body for 204, 205 and 304 while retaining status, response headers and `X-ABVM-Cache-Fallback`. HTTP 200 body behavior remains unchanged. No cache schema, route changes, new dependency or private content.
- **Verification:** isolated source-derived network-first reproduction: **2/3 failures before, 3/3 passes after**, covering 204, 205 and 200. Added three source-executing V8 tests against the actual worker to require the same behavior on GitHub CI. Genuine exact-commit CI remains required before release; this is not device/Safari validation.
- **Source comparison:** Workbox and Serwist remain MIT-licensed, version-pinned rejected candidates (links and immutable SHAs above). Independent zero-dependency fix keeps the existing worker and avoids a framework migration. No third-party source copied.
- **Risk/rollback:** revert the null-body branch change and its three tests; no migrations, external calls, billing, enrollment or deployments. Engineer-hours and observed user incidents remain unmeasured. The PR stays draft pending full required CI and safe release authorization.


## 2026-11-01 cached-body stream failure hardening (Hunter Core run)
- **Before/after actual worker V8 probes:** two cache-hit paths with a synthetic unreadable cached response body rejected the `networkFirst` promise, even though the server provided either a genuine HTTP 503 or a defined offline error condition. After the bounded change, offline resolves to `Response.error()` and online retains the original HTTP 503 status. Two adversarial scenarios reproduced **2/2 failures before; 2/2 expected outcomes after**. Healthy cached 200/204/205 controls remain covered by existing tests.
- **Change:** wrap the cache response reconstruction (Headers, blob, Response) in a best-effort fallback boundary. Does not suppress genuine server error status, change cached normal responses, change routes, store private data, introduce telemetry, dependencies or third-party code.
- **New tests:** two source-executing V8 regression cases in `tests/pwa-cache-storage-failure.test.mjs`; 24 worker cases total, exact-head GitHub CI/browser still to be verified after push. This is simulated corruption, not a measured production incident.
- **External candidate review:** previously pinned MIT Workbox and MIT Serwist were again compared. No upstream code imported; the existing two-line error boundary is safer than a PWA migration. Full transitive audits are not applicable to this dependency-free change.
- **Measured engineering time savings:** unknown; no claim of saved days or actual user impact. Rollback: revert this single commit. No release, main-branch write, production action or Brain/Tradier modification is authorized by this change.

## 2026-11-01 network-first persistence race repair (Core Engineering owner 6ae5c1bae9508191bd3be58a022b7b80)
- Verified public repo default `main` at `9688f1ffb85b8d804af02f783fd409cef2bab3f5`; existing draft PR #459 parent `f8a38e093741d88f96c075361365b291d2d67ba6`, with distinct non-owned integration PRs #457/#458 preserved. Earlier receipts are historical, not current CI approval.
- **Source-authenticated before:** `networkFirst` awaited `caches.open(CACHE)` before `response.clone()`; a returning online response may be consumed while storage opening is delayed. A bounded actual-worker V8 fault probe delivered the network response, but made **zero cache writes** after a delayed storage open.
- **After:** clone the successful response synchronously before awaiting storage opening; retain prior error isolation, caching policy and response identity. The same fault probe delivered the online response and made **one cache write**, without waiting for persistence to finish.
- **Regression:** add a source-executing Node test with delayed `caches.open` and simulated consumed body, asserting both immediate delivery and offline cache persistence. The old source fails the cache-write assertion. Full genuine exact-new-head GitHub CI and real-device offline behavior remain unverified until independently completed.
- **External code decision:** existing pinned Workbox and Serwist MIT candidates remain rejected (above). No third-party library adopted, NOTICE change, new dependency, private data, altered curriculum or production release. Time saved and real-world incident frequency remain **unmeasured**.
- **Stage/next action:** patched on existing draft PR #459; verify new head source integrity and genuine Actions outcomes, retain draft pending protected release/deployment authorization. Rollback: revert this same-PR worker/test/ledger change; no migration.
