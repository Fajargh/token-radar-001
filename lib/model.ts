// The token radar's model (radar-3): one snapshot of the protocol universe in, one ranked board out.
//
// The board covers every pre-token protocol that passes the house's exclusion rule in full
// (198 of the snapshot's 342 pre-token protocols): the 40 on the watchlist, the 138 below the
// $50M floor, and the 20 above the floor that the watchlist leaves out. Those 20 pass every
// check the snapshot can show; the house's rule also uses DefiLlama's parent-protocol field,
// which the snapshot does not carry, so the visible record can neither confirm nor deny a
// parent for them. The board ranks them on the visible record and flags each one
// (off_watchlist_above_floor) so a reader can weigh them; the field guide says a protocol the
// list leaves out is no worse a subject than one on it. The 144 pre-token protocols that fail
// the rule are named in the dashboard's "Left off the board" table with the reason each fails.
//
// A protocol is pre-token when its index entry records no token (no market cap, no CoinGecko id,
// no symbol); the snapshot's live-token protocols are kept apart and shown as the market's own
// values, never mixed into the ranked board.
//
// Implied value follows only from the snapshot's own figures. It is a fitted size curve, not a
// fixed multiple: the market caps of the traded tokens are regressed on TVL in logs, and a
// pre-token protocol is priced off that curve, then adjusted for growth, maturity and breadth:
//
//   curve      log10(mcap) = a + b * log10(TVL), fitted by least squares on the comparables
//   comps      live-token protocols with mcap > 0, TVL > 0 and a category, that pass the same
//              exclusion rule as the board (no bridge, canonical bridge, liquid-staking,
//              liquid-restaking, restaked-BTC, CEX or chain product; no version marker; no
//              whole word wrapped / staked / staking; not named after an exchange) — 88 here
//   band       a comp is kept when its mcap/TVL lies within one decade of the comps' median
//              ratio (median / 10 to median * 10); 68 kept here, 20 set aside as outliers and
//              named in the dashboard. The band is a mechanical rule from the data's own
//              median, not a hand-picked range: a parent token's market cap carried on a
//              sub-protocol, or pass-through staked assets counted as TVL, puts a multiple
//              orders of magnitude from the pack, and such a comp is not comparable.
//   base       = 10 ^ (a + b * log10(TVL))            (the curve's predicted market cap)
//   growth     = clamp(change_7d, -50, 100) per cent
//   growthMult = round6(1 + (growth / 100) x 0.5)
//   maturity   = round6(0.6 + min(age_days, 1095) / 1095 x 0.4)   (age_days unknown: 365)
//   breadth    = round6(1 + 0.02 x min(chains - 1, 5))            (distribution, at most +10%)
//   implied    = max(1, round(round(round(base x growthMult) x maturity) x breadth))
//                (factors rounded to 6 decimals, chained rounding, so the dashboard's
//                step-by-step arithmetic reproduces the stored value to the dollar)
//
// The curve is backtested, not asserted: leave-one-out and 5-fold cross-validation refit the
// band and the curve from scratch for every held-out comp and report the median factor by
// which the prediction misses the actual market cap. On this snapshot the curve's typical miss
// is about x2.7 (leave-one-out) and x2.7 (5-fold); the same test on all 88 clean comps,
// outliers included, is about x3.4; radar-2's shrunk-category-multiple rule, tested the same
// way on the same comps, misses by about x3.7. The dashboard shows all three numbers, with
// their definitions, so the backtest is a claim the reader can check, not a slogan.
//
// Farm plans are costed to the dollar. Every step carries what it costs in dollars (gas at the
// assumed per-transaction prices in GAS_USD, plus any fee the action itself charges) and how
// long it takes; the plan totals the net out-of-pocket cost (gas plus fees) separately from the
// capital deployed, which is returned when the position is unwound. Gas prices are estimates,
// stated in the dashboard's methodology, not snapshot facts.
//
// No protocol name is ever special-cased: the same function scores every row, and the curve,
// the backtest and the multiples table the dashboard prints are computed from the snapshot at
// run time, never written by hand.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  band_decades: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  breadth_per_chain: number;
  breadth_max_chains: number;
}

