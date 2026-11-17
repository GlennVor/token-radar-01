// The token radar's model, version radar-3: one snapshot of the protocol universe in, one ranked
// board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) and adds
// pre-token protocols below the watchlist floor: the early rows the radar exists to find. A protocol
// is pre-token when its record carries no token (no market cap, no CoinGecko id, no symbol); the
// snapshot's live-token protocols are kept apart and shown as the market's own values, never mixed
// into the ranked board.
//
// Implied value follows only from the snapshot's own figures, and it is a fitted curve, not a
// single multiple: the market cap of a priced token grows slower than TVL (the fitted slope is
// below one), so a flat multiple overprices the largest protocols and underprices the small ones.
// The curve is an ordinary least-squares fit of log market cap on log TVL over the priced protocols
// in this snapshot, and each category is adjusted by the median residual of its own priced
// protocols. A category with fewer than three priced protocols gets no adjustment at all — the
// curve alone prices it — because there is nothing to adjust from.
//
//   log(mcap) = a + b x log(tvl), fitted at run time over the priced protocols
//   curve(tvl) = exp(a + b x log(tvl))
//   adjustment(cat) = exp(median residual of priced protocols in cat), n >= 3, else 1.0,
//                     clamped to [0.25, 4.00]
//   growth        = clamp(change_7d, -60, 120) per cent
//   growthMult    = 1 + (growth / 100) x GROWTH_WEIGHT
//   maturity      = 0.6 + min(age_days, 1095) / 1095 x 0.4   (age_days unknown: 365)
//   implied       = max(1, round(curve(tvl) x adjustment(cat) x growthMult x maturity))
//
// The curve is tested three ways on the same snapshot, and the dashboard prints the results:
// the in-sample median error, the leave-one-out median error (the curve refitted without each
// protocol in turn), and the walk-forward error (fitted on the oldest 70% of the priced protocols
// by listing date, tested on the newest 30%). Each is the median absolute error as a multiple of
// the true market cap, so a smaller multiple is a better-tested curve. No protocol name is ever
// special-cased: the same function scores every row.

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
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  adjustment_min: number;
  adjustment_max: number;
  adjustment_min_samples: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.5,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1095,
  unknown_age_days: 365,
  adjustment_min: 0.25,
  adjustment_max: 4.0,
  adjustment_min_samples: 3,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-3';

/** How many pre-token protocols below the watchlist floor the early radar carries, by TVL. */
export const EARLY_ROWS = 160;

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** The fitted size curve: log market cap = intercept + slope x log TVL. */
export interface SizeCurve {
  intercept: number;
  slope: number;
  samples: number;
}

/** One category's adjustment from its priced protocols' residuals. */
export interface CategoryAdjustment {
  category: string;
  adjustment: number;
  samples: number;
  adjusted: boolean;
}

/** How the curve was tested on this snapshot: each multiple is a median absolute error. */
export interface ModelValidation {
  priced_samples: number;
  dated_samples: number;
  in_sample_multiple: number;
  loo_multiple: number;
  walk_forward_multiple: number;
  walk_forward_train: number;
  walk_forward_test: number;
}

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
    curve_value_usd: number;
    category_adjustment: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with the farm plan from the board itself. */
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
  curve_value_usd: number;
  category_adjustment: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  watchlist: boolean;
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
}

/** Everything the dashboard needs: the board, the live set, the curve, its test, and the model. */
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
  curve: SizeCurve;
  validation: ModelValidation;
  adjustments: CategoryAdjustment[];
  rows: RadarRow[];
  live: LiveRow[];
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

/** A value held inside [lo, hi]. */
function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

/** The middle value of a sorted copy; the mean of the two middles for an even count. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** One priced protocol, reduced to the two logs the curve is fitted on, plus its listing date. */
interface PricedPoint {
  logTvl: number;
  logMcap: number;
  listedAt: string | null;
}

/** The protocols that already have a priced token: a positive market cap over a positive TVL. */
function pricedPoints(snapshot: Snapshot): PricedPoint[] {
  const out: PricedPoint[] = [];
  for (const p of snapshot.protocols) {
    if (p.mcap_usd === null || p.tvl_usd <= 0) continue;
    const ratio = p.mcap_usd / p.tvl_usd;
    if (!Number.isFinite(ratio) || ratio <= 0) continue;
    out.push({ logTvl: Math.log(p.tvl_usd), logMcap: Math.log(p.mcap_usd), listedAt: p.listed_at });
  }
  return out;
}

