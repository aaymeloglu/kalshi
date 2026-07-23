import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCreateOrder } from "./create-order.js";
import type { OrdersV2Client } from "../orders-v2.js";

describe("create_order tool", () => {
  let server: McpServer;
  let mockOrdersV2: { createOrder: ReturnType<typeof vi.fn> } & Partial<OrdersV2Client>;
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
      createOrder: vi.fn().mockResolvedValue({
        order_id: "ord-1",
        fill_count: "0.00",
        remaining_count: "5.00",
        ts_ms: 123,
      }),
    };

    registerCreateOrder(server, mockOrdersV2 as unknown as OrdersV2Client);
  });

  it("registers the create_order tool", () => {
    expect(server.tool).toHaveBeenCalledWith(
      "create_order",
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );
  });

  it("places a YES buy as a bid at the yes_price and returns status", async () => {
    const result = await registeredTool.handler({
      ticker: "KXFEDDECISION-26JUL-H0",
      side: "yes",
      action: "buy",
      count: 5,
      yes_price: 77,
      post_only: false,
    });

    expect(mockOrdersV2.createOrder).toHaveBeenCalledTimes(1);
    expect(mockOrdersV2.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        ticker: "KXFEDDECISION-26JUL-H0",
        side: "bid",
        price: "0.7700",
        count: "5.00",
        post_only: false,
      })
    );
    const parsed = JSON.parse(
      (result as { content: [{ text: string }] }).content[0].text
    );
    expect(parsed.success).toBe(true);
    expect(parsed.order_id).toBe("ord-1");
    expect(parsed.status).toBe("open");
  });

  it("inverts a NO buy onto the YES book (ask at 100 - no_price)", async () => {
    await registeredTool.handler({
      ticker: "T",
      side: "no",
      action: "buy",
      count: 1,
      no_price: 25,
    });
    expect(mockOrdersV2.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ side: "ask", price: "0.7500" })
    );
  });

  it("errors without calling the API when the required price is missing", async () => {
    const result = await registeredTool.handler({
      ticker: "T",
      side: "yes",
      action: "buy",
      count: 1,
      // yes_price omitted
    });
    expect((result as { isError?: boolean }).isError).toBe(true);
    expect(mockOrdersV2.createOrder).not.toHaveBeenCalled();
  });

  it("surfaces API errors as an isError result", async () => {
    mockOrdersV2.createOrder.mockRejectedValueOnce(
      new Error("OrdersV2 POST /portfolio/events/orders: missing write permission")
    );
    const result = await registeredTool.handler({
      ticker: "T",
      side: "yes",
      action: "buy",
      count: 1,
      yes_price: 50,
    });
    expect((result as { isError?: boolean }).isError).toBe(true);
    expect(
      (result as { content: [{ text: string }] }).content[0].text
    ).toContain("missing write permission");
  });
});
