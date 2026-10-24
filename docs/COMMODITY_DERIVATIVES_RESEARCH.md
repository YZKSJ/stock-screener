# Commodity Derivatives Research — first vertical slice

This branch adds a provider-neutral research seam for domestic commodity futures. It does **not** claim to provide exchange-certified live quotes.

## API endpoints

- `POST /api/v1/derivatives/validate-snapshot`
- `POST /api/v1/derivatives/history/daily`

The API router is protected by the existing server-session dependency.

## Daily history adapter

The daily history endpoint calls `akshare.futures_zh_daily_sina(symbol=...)`, then filters the returned series to the requested inclusive date range. See the [AKShare futures documentation](https://github.com/akfamily/akshare/blob/main/docs/data/futures/futures.md) and [upstream adapter source](https://github.com/akfamily/akshare/blob/main/akshare/futures/futures_zh_sina.py).

The response includes provider identity, fetch time, requested dates, first/last bar dates, series kind, returned bars and quality counters. Invalid OHLC rows and conflicting duplicate dates are excluded and counted. Missing trading sessions are not inferred because this slice does not yet include the Chinese exchange trading calendar.

Use deliverable contract symbols for contract-specific research. A Sina symbol ending in `0` is commonly a continuous/rolled series; these are labeled `continuous_proxy`. Continuous series can contain roll discontinuities and should not be used for return/backtest analysis before roll-adjustment semantics are verified.

AKShare/Sina is a best-effort third-party source, not an exchange-certified feed. Interfaces can change, be throttled, omit data or become unavailable. Errors are surfaced instead of silently substituting data.

## Request example

These are synthetic test inputs, not current market data.

```json
{
  "contract": {"symbol":"MA609","exchange":"CZCE","product":"MA","multiplier":10,"tick_size":1,"currency":"CNY"},
  "start_date": "2026-10-20",
  "end_date": "2026-10-24"
}
```

Submit to `POST /api/v1/derivatives/history/daily`.

## Not included

- No CTP login, licensed market-data subscription or order submission.
- No background ingestion or persistence; daily history is fetched on demand.
- No exchange holiday/night-session trading calendar.
- No contract directory, roll-adjustment engine, chart UI, Greeks or backtest.

## Tests

From `backend/` run:

```bash
pytest tests/unit/test_derivatives_quality.py tests/unit/test_derivatives_api_registration.py tests/unit/test_akshare_futures_history.py
```

The new adapter tests use a fake AKShare module, so they do not call the network.

## Next steps

1. Add exchange trading-day/night-session semantics.
2. Add contract directory and market-universe APIs.
3. Persist normalized history with source/schema metadata.
4. Build a scan over validated history, then wire charts and MCP tools.
5. Implement licensed CTP/live-data separately from this public history adapter.
