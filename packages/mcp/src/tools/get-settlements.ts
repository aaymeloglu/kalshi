/**
 * Get Settlements Tool
 *
 * MCP tool for fetching the user's settlement history on Kalshi.
 * Returns settlement details including market outcomes and payouts.
 *
 * @module tools/get-settlements
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PortfolioApi } from "kalshi-typescript";
import { z } from "zod";
import { fp } from "../schema.js";

/** Schema for get_settlements tool parameters */
const GetSettlementsSchema = z.object({
  ticker: z.string().optional().describe("Filter by market ticker"),
  event_ticker: z.string().optional().describe("Filter by event ticker"),
  limit: z
    .number()
    .min(1)
    .max(200)
    .optional()
    .describe("Number of settlements to return (default 100, max 200)"),
  cursor: z
    .string()
    .optional()
    .describe("Pagination cursor from previous response"),
  min_ts: z
    .number()
    .optional()
    .describe("Filter settlements after this Unix timestamp"),
  max_ts: z
    .number()
    .optional()
    .describe("Filter settlements before this Unix timestamp"),
});

type GetSettlementsInput = z.infer<typeof GetSettlementsSchema>;

/**
 * Registers the get_settlements tool with the MCP server.
 *
 * @param server - MCP server instance to register the tool with
 * @param portfolioApi - Kalshi Portfolio API client
 */
export function registerGetSettlements(
  server: McpServer,
  portfolioApi: PortfolioApi
) {
  server.tool(
    "get_settlements",
    "Get your settlement history on Kalshi. Shows settled market outcomes and your payouts.",
    GetSettlementsSchema.shape,
    async (params: GetSettlementsInput) => {
      try {
        const response = await portfolioApi.getSettlements(
          params.limit,
          params.cursor,
          params.ticker,
          params.event_ticker,
          params.min_ts,
          params.max_ts
        );

        const settlements = response.data.settlements || [];
        const cursor = response.data.cursor;

        // Format settlements for readable output.
        //
        // Net P&L is the only honest measure of a settlement's result:
        //   net = revenue - (yes_total_cost + no_total_cost) - fees
        // `revenue` is the gross payout in CENTS; cost/fee fields are dollar
        // fixed-point strings under the `*_dollars` schema. The legacy
        // `yes_total_cost`/`yes_count` keys are no longer populated.
        const formattedSettlements = settlements.map((settlement) => {
          const yesCost = fp(settlement.yes_total_cost_dollars) ?? 0;
          const noCost = fp(settlement.no_total_cost_dollars) ?? 0;
          const fees = fp(settlement.fee_cost) ?? 0;
          const revenueDollars = (settlement.revenue ?? 0) / 100;
          const netPnl = revenueDollars - yesCost - noCost - fees;
          return {
            ticker: settlement.ticker,
            event_ticker: settlement.event_ticker,
            market_result: settlement.market_result,
            // Position at settlement
            no_count: fp(settlement.no_count_fp),
            no_total_cost_dollars: noCost,
            yes_count: fp(settlement.yes_count_fp),
            yes_total_cost_dollars: yesCost,
            // Economics (all in dollars)
            revenue_dollars: Number(revenueDollars.toFixed(2)),
            fees_dollars: Number(fees.toFixed(2)),
            net_pnl_dollars: Number(netPnl.toFixed(2)),
            // Timing
            settled_time: settlement.settled_time,
          };
        });

        // Summary: real net P&L, not gross revenue. The previous
        // `total_revenue_cents`/`profitable_settlements` summed gross payouts
        // and ignored cost basis entirely, badly overstating performance.
        const round2 = (n: number) => Number(n.toFixed(2));
        const totalCost = formattedSettlements.reduce(
          (sum, s) => sum + s.yes_total_cost_dollars + s.no_total_cost_dollars,
          0
        );
        const totalRevenue = formattedSettlements.reduce(
          (sum, s) => sum + s.revenue_dollars,
          0
        );
        const totalFees = formattedSettlements.reduce(
          (sum, s) => sum + s.fees_dollars,
          0
        );
        const netPnl = totalRevenue - totalCost - totalFees;
        const netPositive = formattedSettlements.filter(
          (s) => s.net_pnl_dollars > 0
        ).length;
        const netNegative = formattedSettlements.filter(
          (s) => s.net_pnl_dollars < 0
        ).length;

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  settlements: formattedSettlements,
                  summary: {
                    total: settlements.length,
                    total_cost_dollars: round2(totalCost),
                    total_revenue_dollars: round2(totalRevenue),
                    total_fees_dollars: round2(totalFees),
                    net_pnl_dollars: round2(netPnl),
                    net_positive: netPositive,
                    net_negative: netNegative,
                  },
                  cursor,
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
              text: `Error fetching settlements: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