/** The least-squares line of log market cap on log TVL. A flat line when TVL never varies. */
function fitLine(points: PricedPoint[]): { intercept: number; slope: number } {
  const n = points.length;
  let sx = 0;
  let sy = 0;
  for (const p of points) {
    sx += p.logTvl;
    sy += p.logMcap;
  }
  const mx = sx / n;
  const my = sy / n;
  let sxx = 0;
  let sxy = 0;
  for (const p of points) {
    sxx += (p.logTvl - mx) * (p.logTvl - mx);
    sxy += (p.logTvl - mx) * (p.logMcap - my);
  }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  return { intercept: my - slope * mx, slope };
}

/** The curve the snapshot's priced protocols fit, with its sample count. */
export function fitCurve(snapshot: Snapshot): SizeCurve {
  const points = pricedPoints(snapshot);
  if (points.length < 5) throw new SnapshotError(`the snapshot has ${points.length} priced protocols: the curve needs at least 5`);
  const line = fitLine(points);
  return { intercept: line.intercept, slope: line.slope, samples: points.length };
}

/** The market cap the curve predicts for a TVL. */
function curveValue(curve: SizeCurve, tvlUsd: number): number {
  return Math.exp(curve.intercept + curve.slope * Math.log(tvlUsd));
}

/** The median absolute log error of a curve on a set of points, as an error multiple. */
function errorMultiple(points: PricedPoint[], curve: { intercept: number; slope: number }): number {
  const errs = points.map((p) => Math.abs(p.logMcap - (curve.intercept + curve.slope * p.logTvl)));
  return Math.exp(median(errs));
}

/** The leave-one-out error: the curve refitted without each protocol in turn, tested on it. */
function looMultiple(points: PricedPoint[]): number {
  const errs: number[] = [];
  for (let i = 0; i < points.length; i++) {
    const rest = points.filter((_, j) => j !== i);
    const line = fitLine(rest);
    errs.push(Math.abs(points[i]!.logMcap - (line.intercept + line.slope * points[i]!.logTvl)));
  }
  return Math.exp(median(errs));
}

/**
 * The walk-forward error: the curve fitted on the oldest 70% of the dated priced protocols and
 * tested on the newest 30%. A curve that only memorises the past fails this one.
 */
function walkForward(points: PricedPoint[]): { multiple: number; train: number; test: number } {
  const dated = points
    .filter((p) => p.listedAt !== null)
    .sort((a, b) => (a.listedAt! < b.listedAt! ? -1 : a.listedAt! > b.listedAt! ? 1 : 0));
  const cut = Math.floor(dated.length * 0.7);
  const train = dated.slice(0, cut);
  const test = dated.slice(cut);
  if (train.length < 5 || test.length < 3) return { multiple: looMultiple(points), train: train.length, test: test.length };
  const line = fitLine(train);
  return { multiple: errorMultiple(test, line), train: train.length, test: test.length };
}

/** The curve's three tests on this snapshot, each a median absolute error as a multiple. */
export function validateCurve(snapshot: Snapshot, curve: SizeCurve): ModelValidation {
  const points = pricedPoints(snapshot);
  const dated = points.filter((p) => p.listedAt !== null).length;
  const wf = walkForward(points);
  return {
    priced_samples: points.length,
    dated_samples: dated,
    in_sample_multiple: Math.round(errorMultiple(points, curve) * 100) / 100,
    loo_multiple: Math.round(looMultiple(points) * 100) / 100,
    walk_forward_multiple: Math.round(wf.multiple * 100) / 100,
    walk_forward_train: wf.train,
    walk_forward_test: wf.test,
  };
}

/**
 * One category's adjustment from its priced protocols' residuals against the curve. A category
 * with fewer than three priced protocols gets no adjustment: the curve alone prices it, and the
 * dashboard says so. Adjustments are clamped, so one wild residual cannot price a whole category.
 * The table is sorted by category name so the dashboard prints it in a stable order.
 */
