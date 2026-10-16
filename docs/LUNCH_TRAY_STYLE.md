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
side cups match the visible reference. Images are **Meal illustration**, with
illustrative appearance and portions, never actual photographs or evidence of
exact school servings. Keep the complete verified menu text visible.

Source details remain authoritative. Do not invent fruit varieties, taco filling,
dipping sauce, toppings, condiments or allergens. The current generic Fruit is
not pictured, with that omission explicitly disclosed. For Taco Tuesday & chips,
show chips and explicitly named sides only, disclosing the unspecified taco
filling. Generic Dipping sauce is omitted with disclosure. These choices allow
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
