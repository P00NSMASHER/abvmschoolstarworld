# Monthly lunch illustrations

The verified school menu is always the source of truth. Illustrations are a visual
extra; the exact menu text, dates, closures and source links remain visible. Every
image is labeled **Meal illustration**. It is not a photograph of the actual meal.

## Automatic intake and backup

A lunch menu upload plus “integrate into the app” includes artwork in that same
run: review the menu, reuse suitable approved art, generate missing art with the
built-in high-quality image generator, inspect it, test, and publish. No second
artwork request is needed.

The GitHub merge-event task **Complete lunch artwork** is configured as a backup
but currently paused: enabling it was blocked by the account limit of 15 active
tasks. Do not describe it as active until enablement succeeds. Once enabled, after
merged pull requests it checks for current/future menus needing illustrations,
completes the same review and QA process, and quietly does nothing when coverage is
complete. It does not trigger on direct pushes. Use PRs for menu changes. It is not
a private-chat watcher or a paid image API service. If generation is unavailable,
retain the accurate menu text and report the precise missing coverage.

## When a new month arrives

1. Complete the existing official-menu review and update
   `pages/data/lunch-catalog.json`. Never derive menu content from an image prompt.
2. Run `node scripts/build-lunch-art-plan.mjs`. It writes
   `pages/data/lunch-art-plan.json`, an exact source-keyed inventory of unique menus,
   dates, existing approved assets, and missing-art prompts. It also compiles the
   small synchronous `pages/lunch-art.js` renderer, so cards do not wait for a
   second data fetch. The plan is deterministic and can run with every runtime
   pack build. `pendingArtMenus(plan, month)` selects missing current and future
   menus using `YYYY-MM` in the school’s America/New_York timezone; expired
   September menus do not create a recurring backlog. There is no paid API job.
3. Reuse a reviewed entrée-only image when the new menu explicitly names the same
   entrée, after reviewing that exact menu. Add its source ID and full, unchanged
   item list to `approvedMenus`. Side changes require a new explicit approval even
   when the same entrée image remains suitable. A changed source or menu never
   silently inherits an old picture.
4. For missing images, group identical entrées and use the built-in high-quality
   image generator. Generate only named foods, on a clean pale background, without
   logos or lettering. Prioritize frequently repeated meals and the coming week.
   Never infer the meat in “Taco Tuesday & chips”, the variety of “Fruit”, toppings,
   drinks, sides, allergens, or portion size. If the entrée cannot be illustrated
   accurately, keep the text-only card until reviewed.
5. Inspect each generated image. Store approved images under
   `pages/assets/lunch-art/` as optimized WebP files. Record the prompt and image
   review in `docs/lunch-art-prompts.md`; record the asset, alt text, generator,
   review date, review notes and exact menu approvals in
   `pages/data/lunch-art-registry.json`. Only `status: reviewed` entries render.
   Keep the source image immutable when changing foods; add a new asset and review.
6. Rebuild, run `node --test tests/lunch-art.test.mjs` and the existing QA gates.
   Review iPhone and iPad views, including an illustrated day, an uncovered meal,
   noon dismissal and no-school day. Publish through the normal tested release.

## Current coverage

The October catalog contains 20 lunch days, one no-lunch/noon-dismissal day and one
no-school day. It contains 16 unique entrée labels but 20 distinct full menus.
Sixteen reviewed reusable illustrations cover all 20 October lunch dates. The
remaining plan entries are historical September menus and are excluded from the
automatic current/future queue. Other months do not receive images without explicit
source/menu approval. No-school, missing and no-lunch days never receive food art.

`ABVMLunchArt.html(lunch)` returns a labeled figure for an exact approved source and
menu match, or an empty string. The call does not modify the official menu. The
renderer escapes descriptive strings and limits approved image paths to local
assets. The build rejects unknown menus, duplicate approvals and missing files.
