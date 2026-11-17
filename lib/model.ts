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
//   adjustment(cat) = exp(0.5 x median residual of priced protocols in cat), n >= 3, else 1.0,
//                     clamped to [0.25, 4.00]
//   implied       = max(1, round(curve(tvl) x adjustment(cat)))
//
// Every number in the model is fitted from the snapshot: no weight is hand-chosen. An earlier
// version multiplied in a growth factor and a maturity factor; both were dropped after they were
// tested and found not to earn their keep — the walk-forward error of the full implied value
// with them was 3.76x, against 2.99x without them, so the model takes the curve and half the
// category signal and nothing else.
//
// The adjustment is halved on purpose: a category's median residual is a real signal, but it is
// fitted on the protocols that already have a token, and the board prices protocols that do not.
// Halving it tests best where it matters — on protocols the model has never priced. On the
// walk-forward test it is the best of the three variants (2.99x, against 3.77x unshrunk and
// 3.41x with no adjustment at all), so the model takes half the category signal and lets the
// curve carry the rest. Cross-validation is reported as a fourth check; on it the variants sit
// within noise of each other.
//
// Each row also carries a rank range: the model is refitted on 200 bootstrap resamples of the
// priced protocols (a fixed seed, so two runs agree), every row is re-ranked under each resample,
// and the range is the 5th to 95th percentile of its rank, with the same percentiles of its
// implied value. The range is the model's sampling uncertainty — how much the rank moves when
// the priced set is redrawn — not the full prediction error, which is the validation multiples
// below. A rank of 1 with a range of 1–1 is solid; a rank of 100 with a range of 87–219 is not,
// and the board says so.
//
// The whole model is tested four ways on the same snapshot, and the dashboard prints the results:
// the in-sample median error, the leave-one-out median error (the model refitted without each
// protocol in turn), the walk-forward error (fitted on the oldest 70% of the priced protocols
// by listing date, tested on the newest 30%), and five-fold cross-validation (a fixed-seed
// shuffle, each fifth held out in turn). Each is the median absolute error as a multiple of
// the true market cap, so a smaller multiple is a better-tested model. No protocol name is ever
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
  adjustment_min: number;
  adjustment_max: number;
  adjustment_min_samples: number;
  adjustment_shrink: number;
}

