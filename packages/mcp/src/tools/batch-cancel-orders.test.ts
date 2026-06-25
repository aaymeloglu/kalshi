import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { OrdersApi } from "kalshi-typescript";
import { registerBatchCancelOrders } from "./batch-cancel-orders.js";

vi.mock("kalshi-typescript", () => ({
  OrdersApi: vi.fn(),
}));

describe("batch_cancel_orders tool", () => {
  let server: McpServer;
  let mockOrdersApi: { batchCancelOrders: ReturnType<typeof vi.fn> };
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

    mockOrdersApi = {
      batchCancelOrders: vi.fn(),
    };

    registerBatchCancelOrders(server, mockOrdersApi as unknown as OrdersApi);
  });

  it("should register the batch_cancel_orders tool", () => {
    expect(server.tool).toHaveBeenCalledWith(
      "batch_cancel_orders",
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );
  });

  it("should return a deprecation notice instead of canceling orders", async () => {
    const result = await registeredTool.handler({
      order_ids: ["order-123", "order-456"],
    });

    expect((result as { isError?: boolean }).isError).toBe(true);

    const parsed = JSON.parse(
      (result as { content: [{ text: string }] }).content[0].text
    );
    expect(parsed.success).toBe(false);
    expect(parsed.error).toBe("tool_disabled_v1_order_endpoint_removed");

    // The stubbed tool no longer touches the SDK.
    expect(mockOrdersApi.batchCancelOrders).not.toHaveBeenCalled();
  });
});

