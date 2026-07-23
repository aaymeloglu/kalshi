import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCancelOrder } from "./cancel-order.js";
import type { OrdersV2Client } from "../orders-v2.js";

describe("cancel_order tool", () => {
  let server: McpServer;
  let mockOrdersV2: { cancelOrder: ReturnType<typeof vi.fn> } & Partial<OrdersV2Client>;
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
      cancelOrder: vi.fn().mockResolvedValue({
        order_id: "order-123",
        reduced_by: "3.00",
        ts_ms: 99,
      }),
    };

    registerCancelOrder(server, mockOrdersV2 as unknown as OrdersV2Client);
  });

  it("registers the cancel_order tool", () => {
    expect(server.tool).toHaveBeenCalledWith(
      "cancel_order",
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );
  });

  it("cancels the order via the V2 client and returns reduced_by", async () => {
    const result = await registeredTool.handler({ order_id: "order-123" });

    expect(mockOrdersV2.cancelOrder).toHaveBeenCalledWith("order-123");
    const parsed = JSON.parse(
      (result as { content: [{ text: string }] }).content[0].text
    );
    expect(parsed.success).toBe(true);
    expect(parsed.order_id).toBe("order-123");
    expect(parsed.reduced_by).toBe("3.00");
  });

  it("surfaces API errors as an isError result", async () => {
    mockOrdersV2.cancelOrder.mockRejectedValueOnce(new Error("order not found"));
    const result = await registeredTool.handler({ order_id: "missing" });
    expect((result as { isError?: boolean }).isError).toBe(true);
    expect(
      (result as { content: [{ text: string }] }).content[0].text
    ).toContain("order not found");
  });
});
