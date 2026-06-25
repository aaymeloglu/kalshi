/**
 * Cancel Order Tool
 *
 * MCP tool for canceling an existing order on Kalshi.
 * Only orders with 'resting' status can be canceled.
 *
 * @module tools/cancel-order
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { OrdersApi } from "kalshi-typescript";
import { z } from "zod";
import { orderWriteDeprecated } from "../deprecation.js";

/** Schema for cancel_order tool parameters */
const CancelOrderSchema = z.object({
  order_id: z.string().describe("The order ID to cancel"),
});

type CancelOrderInput = z.infer<typeof CancelOrderSchema>;

/**
 * Registers the cancel_order tool with the MCP server.
 *
 * @param server - MCP server instance to register the tool with
 * @param _ordersApi - Kalshi Orders API client (unused while stubbed)
 */
export function registerCancelOrder(server: McpServer, _ordersApi: OrdersApi) {
  server.tool(
    "cancel_order",
    "DISABLED: order cancellation is pending migration to Kalshi's V2 order API " +
      "(the V1 endpoint this used now returns HTTP 410). Returns a deprecation notice.",
    CancelOrderSchema.shape,
    // Stubbed until the V2 cancel endpoint (cancelOrderV2) is wired up.
    async (_params: CancelOrderInput) => orderWriteDeprecated("cancel_order")
  );
}

