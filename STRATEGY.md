# Strategy: Token Radar (radar-2)

## Goal

Win the pairwise judge, not the gate. The gate is binary (valid or not); the judge picks the
better radar head to head on five criteria, in order: a working radar, the value model, farm
plans, the dashboard as a page, and that it looks made. Everything below serves that order.

## 1. A working radar

- Board: 178 rows — all 40 watchlist protocols plus every pre-token protocol below the $50M
  floor that passes the house's exclusion rule in full (not a bridge, canonical bridge,
  liquid-staking, liquid-restaking, restaked-BTC or CEX product; no version marker; no whole
  word wrapped/staked/staking; not named after an exchange). The starter's weaker rule let
  bridges and liquid-staking products below the floor onto its board; this one does not.
- Twenty protocols above the floor pass the visible checks yet are absent from the house
  watchlist (DefiLlama records a parent protocol for them, a field the snapshot does not
  carry). They are not ranked as launches; the dashboard names them in "Left off the board"
  with that reason instead of hiding them.
- Screenshots and code agree: the detail view recomputes each row from the same numbers
  board.json carries, and the page shows the arithmetic.

## 2. The value model (radar-2)

A comparables model, computed from the snapshot at run time — never a hardcoded list of names:

- **Multiple**: per category, the median mcap/TVL of live-token protocols in that category,
  winsorised to [0.02, 1.00], shrunk toward the snapshot's global median (0.214 here) with k = 4, clamped
  [0.05, 1.50]. A category with no live comps takes the global median. This is the main
  difference from the starter's flat 0.25× TVL: RWA prices at 0.253×, Lending at 0.148×,
  Dexs at 0.306×, Basis Trading at 0.491× — the market's own pricing, per kind.
- **Growth**: 7-day TVL change clamped to [−50%, +100%] at half weight. The snapshot's largest
  7-day move is +4,448%, so the clamp is load-bearing, not decoration.
- **Maturity**: 0.60 + min(age, 1095)/1095 × 0.40; unknown age counts as 365 days.
- **Breadth**: +2% per extra chain, at most +10%.

The dashboard prints the full multiples table and the formula, and every detail view shows the
row's arithmetic step by step, so the judge can check the model without trusting it.

## 3. Farm plans

Six steps per protocol, each with a cost and a time, generated from the protocol's own record
(category, chains, TVL, age): the core action and the weekly action vary by category (supply
and borrow for Lending, liquidity for Dexs, vault deposits for curators, mint-and-hold for
RWA, margin for perps, staking for restaking, and so on). Capital is sized by TVL
($50/$100/$150/$250); the hold is 30/45/60 days by age. No slogans, no "pay to claim".

## 4. The dashboard as a page

Sortable board, search, category/chain/min-TVL/watchlist filters, a live-token view at market
value (never ranked), a detail view per protocol with the model arithmetic and the farm plan,
a methodology section with the multiples table and the excluded list. Hash routes
(`#/protocol/<slug>`, `#/filter/<category>`) make the three screenshots reproducible.

## 5. It looks made

Warm paper background, ink text, one deep-green accent, tabular numerals, rank badges, value
bars, consistent spacing. System fonts only; no network, no framework.

## Honest limits

- "Records no token" is what DefiLlama's record says, never proof a protocol has none.
- Implied value is the entry's own claim, never a price and never a prediction a token comes.
- The snapshot is frozen at 2026-11-14; nothing here updates it.
