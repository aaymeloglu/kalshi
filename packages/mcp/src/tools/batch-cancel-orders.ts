/**
 * Batch Cancel Orders Tool
 *
 * Cancels up to 20 resting orders in one V2 request
 * (`DELETE /portfolio/events/orders/batched`).
 *
 * @module tools/batch-cancel-orders
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { type OrdersV2Client } from "../orders-v2.js";

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
 * @param ordersV2 - V2 order client used to cancel the orders
 */
export function registerBatchCancelOrders(
  server: McpServer,
  ordersV2: OrdersV2Client
) {
  server.tool(
    "batch_cancel_orders",
    "Cancel up to 20 resting orders in a single request by their order IDs " +
      "(V2 order API). Returns per-order results, including any per-order errors.",
    BatchCancelOrdersSchema.shape,
    async (params: BatchCancelOrdersInput) => {
      try {
        const res = await ordersV2.batchCancelOrders(params.order_ids);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { success: true, orders: res.orders },
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
              text: `Error batch-canceling orders: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
