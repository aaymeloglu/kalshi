import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { OrdersApi, MarketApi, PortfolioApi } from "kalshi-typescript";
import { registerCreateOrder } from "./create-order.js";

vi.mock("kalshi-typescript", () => ({
  OrdersApi: vi.fn(),
  CreateOrderRequestSideEnum: {
    Yes: "yes",
    No: "no",
  },
  CreateOrderRequestActionEnum: {
    Buy: "buy",
    Sell: "sell",
  },
  CreateOrderRequestTypeEnum: {
    Limit: "limit",
    Market: "market",
  },
}));

describe("create_order tool", () => {
  let server: McpServer;
  let mockOrdersApi: { createOrder: ReturnType<typeof vi.fn> };
  let mockMarketApi: { getMarket: ReturnType<typeof vi.fn> };
  let mockPortfolioApi: { getBalance: ReturnType<typeof vi.fn> };
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
      createOrder: vi.fn(),
    };

    mockMarketApi = {
      getMarket: vi.fn().mockResolvedValue({
        data: {
          market: {
            ticker: "KXBTC-25JAN03-B100500",
            status: "open",
            yes_ask: 50,
            yes_bid: 48,
          },
        },
      }),
    };

    mockPortfolioApi = {
      getBalance: vi.fn().mockResolvedValue({
        data: { balance: 100000 }, // $1000 balance
      }),
    };

    registerCreateOrder(
      server,
      mockOrdersApi as unknown as OrdersApi,
      mockMarketApi as unknown as MarketApi,
      mockPortfolioApi as unknown as PortfolioApi
    );
  });

  it("should register the create_order tool", () => {
    expect(server.tool).toHaveBeenCalledWith(
      "create_order",
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );
  });

  it("should return a deprecation notice instead of placing an order", async () => {
    const result = await registeredTool.handler({
      ticker: "KXBTC-25JAN03-B100500",
      side: "yes",
      action: "buy",
      count: 10,
      yes_price: 45,
    });

    expect((result as { isError?: boolean }).isError).toBe(true);

    const parsed = JSON.parse(
      (result as { content: [{ text: string }] }).content[0].text
    );
    expect(parsed.success).toBe(false);
    expect(parsed.error).toBe("tool_disabled_v1_order_endpoint_removed");

    // The stubbed tool no longer touches the SDK.
    expect(mockOrdersApi.createOrder).not.toHaveBeenCalled();
  });
});