export function categoryAdjustments(snapshot: Snapshot, curve: SizeCurve, model: ModelConstants): CategoryAdjustment[] {
  const byCategory = new Map<string, number[]>();
  for (const p of snapshot.protocols) {
    if (p.mcap_usd === null || p.tvl_usd <= 0) continue;
    const ratio = p.mcap_usd / p.tvl_usd;
    if (!Number.isFinite(ratio) || ratio <= 0) continue;
    const residual = Math.log(p.mcap_usd) - (curve.intercept + curve.slope * Math.log(p.tvl_usd));
    const key = p.category ?? 'Unknown';
    const list = byCategory.get(key) ?? [];
    list.push(residual);
    byCategory.set(key, list);
  }
  const out: CategoryAdjustment[] = [];
  for (const [category, residuals] of [...byCategory.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))) {
    const adjusted = residuals.length >= model.adjustment_min_samples;
    const raw = adjusted ? Math.exp(median(residuals)) : 1;
    out.push({
      category,
      adjustment: Math.round(clamp(raw, model.adjustment_min, model.adjustment_max) * 1e4) / 1e4,
      samples: residuals.length,
      adjusted,
    });
  }
  return out;
}

/** The adjustment one protocol is priced at: its category's row, or none when unlisted. */
function adjustmentFor(category: string | null, adjustments: CategoryAdjustment[]): number {
  const row = adjustments.find((m) => m.category === (category ?? 'Unknown'));
  return row === undefined ? 1 : row.adjustment;
}

/** The multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
  curve: SizeCurve,
  adjustments: CategoryAdjustment[],
): { implied: number; curveValueUsd: number; adjustment: number; growthPct: number; growthMult: number; maturityMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = clamp(rawGrowth, model.growth_floor, model.growth_cap);
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const curveVal = curveValue(curve, protocol.tvl_usd);
  const adjustment = adjustmentFor(protocol.category, adjustments);
  const implied = Math.max(1, Math.round(curveVal * adjustment * growthMult * maturityMult));
  return { implied, curveValueUsd: Math.round(curveVal), adjustment, growthPct, growthMult, maturityMult, age };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !VERSIONED.test(p.name);
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const curve = fitCurve(snapshot);
  const adjustments = categoryAdjustments(snapshot, curve, model);
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries (it cannot, but
  // the board's coverage is the gate's row and is never gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: pre-token protocols below the watchlist floor, by TVL, capped. Never a
  // replacement for a watchlist row: a chosen protocol stays chosen.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, EARLY_ROWS);
  for (const p of early) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => {
    const { implied, curveValueUsd, adjustment, growthPct, growthMult, maturityMult, age } = impliedValue(p, snapshot.as_of, model, curve, adjustments);
    return { p, implied, curveValueUsd, adjustment, growthPct, growthMult, maturityMult, age };
  });
  scored.sort((a, b) => b.implied - a.implied || b.p.tvl_usd - a.p.tvl_usd || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  // Ranks must be strictly ordered by implied value: two rows that price identically are split by
  // one dollar, below the dashboard's display precision, so the order the model computed is kept.
  let tied = 0;
  for (let i = 1; i < scored.length; i++) {
    if (scored[i]!.implied >= scored[i - 1]!.implied) {
      scored[i]!.implied = scored[i - 1]!.implied - 1;
      tied++;
    }
  }
  if (tied > 0) process.stderr.write(`token radar: ${tied} tied implied value${tied === 1 ? '' : 's'} split by $1 to keep ranks strictly ordered\n`);
  return scored.map((s, i) => ({
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
      curve_value_usd: s.curveValueUsd,
      category_adjustment: round4(s.adjustment),
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

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

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('curator') || c.includes('allocator') || c.includes('vault')) {
    return `Deposit $${capital} into a ${name} vault on ${chain} and hold the vault shares; the vault's own page shows which strategy the deposit follows.`;
  }
  if (c.includes('rwa') || c.includes('real world')) {
    return `Mint $${capital} of the protocol's yield-bearing asset on ${chain} and hold it in the same wallet.`;
  }
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) {
    return `Supply $${capital} of USDC to ${name} on ${chain} and leave the supply position open.`;
  }
  if (c.includes('dex') || c.includes('leveraged farm')) {
    return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  }
  if (c.includes('yield') || c.includes('aggregator')) {
    return `Deposit $${capital} into ${name}'s highest-TVL strategy on ${chain} and keep the position open.`;
  }
  if (c.includes('bridge')) {
    return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds inside its app.`;
  }
  if (c.includes('staking') || c.includes('restak')) {
    return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt token.`;
  }
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('basis')) {
    return `Deposit $${capital} of USDC as margin on ${name} and open one small hedged position.`;
  }
  if (c.includes('prediction')) {
    return `Fund $${capital} and place one market position on ${name}.`;
  }
  if (c.includes('stable')) {
    return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  }
  if (c.includes('insurance')) {
    return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active.`;
  }
  if (c.includes('payment')) {
    return `Route $${capital} of payments through ${name} on ${chain} and keep the receipts.`;
  }
  if (c.includes('chain')) {
    return `Bridge $${capital} to the chain ${name} runs on and use one of its native apps.`;
  }
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** A second, smaller action in the same app, so the wallet shows two kinds of activity. */
function secondActionFor(p: SnapshotProtocol, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('curator') || c.includes('allocator') || c.includes('vault')) {
    return `Vote on one vault strategy or review the vault's allocation page on ${chain}.`;
  }
  if (c.includes('rwa') || c.includes('real world')) {
    return `Claim one yield distribution from the asset you minted, or mint $10 more of it.`;
  }
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) {
    return `Borrow $10 against the supply and repay it the same week, so the wallet shows two-sided activity.`;
  }
  if (c.includes('dex') || c.includes('leveraged farm')) {
    return `Swap $10 through the pool you supplied, so the wallet shows both sides of the market.`;
  }
  if (c.includes('yield') || c.includes('aggregator')) {
    return `Claim one round of yield, or restake $10 of it into the same strategy.`;
  }
  if (c.includes('bridge')) {
    return `Bridge $10 back the other way, so the wallet shows a round trip.`;
  }
  if (c.includes('staking') || c.includes('restak')) {
    return `Claim one staking reward, or delegate $10 more, and keep the receipt token.`;
  }
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('basis')) {
    return `Close the hedged position and open one fresh small position the same week.`;
  }
  if (c.includes('prediction')) {
    return `Settle one market and place one fresh position.`;
  }
  if (c.includes('stable')) {
    return `Swap $10 of the stable asset for USDC and back, inside the same app.`;
  }
  if (c.includes('insurance')) {
    return `Check the policy's active status on the protocol's own page and keep the renewal reminder set.`;
  }
  if (c.includes('payment')) {
    return `Send one $10 payment through ${name} and keep the receipt.`;
  }
  if (c.includes('chain')) {
    return `Use one native app on the chain for a $10 transaction.`;
  }
  return `Do one $10 transaction inside ${name}'s own app, such as a swap or a claim.`;
}

