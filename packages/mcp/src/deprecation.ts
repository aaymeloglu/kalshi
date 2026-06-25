/**
 * Deprecation notice for the order-write tools.
 *
 * Kalshi retired the V1 order-write endpoints; they now return HTTP 410
 * (`deprecated_v1_order_endpoint`). The V2 replacement uses a different
 * order-book (bid/ask) model. Until those tools are migrated to V2, they return
 * the notice below instead of calling the dead routes. All read tools (markets,
 * events, fills, settlements, positions, orderbook, trades, orders) are fully
 * functional on the current schema.
 *
 * @module deprecation
 */

/** Standard MCP tool result shape returned by the stubbed order-write tools. */
export function orderWriteDeprecated(tool: string) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            success: false,
            error: "tool_disabled_v1_order_endpoint_removed",
            message:
              `${tool} is disabled in this build. Kalshi retired the V1 ` +
              "order-write endpoints (HTTP 410 deprecated_v1_order_endpoint). " +
              "Order placement is pending migration to the V2 order API, which " +
              "uses a bid/ask order-book model. Read-only market and portfolio " +
              "tools are fully functional.",
            docs: "https://docs.kalshi.com/api-reference/orders/create-order",
          },
          null,
          2
        ),
      },
    ],
    isError: true,
  };
}