export const MODEL: ModelConstants = {
  band_decades: 1,
  growth_weight: 0.5,
  growth_floor: -50,
  growth_cap: 100,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1095,
  unknown_age_days: 365,
  breadth_per_chain: 0.02,
  breadth_max_chains: 5,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-4';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** Assumed gas per transaction, in dollars (estimates, November 2026 — stated in the dashboard, not snapshot facts). */
export const GAS_USD: { ethereum: number; solana: number; low_cost: number; other: number } = {
  ethereum: 2.5,
  solana: 0.02,
  low_cost: 0.1,
  other: 0.25,
};

/** Chains whose transactions are priced at the low-cost tier: layer-2s and cheap chains. */
export const LOW_COST_CHAINS = new Set([
  'Arbitrum', 'Optimism', 'Base', 'Linea', 'Scroll', 'zkSync Era', 'Blast', 'Mantle', 'Unichain',
  'Ink', 'Mode', 'Starknet', 'Polygon zkEVM', 'Manta', 'Fraxtal', 'Katana', 'Taiko', 'Zircuit',
  'Abstract', 'Soneium', 'World Chain', 'Op_Bnb', 'Arbitrum Nova', 'Metis', 'Kroma', 'Zora',
  'Mint', 'Lisk', 'Morph', 'Boba', 'Boba_Bnb', 'Boba_Avax', 'Plume', 'Plume Mainnet', 'MegaETH',
  'RISE', 'Fluent', 'Stable', 'Tempo', 'X Layer', 'Polygon', 'Celo', 'xDai', 'Lens', 'MetalL2',
  'ApeChain', 'Reya Network', 'Degen', 'Eclipse', 'Fuel', 'Zkfair', 'Silicon zkEVM', 'KiteAI',
]);

/** A farm step: the action, what it costs, and how long it takes. cost_usd is the net out-of-pocket dollars (gas plus fees); capital is never in it. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
  cost_usd: number;
  txs: number;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  off_watchlist_above_floor: boolean;
  farm_cost_usd: number;
  farm_capital_usd: number;
  farm_gas_usd: number;
  farm_fees_usd: number;
  model: {
    predicted_mcap_usd: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    breadth_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with the model factors the detail view shows. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  off_watchlist_above_floor: boolean;
  predicted_mcap_usd: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  breadth_multiplier: number;
  base_usd: number;
  farm_cost_usd: number;
  farm_capital_usd: number;
  farm_gas_usd: number;
  farm_fees_usd: number;
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
  mcap_tvl: number | null;
}

/** One category's comparables row, for the dashboard's multiples table (descriptive: the curve, not the category, prices the board). */
export interface CompsRow {
  category: string;
  comps_n: number;
  raw_median: number | null;
}

/** One farm by value for money: the cheapest net farm cost per $1M of implied value. */
export interface FarmValueRow {
  rank: number;
  slug: string;
  name: string;
  implied_value_usd: number;
  farm_cost_usd: number;
  farm_capital_usd: number;
  cost_per_1m_usd: number;
}

/** One category's share of the board: how many rows it holds and what they are worth together. */
export interface CategorySummaryRow {
  category: string;
  rows: number;
  total_implied_usd: number;
  top_name: string;
  top_implied_usd: number;
}

/** A protocol the board deliberately does not rank, with the reason why. */
export interface ExcludedRow {
  slug: string;
  name: string;
  category: string | null;
  tvl_usd: number;
  reason: string;
}

/** One comparables point for the size-curve scatter: a traded token the curve is fitted on, or set aside. */
export interface CurvePoint {
  slug: string;
  name: string;
  tvl_usd: number;
  mcap_usd: number;
  kept: boolean;
}

/** The fitted size curve and the backtest, as the dashboard shows them. */
export interface CurveData {
  intercept: number;
  slope: number;
  r_squared: number;
  clean_n: number;
  kept_n: number;
  set_aside_n: number;
  median_ratio: number;
  band_lo: number;
  band_hi: number;
  points: CurvePoint[];
  set_aside: { slug: string; name: string; ratio: number }[];
}

/** One backtest's numbers: the median factor by which a held-out prediction misses, and the shares within 2x and 3x. */
export interface BacktestNumbers {
  n: number;
  median_factor: number;
  within_2x: number;
  within_3x: number;
}

/** The backtest, as the dashboard shows it. */
export interface BacktestData {
  loo: BacktestNumbers;
  cv5: BacktestNumbers;
  oos_split: BacktestNumbers;
  loo_all_clean: BacktestNumbers;
  cv5_all_clean: BacktestNumbers;
  radar2_loo: BacktestNumbers;
}

/** Everything the dashboard needs: the board, the live set, the curve, the backtest and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  above_floor_off_watchlist: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
  comps: CompsRow[];
  farm_value: FarmValueRow[];
  by_category: CategorySummaryRow[];
  excluded: ExcludedRow[];
  watchlist: string[];
  curve: CurveData;
  backtest: BacktestData;
  gas_usd: { ethereum: number; solana: number; low_cost: number; other: number };
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The median of an array (it is sorted in place by a copy). */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return NaN;
  const mid = Math.floor(n / 2);
  return n % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
/** The house's excluded categories for a wrapped, staked or bridged product. */
const EXCLUDED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);
/** Categories whose token is not a protocol-launch comparable: a chain's own token, or bridged assets counted as TVL. */
const COMP_EXCLUDED_CATEGORIES = new Set([...EXCLUDED_CATEGORIES, 'Chain', 'Cross Chain Bridge']);
/** Exchange names a launch candidate never begins with. */
const EXCHANGE_PREFIXES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];
/** Whole words that mark a wrapped or staked product. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Whether a protocol is one the board may rank: pre-token and passing the house's exclusion rule
 * in full. This is the rule the watchlist itself was built with, applied to the protocols below
 * the floor as well — and to the twenty above the floor the watchlist leaves out, which the
 * board ranks on the visible record and flags.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return false;
  if (VERSIONED.test(p.name)) return false;
  if (WRAPPED_WORD.test(p.name)) return false;
  if (EXCHANGE_PREFIXES.some((x) => p.name.startsWith(x))) return false;
  return true;
}

/** Why a pre-token protocol is not rankable, for the "Left off the board" table. */
export function exclusionReason(p: SnapshotProtocol): string {
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return `Category ${p.category}: a wrapped, staked, bridged or exchange product, not a launch of its own.`;
  if (VERSIONED.test(p.name)) return 'Name ends in a version marker: a pool or deployment of another protocol.';
  if (WRAPPED_WORD.test(p.name)) return 'Name carries wrapped, staked or staking: a wrapped or staked product of a token that trades.';
  if (EXCHANGE_PREFIXES.some((x) => p.name.startsWith(x))) return 'Named after an exchange: an exchange product, not a launch of its own.';
  return 'Fails the exclusion rule.';
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;
const round6 = (n: number): number => Math.round(n * 1e6) / 1e6;
const round2 = (n: number): number => Math.round(n * 100) / 100;

/* ---- the size curve: comparables, the band, the fit, the backtest ---- */

/** The traded tokens the curve may learn from: live-token protocols with a positive market cap and TVL, a category, and no excluded shape. */
export function cleanComps(snapshot: Snapshot): SnapshotProtocol[] {
  return snapshot.protocols.filter(
    (p) =>
      !isPreToken(p) &&
      p.mcap_usd !== null &&
      p.mcap_usd > 0 &&
      p.tvl_usd > 0 &&
      p.category !== null &&
      !COMP_EXCLUDED_CATEGORIES.has(p.category) &&
      !VERSIONED.test(p.name) &&
      !WRAPPED_WORD.test(p.name) &&
      !EXCHANGE_PREFIXES.some((x) => p.name.startsWith(x)),
  );
}

/** Least squares on log10(mcap) against log10(TVL): intercept, slope and R squared. */
function olsLogLog(protocols: SnapshotProtocol[]): { intercept: number; slope: number; rSquared: number } {
  const xs = protocols.map((p) => Math.log10(p.tvl_usd));
  const ys = protocols.map((p) => Math.log10(p.mcap_usd!));
  const n = xs.length;
  const meanX = xs.reduce((s, v) => s + v, 0) / n;
  const meanY = ys.reduce((s, v) => s + v, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i]! - meanX) * (ys[i]! - meanY);
    sxx += (xs[i]! - meanX) ** 2;
  }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  const intercept = meanY - slope * meanX;
  let ssTot = 0;
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    const fitted = intercept + slope * xs[i]!;
    ssTot += (ys[i]! - meanY) ** 2;
    ssRes += (ys[i]! - fitted) ** 2;
  }
  return { intercept, slope, rSquared: ssTot === 0 ? 0 : 1 - ssRes / ssTot };
}

