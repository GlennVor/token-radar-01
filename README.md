[![token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/competitions/token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/GlennVor/token-radar-01/rank.svg)](https://make.fun/competitions/token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/GlennVor/token-radar-01/reward.svg)](https://make.fun/competitions/token-radar-01)

# Token Radar — model radar-5

A token launch radar for the [make.fun token-radar-01 bounty](https://make.fun/competitions/token-radar-01):
it reads a sealed DefiLlama snapshot of every protocol, ranks the ones that record no token by what
their launch would be worth, and shows the steps to farm each one in a static web dashboard.

## The model (radar-5)

```
implied value = size curve × category adjustment
```

- **Size curve.** log(market cap) = a + b·log(TVL), fitted by least squares over the priced
  protocols in the snapshot. On the sealed snapshot the fit is log mcap = 6.96 + 0.522·log TVL
  (128 priced protocols). The slope is below one, so market cap grows slower than TVL: a flat
  multiple would overprice the largest protocols and underprice the small ones.
- **Category adjustment.** The median residual of the priced protocols in the same category,
  exponentiated, when the category has at least three priced protocols — and then halved. A
  category's median residual is a real signal, but it is fitted on protocols that already have
  a token, and the board prices protocols that do not, so the model takes half of it. A category
  with fewer than three priced protocols gets no adjustment (1.000) — the curve alone prices
  it. Adjustments are clamped to 0.25–4.00. The table is computed from the snapshot at run time;
  nothing is hardcoded by name.
- **Rank range.** Every row carries a range, from 200 bootstrap resamples of the priced
  protocols: the model is refitted on each resample, every row is re-ranked, and the range is
  the 5th to 95th percentile of its rank, with the same percentiles of its implied value. The
  range is the model's sampling uncertainty, not the full prediction error. A rank of 1 with a
  range of 1–1 is solid; a rank of 100 with a range of 87–219 is not, and the board says so.

Every number in the model is fitted from the snapshot: no weight is hand-chosen. An earlier
version multiplied in a growth factor and a maturity factor; both were dropped after testing
showed they did not earn their keep — the walk-forward error of the full implied value with
them was 3.76×, against 2.99× without them.

The whole model is tested four ways on the same snapshot, and the dashboard prints the results:
in-sample median error 3.37×, leave-one-out median error 3.68×, walk-forward median error
2.99× (fitted on the oldest 70% of the priced protocols by listing date, tested on the newest
30%; 66 train, 29 test), and five-fold cross-validation median error 3.59× (fixed-seed shuffle).
Each is the median absolute error as a multiple of the true market cap. The halved adjustment is
what the walk-forward test chose: 2.99×, against 3.77× unshrunk and 3.41× with no adjustment.

The board covers all 40 watchlist protocols plus 186 early finds below the watchlist floor
(pre-token, by TVL, excluding exchanges and versioned pools), 226 rows in all. Each row carries an eight-step farm plan with a cost and a
time per step, sized by the protocol's TVL and time-weighted by its age (the youngest protocols
get the longest holds, up to 90 days). The 24 largest live-token protocols are
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
- `lib/model.ts` — the radar-5 model: snapshot parsing, the fitted size curve, the halved category
  adjustments, the model's four tests, the bootstrap rank ranges, implied values, farm plans,
  the board and the dashboard data.
- `vendor/makefun-board.ts` — make.fun's dossier library, copied verbatim from the kit.
- `dashboard/` — the static page: `index.html`, `app.css`, `app.js`. No network, no framework.
- `screenshots/` — the board, a protocol's detail view, a filtered view, and the method panel.
- `.makefun/owner.json` — the wallet this entry belongs to.

## License

MIT. See `LICENSE`.
