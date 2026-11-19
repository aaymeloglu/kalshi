---
"@newyorkcompute/kalshi-mcp": minor
"@newyorkcompute/kalshi-core": patch
---

Upgrade all dependencies, including `kalshi-typescript` 3.36, `zod` 4 and `@modelcontextprotocol/sdk` 1.32.

`get_market` no longer returns `liquidity` and `get_positions` no longer returns `resting_orders_count`; Kalshi removed both fields from the API models. A malformed `KALSHI_PRIVATE_KEY` now fails at startup instead of on the first authenticated request.
