# Static Futures Research Snapshot

The static site can display a scheduled, read-only futures research snapshot without a continuously running API server.

- The static publish workflow calls the futures snapshot exporter before building the static frontend.
- The script reads the third-party OpenCTP/AKShare reference directory and fetches daily bars for a small watchlist (currently RB, MA, I, CU, AG) using the existing provider adapters.
- The snapshot is written to `frontend/public/static-data/futures-research.json`; the static UI reads it from the site's base path and does not send API requests when `VITE_STATIC_SITE=true`.
- If the upstream directory is down, the script writes an explicit offline snapshot and the static build continues. Per-contract failures are surfaced in the UI rather than guessed over.
- The directory's contract codes/contract specifications are third-party reference data and may include stale contracts. The expiry selector is only a lightweight code heuristic, not official listing validation.
- Daily bars are delayed historical data. No ticks, real-time market data, orders, broker credentials, or trading are involved.

The snapshot and UI labels must never present a sample chart or an uncomputed backtest as a real signal/result.