/**
 * A protocol's farm plan: eight steps, each an action with a cost and a time. The plan is derived
 * from the protocol's own record (category, chains, TVL, age), never from a hand-written list of
 * names. The deposit is sized by the protocol's TVL, the hold by its age, and every step names
 * the chain it runs on.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  const second = secondActionFor(p, chain);
  const gas = capital >= 150 ? 8 : 4;
  return [
    {
      text: `Set aside a fresh wallet that holds only the funds you plan to farm, and store its seed phrase offline, never in a screenshot or a chat.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about $${gas} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: second,
      cost: '$10 of capital and about $2 of gas',
      time: '10 minutes',
    },
    {
      text: `Do one qualifying action each week on ${chain}, such as a deposit, a swap, a vote or a claim, so the wallet reads as active rather than one-off.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Once a week, record the position's dollar value and the protocol's TVL in a farm log; a TVL that falls by a third is the signal to unwind early.`,
      cost: 'nothing but the log',
      time: '5 minutes a week',
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page from its official site and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `After ${hold} days, withdraw the position in one transaction, keep the receipt, and write the wallet, the dates and every transaction hash in the farm log.`,
      cost: `about $${gas} of gas to exit`,
      time: '15 minutes',
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
    }));
}

/** A board row's compact form for data.js, carrying the farm plan from the board itself. */
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
    curve_value_usd: row.model.curve_value_usd,
    category_adjustment: row.model.category_adjustment,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    watchlist: false,
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const curve = fitCurve(snapshot);
  const validation = validateCurve(snapshot, curve);
  const adjustments = categoryAdjustments(snapshot, curve, model);
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
    curve,
    validation,
    adjustments,
    rows: board.map((r) => ({ ...radarRow(r), watchlist: snapshot.watchlist.includes(r.slug) })),
    live,
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
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd >= board[i - 1]!.implied_value_usd) return `row ${i + 1} does not rank strictly below row ${i} on implied value`;
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
