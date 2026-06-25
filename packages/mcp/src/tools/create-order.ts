/**
 * Create Order Tool
 *
 * MCP tool for placing new orders on Kalshi markets.
 * Includes pre-flight validation to check market status, balance, and price reasonableness.
 *
 * ⚠️ CAUTION: This tool executes real trades with real money.
 *
 * @module tools/create-order
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { OrdersApi, MarketApi, PortfolioApi } from "kalshi-typescript";
import { z } from "zod";
import { orderWriteDeprecated } from "../deprecation.js";

/** Schema for create_order tool parameters */
const CreateOrderSchema = z.object({
  ticker: z.string().describe("Market ticker to place order on"),
  side: z.enum(["yes", "no"]).describe("Side of the order: 'yes' or 'no'"),
  action: z.enum(["buy", "sell"]).describe("Action: 'buy' or 'sell'"),
  count: z.number().min(1).describe("Number of contracts"),
  type: z
    .enum(["limit", "market"])
    .optional()
    .default("limit")
    .describe("Order type (default: limit)"),
  yes_price: z
    .number()
    .min(1)
    .max(99)
    .optional()
    .describe("Yes price in cents (1-99). Required for limit orders on yes side."),
  no_price: z
    .number()
    .min(1)
    .max(99)
    .optional()
    .describe("No price in cents (1-99). Required for limit orders on no side."),
  client_order_id: z
    .string()
    .optional()
    .describe("Optional client-provided order ID for idempotency"),
  expiration_ts: z
    .number()
    .optional()
    .describe("Unix timestamp when order expires"),
});

type CreateOrderInput = z.infer<typeof CreateOrderSchema>;

/**
 * Registers the create_order tool with the MCP server.
 *
 * @param server - MCP server instance to register the tool with
 * @param ordersApi - Kalshi Orders API client
 * @param marketApi - Kalshi Market API client (for validation)
 * @param portfolioApi - Kalshi Portfolio API client (for balance check)
 */
export function registerCreateOrder(
  server: McpServer,
  _ordersApi: OrdersApi,
  _marketApi: MarketApi,
  _portfolioApi: PortfolioApi
) {
  server.tool(
    "create_order",
    "DISABLED: order placement is pending migration to Kalshi's V2 order API " +
      "(the V1 endpoint this used now returns HTTP 410). Returns a deprecation notice.",
    CreateOrderSchema.shape,
    // Input schema is retained to document the intended interface; the handler
    // is stubbed until the V2 (bid/ask) order model is implemented.
    async (_params: CreateOrderInput) => orderWriteDeprecated("create_order")
  );
}

