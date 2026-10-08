# ABVM Study Ranks

The existing permanent ABVM rank ladder now has **22 ranks, including 15 added promotions**. The original seven names, artwork, IDs and thresholds are preserved; ABVM Legend remains the final reward at 1,500 Study Stars. This is not a separate badge system. The first milestones are only 25 stars apart, then the gaps gradually grow to 100.

| Rank | Stars required | Original/new |
| --- | ---: | --- |
| Eaglet | 0 | Original |
| Nest Explorer | 25 | New |
| Star Scout | 50 | Original |
| Little Luminary | 75 | New |
| Feather Cadet | 100 | New |
| Bright Spark | 150 | Original |
| Star Voyager | 200 | New |
| Sky Scholar | 250 | New |
| Junior Scholar | 300 | Original |
| Wing Leader | 375 | New |
| Study Sentinel | 450 | New |
| School Spirit | 525 | New |
| Honor Eagle | 600 | Original |
| Blue Ribbon Ace | 700 | New |
| Golden Quill | 800 | New |
| Sky Captain | 900 | New |
| Golden Eagle | 1000 | Original |
| Eagle Vanguard | 1100 | New |
| Honor Guardian | 1200 | New |
| Crown Keeper | 1300 | New |
| Star Commander | 1400 | New |
| ABVM Legend | 1500 | Original |

Today presents the current rank, Study tracks the next promotion, and Progress presents the entire ladder. The next-rank progress meter fills from the current rank threshold to the next, while the numeric label retains the saved-star balance and next threshold.

Completed rounds still award 10 Study Stars, up to 10 extra correct-streak stars, and a 25-star bonus for 100% first-try accuracy. Each submitted wrong answer deducts up to 2 stars (never below zero). Retries do not earn a perfect bonus. Study results and content governance are unchanged.

## Permanent migration

Existing badge-achievements stores upgrade their `collection-state.ladderVersion` from 1 to 2 inside the same atomic IndexedDB transaction used by awards. Original earned badges are preserved verbatim. Their highest previously earned original threshold safely proves that the **newly inserted** lower badges were earned, even when penalties have since lowered the saved balance. Inserted backfills use `migrated: true`, `earnedAt: null` and `earnedOrder: 0`, so no historical promotion date is fabricated and an old lower rank can never displace the latest saved original promotion. Repeat loads are idempotent. A v1 reward ledger with no badge state still migrates only the proven **net** balance, never canceled positive reward rows.

The seven original polished WebP badges are unchanged. Fifteen new original handcrafted SVG badges add metallic gold bevels, navy enamel, gemstones, ribbon tails and different school-themed 3D-style motifs. These are decorative, responsive assets with transparent backgrounds; all are optional offline-cache items. No student-specific performance data is published.