/** The fitted curve: the band from the comps' own median ratio, the kept comps, and the log-log fit on them. */
export interface FittedCurve {
  intercept: number;
  slope: number;
  rSquared: number;
  medianRatio: number;
  bandLo: number;
  bandHi: number;
  kept: SnapshotProtocol[];
  setAside: SnapshotProtocol[];
}

export function fitCurve(comps: SnapshotProtocol[], model: ModelConstants = MODEL): FittedCurve {
  const ratios = comps.map((p) => p.mcap_usd! / p.tvl_usd);
  const medianRatio = median(ratios);
  const decade = 10 ** model.band_decades;
  const bandLo = medianRatio / decade;
  const bandHi = medianRatio * decade;
  const kept = comps.filter((p) => {
    const r = p.mcap_usd! / p.tvl_usd;
    return r >= bandLo && r <= bandHi;
  });
  const setAside = comps.filter((p) => !kept.includes(p));
  const fit = olsLogLog(kept);
  return { ...fit, medianRatio, bandLo, bandHi, kept, setAside };
}

/** The curve's prediction for a TVL, in log10 dollars. */
function predictLog(fit: FittedCurve, tvlUsd: number): number {
  return fit.intercept + fit.slope * Math.log10(tvlUsd);
}

/** A deterministic 0..1 hash of a slug (FNV-1a): the cross-validation folds and the split, reproducible on every run. */
function hash01(slug: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return (h % 1000) / 1000;
}

