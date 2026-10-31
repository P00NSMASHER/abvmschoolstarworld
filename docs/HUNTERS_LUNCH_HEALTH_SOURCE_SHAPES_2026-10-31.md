# GitHub source hunter | malformed ABVM lunch coverage feeds | 2026-10-31

## Reproduction and source pin
- Target: `P00NSMASHER/abvmschoolstarworld` source at protected main `a429ba063cb5eb8fdab32e8150e0e35dbdce0a0d`; touched only `scripts/school-week-label.mjs`, its existing Node tests, and this ledger.
- Exact original JavaScript evaluated in isolated V8: `assessUpcomingLunchCoverage({lunchMenu:{date:'2026-10-19'},lunchArchive:[{date:'2026-10-20'}],importantDates:[]},'2026-10-17T22:00:00Z')` throws `TypeError: ... is not iterable`.
- Separate original failure: object-form `importantDates` causes `TypeError: ... .some is not a function`, losing all health coverage despite valid published archive dates.
- Patch reads only actual arrays. The invalid lunch object cannot claim a published lunch; the invalid closure object cannot claim a school closure. Previously valid archived dates and explicit valid no-school days still work.
- V8 source-byte preflight: three synthetic positive/adversarial cases passed before commit. The committed `tests/school-week-label.test.mjs` supplies persistent regression checks. Host Node/browser CI must be checked at exact head before merging.

## External source consideration (no code copied)
- `colinhacks/zod` [MIT license](https://github.com/colinhacks/zod/blob/main/LICENSE), license blob `c06579627b432d09779094cd0166b7f37fe51db8`, reviewed head `2554b70c3d4a80273381e61d527d820720626440` (2026-10-30). Full runtime schema validation too heavy for three array checks.
- `ajv-validator/ajv` [MIT license](https://github.com/ajv-validator/ajv/blob/master/LICENSE), license blob `139162ad2c389a18d3d66e159a2821b2e40087fc`, reviewed head `f177fe323420ccb23e1a79445fd470cbf80aee7c`. JSON Schema adoption would add schemas, packages, dependency review and maintenance for this isolated bug.
- Rejected both integrations. Native `Array.isArray` preserves package-lock, has no transitive license/advisory change, NOTICE obligations, runtime cost or external telemetry. No comprehensive upstream advisory audit claimed.

## Safety/impact/rollback
- No private student content, source data rewrites, CI weakening, schedule changes, deploys, or live source fetches.
- Source checks: malformed menu object and closure object previously crash; after change, all five missing dates correctly reported when no eligible menus; valid array/archive/closure controls unchanged.
- Hypothetical engineering-time savings 0.5–2 hours *if* incident prevented, calculated as approx. 0.5h reproduction plus 0–1.5h root cause/support. Confidence low; no observed production impact or measured saved hours.
- Rollback: revert focused PR; no migration.
- Next: verify exact-head Node and browser CI; do not merge until protected procedure and all required checks. Prior unrelated PR #434 remains untouched; Portfolio Brain observation not touched.
