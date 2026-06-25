import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PortfolioApi } from "kalshi-typescript";
import { registerGetSettlements } from "./get-settlements.js";

vi.mock("kalshi-typescript", () => ({
  PortfolioApi: vi.fn(),
}));

describe("get_settlements tool", () => {
  let server: McpServer;
  let mockPortfolioApi: { getSettlements: ReturnType<typeof vi.fn> };
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

    mockPortfolioApi = {
      getSettlements: vi.fn(),
    };

    registerGetSettlements(
      server,
      mockPortfolioApi as unknown as PortfolioApi
    );
  });

  it("should register the get_settlements tool", () => {
    expect(server.tool).toHaveBeenCalledWith(
      "get_settlements",
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );
  });

  it("should return formatted settlements on success", async () => {
    const mockSettlements = [
      {
        ticker: "KXBTC-25JAN03-B100500",
        event_ticker: "KXBTC",
        market_result: "yes",
        yes_count_fp: "10",
        yes_total_cost_dollars: "4.50",
        no_count_fp: "0",
        no_total_cost_dollars: "0",
        revenue: 1000, // cents (gross payout)
        fee_cost: "0",
        settled_time: "2024-12-21T00:00:00Z",
      },
      {
        ticker: "KXINX-25JAN03-B19500",
        event_ticker: "KXINX",
        market_result: "no",
        yes_count_fp: "5",
        yes_total_cost_dollars: "3.00",
        no_count_fp: "0",
        no_total_cost_dollars: "0",
        revenue: 0, // cents
        fee_cost: "0",
        settled_time: "2024-12-21T01:00:00Z",
      },
    ];

    mockPortfolioApi.getSettlements.mockResolvedValue({
      data: {
        settlements: mockSettlements,
        cursor: "next-cursor",
      },
    });

    const result = await registeredTool.handler({});

    const parsed = JSON.parse(
      (result as { content: [{ text: string }] }).content[0].text
    );
    expect(parsed.settlements).toHaveLength(2);
    expect(parsed.settlements[0].ticker).toBe("KXBTC-25JAN03-B100500");
    expect(parsed.settlements[0].market_result).toBe("yes");
    expect(parsed.settlements[0].yes_count).toBe(10);
    expect(parsed.settlements[0].revenue_dollars).toBe(10);
    expect(parsed.settlements[0].net_pnl_dollars).toBe(5.5);
    expect(parsed.settlements[1].net_pnl_dollars).toBe(-3);
    expect(parsed.summary.total).toBe(2);
    expect(parsed.summary.total_cost_dollars).toBe(7.5);
    expect(parsed.summary.total_revenue_dollars).toBe(10);
    expect(parsed.summary.net_pnl_dollars).toBe(2.5);
    expect(parsed.summary.net_positive).toBe(1);
    expect(parsed.summary.net_negative).toBe(1);
  });

  it("should filter by ticker", async () => {
    mockPortfolioApi.getSettlements.mockResolvedValue({
      data: { settlements: [], cursor: null },
    });

    await registeredTool.handler({ ticker: "KXBTC-25JAN03-B100500" });

    expect(mockPortfolioApi.getSettlements).toHaveBeenCalledWith(
      undefined, // limit
      undefined, // cursor
      "KXBTC-25JAN03-B100500", // ticker
      undefined, // event_ticker
      undefined, // min_ts
      undefined // max_ts
    );
  });

  it("should filter by event_ticker", async () => {
    mockPortfolioApi.getSettlements.mockResolvedValue({
      data: { settlements: [], cursor: null },
    });

    await registeredTool.handler({ event_ticker: "KXBTC" });

    expect(mockPortfolioApi.getSettlements).toHaveBeenCalledWith(
      undefined, // limit
      undefined, // cursor
      undefined, // ticker
      "KXBTC", // event_ticker
      undefined, // min_ts
      undefined // max_ts
    );
  });

  it("should return error on API failure", async () => {
    mockPortfolioApi.getSettlements.mockRejectedValue(
      new Error("Unauthorized")
    );

    const result = await registeredTool.handler({});

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: "Error fetching settlements: Unauthorized",
        },
      ],
      isError: true,
    });
  });
});