/** One backtest's numbers from a list of log10 errors: median factor, and the shares within 2x and 3x. */
function backtestNumbers(errors: number[]): BacktestNumbers {
  const factors = errors.map((e) => 10 ** Math.abs(e)).sort((a, b) => a - b);
  return {
    n: factors.length,
    median_factor: round2(median(factors)),
    within_2x: round4(factors.filter((f) => f <= 2).length / factors.length),
    within_3x: round4(factors.filter((f) => f <= 3).length / factors.length),
  };
}

/**
 * The backtest, all refits from scratch: leave-one-out and 5-fold cross-validation on the kept
 * comps, a single 70/30 split, and the same two tests on all clean comps with the outliers left
 * in. Radar-2's rule is tested the same leave-one-out way on the same kept comps, so the
 * comparison is apples to apples.
 */
export function backtest(snapshot: Snapshot, model: ModelConstants = MODEL): BacktestData {
  const clean = cleanComps(snapshot);
  const full = fitCurve(clean, model);
  const kept = full.kept;

  const looKept: number[] = [];
  const cvKept: number[] = [];
  for (const p of kept) {
    const rest = kept.filter((q) => q.slug !== p.slug);
    const fit = fitCurve(rest, model);
    looKept.push(predictLog(fit, p.tvl_usd) - Math.log10(p.mcap_usd!));
    const fold = Math.floor(hash01(p.slug) * 5);
    const train = kept.filter((q) => Math.floor(hash01(q.slug) * 5) !== fold && q.slug !== p.slug);
    const fitFold = fitCurve(train, model);
    cvKept.push(predictLog(fitFold, p.tvl_usd) - Math.log10(p.mcap_usd!));
  }
  const trainSplit = kept.filter((p) => hash01(p.slug) >= 0.3);
  const testSplit = kept.filter((p) => hash01(p.slug) < 0.3);
  const fitSplit = fitCurve(trainSplit, model);
  const oosSplit = testSplit.map((p) => predictLog(fitSplit, p.tvl_usd) - Math.log10(p.mcap_usd!));

  const looAll: number[] = [];
  const cvAll: number[] = [];
  for (const p of clean) {
    const rest = clean.filter((q) => q.slug !== p.slug);
    const fit = fitCurve(rest, model);
    looAll.push(predictLog(fit, p.tvl_usd) - Math.log10(p.mcap_usd!));
    const fold = Math.floor(hash01(p.slug) * 5);
    const train = clean.filter((q) => Math.floor(hash01(q.slug) * 5) !== fold && q.slug !== p.slug);
    const fitFold = fitCurve(train, model);
    cvAll.push(predictLog(fitFold, p.tvl_usd) - Math.log10(p.mcap_usd!));
  }

  // Radar-2's rule, leave-one-out on the same kept comps: each category's median multiple of
  // the OTHER comps, shrunk toward the global median of the others with k = 4.
  const radar2Errors: number[] = [];
  for (const p of kept) {
    const rest = kept.filter((q) => q.slug !== p.slug);
    const allRatios = rest.map((q) => q.mcap_usd! / q.tvl_usd).sort((a, b) => a - b);
    const globalMedian = median(allRatios);
    const catRatios = rest.filter((q) => q.category === p.category).map((q) => q.mcap_usd! / q.tvl_usd).sort((a, b) => a - b);
    let multiple: number;
    if (catRatios.length === 0) {
      multiple = globalMedian;
    } else {
      const raw = median(catRatios);
      const rawW = Math.min(1.0, Math.max(0.02, raw));
      multiple = Math.min(1.5, Math.max(0.05, (catRatios.length * rawW + 4 * globalMedian) / (catRatios.length + 4)));
    }
    radar2Errors.push(Math.log10(p.tvl_usd * multiple) - Math.log10(p.mcap_usd!));
  }

  return {
    loo: backtestNumbers(looKept),
    cv5: backtestNumbers(cvKept),
    oos_split: backtestNumbers(oosSplit),
    loo_all_clean: backtestNumbers(looAll),
    cv5_all_clean: backtestNumbers(cvAll),
    radar2_loo: backtestNumbers(radar2Errors),
  };
}

