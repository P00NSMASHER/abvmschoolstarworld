# Core Hunter B | ABVM offline code-version integrity | October 31, 2026

## Evidence and ownership
- Canonical repository: `P00NSMASHER/abvmschoolstarworld`; branched from protected `main@86643fa5590bb657be22f72cb7d5345c49c56f6a` after CI-verified workflow-action upgrade PR #441 merged.
- Open curriculum PR #436 and scheduled-source monitoring PR #434 remain untouched. This change addresses only installed PWA cache revision integrity, without editing source feeds, student information, schoolwork, teacher content, provider settings, or workflows.

## Reproduced pre-change failure
- The historical `cachedFallback` always retried `cache.match(request,{ignoreSearch:true})` after an exact miss. Given a previously stored `./app.js?v=166`, a failed/offline request for `./app.js?v=999` could receive the old `?v=166` bytes as if they were requested. Mixing versioned JS/CSS/MJS modules is unsafe even if network-first logic prevents it when online.
- The test in `tests/pwa-cache-fallback.test.mjs` runs the actual service-worker source against an adversarial in-memory cache. The negative control supplies prior-version bytes on query-ignored matches and checks that versioned-code misses fail closed. The positive controls prove that exact version matches and query-insensitive unversioned data fallback still work.

## Small integration, no dependency
- `cachedFallback` first checks exact cache identity. For CSS/JS/MJS with a `v` query parameter, it returns only that exact version or no response. For all other requests, existing query-insensitive data/navigation fallback remains unchanged.
- Incremented cache and one-time service-worker reload identity together from 198 to 199, preserving PWA upgrade semantics. Existing full browser/offline QA remains required before protected promotion.
- Public code compared: [GoogleChrome/workbox](https://github.com/GoogleChrome/workbox) (MIT, relevant caching architecture) and [microsoft/playwright](https://github.com/microsoft/playwright) (Apache-2.0, already in dev dependency tree for browser reproduction). No code was copied, no new dependency was installed, and no NOTICE or transitive license change results.
- Engineering time saved is **not measured**; a hypothetical 1-3h troubleshooting reduction for a future stale-module incident is not realized savings.

## Validation, release and rollback
- New deterministic node:vm positive/negative controls run through the existing `npm run qa:unit` path. Existing Playwright offline/PWA tests must also pass in hosted App QA and independent reproduction on the exact PR head.
- No live deployment, authenticated school-source fetch or production cache reset occurred during branch preparation.
- Rollback is a clean PR revert: restore prior `cachedFallback` and synchronized cache/reload identities. Physical iPhone, VoiceOver and real-world offline usage remain unverified.
