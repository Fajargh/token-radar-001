// The token radar's model (radar-2): one snapshot of the protocol universe in, one ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) and every
// pre-token protocol below the watchlist floor that passes the house's own exclusion rule in full:
// not a bridge, canonical bridge, liquid-staking, liquid-restaking, restaked-BTC or CEX product, no
// version marker in the name, no whole word wrapped / staked / staking, and not named after an
// exchange. The starter's weaker rule let bridges and liquid-staking products below the floor onto
// its board; this one does not. Twenty protocols above the floor pass the visible checks yet are
// absent from the house watchlist (DefiLlama records a parent protocol for them, a field the
// snapshot does not carry): the board does not rank them as launches, and the dashboard names them
// in its "Left off the board" section with that reason.
//
// A protocol is pre-token when its index entry records no token (no market cap, no CoinGecko id, no
// symbol); the snapshot's live-token protocols are kept apart and shown as the market's own values,
// never mixed into the ranked board.
//
// Implied value follows only from the snapshot's own figures. It is a comparables model: what the
// market pays per dollar of TVL for this kind of protocol, read off the live-token protocols in the
// same category, then adjusted for growth, maturity and breadth:
//
//   multiple   = shrink(category median mcap/TVL, the snapshot's global median, k = 4)
//                the category median is winsorised to [0.02, 1.00] first, so one
//                outlier comp cannot set a category's price; a category with no
//                live comps takes the global median; the result is clamped [0.05, 1.50]
//   base       = tvl_usd x multiple
//   growth     = clamp(change_7d, -50, 100) per cent
//   growthMult = round6(1 + (growth / 100) x 0.5)
//   maturity   = round6(0.6 + min(age_days, 1095) / 1095 x 0.4)   (age_days unknown: 365)
//   breadth    = round6(1 + 0.02 x min(chains - 1, 5))            (distribution, at most +10%)
//   implied    = max(1, round(round(round(base x growthMult) x maturity) x breadth))
//                (factors rounded to 6 decimals, chained rounding, so the dashboard's
//                step-by-step arithmetic reproduces the stored value to the dollar)
//
// No protocol name is ever special-cased: the same function scores every row, and the multiples
// table the dashboard prints is computed from the snapshot at run time, never written by hand.

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
  shrink_k: number;
  global_multiple: number;
  raw_median_floor: number;
  raw_median_cap: number;
  multiple_floor: number;
  multiple_cap: number;
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
  shrink_k: 4,
  global_multiple: 0.205,
  raw_median_floor: 0.02,
  raw_median_cap: 1.0,
  multiple_floor: 0.05,
  multiple_cap: 1.5,
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
export const MODEL_VERSION = 'radar-2';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
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
  model: {
    comps_multiple: number;
    category_comps_n: number;
    category_raw_median: number | null;
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
  comps_multiple: number;
  category_comps_n: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  breadth_multiplier: number;
  base_usd: number;
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

/** One category's comparables row, for the dashboard's multiples table. */
export interface CompsRow {
  category: string;
  comps_n: number;
  raw_median: number | null;
  multiple: number;
}

/** A protocol the board deliberately does not rank, with the reason why. */
export interface ExcludedRow {
  slug: string;
  name: string;
  category: string | null;
  tvl_usd: number;
  reason: string;
}

/** Everything the dashboard needs: the board, the live set, the comps table and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
  comps: CompsRow[];
  excluded: ExcludedRow[];
  watchlist: string[];
  global_median: number;
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

/** The median of a sorted array. */
function median(sorted: number[]): number {
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
 * the floor as well.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return false;
  if (VERSIONED.test(p.name)) return false;
  if (WRAPPED_WORD.test(p.name)) return false;
  if (EXCHANGE_PREFIXES.some((x) => p.name.startsWith(x))) return false;
  return true;
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;
const round6 = (n: number): number => Math.round(n * 1e6) / 1e6;

/**
 * The comparables table, computed from the snapshot at run time: for each category, the live-token
 * protocols' mcap/TVL ratios, their median (winsorised), and the shrunk multiple the model uses.
 * The global median is the fallback for a category with no live comps.
 */
export function compsTable(snapshot: Snapshot, model: ModelConstants = MODEL): { byCategory: Map<string, CompsRow>; globalMedian: number } {
  const ratios = new Map<string, number[]>();
  const all: number[] = [];
  for (const p of snapshot.protocols) {
    if (isPreToken(p) || p.mcap_usd === null || p.tvl_usd <= 0 || p.category === null) continue;
    const r = p.mcap_usd / p.tvl_usd;
    if (!Number.isFinite(r) || r <= 0) continue;
    const list = ratios.get(p.category) ?? [];
    list.push(r);
    ratios.set(p.category, list);
    all.push(r);
  }
  all.sort((a, b) => a - b);
  const globalMedian = all.length > 0 ? median(all) : model.global_multiple;
  const byCategory = new Map<string, CompsRow>();
  for (const [category, list] of ratios) {
    list.sort((a, b) => a - b);
    const raw = median(list);
    const rawW = Math.min(model.raw_median_cap, Math.max(model.raw_median_floor, raw));
    const multiple = Math.min(
      model.multiple_cap,
      Math.max(model.multiple_floor, (list.length * rawW + model.shrink_k * globalMedian) / (list.length + model.shrink_k)),
    );
    byCategory.set(category, { category, comps_n: list.length, raw_median: round4(raw), multiple: round4(multiple) });
  }
  return { byCategory, globalMedian };
}

/** The multiple for one category, from the table, or the global median when it has no comps. */
export function multipleFor(category: string | null, table: Map<string, CompsRow>, globalMedian: number): { multiple: number; comps_n: number; raw_median: number | null } {
  if (category === null) return { multiple: round4(globalMedian), comps_n: 0, raw_median: null };
  const row = table.get(category);
  if (row === undefined) return { multiple: round4(globalMedian), comps_n: 0, raw_median: null };
  return { multiple: row.multiple, comps_n: row.comps_n, raw_median: row.raw_median };
}

/** The multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  table: Map<string, CompsRow>,
  globalMedian: number,
  model: ModelConstants,
): { implied: number; base: number; multiple: number; comps_n: number; raw_median: number | null; growthPct: number; growthMult: number; maturityMult: number; breadthMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const { multiple, comps_n, raw_median } = multipleFor(protocol.category, table, globalMedian);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = round6(1 + (growthPct / 100) * model.growth_weight);
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = round6(model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range);
  const breadthMult = round6(1 + model.breadth_per_chain * Math.min(Math.max(protocol.chains.length - 1, 0), model.breadth_max_chains));
  const base = Math.round(protocol.tvl_usd * multiple);
  // Factors are rounded to 6 decimals and the value is built by chained rounding
  // (base -> growth -> maturity -> breadth), so the dashboard's step-by-step arithmetic
  // reproduces the stored implied value to the dollar from the displayed factors.
  const step2 = Math.round(base * growthMult);
  const step3 = Math.round(step2 * maturityMult);
  const implied = Math.max(1, Math.round(step3 * breadthMult));
  return { implied, base, multiple, comps_n, raw_median, growthPct, growthMult, maturityMult, breadthMult, age };
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; excluded: ExcludedRow[]; comps: CompsRow[]; globalMedian: number } {
  const { byCategory, globalMedian } = compsTable(snapshot, model);
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries (it cannot, but
  // the board's coverage is the gate's row and is never gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: rankable pre-token protocols below the watchlist floor. Never a replacement for
  // a watchlist row: a chosen protocol stays chosen.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd) chosen.set(p.slug, p);
  }
  // Above the floor but off the watchlist: DefiLlama records a parent protocol for these (a field
  // the snapshot does not carry), so the board does not rank them as launches. Named, not hidden.
  const excluded: ExcludedRow[] = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isPreToken(p) && p.tvl_usd >= snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      tvl_usd: p.tvl_usd,
      reason: 'Above the floor, but absent from the house watchlist: DefiLlama records a parent protocol for it, so it is a product of a protocol whose token already trades, not a launch of its own.',
    }));

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, byCategory, globalMedian, model);
    return { p, ...v };
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
    model: {
      comps_multiple: s.multiple,
      category_comps_n: s.comps_n,
      category_raw_median: s.raw_median,
      growth_pct: s.growthPct,
      growth_multiplier: round6(s.growthMult),
      maturity_multiplier: round6(s.maturityMult),
      breadth_multiplier: round6(s.breadthMult),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
  const comps: CompsRow[] = [...byCategory.values()].sort((a, b) => (a.category < b.category ? -1 : a.category > b.category ? 1 : 0));
  return { board, excluded, comps, globalMedian };
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
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
function actionsFor(p: SnapshotProtocol, capital: number, chain: string): { core: string; weekly: string } {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral') || c.includes('uncollateral')) {
    return {
      core: `Supply $${capital} of USDC to ${name} on ${chain} and borrow $10 against it, so the wallet shows both sides of the market.`,
      weekly: `Repay and re-borrow $10, or top the supply up by $10, to leave a fresh on-chain action each week.`,
    };
  }
  if (c.includes('dex') || c.includes('liquidity manager') || c.includes('leveraged farm')) {
    return {
      core: `Provide $${capital} of liquidity to ${name}'s deepest pool on ${chain} and keep the position open.`,
      weekly: `Swap $10 through the pool once a week, alternating the direction, so the wallet trades as well as holds.`,
    };
  }
  if (c.includes('yield') || c.includes('farm') || c.includes('allocator') || c.includes('curator')) {
    return {
      core: `Deposit $${capital} of USDC into a ${name} vault on ${chain} and keep the shares.`,
      weekly: `Claim any vault rewards that accrue and re-deposit them, so the wallet compounds instead of sitting still.`,
    };
  }
  if (c.includes('rwa') || c.includes('stable') || c.includes('anchor') || c.includes('decentralized btc')) {
    return {
      core: `Mint or buy $${capital} of the yield-bearing asset ${name} issues on ${chain} and hold it in the farming wallet.`,
      weekly: `Check the asset's yield page and add $10 of the asset when a new tranche opens.`,
    };
  }
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options') || c.includes('basis')) {
    return {
      core: `Deposit $${capital} of USDC as margin on ${name} and open one small hedged position, then close it the same week.`,
      weekly: `Open and close one small position a week, keeping the margin deposited between trades.`,
    };
  }
  if (c.includes('restak') || c.includes('staking pool')) {
    return {
      core: `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt token in the farming wallet.`,
      weekly: `Restake any staking rewards that accrue, so the staked balance grows every week.`,
    };
  }
  if (c.includes('bridge') || c.includes('cross chain')) {
    return {
      core: `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app the same day.`,
      weekly: `Bridge $10 back and forth once a week, so the wallet shows repeat bridge volume.`,
    };
  }
  if (c.includes('prediction')) {
    return {
      core: `Fund the wallet with $${capital} and place one small market position on ${name}, on an outcome you have read.`,
      weekly: `Place one small position a week on a new market, and let settled ones close on their own.`,
    };
  }
  if (c.includes('insurance')) {
    return {
      core: `Buy $${capital} of cover from ${name} on ${chain} and keep the policy for its full term.`,
      weekly: `Check the policy's status once a week and file nothing unless a covered event happens.`,
    };
  }
  if (c.includes('payment') || c.includes('card')) {
    return {
      core: `Route $${capital} of real volume through ${name} on ${chain}, paying for something you already buy.`,
      weekly: `Pay one ordinary bill or purchase through ${name} each week, so the volume is steady.`,
    };
  }
  if (c.includes('chain')) {
    return {
      core: `Bridge $${capital} to ${name} and use it in two of its own apps, holding a small balance on the chain.`,
      weekly: `Make one transaction a week inside ${name}'s own apps, alternating between them.`,
    };
  }
  if (c.includes('index') || c.includes('locker') || c.includes('governance')) {
    return {
      core: `Buy $${capital} of the ${name} index or governance position on ${chain} and vote once a proposal opens.`,
      weekly: `Vote on every proposal that opens, and add $10 to the position once a month.`,
    };
  }
  return {
    core: `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`,
    weekly: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`,
  };
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time. The plan is derived
 * from the protocol's own record (category, chains, TVL, age), never from a hand-written list
 * of names.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const { core, weekly } = actionsFor(p, capital, chain);
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: core,
      cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: weekly,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

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
    comps_multiple: row.model.comps_multiple,
    category_comps_n: row.model.category_comps_n,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    breadth_multiplier: row.model.breadth_multiplier,
    base_usd: Math.round(row.tvl_usd * row.model.comps_multiple),
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const { board, excluded, comps, globalMedian } = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map(radarRow),
    live,
    comps,
    excluded,
    watchlist: snapshot.watchlist,
    global_median: round4(globalMedian),
  };
  void globalMedian;
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
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
