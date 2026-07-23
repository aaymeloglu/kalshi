/**
 * Cancel Order Tool
 *
 * Cancels a resting order via the Kalshi V2 order API
 * (`DELETE /portfolio/events/orders/{id}`).
 *
 * @module tools/cancel-order
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { type OrdersV2Client } from "../orders-v2.js";

/** Schema for cancel_order tool parameters */
const CancelOrderSchema = z.object({
  order_id: z.string().describe("The order ID to cancel"),
});

type CancelOrderInput = z.infer<typeof CancelOrderSchema>;

/**
 * Registers the cancel_order tool with the MCP server.
 *
 * @param server - MCP server instance to register the tool with
 * @param ordersV2 - V2 order client used to cancel the order
 */
export function registerCancelOrder(server: McpServer, ordersV2: OrdersV2Client) {
  server.tool(
    "cancel_order",
    "Cancel a resting order on Kalshi by its order ID (V2 order API). Returns " +
      "how many contracts the resting order was reduced by.",
    CancelOrderSchema.shape,
    async (params: CancelOrderInput) => {
      try {
        const res = await ordersV2.cancelOrder(params.order_id);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: true,
                  order_id: res.order_id,
                  reduced_by: res.reduced_by,
                  ts_ms: res.ts_ms,
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
              text: `Error canceling order ${params.order_id}: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
