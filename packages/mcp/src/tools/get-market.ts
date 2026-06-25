/**
 * Get Market Tool
 *
 * MCP tool for fetching detailed information about a specific Kalshi market.
 * Returns full market details including rules, pricing, volume, and settlement info.
 *
 * @module tools/get-market
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { MarketApi } from "kalshi-typescript";
import { z } from "zod";
import { cents, fp } from "../schema.js";

/** Schema for get_market tool parameters */
const GetMarketSchema = z.object({
  ticker: z
    .string()
    .describe("The market ticker (e.g., 'KXBTC-25JAN03-B100500')"),
});

type GetMarketInput = z.infer<typeof GetMarketSchema>;

/**
 * Registers the get_market tool with the MCP server.
 *
 * @param server - MCP server instance to register the tool with
 * @param marketApi - Kalshi Market API client
 */
export function registerGetMarket(server: McpServer, marketApi: MarketApi) {
  server.tool(
    "get_market",
    "Get detailed information about a specific Kalshi market by its ticker. Returns full market details including rules, pricing, and settlement information.",
    GetMarketSchema.shape,
    async (params: GetMarketInput) => {
      try {
        const response = await marketApi.getMarket(params.ticker);
        const market = response.data.market;

        if (!market) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Market not found: ${params.ticker}`,
              },
            ],
            isError: true,
          };
        }

        // Format market for readable output
        const formattedMarket = {
          // Basic info
          ticker: market.ticker,
          title: market.title,
          subtitle: market.subtitle,
          yes_sub_title: market.yes_sub_title,
          no_sub_title: market.no_sub_title,
          status: market.status,
          result: market.result,
          market_type: market.market_type,

          // Event info
          event_ticker: market.event_ticker,

          // Pricing
          yes_bid: cents(market.yes_bid_dollars),
          yes_ask: cents(market.yes_ask_dollars),
          no_bid: cents(market.no_bid_dollars),
          no_ask: cents(market.no_ask_dollars),
          last_price: cents(market.last_price_dollars),
          previous_yes_bid: cents(market.previous_yes_bid_dollars),
          previous_yes_ask: cents(market.previous_yes_ask_dollars),
          previous_price: cents(market.previous_price_dollars),

          // Volume
          volume: fp(market.volume_fp),
          volume_24h: fp(market.volume_24h_fp),
          open_interest: fp(market.open_interest_fp),
          liquidity: fp(market.liquidity_dollars),

          // Timing
          created_time: market.created_time,
          open_time: market.open_time,
          close_time: market.close_time,
          expected_expiration_time: market.expected_expiration_time,
          latest_expiration_time: market.latest_expiration_time,

          // Rules
          rules_primary: market.rules_primary,
          rules_secondary: market.rules_secondary,

          // Settlement
          settlement_value: fp(market.settlement_value_dollars),
          settlement_timer_seconds: market.settlement_timer_seconds,
          notional_value: fp(market.notional_value_dollars),

          // Strike info
          strike_type: market.strike_type,
          cap_strike: market.cap_strike,
          floor_strike: market.floor_strike,
        };

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(formattedMarket, null, 2),
            },
          ],
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error occurred";
        return {
          content: [
            {
              type: "text" as const,
              text: `Error fetching market ${params.ticker}: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
