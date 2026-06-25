/**
 * Batch Cancel Orders Tool
 *
 * MCP tool for canceling multiple orders at once on Kalshi.
 * Can cancel up to 20 orders in a single request.
 *
 * @module tools/batch-cancel-orders
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { OrdersApi } from "kalshi-typescript";
import { z } from "zod";
import { orderWriteDeprecated } from "../deprecation.js";

/** Schema for batch_cancel_orders tool parameters */
const BatchCancelOrdersSchema = z.object({
  order_ids: z
    .array(z.string())
    .min(1)
    .max(20)
    .describe("Array of order IDs to cancel (max 20)"),
});

type BatchCancelOrdersInput = z.infer<typeof BatchCancelOrdersSchema>;

/**
 * Registers the batch_cancel_orders tool with the MCP server.
 *
 * @param server - MCP server instance to register the tool with
 * @param _ordersApi - Kalshi Orders API client (unused while stubbed)
 */
export function registerBatchCancelOrders(
  server: McpServer,
  _ordersApi: OrdersApi
) {
  server.tool(
    "batch_cancel_orders",
    "DISABLED: batch order cancellation is pending migration to Kalshi's V2 order " +
      "API (the V1 endpoint this used now returns HTTP 410). Returns a deprecation notice.",
    BatchCancelOrdersSchema.shape,
    // Stubbed until the V2 batch cancel endpoint (batchCancelOrdersV2) is wired up.
    async (_params: BatchCancelOrdersInput) =>
      orderWriteDeprecated("batch_cancel_orders")
  );
}

