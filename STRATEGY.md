# Strategy: Token Radar (radar-3)

## Goal

Win the pairwise judge, not the gate. The gate is binary (valid or not); the judge picks the
better radar head to head on five criteria, in order: a working radar, the value model, farm
plans, the dashboard as a page, and that it looks made. Everything below serves that order.
Radar-2 was a fixed shrunk multiple with no backtest. Radar-3 closes that gap: a size curve
fitted to the traded tokens, backtested out of sample, and farm plans costed to the dollar.

## 1. A working radar

- Board: 198 rows — all 40 watchlist protocols, the 138 rankable pre-token protocols below
  the $50M floor, and the 20 above the floor that the watchlist leaves out. Those twenty pass
  every check the snapshot can show; the house's rule also uses DefiLlama's parent-protocol
  field, which the snapshot does not carry, so the visible record can neither confirm nor deny
  a parent for them. They are ranked on the visible record and flagged
  `off-watchlist, above floor` on their rows and in the detail view, so a reader can weigh
  them. The field guide says a protocol the list leaves out is no worse a subject than one
  on it.
- The 144 pre-token protocols that fail the exclusion rule are named in "Left off the board"
  with the reason each fails (excluded category, version marker, wrapped/staked word,
  exchange name).
- Screenshots and code agree: the detail view recomputes each row from the same numbers
  board.json carries, and the page shows the arithmetic.

## 2. The value model (radar-3)

A fitted size curve, computed from the snapshot at run time — never a hardcoded list of names:

- **Comparables**: live-token protocols with a positive market cap and TVL, a category, and no
  excluded shape (no bridge, canonical bridge, liquid-staking, liquid-restaking,
  restaked-BTC, CEX or chain product; no version marker; no whole word wrapped, staked or
  staking; not named after an exchange). That is 88 protocols. A parent token's market cap
  carried on a sub-protocol, or pass-through staked assets counted as TVL, is not a
  comparable, and the exclusions are the same rule the watchlist uses.
- **Band**: a comp is kept when its market-cap-to-TVL ratio lies within one decade of the
  comps' median ratio (0.214x here, so the band is 0.021x to 2.14x). 68 are kept, 20 are set
  aside as outliers and named in the dashboard with their ratios. The band is a mechanical
  rule from the data's own median, not a hand-picked range.
- **Curve**: least squares on log10(market cap) against log10(TVL) over the kept comps:
  log10(mcap) = 1.6934 + 0.6937 * log10(TVL), R² = 0.402. A protocol twice as big is not
  worth twice as much: the slope is below one, so the curve pays less per TVL dollar as TVL
  grows. The biggest rows are worth far less than a fixed multiple of their TVL would say,
  and the data says so, not the author.
- **Growth**: 7-day TVL change clamped to [-50%, +100%] at half weight. The snapshot's largest
  7-day move is +4,448%, so the clamp is load-bearing, not decoration.
- **Maturity**: 0.60 + min(age, 1095)/1095 * 0.40; unknown age counts as 365 days.
- **Breadth**: +2% per extra chain, at most +10%.

The dashboard prints the fitted curve, the scatter of all 88 clean comps with the fitted line,
the per-category median ratios (descriptive only — the curve, not the category, prices the
board), and the full backtest.

## 3. The backtest

Every number is computed from the snapshot at run time, by refitting the band and the curve
from scratch for each held-out protocol. The median factor is the typical miss: half the
held-out tokens are predicted within that factor of their actual market cap.

- Leave-one-out: x2.67 (32% within 2x, 57% within 3x), n = 68.
- 5-fold cross-validation: x2.65 (35% within 2x, 56% within 3x).
- Single 70/30 out-of-sample split: x2.59 (test n = 12).
- Leave-one-out on all 88 clean comps, outliers included: x3.42 — the honest number with the
  bad comps left in, shown beside the headline.
- Radar-2's rule, leave-one-out on the same 68 comps: x3.67. The curve cuts the typical error
  by about a quarter against the old rule, on the same test.

No richer model helped: adding age, chain count, growth or per-category intercepts raised the
in-sample R² and made the out-of-sample miss worse, so radar-3 keeps the single curve. The
backtest is a claim the reader can check, not a slogan: the dashboard states the method, the
numbers, and the comparison.

## 4. Farm plans, costed to the dollar

Six steps per protocol, each with a dollar cost and a time, generated from the protocol's own
record (category, chains, TVL, age). The cost is gas plus any fee the action charges, at
assumed per-transaction prices stated in the dashboard: Ethereum $2.50, Solana $0.02, named
layer-2s and cheap chains $0.10, all other chains $0.25. Gas prices are estimates, not
snapshot facts. The core action is 2 transactions (approve, then act), the weekly action is
1 per week over the hold (30/45/60 days by age), the claim is 1; bridges pay a $1.00 fee per
crossing. Capital is sized by TVL ($50/$100/$150/$250) and shown separately: it is deployed,
not spent, and returns when the position is unwound. The plan's net cost is gas plus fees.
Each detail view shows the net cost, the gas, the fees, the capital, and the cost per $1M
of implied value, so a reader can tell at a glance whether a farm is worth its gas.

## 5. The dashboard as a page

Sortable board (by implied value, TVL, growth, age, farm cost, name), search, category/chain/
min-TVL/watchlist filters, a live-token view at market value (never ranked), a detail view per
protocol with the curve arithmetic and the costed farm plan, a methodology section with the
curve, the scatter, the backtest table, the gas table, the set-aside list and the excluded
list. Hash routes (`#/protocol/<slug>`, `#/filter/<category>`) make the three screenshots
reproducible.

## 6. It looks made

Warm paper background, ink text, one deep-green accent, tabular numerals, rank badges, value
bars, consistent spacing. System fonts only; no network, no framework.

## Honest limits

- "Records no token" is what DefiLlama's record says, never proof a protocol has none.
- Implied value is the entry's own claim, never a price and never a prediction a token comes.
  The backtest says the typical prediction is off by a factor of about two and a half: treat
  every implied value as an order of magnitude, not a quote.
- Gas prices are estimates; if they move, the farm costs move with the table, not with the
  protocol.
- The snapshot is frozen at 2026-11-14; nothing here updates it.
