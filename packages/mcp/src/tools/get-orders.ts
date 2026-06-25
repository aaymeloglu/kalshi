/**
 * Get Orders Tool
 *
 * MCP tool for fetching the user's orders on Kalshi markets.
 * Returns order details including status, prices, quantities, and fill information.
 *
 * @module tools/get-orders
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { OrdersApi } from "kalshi-typescript";
import { z } from "zod";
import { cents, fp } from "../schema.js";

/** Schema for get_orders tool parameters */
const GetOrdersSchema = z.object({
  ticker: z.string().optional().describe("Filter by market ticker"),
  event_ticker: z
    .string()
    .optional()
    .describe("Filter by event ticker (comma-separated, max 10)"),
  status: z
    .enum(["resting", "canceled", "executed"])
    .optional()
    .describe("Filter by order status"),
  limit: z
    .number()
    .min(1)
    .max(200)
    .optional()
    .describe("Number of orders to return (default 100, max 200)"),
  cursor: z
    .string()
    .optional()
    .describe("Pagination cursor from previous response"),
  min_ts: z
    .number()
    .optional()
    .describe("Filter orders after this Unix timestamp"),
  max_ts: z
    .number()
    .optional()
    .describe("Filter orders before this Unix timestamp"),
});

type GetOrdersInput = z.infer<typeof GetOrdersSchema>;

/**
 * Registers the get_orders tool with the MCP server.
 *
 * @param server - MCP server instance to register the tool with
 * @param ordersApi - Kalshi Orders API client
 */
export function registerGetOrders(server: McpServer, ordersApi: OrdersApi) {
  server.tool(
    "get_orders",
    "Get your orders on Kalshi. Shows order details including status, prices, and fill information.",
    GetOrdersSchema.shape,
    async (params: GetOrdersInput) => {
      try {
        const response = await ordersApi.getOrders(
          params.ticker,
          params.event_ticker,
          params.min_ts,
          params.max_ts,
          params.status,
          params.limit,
          params.cursor
        );

        const orders = response.data.orders || [];
        const cursor = response.data.cursor;

        // Format orders for readable output
        const formattedOrders = orders.map((order) => ({
          order_id: order.order_id,
          ticker: order.ticker,
          // Order details
          side: order.side,
          action: order.action,
          type: order.type,
          status: order.status,
          // Pricing
          yes_price: cents(order.yes_price_dollars),
          no_price: cents(order.no_price_dollars),
          // Quantities
          initial_count: fp(order.initial_count_fp),
          fill_count: fp(order.fill_count_fp),
          remaining_count: fp(order.remaining_count_fp),
          // Timing
          created_time: order.created_time,
          expiration_time: order.expiration_time,
          // Fill costs
          taker_fill_cost: fp(order.taker_fill_cost_dollars),
          maker_fill_cost: fp(order.maker_fill_cost_dollars),
          taker_fees: fp(order.taker_fees_dollars),
          maker_fees: fp(order.maker_fees_dollars),
        }));

        // Calculate summary
        const restingOrders = orders.filter((o) => o.status === "resting");
        const executedOrders = orders.filter((o) => o.status === "executed");

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  orders: formattedOrders,
                  summary: {
                    total: orders.length,
                    resting: restingOrders.length,
                    executed: executedOrders.length,
                  },
                  cursor,
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
              text: `Error fetching orders: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