/** The curve's data for the dashboard: the fit, the band, and every clean comp as a scatter point. */
export function curveData(snapshot: Snapshot, model: ModelConstants = MODEL): CurveData {
  const clean = cleanComps(snapshot);
  const fit = fitCurve(clean, model);
  const keptSlugs = new Set(fit.kept.map((p) => p.slug));
  const points: CurvePoint[] = clean
    .map((p) => ({ slug: p.slug, name: p.name, tvl_usd: p.tvl_usd, mcap_usd: p.mcap_usd!, kept: keptSlugs.has(p.slug) }))
    .sort((a, b) => a.tvl_usd - b.tvl_usd);
  return {
    intercept: round4(fit.intercept),
    slope: round4(fit.slope),
    r_squared: round4(fit.rSquared),
    clean_n: clean.length,
    kept_n: fit.kept.length,
    set_aside_n: fit.setAside.length,
    median_ratio: round4(fit.medianRatio),
    band_lo: round4(fit.bandLo),
    band_hi: round4(fit.bandHi),
    points,
    set_aside: fit.setAside
      .map((p) => ({ slug: p.slug, name: p.name, ratio: round4(p.mcap_usd! / p.tvl_usd) }))
      .sort((a, b) => b.ratio - a.ratio),
  };
}

/** The comparables table, descriptive: for each category, the kept comps' median mcap/TVL. The curve, not the category, prices the board. */
export function compsTable(snapshot: Snapshot, model: ModelConstants = MODEL): CompsRow[] {
  const fit = fitCurve(cleanComps(snapshot), model);
  const byCategory = new Map<string, number[]>();
  for (const p of fit.kept) {
    const list = byCategory.get(p.category!) ?? [];
    list.push(p.mcap_usd! / p.tvl_usd);
    byCategory.set(p.category!, list);
  }
  return [...byCategory.entries()]
    .map(([category, ratios]) => ({ category, comps_n: ratios.length, raw_median: round4(median(ratios)) }))
    .sort((a, b) => (a.category < b.category ? -1 : a.category > b.category ? 1 : 0));
}

/** The ten farms that buy the most implied value per dollar of net farm cost: the cheapest
 * net cost per $1M of implied value, cheapest first. A farm's net cost is gas plus fees; the
 * capital is deployed, not spent, so it is shown beside the cost, never inside it. */
export function farmValueTable(board: BoardRow[]): FarmValueRow[] {
  return [...board]
    .map((r) => ({
      slug: r.slug,
      name: r.name,
      implied_value_usd: r.implied_value_usd,
      farm_cost_usd: r.farm_cost_usd,
      farm_capital_usd: r.farm_capital_usd,
      cost_per_1m_usd: (r.farm_cost_usd / r.implied_value_usd) * 1_000_000,
    }))
    .sort((a, b) => a.cost_per_1m_usd - b.cost_per_1m_usd || b.implied_value_usd - a.implied_value_usd)
    .slice(0, 10)
    .map((r, i) => ({ rank: i + 1, ...r, cost_per_1m_usd: round4(r.cost_per_1m_usd) }));
}

