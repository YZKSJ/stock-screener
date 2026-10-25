# Static Futures Research Snapshot

The project now has a standalone multi-page entry for Cloudflare Pages, separate from the larger stock-scanner snapshot pipeline.

## Cloudflare Pages setup

Create a **new** Pages project from the `YZKSJ/stock-screener` Git repository; do not reuse `yunshu` or `trade999`.

- Framework preset: Vite (or none)
- Root directory: `frontend`
- Build command: `npm ci && npm run build`
- Build output directory: `dist`
- Environment variable: `VITE_STATIC_SITE=true`
- Optional environment variable: `VITE_BASE_PATH=/`
- Preview URL path: `/futures.html`

The multi-page build continues to include the repository's existing `index.html` and adds a standalone `futures.html` that mounts only the futures research workbench. It does not require the stock-scanner static manifest or a continuously running Python API.

## Update and publish flow

1. `.github/workflows/futures-research-snapshot.yml` runs on weekdays after the domestic commodity day session, and can also be started manually from GitHub Actions.
2. It loads the OpenCTP/AKShare reference directory and fetches daily bars for a small representative watchlist (currently RB, MA, I, CU, AG).
3. The producer marks a snapshot ready only when at least one selected contract has a latest bar no more than seven calendar days before the snapshot date. If the export is offline or all histories are stale, the previous usable snapshot is kept.
4. Only a ready snapshot replaces the `futures-research-data` GitHub Release asset and `frontend/public/static-data/futures-research.json`. The JSON commit triggers Cloudflare Pages Git integration to rebuild the standalone site; generated data-only pushes are excluded from the full CI matrix.
5. When `VITE_STATIC_SITE=true`, the standalone Futures page reads the published JSON and does not call backend API routes. It displays snapshot time, provider provenance, last-bar date and stale-data warnings.

## Data and model boundaries

- The directory is third-party reference data, not an exchange-certified contract master; it may contain stale entries. Expiry selection is a limited code heuristic, not official listing validation.
- Daily bars are historical/delayed source data, not real-time market data. Only a small watchlist receives prebuilt history to limit upstream calls. Other directory entries may be searchable in the full server-backed UI but will not have static daily history unless included in the snapshot.
- The UI's SMA5/SMA20 research example uses only previous closes to choose long-or-flat exposure for the next close-to-close change. It is a gross close-price return proxy, not futures contract P&L. It excludes multiplier/tick value, transaction fees, slippage, margin/leverage, stop logic and contract rolls. Do not compare it with executable trading performance.
- No tick feed, brokerage credentials, order routing or automated trading is included.

Keep sample charts and uncomputed placeholders clearly labeled; do not present the sample visual line as measured strategy performance.
