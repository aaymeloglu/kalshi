import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { OrdersApi } from "kalshi-typescript";
import { registerCancelOrder } from "./cancel-order.js";

// Mock the OrdersApi
vi.mock("kalshi-typescript", () => ({
  OrdersApi: vi.fn(),
}));

describe("cancel_order tool", () => {
  let server: McpServer;
  let mockOrdersApi: { cancelOrder: ReturnType<typeof vi.fn> };
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
      cancelOrder: vi.fn(),
    };

    registerCancelOrder(server, mockOrdersApi as unknown as OrdersApi);
  });

  it("should register the cancel_order tool", () => {
    expect(server.tool).toHaveBeenCalledWith(
      "cancel_order",
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );
  });

  it("should return a deprecation notice instead of canceling an order", async () => {
    const result = await registeredTool.handler({ order_id: "order-123" });

    expect((result as { isError?: boolean }).isError).toBe(true);

    const parsed = JSON.parse(
      (result as { content: [{ text: string }] }).content[0].text
    );
    expect(parsed.success).toBe(false);
    expect(parsed.error).toBe("tool_disabled_v1_order_endpoint_removed");

    // The stubbed tool no longer touches the SDK.
    expect(mockOrdersApi.cancelOrder).not.toHaveBeenCalled();
  });
});

