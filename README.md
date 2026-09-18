# ABVM School Star World v4

Standalone Grade 2 game built from the user's ABVM requirements and research blueprint.

## Included
- Phone-cloud school source feed with server-side last-good cache and verified fallback
- Tonight homework + reminders
- 5-question adaptive Quests with pause/resume, read-aloud, hint ladder, model answer, auto-advance, More Time, and duplicate-reward protection
- Creation Garden, Story Trail, Lantern Path world progression
- Study Guides with upcoming-assessment priority and separately revealed practice answers
- Simple first-run avatar selector, detailed SVG avatar renderer, companion, dress-up, saved looks
- 12 Catalog collections × 10 items = 120 original items; every item has a renderer-backed thumbnail
- Ownership, equipment, favorites, Dream Goal, coins, League Stars, room delivery/placement
- Parent Learning Pulse, settings, export/import backup, legacy ticket conversion support
- IndexedDB-first local persistence and PWA shell caching
- No loot boxes, streak loss, expiring rewards, public child rankings, or FOMO pressure


## v5 emergency source-fix build

This build rejects incomplete upstream study packs, ignores incomplete cached packs, and falls back to a sanitized local pack containing the verified homework plus the current Spelling, Reading/ELA, and Religion material supplied on 2026-09-17. The local bootstrap is automatically superseded when the sanitized upstream source reports a complete pack.
