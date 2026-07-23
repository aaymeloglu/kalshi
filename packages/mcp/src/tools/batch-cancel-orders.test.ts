import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBatchCancelOrders } from "./batch-cancel-orders.js";
import type { OrdersV2Client } from "../orders-v2.js";

describe("batch_cancel_orders tool", () => {
  let server: McpServer;
  let mockOrdersV2: {
    batchCancelOrders: ReturnType<typeof vi.fn>;
  } & Partial<OrdersV2Client>;
  let registeredTool: {
    name: string;
    handler: (params: Record<string, unknown>) => Promise<unknown>;
  };

  beforeEach(() => {
    server = {
      tool: vi.fn((_name, _desc, _schema, handler) => {
        registeredTool = { name: _name, handler };
      }),
    } as unknown as McpServer;

    mockOrdersV2 = {
      batchCancelOrders: vi.fn().mockResolvedValue({
        orders: [
          { order_id: "o1", reduced_by: "1.00", ts_ms: 1 },
          { order_id: "o2", reduced_by: "0.00", error: { message: "not found" } },
        ],
      }),
    };

    registerBatchCancelOrders(server, mockOrdersV2 as unknown as OrdersV2Client);
  });

  it("registers the batch_cancel_orders tool", () => {
    expect(server.tool).toHaveBeenCalledWith(
      "batch_cancel_orders",
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );
  });

  it("cancels the batch via the V2 client and returns per-order results", async () => {
    const result = await registeredTool.handler({ order_ids: ["o1", "o2"] });

    expect(mockOrdersV2.batchCancelOrders).toHaveBeenCalledWith(["o1", "o2"]);
    const parsed = JSON.parse(
      (result as { content: [{ text: string }] }).content[0].text
    );
    expect(parsed.success).toBe(true);
    expect(parsed.orders).toHaveLength(2);
    expect(parsed.orders[1].error.message).toBe("not found");
  });

  it("surfaces API errors as an isError result", async () => {
    mockOrdersV2.batchCancelOrders.mockRejectedValueOnce(
      new Error("too many orders")
    );
    const result = await registeredTool.handler({ order_ids: ["o1"] });
    expect((result as { isError?: boolean }).isError).toBe(true);
    expect(
      (result as { content: [{ text: string }] }).content[0].text
    ).toContain("too many orders");
  });
});
