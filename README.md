[![token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/competitions/token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/GlennVor/token-radar-01/rank.svg)](https://make.fun/competitions/token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/GlennVor/token-radar-01/reward.svg)](https://make.fun/competitions/token-radar-01)

# Token Radar — model radar-2

A token launch radar for the [make.fun token-radar-01 bounty](https://make.fun/competitions/token-radar-01):
it reads a sealed DefiLlama snapshot of every protocol, ranks the ones that record no token by what
their launch would be worth, and shows the steps to farm each one in a static web dashboard.

## The model (radar-2)

```
implied value = TVL × category multiple × growth factor × maturity factor
```

- **Category multiple.** The median market-cap-to-TVL ratio of the protocols in the same category
  that already have a priced token. A category with fewer than three priced protocols falls back to
  the median over every priced protocol (0.214 on this snapshot). Multiples are clamped to 0.05–0.75.
  The table is computed from the snapshot at run time; nothing is hardcoded by name.
- **Growth factor.** 1 + (7-day TVL change, clamped to −60%…+120%) × 0.5.
- **Maturity factor.** 0.6 + min(age in days, 1095) / 1095 × 0.4. A protocol with no listing date
  counts as 365 days old.

The board covers all 40 watchlist protocols plus 160 early finds below the watchlist floor
(pre-token, by TVL), 200 rows in all. The 24 largest live-token protocols are shown apart, with the
market's own values — they are the comparables the multiples are priced from.

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
- `lib/model.ts` — the radar-2 model: snapshot parsing, category multiples, implied values, farm
  plans, the board and the dashboard data.
- `vendor/makefun-board.ts` — make.fun's dossier library, copied verbatim from the kit.
- `dashboard/` — the static page: `index.html`, `app.css`, `app.js`. No network, no framework.
- `screenshots/` — the board, a protocol's detail view, and a filtered view.
- `.makefun/owner.json` — the wallet this entry belongs to.

## License

MIT. See `LICENSE`.
