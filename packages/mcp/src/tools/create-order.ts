/**
 * Create Order Tool
 *
 * Places a limit order on Kalshi via the V2 order API (`/portfolio/events/orders`).
 * Kalshi retired the V1 write endpoints (HTTP 410); this uses the V2 bid/ask book
 * through the self-contained {@link OrdersV2Client}.
 *
 * ⚠️ CAUTION: this places a REAL order with REAL money on a live market.
 *
 * @module tools/create-order
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  type OrdersV2Client,
  toCreateOrderV2Request,
  statusFromV2Counts,
} from "../orders-v2.js";

/** Schema for create_order tool parameters */
const CreateOrderSchema = z.object({
  ticker: z.string().describe("Market ticker to place the order on"),
  side: z.enum(["yes", "no"]).describe("Contract side: 'yes' or 'no'"),
  action: z.enum(["buy", "sell"]).describe("Action: 'buy' or 'sell'"),
  count: z.number().int().min(1).describe("Number of contracts"),
  yes_price: z
    .number()
    .min(1)
    .max(99)
    .optional()
    .describe("Limit price in cents (1-99). Required when side='yes'."),
  no_price: z
    .number()
    .min(1)
    .max(99)
    .optional()
    .describe("Limit price in cents (1-99). Required when side='no'."),
  post_only: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      "If true, the order only rests as a maker and is rejected if it would " +
        "cross the spread (never takes). Default false."
    ),
  client_order_id: z
    .string()
    .optional()
    .describe("Optional client-provided ID for idempotency"),
});

type CreateOrderInput = z.infer<typeof CreateOrderSchema>;

/**
 * Registers the create_order tool with the MCP server.
 *
 * @param server - MCP server instance to register the tool with
 * @param ordersV2 - V2 order client used to place the order
 */
export function registerCreateOrder(
  server: McpServer,
  ordersV2: OrdersV2Client
) {
  server.tool(
    "create_order",
    "Place a REAL limit order on a Kalshi market (V2 order API). This spends " +
      "real money. Provide yes_price when side='yes' or no_price when side='no' " +
      "(both in cents, 1-99). Use post_only=true to guarantee maker-only.",
    CreateOrderSchema.shape,
    async (params: CreateOrderInput) => {
      const priceCents =
        params.side === "yes" ? params.yes_price : params.no_price;
      if (priceCents == null) {
        return {
          content: [
            {
              type: "text" as const,
              text:
                `Missing price: side='${params.side}' requires ` +
                `${params.side === "yes" ? "yes_price" : "no_price"} (in cents).`,
            },
          ],
          isError: true,
        };
      }

      const body = toCreateOrderV2Request({
        ticker: params.ticker,
        side: params.side,
        action: params.action,
        priceCents,
        count: params.count,
        clientOrderId: params.client_order_id,
        postOnly: params.post_only,
      });

      try {
        const res = await ordersV2.createOrder(body);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: true,
                  order_id: res.order_id,
                  client_order_id: res.client_order_id,
                  status: statusFromV2Counts(
                    res.fill_count,
                    res.remaining_count
                  ),
                  fill_count: res.fill_count,
                  remaining_count: res.remaining_count,
                  average_fill_price: res.average_fill_price,
                  submitted: {
                    ticker: body.ticker,
                    book_side: body.side,
                    price_dollars: body.price,
                    count: body.count,
                    post_only: body.post_only,
                  },
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
              text: `Error placing order for ${params.ticker}: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
