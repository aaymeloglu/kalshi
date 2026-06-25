/**
 * Get Orderbook Tool
 *
 * MCP tool for fetching the orderbook for a Kalshi market.
 * Returns bid price levels with quantities for both yes and no sides.
 *
 * @module tools/get-orderbook
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { MarketApi } from "kalshi-typescript";
import { z } from "zod";
import { cents, fp } from "../schema.js";

/** Schema for get_orderbook tool parameters */
const GetOrderbookSchema = z.object({
  ticker: z
    .string()
    .describe("The market ticker (e.g., 'KXBTC-25JAN03-B100500')"),
  depth: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .describe("Number of price levels to return (1-100, default all)"),
});

type GetOrderbookInput = z.infer<typeof GetOrderbookSchema>;

/**
 * Registers the get_orderbook tool with the MCP server.
 *
 * @param server - MCP server instance to register the tool with
 * @param marketApi - Kalshi Market API client
 */
export function registerGetOrderbook(server: McpServer, marketApi: MarketApi) {
  server.tool(
    "get_orderbook",
    "Get the orderbook for a specific Kalshi market. Returns bid price levels with quantities for both yes and no sides.",
    GetOrderbookSchema.shape,
    async (params: GetOrderbookInput) => {
      try {
        const response = await marketApi.getMarketOrderbook(
          params.ticker,
          params.depth
        );

        const orderbook = response.data.orderbook_fp;

        if (!orderbook) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Orderbook not found for market: ${params.ticker}`,
              },
            ],
            isError: true,
          };
        }

        // Each level is [price_dollars, quantity_fp]; prices reported in cents.
        const yesBids = orderbook.yes_dollars || [];
        const noBids = orderbook.no_dollars || [];

        // Format orderbook for readable output
        const formattedOrderbook = {
          ticker: params.ticker,
          yes_bids: yesBids.map((level) => ({
            price: cents(level[0]),
            quantity: fp(level[1]),
          })),
          no_bids: noBids.map((level) => ({
            price: cents(level[0]),
            quantity: fp(level[1]),
          })),
        };

        // Calculate summary stats (best bid is the last/highest level)
        const summary = {
          yes_levels: yesBids.length,
          no_levels: noBids.length,
          best_yes_bid:
            yesBids.length > 0 ? cents(yesBids[yesBids.length - 1][0]) : null,
          best_no_bid:
            noBids.length > 0 ? cents(noBids[noBids.length - 1][0]) : null,
        };

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  ...formattedOrderbook,
                  summary,
                },
                null,
                2
              ),
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
              text: `Error fetching orderbook for ${params.ticker}: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
