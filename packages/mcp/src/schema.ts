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
 * Convert a dollar-denominated fixed-point string (or number) to integer cents.
 *
 * Used for quote/price fields (`yes_bid_dollars`, `last_price_dollars`, ...) so
 * tool output is in whole cents.
 *
 * @returns price in integer cents, or `null` if the input is missing/unparseable.
 */
export function cents(value: string | number | null | undefined): number | null {
  const n = fp(value);
  return n === null ? null : Math.round(n * 100);
}
