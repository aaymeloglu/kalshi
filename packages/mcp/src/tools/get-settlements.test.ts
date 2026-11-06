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

  it("credits the $1 netting payout when YES and NO were both held (round trip)", async () => {
    // Real case (GOVPARTYWI-26-R): bought 100 YES @ 52¢, then 100 NO @ 39¢.
    // Kalshi nets each YES+NO pair for $1 immediately, so `revenue` at
    // settlement is 0. True P&L = 100 − 52 − 39 − 3.41 = +5.59, not −94.41.
    mockPortfolioApi.getSettlements.mockResolvedValue({
      data: {
        settlements: [
          {
            ticker: "GOVPARTYWI-26-R",
            event_ticker: "GOVPARTYWI-26",
            market_result: "no",
            yes_count_fp: "100",
            yes_total_cost_dollars: "52",
            no_count_fp: "100",
            no_total_cost_dollars: "39",
            revenue: 0,
            fee_cost: "3.41",
            settled_time: "2026-11-04T04:30:10Z",
          },
          {
            // Partial netting: 40 pairs netted ($40), 60 YES left settle YES ($60).
            ticker: "PARTIAL-T1",
            event_ticker: "PARTIAL",
            market_result: "yes",
            yes_count_fp: "100",
            yes_total_cost_dollars: "50",
            no_count_fp: "40",
            no_total_cost_dollars: "20",
            revenue: 6000,
            fee_cost: "1",
            settled_time: "2026-11-04T04:30:10Z",
          },
        ],
        cursor: null,
      },
    });

    const result = await registeredTool.handler({});
    const parsed = JSON.parse(
      (result as { content: [{ text: string }] }).content[0].text
    );
    expect(parsed.settlements[0].netted_pairs).toBe(100);
    expect(parsed.settlements[0].netting_payout_dollars).toBe(100);
    expect(parsed.settlements[0].net_pnl_dollars).toBe(5.59);
    expect(parsed.settlements[1].netted_pairs).toBe(40);
    expect(parsed.settlements[1].net_pnl_dollars).toBe(29); // 60 + 40 − 70 − 1
    expect(parsed.summary.net_pnl_dollars).toBe(34.59);
    expect(parsed.summary.net_positive).toBe(2);
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