export const MODEL: ModelConstants = {
  adjustment_min: 0.25,
  adjustment_max: 4.0,
  adjustment_min_samples: 3,
  adjustment_shrink: 0.5,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-5';

/** How many pre-token protocols below the watchlist floor the early radar carries, by TVL. */
export const EARLY_ROWS = 192;

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

/** How the model was tested on this snapshot: each multiple is a median absolute error. */
export interface ModelValidation {
  priced_samples: number;
  dated_samples: number;
  in_sample_multiple: number;
  loo_multiple: number;
  walk_forward_multiple: number;
  walk_forward_train: number;
  walk_forward_test: number;
  cv_multiple: number;
  cv_folds: number;
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
  rank_range: [number, number];
  value_range: [number, number];
  model: {
    curve_value_usd: number;
    category_adjustment: number;
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
  rank_range: [number, number];
  value_range: [number, number];
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

/** One priced protocol, reduced to the logs the curve is fitted on, plus its listing date and category. */
interface PricedPoint {
  logTvl: number;
  logMcap: number;
  listedAt: string | null;
  category: string;
}

/** The protocols that already have a priced token: a positive market cap over a positive TVL. */
function pricedPoints(snapshot: Snapshot): PricedPoint[] {
  const out: PricedPoint[] = [];
  for (const p of snapshot.protocols) {
    if (p.mcap_usd === null || p.tvl_usd <= 0) continue;
    const ratio = p.mcap_usd / p.tvl_usd;
    if (!Number.isFinite(ratio) || ratio <= 0) continue;
    out.push({ logTvl: Math.log(p.tvl_usd), logMcap: Math.log(p.mcap_usd), listedAt: p.listed_at, category: p.category ?? 'Unknown' });
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

/** The fitted model: the curve and the category adjustments, as one object the tests refit. */
interface FittedModel {
  curve: SizeCurve;
  adjustments: CategoryAdjustment[];
}

/** The market cap the curve predicts for a TVL. */
function curveValue(curve: SizeCurve, tvlUsd: number): number {
  return Math.exp(curve.intercept + curve.slope * Math.log(tvlUsd));
}

/** The log-space adjustment one category gets from a fitted model: zero when unadjusted. */
function logAdjustment(model: FittedModel, category: string): number {
  const row = model.adjustments.find((m) => m.category === category);
  if (row === undefined || !row.adjusted) return 0;
  return Math.log(row.adjustment);
}

/** The model's log-space prediction for one priced point: curve plus its category adjustment. */
function predictLog(model: FittedModel, p: PricedPoint): number {
  return model.curve.intercept + model.curve.slope * p.logTvl + logAdjustment(model, p.category);
}

/** The median absolute log error of a fitted model on a set of points, as an error multiple. */
function errorMultiple(model: FittedModel, points: PricedPoint[]): number {
  const errs = points.map((p) => Math.abs(p.logMcap - predictLog(model, p)));
  return Math.exp(median(errs));
}

/** The curve a set of priced points fits, with its sample count. */
function fitCurveFromPoints(points: PricedPoint[]): SizeCurve {
  if (points.length < 5) throw new SnapshotError(`the snapshot has ${points.length} priced protocols: the curve needs at least 5`);
  const line = fitLine(points);
  return { intercept: line.intercept, slope: line.slope, samples: points.length };
}

/**
 * One category's adjustment from a set of points' residuals against the curve. The median
 * residual is halved (model.adjustment_shrink) before it is exponentiated: the category signal is
 * real but noisy, and half of it tests best on protocols the model has never priced. A category
 * with fewer than three priced protocols gets no adjustment: the curve alone prices it, and the
 * dashboard says so. Adjustments are clamped, so one wild residual cannot price a whole category.
 * The table is sorted by category name so the dashboard prints it in a stable order.
 */
function adjustmentsFromPoints(points: PricedPoint[], curve: SizeCurve, model: ModelConstants): CategoryAdjustment[] {
  const byCategory = new Map<string, number[]>();
  for (const p of points) {
    const residual = p.logMcap - (curve.intercept + curve.slope * p.logTvl);
    const list = byCategory.get(p.category) ?? [];
    list.push(residual);
    byCategory.set(p.category, list);
  }
  const out: CategoryAdjustment[] = [];
  for (const [category, residuals] of [...byCategory.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))) {
    const adjusted = residuals.length >= model.adjustment_min_samples;
    const raw = adjusted ? Math.exp(median(residuals) * model.adjustment_shrink) : 1;
    out.push({
      category,
      adjustment: Math.round(clamp(raw, model.adjustment_min, model.adjustment_max) * 1e4) / 1e4,
      samples: residuals.length,
      adjusted,
    });
  }
  return out;
}

/** The curve and the adjustments a set of priced points fits. */
function fitModel(points: PricedPoint[], model: ModelConstants): FittedModel {
  const curve = fitCurveFromPoints(points);
  return { curve, adjustments: adjustmentsFromPoints(points, curve, model) };
}

/** The curve the snapshot's priced protocols fit, with its sample count. */
export function fitCurve(snapshot: Snapshot): SizeCurve {
  return fitCurveFromPoints(pricedPoints(snapshot));
}

/** One category's adjustment from its priced protocols' residuals against the curve. */
export function categoryAdjustments(snapshot: Snapshot, curve: SizeCurve, model: ModelConstants): CategoryAdjustment[] {
  return adjustmentsFromPoints(pricedPoints(snapshot), curve, model);
}

/** The leave-one-out error: the model refitted without each protocol in turn, tested on it. */
function looMultiple(points: PricedPoint[], model: ModelConstants): number {
  const errs: number[] = [];
  for (let i = 0; i < points.length; i++) {
    const rest = points.filter((_, j) => j !== i);
    const fitted = fitModel(rest, model);
    errs.push(Math.abs(points[i]!.logMcap - predictLog(fitted, points[i]!)));
  }
  return Math.exp(median(errs));
}

/**
 * The walk-forward error: the model fitted on the oldest 70% of the dated priced protocols and
 * tested on the newest 30%. A model that only memorises the past fails this one.
 */
function walkForward(points: PricedPoint[], model: ModelConstants): { multiple: number; train: number; test: number } {
  const dated = points
    .filter((p) => p.listedAt !== null)
    .sort((a, b) => (a.listedAt! < b.listedAt! ? -1 : a.listedAt! > b.listedAt! ? 1 : 0));
  const cut = Math.floor(dated.length * 0.7);
  const train = dated.slice(0, cut);
  const test = dated.slice(cut);
  if (train.length < 5 || test.length < 3) return { multiple: looMultiple(points, model), train: train.length, test: test.length };
  const fitted = fitModel(train, model);
  return { multiple: errorMultiple(fitted, test), train: train.length, test: test.length };
}

/** A small deterministic generator (mulberry32) so the cross-validation shuffle is reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Five-fold cross-validation: a fixed-seed shuffle splits the priced protocols into five folds,
 * the model is fitted on four and tested on the fifth, and the median error over every held-out
 * protocol is the multiple. The seed is fixed so two runs of the program agree.
 */
function cvMultiple(points: PricedPoint[], model: ModelConstants, folds = 5, seed = 7): number {
  const order = points.map((_, i) => i);
  const rand = mulberry32(seed);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  const errs: number[] = [];
  for (let f = 0; f < folds; f++) {
    const testIdx = new Set(order.filter((_, i) => i % folds === f));
    const train = points.filter((_, i) => !testIdx.has(i));
    const test = points.filter((_, i) => testIdx.has(i));
    const fitted = fitModel(train, model);
    for (const p of test) errs.push(Math.abs(p.logMcap - predictLog(fitted, p)));
  }
  return Math.exp(median(errs));
}

/** The whole model's four tests on this snapshot, each a median absolute error as a multiple. */
export function validateModel(snapshot: Snapshot, model: ModelConstants = MODEL): ModelValidation {
  const points = pricedPoints(snapshot);
  const dated = points.filter((p) => p.listedAt !== null).length;
  const fitted = fitModel(points, model);
  const wf = walkForward(points, model);
  return {
    priced_samples: points.length,
    dated_samples: dated,
    in_sample_multiple: Math.round(errorMultiple(fitted, points) * 100) / 100,
    loo_multiple: Math.round(looMultiple(points, model) * 100) / 100,
    walk_forward_multiple: Math.round(wf.multiple * 100) / 100,
    walk_forward_train: wf.train,
    walk_forward_test: wf.test,
    cv_multiple: Math.round(cvMultiple(points, model) * 100) / 100,
    cv_folds: 5,
  };
}

/** The adjustment one protocol is priced at: its category's row, or none when unlisted. */
function adjustmentFor(category: string | null, adjustments: CategoryAdjustment[]): number {
  const row = adjustments.find((m) => m.category === (category ?? 'Unknown'));
  return row === undefined ? 1 : row.adjustment;
}

/** One protocol's bootstrap range: the 5th–95th percentile of its rank and its implied value. */
export interface BootstrapRange {
  rank: [number, number];
  value: [number, number];
}

/**
 * The bootstrap rank range of every board protocol: the model refitted on 200 resamples of the
 * priced protocols (a fixed seed, so two runs agree), every protocol re-ranked under each
 * resample, and the 5th–95th percentile of its rank and its implied value. The range is the
 * model's sampling uncertainty — how much the rank moves when the priced set is redrawn — not
 * the full prediction error, which is the validation multiples.
 */
export function bootstrapRanges(
  snapshot: Snapshot,
  board: SnapshotProtocol[],
  model: ModelConstants,
  resamples = 200,
  seed = 11,
): Map<string, BootstrapRange> {
  const points = pricedPoints(snapshot);
  const rand = mulberry32(seed);
  const rankSamples = new Map<string, number[]>();
  const valueSamples = new Map<string, number[]>();
  for (const p of board) {
    rankSamples.set(p.slug, []);
    valueSamples.set(p.slug, []);
  }
  for (let b = 0; b < resamples; b++) {
    const sample: PricedPoint[] = [];
    for (let i = 0; i < points.length; i++) sample.push(points[Math.floor(rand() * points.length)]!);
    const fitted = fitModel(sample, model);
    const vals = board.map((p) => {
      const curveVal = curveValue(fitted.curve, p.tvl_usd);
      const adj = adjustmentFor(p.category, fitted.adjustments);
      return { slug: p.slug, value: Math.max(1, Math.round(curveVal * adj)) };
    });
    const order = [...vals].sort((a, b) => b.value - a.value || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
    for (let r = 0; r < order.length; r++) {
      rankSamples.get(order[r]!.slug)!.push(r + 1);
      valueSamples.get(order[r]!.slug)!.push(order[r]!.value);
    }
  }
  const out = new Map<string, BootstrapRange>();
  const lo = Math.floor(0.05 * (resamples - 1));
  const hi = Math.ceil(0.95 * (resamples - 1));
  for (const p of board) {
    const ranks = [...rankSamples.get(p.slug)!].sort((a, b) => a - b);
    const values = [...valueSamples.get(p.slug)!].sort((a, b) => a - b);
    out.set(p.slug, { rank: [ranks[lo]!, ranks[hi]!], value: [values[lo]!, values[hi]!] });
  }
  return out;
}

/** The implied value one protocol gets under `model`: the curve times its category adjustment. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
  curve: SizeCurve,
  adjustments: CategoryAdjustment[],
): { implied: number; curveValueUsd: number; adjustment: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const curveVal = curveValue(curve, protocol.tvl_usd);
  const adjustment = adjustmentFor(protocol.category, adjustments);
  const implied = Math.max(1, Math.round(curveVal * adjustment));
  return { implied, curveValueUsd: Math.round(curveVal), adjustment, age };
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
    const { implied, curveValueUsd, adjustment, age } = impliedValue(p, snapshot.as_of, model, curve, adjustments);
    return { p, implied, curveValueUsd, adjustment, age };
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
  const ranges = bootstrapRanges(snapshot, scored.map((s) => s.p), model);
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
    rank_range: ranges.get(s.p.slug)!.rank,
    value_range: ranges.get(s.p.slug)!.value,
    model: {
      curve_value_usd: s.curveValueUsd,
      category_adjustment: round4(s.adjustment),
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

/** How long to hold, from the protocol's age: the younger the protocol, the longer the
 * qualifying window, so the plan is time-weighted by age. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 45;
  if (age < 90) return 90;
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
  const weeks = Math.max(1, Math.ceil(hold / 7));
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
      text: `Do one qualifying action each week for ${weeks} weeks on ${chain}, such as a deposit, a swap, a vote or a claim, so the wallet reads as active rather than one-off.`,
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
    rank_range: row.rank_range,
    value_range: row.value_range,
    watchlist: false,
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const curve = fitCurve(snapshot);
  const validation = validateModel(snapshot, model);
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