/** The board by category: how many rows each category holds, what they are worth together, and
 * the category's strongest protocol. The board's breadth, in one table. */
export function categorySummary(board: BoardRow[]): CategorySummaryRow[] {
  const byCategory = new Map<string, BoardRow[]>();
  for (const r of board) {
    const key = r.category ?? 'Uncategorised';
    const list = byCategory.get(key) ?? [];
    list.push(r);
    byCategory.set(key, list);
  }
  return [...byCategory.entries()]
    .map(([category, rows]) => ({
      category,
      rows: rows.length,
      total_implied_usd: rows.reduce((s, r) => s + r.implied_value_usd, 0),
      top_name: rows[0]!.name,
      top_implied_usd: rows[0]!.implied_value_usd,
    }))
    .sort((a, b) => b.total_implied_usd - a.total_implied_usd);
}

/* ---- implied value, the board, and the costed farm plans ---- */

/** The multipliers and the implied value one protocol gets under the curve. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  fit: FittedCurve,
  model: ModelConstants,
): { implied: number; base: number; growthPct: number; growthMult: number; maturityMult: number; breadthMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = round6(1 + (growthPct / 100) * model.growth_weight);
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = round6(model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range);
  const breadthMult = round6(1 + model.breadth_per_chain * Math.min(Math.max(protocol.chains.length - 1, 0), model.breadth_max_chains));
  const base = Math.max(1, Math.round(10 ** predictLog(fit, protocol.tvl_usd)));
  // Factors are rounded to 6 decimals and the value is built by chained rounding
  // (base -> growth -> maturity -> breadth), so the dashboard's step-by-step arithmetic
  // reproduces the stored implied value to the dollar from the displayed factors.
  const step2 = Math.round(base * growthMult);
  const step3 = Math.round(step2 * maturityMult);
  const implied = Math.max(1, Math.round(step3 * breadthMult));
  return { implied, base, growthPct, growthMult, maturityMult, breadthMult, age };
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; excluded: ExcludedRow[]; curve: FittedCurve } {
  const fit = fitCurve(cleanComps(snapshot), model);
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries (it cannot, but
  // the board's coverage is the gate's row and is never gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every rankable pre-token protocol the watchlist leaves out, below the floor
  // and above it alike. Never a replacement for a watchlist row: a chosen protocol stays chosen.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }
  // Pre-token protocols the exclusion rule keeps off the board, named with the reason each fails.
  const excluded: ExcludedRow[] = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isPreToken(p))
    .sort((a, b) => b.tvl_usd - a.tvl_usd)
    .map((p) => ({ slug: p.slug, name: p.name, category: p.category, tvl_usd: p.tvl_usd, reason: exclusionReason(p) }));

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, fit, model);
    const plan = farmPlan(p, v.age);
    return { p, ...v, plan };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  const board: BoardRow[] = scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    off_watchlist_above_floor: !snapshot.watchlist.includes(s.p.slug) && s.p.tvl_usd >= snapshot.floor_usd,
    farm_cost_usd: s.plan.total_cost_usd,
    farm_capital_usd: s.plan.capital_usd,
    farm_gas_usd: s.plan.gas_usd,
    farm_fees_usd: s.plan.fees_usd,
    model: {
      predicted_mcap_usd: s.base,
      growth_pct: s.growthPct,
      growth_multiplier: round6(s.growthMult),
      maturity_multiplier: round6(s.maturityMult),
      breadth_multiplier: round6(s.breadthMult),
      age_days: s.age,
    },
    farm_steps: s.plan.steps.map(stepText),
  }));
  return { board, excluded, curve: fit };
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** Dollars with two decimals, for a cost string. */
function dollars(n: number): string {
  return `$${n.toFixed(2)}`;
}

