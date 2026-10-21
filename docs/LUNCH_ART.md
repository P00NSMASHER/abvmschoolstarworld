# Monthly lunch illustrations

The verified school menu is always the source of truth. Illustrations are a visual
extra; exact menu text, dates, closures and source links remain visible. Each image
has accessible alt text identifying it as an illustration; no visible footnote
appears beneath the photo. These are not photographs of actual school servings.

## Automatic intake and menu-update artwork

A lunch menu upload plus “integrate into the app” includes artwork in that same
run: review the menu, reuse exact reviewed meal art in the approved tray style, generate missing art with the
built-in high-quality image generator, inspect it, test, and publish. No second
artwork request is needed.

The 20 October tray illustrations are complete and production-verified in PR #378.
On October 16, 2026 the former **Complete lunch artwork** task was repurposed as
**Protect ABVM learning reliability**. It retains the existing repository merge
trigger and now prioritizes source/publication failures and broken learning flows.
Future missing-menu images remain part of the existing hourly **ABVM School Data
Intake** task and the menu-import process below. No dedicated artwork task or new
schedule is required. Reuse active work, exact verified menu/style metadata and normal
independent automated QA/Pages gates. No human approval is required. If generation is unavailable, retain accurate menu text
and record precise incomplete coverage. No private-chat upload watcher or paid
image API service is introduced.

### Photorealistic tray revision

The two reference photos have now been received and inspected. The approved
privacy-safe style, exact omission policy and reusable generated reference are
in [LUNCH_TRAY_STYLE.md](LUNCH_TRAY_STYLE.md). New artwork follows this style;
private reference originals and people never enter this repository. All 20 exact
October menus have reviewed photorealistic tray illustrations of the known menu
components. Fruit variety, generic dipping sauce and unspecified taco filling
remain unpictured and documented in approved artwork metadata; complete verified
menu text stays visible without an image footnote.
Use the style-aware pending-art queue to replace legacy entree-only coverage.

## When a new month arrives

1. Complete the existing official-menu review and update
   `pages/data/lunch-catalog.json`. Never derive menu content from an image prompt.
2. Run `node scripts/build-lunch-art-plan.mjs`. It writes
   `pages/data/lunch-art-plan.json`, an exact source-keyed inventory of unique menus,
   dates, existing approved assets, and missing-art prompts. It also compiles the
   small synchronous `pages/lunch-art.js` renderer, so cards do not wait for a
   second data fetch. The plan is deterministic and can run with every runtime
   pack build. `pendingArtMenus(plan, month, {styleId:TRAY_STYLE_ID})` selects missing current and future
   menus using `YYYY-MM` in the school’s America/New_York timezone; expired
   September menus do not create a recurring backlog. There is no paid API job.
3. Reuse an existing reviewed tray image only when every depicted food and the
   complete new verified menu match. Add the exact new source ID and full item
   list to `approvedMenus`; never inherit a picture from a changed source/menu.
   Keep the approved tray style and disclosures. Legacy entree-only coverage does
   not satisfy the requested tray revision.
4. For missing images, use the built-in high-quality image generator with the
   shared style/prompt in `scripts/lunch-art-style.mjs` and the approved generated
   reference in `docs/LUNCH_TRAY_STYLE.md`. Group identical complete menus, never
   just entrees with different sides. Never infer unspecified meats, fruit,
   sauces, toppings, drinks or allergens. Omit and disclose unknown components;
   retain accurate text when an image cannot be reviewed faithfully. No routine
   educator or user approval is required for this authorized workflow.
5. Inspect each generated image. Store approved images under
   `pages/assets/lunch-art/` as optimized WebP files. Record the prompt and image
   review in `docs/lunch-art-prompts.md` or an explicitly linked supplement in its
   prompt/review index; record the asset, alt text, generator,
   review date, review notes and exact menu approvals in
   `pages/data/lunch-art-registry.json`. Only `status: reviewed` entries render. Here `reviewed` means a checked
source-locked image/menu record with reproducible evidence, not a human
reviewer signature. Unverifiable art stays omitted; accurate text remains.
   Keep the source image immutable when changing foods; add a new asset and review.
6. Rebuild, run `node --test tests/lunch-art.test.mjs` and the existing QA gates.
   Review iPhone and iPad views, including an illustrated day, an uncovered meal,
   noon dismissal and no-school day. Publish through the normal tested release.

## Current coverage

The October catalog contains 20 lunch days, one no-lunch/noon-dismissal day and one
no-school day. It contains 16 unique entrée labels but 20 distinct full menus.
Twenty reviewed photorealistic tray illustrations cover all 20 October catalog menus. The
remaining plan entries are historical September menus and are excluded from the
automatic current/future queue. Other months receive imagery only after independently verified full-menu
source identity and matching registry evidence; recurring human approval is
not a prerequisite. Unknown menu components remain text-only. No-school, missing and no-lunch days never receive food art.

`ABVMLunchArt.html(lunch)` returns an image-only figure with descriptive alt text
for an exact approved source and menu match, or an empty string. No visible caption
or omission disclaimer renders beneath the image; the full menu remains above it.
The call does not modify the official menu. The renderer escapes descriptive
strings and limits approved image paths to local assets. The build rejects unknown
menus, duplicate approvals and missing files. Omission records remain in the registry.
