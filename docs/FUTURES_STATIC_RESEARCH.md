# Static Futures Research Snapshot

The static site can display a scheduled, read-only commodity-futures snapshot without a continuously running API server.

## Update and publish flow

1. `.github/workflows/futures-research-snapshot.yml` runs on weekdays after the domestic day session, and can also be started manually from GitHub Actions.
2. It calls `app.scripts.export_futures_research_snapshot`, which loads the OpenCTP/AKShare reference directory and fetches daily bars for a small representative watchlist (currently RB, MA, I, CU, AG).
3. The producer only replaces the `futures-research-data` GitHub Release asset when the snapshot includes at least one selected contract with a latest bar no more than seven calendar days before the snapshot date. If the export is offline or all histories are stale, the previous usable release asset is kept.
4. A successful snapshot update wakes `static-site-publish.yml`; the publisher downloads the last-good asset into `frontend/public/static-data/futures-research.json` before building the site. A missing initial asset produces an explicit offline JSON file, not fabricated data.
5. With `VITE_STATIC_SITE=true`, the Futures page reads that JSON from the deployed site's base path. It does not call the server-backed directory/history API in static mode.

## Data and model boundaries

- The directory is third-party reference data, not an exchange-certified contract master; it may contain stale entries. Expiry selection is a limited code heuristic, not official listing validation.
- Daily bars are historical/delayed source data, not real-time market data. The page displays source provenance, snapshot time, last bar date and stale-data warnings.
- Only a small watchlist receives prebuilt history to limit upstream calls. Other directory entries may be searchable but will not have static daily history until included in a future export.
- The UI's SMA5/SMA20 research example uses only previous closes to choose long-or-flat exposure for the next close-to-close change. It is a gross close-price return proxy, not futures contract P&L. It excludes multiplier/tick value, transaction fees, slippage, margin/leverage, stop logic and contract rolls. Do not compare it with executable trading performance.
- No tick feed, brokerage credentials, order routing or automated trading is included.

Keep sample charts and uncomputed placeholders clearly labeled; do not present the sample visual line as measured strategy performance.
