[![token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/competitions/token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/GlennVor/token-radar-01/rank.svg)](https://make.fun/competitions/token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/GlennVor/token-radar-01/reward.svg)](https://make.fun/competitions/token-radar-01)

# Token Radar — model radar-3

A token launch radar for the [make.fun token-radar-01 bounty](https://make.fun/competitions/token-radar-01):
it reads a sealed DefiLlama snapshot of every protocol, ranks the ones that record no token by what
their launch would be worth, and shows the steps to farm each one in a static web dashboard.

## The model (radar-3)

```
implied value = size curve × category adjustment × growth factor × maturity factor
```

- **Size curve.** log(market cap) = a + b·log(TVL), fitted by least squares over the priced
  protocols in the snapshot. On the sealed snapshot the fit is log mcap = 6.96 + 0.522·log TVL
  (128 priced protocols). The slope is below one, so market cap grows slower than TVL: a flat
  multiple would overprice the largest protocols and underprice the small ones.
- **Category adjustment.** The median residual of the priced protocols in the same category,
  exponentiated, when the category has at least three priced protocols. A category with fewer
  gets no adjustment (1.000) — the curve alone prices it. Adjustments are clamped to 0.25–4.00.
  The table is computed from the snapshot at run time; nothing is hardcoded by name.
- **Growth factor.** 1 + (7-day TVL change, clamped to −60%…+120%) × 0.5.
- **Maturity factor.** 0.6 + min(age in days, 1095) / 1095 × 0.4. A protocol with no listing date
  counts as 365 days old.

The curve is tested three ways on the same snapshot, and the dashboard prints the results:
in-sample median error 3.36×, leave-one-out median error 3.40×, walk-forward median error
3.41× (fitted on the oldest 70% of the priced protocols by listing date, tested on the newest
30%; 66 train, 29 test). Each is the median absolute error as a multiple of the true market cap.

The board covers all 40 watchlist protocols plus 160 early finds below the watchlist floor
(pre-token, by TVL), 200 rows in all. Each row carries an eight-step farm plan with a cost and a
time per step, sized by the protocol's TVL and age. The 24 largest live-token protocols are
shown apart, with the market's own values — they are the comparables the size curve is fitted on.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json|directory>
```

Node 22.18 or later, standard library only, no install. Writes `board.json`, `data.js`,
`dashboard/`, `screenshots/` and `dossier.json` to the output directory. Runs twice must write the
same bytes.

## Layout

- `main.ts` — the entry point: reads the snapshot, writes the board, the dashboard data, the
  screenshots and the dossier.
- `lib/model.ts` — the radar-3 model: snapshot parsing, the fitted size curve, category
  adjustments, the curve's three tests, implied values, farm plans, the board and the dashboard
  data.
- `vendor/makefun-board.ts` — make.fun's dossier library, copied verbatim from the kit.
- `dashboard/` — the static page: `index.html`, `app.css`, `app.js`. No network, no framework.
- `screenshots/` — the board, a protocol's detail view, a filtered view, and the method panel.
- `.makefun/owner.json` — the wallet this entry belongs to.

## License

MIT. See `LICENSE`.
