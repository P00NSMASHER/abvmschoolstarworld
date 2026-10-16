# Approved maroon-tray image style

The user's two lunch reference photos were received and visually inspected on
October 15, 2026 (America/New_York). Only the maroon trays at the right were used
as reference: burgundy/maroon molded plastic, rounded corners, a thick raised
rolled rim, subtle speckling and shallow divided wells, on a cobalt-blue table.
The trays are partly cropped; unseen geometry is illustrative. The white paper
bowl in front is not the requested tray. People, private photos, names, room
landmarks and branded milk cartons are excluded from public assets and prompts.
No private reference original is committed.

The reusable privacy-safe generated reference is
`pages/assets/lunch-art/tray-2026-10-16-v1.webp`. It contains no people or private
reference pixels. Use it only for tray/camera consistency; replace every food
when generating a different menu. Style ID: `abvm-maroon-tray-v1`.

Use high-quality natural photorealism, a landscape 3:2 composition with the entire
tray visible, elevated three-quarter overhead framing, soft neutral daylight,
crisp natural food texture and no text/logos/drinks/extra food. Small clear plain
side cups match the visible reference. Images are illustrations with descriptive
alt text, not actual photographs or evidence of exact school servings. Keep the
complete verified menu text visible; do not render a caption beneath the image.

Source details remain authoritative. Do not invent fruit varieties, taco filling,
dipping sauce, toppings, condiments or allergens. The current generic Fruit is
not pictured; its omission remains recorded in reviewed registry metadata. For
Taco Tuesday & chips, show chips and explicitly named sides only, recording the
unspecified filling. Generic Dipping sauce is omitted and recorded. These choices allow
ongoing artwork completion without requiring an educator approval or inventing
food content. Named meals/sides otherwise remain visually represented.

`scripts/lunch-art-style.mjs` supplies the canonical prompt and omission policy.
`pendingArtMenus(plan, currentNewYorkMonth, {styleId:TRAY_STYLE_ID})` catches
missing art and legacy entree-only coverage. Every output needs visual inspection
against its exact menu before registry approval. Reject extra or missing food;
October review corrected an unlisted potato side and herb garnish before export.
Never interpret a successful generation call as visual approval.

Twenty October menu assets were generated with the built-in image tool, inspected,
and exported to immutable local 1280px WebP files. Exact prompts, byte hashes and
review records are in [the prompt manifest](lunch-tray-prompts-2026-10.json).
The registry pins source ID, full menu, approved style, dimensions, omission note
and SHA-256. Builder checks cap each asset at 256 KiB and reject changed/missing
bytes or dishonest omissions. Old reviewed entree records remain archived for
provenance, outside active mappings. Calendar closure precedence still wins even
when the district catalog lists a meal, including Grade 2's October 20 closure.

The enabled Complete lunch artwork merge-event task audits current/future menu
changes, reuses only an exact matching reviewed meal and style, generates and
reviews missing assets, and uses the normal independent QA/PR/Pages workflow.
No private reference is needed on future runs. Unchanged art is never regenerated
for activity. Source or provider failure retains accurate text and an unfinished
checkpoint; bounded retries and all release/privacy gates remain. No new spending,
paid API, credentials, contacts, Work-credit workflow or manual curriculum
promotion is introduced. Ongoing automation cannot guarantee perpetual provider
availability.

## Updates in an already-open app

The startup renderer includes a fast reviewed map, then nonblocking checks refresh
`data/lunch-art-current.json` through the service worker's network-first path.
New map data must retain exact source/menu keys, local safe asset paths, approved
style, 1200–1600px width, landscape dimensions and canonical omission notes. Bad
or offline updates preserve the last reviewed map. Requests coalesce, time out
after eight seconds and are throttled to one attempt per five minutes.

Visible planner views check the existing source and homework feeds every five
minutes through their established throttles and verification functions. Study
sessions are excluded from this new periodic repaint path. Artwork refresh is
independent of source success and never delays it; changed reviewed maps repaint
Today/Week/Calendar without a reload. Full text remains authoritative before art
arrives. Loaded images use the existing static cache; missing images fall back
to text on every route.

The existing hourly School Data Intake lane provides bounded missing-art recovery
after its primary teacher/homework work if the merge event was missed or stopped.
It reuses the canonical artwork PR/owner, preserves schedules and all release
gates, and never makes art a prerequisite for school-data publication.

Food terminology review corrected Baby cake potatoes from whole baby potatoes
to mini potato cakes. The [manufacturer description](https://mccainusafoodservice.com/products/details/mccain-babycakes-seasoned-mini-potato-pancakes-648-oz/)
was used only to recognize the food term; it is not evidence of the school's
supplier, recipe, brand, portion or allergens. School menu wording is unchanged.
The prompt hint applies only when that specific menu item occurs.
