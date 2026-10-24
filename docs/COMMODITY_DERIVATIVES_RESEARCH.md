# Commodity Derivatives Research — first vertical slice

This branch introduces a provider-neutral domain/API seam for domestic commodity
futures. It does **not** claim to provide live quotes.

## Scope

- Normalize contract identity (symbol, exchange, product, multiplier, tick size,
  and currency).
- Normalize one quote observation with source and fetch timestamps.
- Validate identity, price sanity, OHLC coherence, best bid/ask, volume/open
  interest, and observation freshness.
- Expose the protected API endpoint `POST /api/v1/derivatives/validate-snapshot`.
- Keep provider integration behind `FuturesMarketDataProvider`.

## Request example

These are synthetic test values, not a current quote.

```json
{
  "contract": {"symbol": "MA701", "exchange": "CZCE", "product": "MA", "multiplier": 10, "tick_size": 1, "currency": "CNY"},
  "observation": {
    "symbol": "MA701", "exchange": "CZCE",
    "as_of": "2026-10-24T14:59:30+00:00",
    "fetched_at": "2026-10-24T14:59:40+00:00",
    "last_price": 2500, "volume": 12000, "open_interest": 35000,
    "open_price": 2480, "high_price": 2520, "low_price": 2470,
    "prev_close": 2490, "bid_price_1": 2499, "ask_price_1": 2500,
    "source": "example-fixture"
  },
  "max_age_seconds": 180
}
```

The response reports `valid`, `warning`, or `invalid` and reason codes.
Missing volume/open interest or an incomplete order book is a warning, not a
silently substituted zero. Identity mismatch, impossible price relationships,
crossed bid/ask, and sufficiently future-dated observations are invalid.

## Not included

- No CTP login, market subscription, credentials, or live data adapter.
- No external download or persistence.
- No Chinese exchange trading calendar/night-session day mapping.
- No continuous-contract rolls, history store, charts, Greeks, or backtest.
- No order submission.

## Next steps

1. Add exchange trading-day/calendar and historical bar semantics.
2. Implement a licensed provider adapter behind the provider port, with fixtures.
3. Add read-only contract directory and market-universe APIs.
4. Add a scan over a supplied historical dataset before adding UI/MCP workflows.
