# ABVM unified release preview — no production deployment

Preview assembles the fully QA-green premium experience 2f05c377e229acb7ccd0c87c9c3a20ef6aeefa4d, current school main 7a6a6f838fc51f0ede60a3264e2213a87f7587e2, and pending teacher freshness correction 88548c13cc94ef69be1cfe8a59988995c796a2c2 in one review-only Git tree.

Preserved without overwrite: the latest main school pack, study archive, uploaded notices, official school-calendar reference, school-updates.js v4 and styles.css v113. Premium Today, Calendar, Study home/player, Test Prep, Progress and all earned Study Stars history logic remain unchanged. Source freshness now uses teacher-page check timestamps, never a newer Yahoo notice timestamp.

PWA required-shell count stays exactly 14. Integrated URLs: styles v113, school-updates v4, app v138, product-view v8, study CSS v17, design-polish v6 and service-worker cache v158.

Do not merge or deploy. Require exact-head QA, independent reproduction, screen-level WebKit verification and successful source-freshness PR #285 QA before production approval.
