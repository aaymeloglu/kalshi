/**
 * Schema field helpers
 *
 * Kalshi's trade-api represents numbers as fixed-point decimal strings:
 *   - Money and quotes use `*_dollars` keys (e.g. `yes_bid_dollars: "0.9300"`,
 *     `no_total_cost_dollars: "33.348920"`).
 *   - Contract counts, sizes, volume and open interest use `*_fp` keys
 *     (e.g. `count_fp: "10.00"`).
 *
 * These helpers convert that wire format into the numbers the tools expose:
 * prices in integer cents (the 0–100 unit Kalshi users think in), and counts,
 * volumes and dollar amounts as plain numbers.
 *
 * @module schema
 */

/**
 * Parse a fixed-point decimal string (or number) to a number.
 *
 * Used for `*_fp` count/size/volume fields and for `*_dollars` amounts that are
 * reported in dollars.
 *
 * @returns the parsed number, or `null` if the input is missing/unparseable.
 */
export function fp(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Convert a dollar-denominated fixed-point string (or number) to cents.
 *
 * Used for quote/price fields (`yes_bid_dollars`, `last_price_dollars`, ...).
 * Kalshi `deci_cent` markets quote on a 0.1¢ grid (e.g. `"0.7350"` = 73.5¢), so
 * this preserves 0.1¢ granularity rather than collapsing to whole cents — the
 * half-cent matters for edge/EV math in analysis. Whole-cent quotes are
 * unchanged: `"0.7400"` → `74`, `"0.7350"` → `73.5`.
 *
 * @returns price in cents (to 0.1¢), or `null` if the input is missing/unparseable.
 */
export function cents(value: string | number | null | undefined): number | null {
  const n = fp(value);
  // Round to the nearest 0.1¢ to keep deci_cent precision while killing the
  // floating-point noise from `dollars * 100` (e.g. 0.74 * 1000 = 740.0000…).
  return n === null ? null : Math.round(n * 1000) / 10;
}
