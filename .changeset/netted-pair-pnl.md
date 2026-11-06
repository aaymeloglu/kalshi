---
"@newyorkcompute/kalshi-mcp": patch
---

get_settlements: credit the $1-per-pair netting payout when YES and NO were both held on a ticker, so closed round trips no longer report as near-total losses. Adds `netted_pairs` and `netting_payout_dollars` per row and `total_netting_payout_dollars` to the summary.
