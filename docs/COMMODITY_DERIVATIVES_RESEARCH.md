# Commodity Derivatives Research — first vertical slice

This branch adds a provider-neutral research seam for domestic commodity futures. It does **not** claim to provide exchange-certified live quotes.

## API endpoints

- `GET /api/v1/derivatives/directory?q=MA&exchange=CZCE&limit=50`
- `POST /api/v1/derivatives/validate-snapshot`
- `POST /api/v1/derivatives/history/daily`
- `POST /api/v1/derivatives/scan/daily`

All endpoints are behind the existing server-session dependency.

## Daily history adapter and indicators

The history endpoint calls `akshare.futures_zh_daily_sina(symbol=...)`, then filters the returned daily series to the requested inclusive date range. See the [AKShare futures documentation](https://github.com/akfamily/akshare/blob/main/docs/data/futures/futures.md) and [upstream adapter source](https://github.com/akfamily/akshare/blob/main/akshare/futures/futures_zh_sina.py).

The response includes provider identity, fetch time, requested dates, first/last bar dates, series kind, returned bars and quality counters. Single-history and scan results report the calendar-day gap between the requested end date and the latest returned bar; gaps greater than seven days trigger a warning. This is a coarse coverage alarm, not an exchange trading-day calculation. Invalid OHLC rows and conflicting duplicate dates are excluded and counted. It also computes 1/5/20-bar returns, 5/20-bar moving averages, 20-return annualized realized volatility, recent-five vs previous-twenty volume ratio, five-bar open-interest change, and latest intraday range. Annualization assumes 252 periods per year.

## Contract directory

The directory reads `akshare.futures_fees_info()`, which AKShare documents as an OpenCTP fee/reference table. It exposes normalized symbol, exchange, product, product name, contract name, multiplier and minimum tick, with a short in-process cache. The adapter filters to commodity-futures-looking symbols and excludes options, continuous symbols and financial futures, and fails closed if upstream columns change. It reports both local fetch time and the upstream update timestamp when available.

This is a discovery and form-prefill aid, **not** an official exchange contract master. The list can include expired or stale contracts; verify current listing status and contract metadata with the exchange or broker. Source rows that are malformed or conflict are excluded, not silently trusted.

## Bounded contract-list scan

`POST /api/v1/derivatives/scan/daily` accepts 1–8 explicitly supplied contracts and fetches them sequentially. It is a watchlist/selected-contract scan, not an automatic full-market universe scan. Rows with sufficient history are ranked by 20-bar return descending; contracts with insufficient history remain visible but unranked, and provider errors are reported per contract rather than aborting the whole batch. Each contract row also carries quality warnings for continuous/rolled series, malformed or conflicting rows excluded during normalization, empty results, and short history. These flags are informational and do not certify source accuracy.

## Data-source caveats

Use deliverable contract symbols for contract-specific research. A Sina symbol ending in `0` is commonly a continuous/rolled series; these are labeled `continuous_proxy`. Continuous series can contain roll discontinuities and should not be used for return/backtest analysis before roll adjustment semantics are verified.

AKShare/Sina is a best-effort third-party source, not an exchange-certified feed. Interfaces can change, be throttled, omit data or become unavailable. Errors are surfaced instead of silently substituting data.

## Request example

These values are synthetic, not current market data.

```json
{
  "contracts": [
    {"symbol":"MA609","exchange":"CZCE","product":"MA","multiplier":10,"tick_size":1,"currency":"CNY"},
    {"symbol":"RB2610","exchange":"SHFE","product":"RB","multiplier":10,"tick_size":1,"currency":"CNY"}
  ],
  "start_date": "2026-06-01",
  "end_date": "2026-10-24"
}
```

Submit to `POST /api/v1/derivatives/scan/daily`. Returns and realized volatility are percentages; volume ratio is a multiplier. Missing history remains unavailable rather than replaced with zero. The trend state is descriptive, not a trading instruction.

## Not included

- No CTP login, licensed market-data subscription or order submission.
- No background ingestion or persistence; history is fetched on demand.
- No exchange holiday/night-session trading calendar.
- No contract directory, roll-adjustment engine, chart UI, Greeks or backtest.

## Tests

From `backend/` run:

```bash
pytest tests/unit/test_derivatives_quality.py tests/unit/test_derivatives_api_registration.py tests/unit/test_akshare_futures_history.py tests/unit/test_akshare_futures_directory.py tests/unit/test_derivatives_analytics.py tests/unit/test_derivatives_scan.py tests/unit/test_derivatives_directory_api.py
```

The new history and analytics tests use synthetic bars/fake provider calls, not live network data.

## Next steps

1. Validate provider directory and history coverage against selected symbols.
2. Add exchange/product-specific trading-day/night-session semantics from verifiable references.
3. Persist normalized history with source/schema metadata.
4. Improve chart/report UI and MCP tools over the same calculation layer.
5. Implement licensed CTP/live-data separately from this public history adapter.