/** The assumed gas for one transaction on a protocol's first chain. */
export function gasPerTx(p: SnapshotProtocol): number {
  const chain = p.chains.length > 0 ? p.chains[0]! : '';
  if (chain === 'Ethereum') return GAS_USD.ethereum;
  if (chain === 'Solana') return GAS_USD.solana;
  if (LOW_COST_CHAINS.has(chain)) return GAS_USD.low_cost;
  return GAS_USD.other;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's core action and its weekly action, in the words a farmer can follow. */
function actionsFor(p: SnapshotProtocol, capital: number, chain: string): { core: string; weekly: string; coreTxs: number; coreFee: number; weeklyTxs: number; weeklyFee: number } {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  const bridge = { coreTxs: 1, coreFee: 1.0, weeklyTxs: 1, weeklyFee: 1.0 };
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral') || c.includes('uncollateral')) {
    return {
      core: `Supply $${capital} of USDC to ${name} on ${chain} and borrow $10 against it, so the wallet shows both sides of the market.`,
      weekly: `Repay and re-borrow $10, or top the supply up by $10, to leave a fresh on-chain action each week.`,
      coreTxs: 2, coreFee: 0, weeklyTxs: 1, weeklyFee: 0,
    };
  }
  if (c.includes('dex') || c.includes('liquidity manager') || c.includes('leveraged farm')) {
    return {
      core: `Provide $${capital} of liquidity to ${name}'s deepest pool on ${chain} and keep the position open.`,
      weekly: `Swap $10 through the pool once a week, alternating the direction, so the wallet trades as well as holds.`,
      coreTxs: 2, coreFee: 0, weeklyTxs: 1, weeklyFee: 0,
    };
  }
  if (c.includes('yield') || c.includes('farm') || c.includes('allocator') || c.includes('curator')) {
    return {
      core: `Deposit $${capital} of USDC into a ${name} vault on ${chain} and keep the shares.`,
      weekly: `Claim any vault rewards that accrue and re-deposit them, so the wallet compounds instead of sitting still.`,
      coreTxs: 2, coreFee: 0, weeklyTxs: 1, weeklyFee: 0,
    };
  }
  if (c.includes('rwa') || c.includes('stable') || c.includes('anchor') || c.includes('decentralized btc')) {
    return {
      core: `Mint or buy $${capital} of the yield-bearing asset ${name} issues on ${chain} and hold it in the farming wallet.`,
      weekly: `Check the asset's yield page and add $10 of the asset when a new tranche opens.`,
      coreTxs: 2, coreFee: 0, weeklyTxs: 1, weeklyFee: 0,
    };
  }
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options') || c.includes('basis')) {
    return {
      core: `Deposit $${capital} of USDC as margin on ${name} and open one small hedged position, then close it the same week.`,
      weekly: `Open and close one small position a week, keeping the margin deposited between trades.`,
      coreTxs: 2, coreFee: 0, weeklyTxs: 1, weeklyFee: 0,
    };
  }
  if (c.includes('restak') || c.includes('staking pool')) {
    return {
      core: `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt token in the farming wallet.`,
      weekly: `Restake any staking rewards that accrue, so the staked balance grows every week.`,
      coreTxs: 2, coreFee: 0, weeklyTxs: 1, weeklyFee: 0,
    };
  }
  if (c.includes('bridge') || c.includes('cross chain')) {
    return {
      core: `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app the same day.`,
      weekly: `Bridge $10 back and forth once a week, so the wallet shows repeat bridge volume.`,
      ...bridge,
    };
  }
  if (c.includes('prediction')) {
    return {
      core: `Fund the wallet with $${capital} and place one small market position on ${name}, on an outcome you have read.`,
      weekly: `Place one small position a week on a new market, and let settled ones close on their own.`,
      coreTxs: 2, coreFee: 0, weeklyTxs: 1, weeklyFee: 0,
    };
  }
  if (c.includes('insurance')) {
    return {
      core: `Buy $${capital} of cover from ${name} on ${chain} and keep the policy for its full term.`,
      weekly: `Check the policy's status once a week and file nothing unless a covered event happens.`,
      coreTxs: 1, coreFee: 0, weeklyTxs: 0, weeklyFee: 0,
    };
  }
  if (c.includes('payment') || c.includes('card')) {
    return {
      core: `Route $${capital} of real volume through ${name} on ${chain}, paying for something you already buy.`,
      weekly: `Pay one ordinary bill or purchase through ${name} each week, so the volume is steady.`,
      coreTxs: 1, coreFee: 0, weeklyTxs: 1, weeklyFee: 0,
    };
  }
  if (c.includes('chain')) {
    return {
      core: `Bridge $${capital} to ${name} and use it in two of its own apps, holding a small balance on the chain.`,
      weekly: `Make one transaction a week inside ${name}'s own apps, alternating between them.`,
      ...bridge,
    };
  }
  if (c.includes('index') || c.includes('locker') || c.includes('governance')) {
    return {
      core: `Buy $${capital} of the ${name} index or governance position on ${chain} and vote once a proposal opens.`,
      weekly: `Vote on every proposal that opens, and add $10 to the position once a month.`,
      coreTxs: 2, coreFee: 0, weeklyTxs: 1, weeklyFee: 0,
    };
  }
  return {
    core: `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`,
    weekly: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`,
    coreTxs: 2, coreFee: 0, weeklyTxs: 1, weeklyFee: 0,
  };
}

/**
 * A protocol's farm plan, costed to the dollar: six steps, each with its gas (transactions at
 * the assumed per-transaction price for the protocol's chain) and any fee the action charges,
 * plus the plan's totals. The net cost is gas plus fees; the capital is deployed, not spent,
 * and is returned when the position is unwound.
 */
export function farmPlan(
  p: SnapshotProtocol,
  age: number | null,
): { steps: FarmStep[]; total_cost_usd: number; capital_usd: number; gas_usd: number; fees_usd: number } {
  const chain = chainOf(p);
  const gas = gasPerTx(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const weeks = Math.max(1, Math.ceil(hold / 7));
  const { core, weekly, coreTxs, coreFee, weeklyTxs, weeklyFee } = actionsFor(p, capital, chain);
  const coreGas = round2(coreTxs * gas);
  const weeklyGas = round2(weeks * weeklyTxs * gas);
  const weeklyFees = round2(weeks * weeklyFee);
  const steps: FarmStep[] = [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: `${dollars(gas)} of gas to fund the wallet`,
      time: '5 minutes',
      cost_usd: round2(gas),
      txs: 1,
    },
    {
      text: core,
      cost: `${dollars(capital)} of capital and ${dollars(coreGas + coreFee)} of gas${coreFee > 0 ? ` and fees (${dollars(coreFee)} bridge fee)` : ''}`,
      time: '15 minutes to set up',
      cost_usd: round2(coreGas + coreFee),
      txs: coreTxs,
    },
    {
      text: weekly,
      cost: `${dollars(weeklyGas + weeklyFees)} of gas${weeklyFees > 0 ? ` and fees over ${weeks} weeks` : ` over ${weeks} weeks`}`,
      time: '10 minutes a week',
      cost_usd: round2(weeklyGas + weeklyFees),
      txs: weeks * weeklyTxs,
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
      cost_usd: 0,
      txs: 0,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
      cost: `${dollars(gas)} of gas to claim`,
      time: '10 minutes',
      cost_usd: round2(gas),
      txs: 1,
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
      cost_usd: 0,
      txs: 0,
    },
  ];
  const gasTotal = round2(steps.reduce((s, st) => s + st.txs * gas, 0));
  const feesTotal = round2(coreFee + weeklyFees);
  const total = round2(steps.reduce((s, st) => s + st.cost_usd, 0));
  return { steps, total_cost_usd: total, capital_usd: capital, gas_usd: gasTotal, fees_usd: feesTotal };
}

/* ---- the live set, the radar assembly, and the snapshot ---- */

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
      mcap_tvl: p.mcap_usd !== null && p.tvl_usd > 0 ? round4(p.mcap_usd / p.tvl_usd) : null,
    }));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    off_watchlist_above_floor: row.off_watchlist_above_floor,
    predicted_mcap_usd: row.model.predicted_mcap_usd,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    breadth_multiplier: row.model.breadth_multiplier,
    base_usd: row.model.predicted_mcap_usd,
    farm_cost_usd: row.farm_cost_usd,
    farm_capital_usd: row.farm_capital_usd,
    farm_gas_usd: row.farm_gas_usd,
    farm_fees_usd: row.farm_fees_usd,
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const { board, excluded } = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const aboveFloor = board.filter((r) => r.off_watchlist_above_floor).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    above_floor_off_watchlist: aboveFloor,
    live_size: live.length,
    rows: board.map(radarRow),
    live,
    comps: compsTable(snapshot, model),
    farm_value: farmValueTable(board),
    by_category: categorySummary(board),
    excluded,
    watchlist: snapshot.watchlist,
    curve: curveData(snapshot, model),
    backtest: backtest(snapshot, model),
    gas_usd: { ...GAS_USD },
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
    if (!Number.isFinite(r.farm_cost_usd) || r.farm_cost_usd < 0) return `${r.slug} has farm cost ${r.farm_cost_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
