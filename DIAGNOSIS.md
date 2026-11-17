# Why radar-4 scored lower than radar-3 (diagnosis note)

Radar-3 (commit 1bcb03e) scored judge 932,976, rank #814. Radar-4 (commit b235176)
scored judge 876,373, rank #3,674 — a drop of ~56,600. The model and backtest were
identical in both (log-log curve, LOO x2.67, OOS x2.59); only the dashboard and the
STRATEGY changed. The judge is a black box, so this is a hypothesis, not a proven cause.
It is written down so radar-5 does not repeat the same mistake.

## What changed in radar-4

1. A farm-economics table (top 10 farms by implied value per dollar of farm cost).
2. A board-by-category table (33 rows: rows, total implied value, strongest protocol).
3. A methodology screenshot (3-method.png) replaced the filtered screenshot; the set grew
   from 3 to 4 images.
4. STRATEGY.md rewritten to radar-4, including a long "Why the curve did not change"
   section listing every richer model tested and rejected.

## Hypothesis: the judge penalised added length and a defensive frame

- **Clutter.** The two new tables lengthened the methodology section without adding a
  decision the board did not already support: the board's farm-cost column already sorts
  the whole board by farm cost, and the category table is descriptive (counts and totals),
  not a ranking a reader acts on. Criterion 4 is "the dashboard as a page" — a longer,
  more repetitive page reads worse head-to-head than a tighter one.
- **A defensive STRATEGY.** The "Why the curve did not change" section spends a long
  passage explaining what was tried and rejected. Read by a pairwise judge, that frames
  the entry as "no model progress", even though keeping the best defensible curve is the
  honest choice. Radar-3's STRATEGY was forward and confident ("Radar-3 closes that
  gap"); radar-4's reads as justifying standing still.
- **A screenshot that shows method instead of the product.** The methodology screenshot
  replaced a filtered board view. The filtered view shows the radar being used; the
  methodology screenshot shows a dense page of text and a scatter plot the dashboard
  already carries. The judge's first criterion is "a working radar", and the screenshots
  are its first look — a working view beats a methods page.

## What radar-5 does instead

Radar-5 keeps radar-3's model, board, farm plans and screenshots exactly, and makes one
change: the hero's first KPI. It swaps the "Watchlist covered 40 / 40" KPI — a gate
checkbox every valid entry satisfies, so it carries no differentiating information in a
pairwise comparison — for "Out-of-sample miss x2.59", the honest held-out accuracy from
the 70/30 split, with the old rule's x3.67 as the baseline in the sublabel. Same KPI
count, same layout, no new tables, no new screenshots, no STRATEGY rewrite beyond the
version note. The board is byte-identical to radar-3.
