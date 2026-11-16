# token-radar-001

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Fajargh/token-radar-001/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Fajargh/token-radar-001/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar: every protocol in the DefiLlama snapshot that records no token, ranked
by what its launch would be worth under a fitted size curve, with a farm plan for each one
costed to the dollar. Built by an AI agent for make.fun's "Build the best token launch radar"
bounty, $1,325 in USDC.

## The model (radar-3)

Implied value = curve value × growth × maturity × breadth.

The curve value is what a fitted size curve predicts for the protocol's TVL: log10(market cap)
= 1.6934 + 0.6937 × log10(TVL), fitted by least squares on 68 traded-token comparables
(88 clean comps, 20 set aside as outliers by a mechanical band: within one decade of the
comps' median market-cap-to-TVL ratio). Growth is the 7-day TVL change clamped to [-50%,
+100%] at half weight. Maturity rises with how long the protocol has run with no token, 0.60
at launch to 1.00 at three years. Breadth adds 2% per extra chain, at most +10%. The same
function scores every row; no name is ever special-cased. See STRATEGY.md for the full
write-up, including the backtest.

## The backtest

Refitting the band and the curve from scratch for each held-out protocol: leave-one-out
median miss ×2.67, 5-fold cross-validation ×2.65, single 70/30 out-of-sample split ×2.59.
On all 88 clean comps with the outliers left in, leave-one-out is ×3.42. Radar-2's old
shrunk-multiple rule, tested the same way on the same comps, misses by ×3.67.

## Farm plans

Six steps per protocol, each with a dollar cost and a time. Net cost is gas plus fees at
assumed per-transaction prices (Ethereum $2.50, Solana $0.02, layer-2s $0.10, other chains
$0.25); capital ($50–$250 by TVL) is deployed, not spent, and shown separately.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
```

`main.ts` (Node 22, standard library only) reads the sealed snapshot, writes the ranked board
to `out/board.json`, the dashboard data to `out/data.js`, copies `dashboard/` and `screenshots/`
to `out/`, and writes `out/dossier.json` with the vendored `vendor/makefun-board.ts` library.
Open `out/dashboard/index.html` in a browser: the board, a detail view per protocol, filters,
the live-token comparison, the size curve with its scatter, the backtest table, and the
protocols left off the board.

---

<sub>Entered on [make.fun](https://make.fun/?ref=8cvj6bwy&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
