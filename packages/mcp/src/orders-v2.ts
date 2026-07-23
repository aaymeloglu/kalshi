/**
 * Kalshi Create Order V2 client
 *
 * Kalshi retired the V1 `/portfolio/orders` write endpoints (HTTP 410), and the
 * `kalshi-typescript` SDK still only exposes those dead V1 paths. This is a thin,
 * self-contained client that signs RSA-PSS requests against the V2
 * `/trade-api/v2/portfolio/events/orders*` endpoints — no SDK dependency.
 *
 * Ported from the upstream market-maker module (`core/src/mm/orders-v2.ts`) and
 * trimmed to what the read-mostly MCP order tools need. All prices cross the wire
 * as dollar fixed-point strings; the V2 book is a single YES book, so NO-side
 * intents are converted to the equivalent YES bid/ask.
 *
 * @module orders-v2
 */

import * as crypto from "crypto";
import axios, { type AxiosInstance } from "axios";
import type { KalshiConfig } from "./config.js";

/** Order intent side, in Kalshi's yes/no contract terms. */
export type Side = "yes" | "no";
/** Order intent action. */
export type Action = "buy" | "sell";
/** V2 order-book side (the exchange models a single YES book). */
export type BookSide = "bid" | "ask";

export interface CreateOrderV2Request {
  ticker: string;
  client_order_id?: string;
  side: BookSide;
  count: string;
  price: string;
  time_in_force: "fill_or_kill" | "good_till_canceled" | "immediate_or_cancel";
  self_trade_prevention_type: "taker_at_cross" | "maker";
  post_only?: boolean;
}

export interface CreateOrderV2Response {
  order_id: string;
  client_order_id?: string;
  fill_count: string;
  remaining_count: string;
  average_fill_price?: string;
  average_fee_paid?: string;
  ts_ms: number;
}

export interface CancelOrderV2Response {
  order_id: string;
  client_order_id?: string;
  reduced_by: string;
  ts_ms: number;
}

export interface BatchCancelOrdersV2Response {
  orders: Array<{
    order_id: string;
    client_order_id?: string | null;
    reduced_by: string;
    ts_ms?: number | null;
    error?: { code?: string; message?: string };
  }>;
}

/**
 * Map a yes/no buy/sell intent onto the single YES book: which side to post on,
 * and the YES-book price in dollar fixed-point.
 *
 * NO-side identity: buy NO @ p ≡ sell YES @ (100−p); sell NO @ p ≡ buy YES @ (100−p).
 */
export function mapToYesBookOrder(
  side: Side,
  action: Action,
  priceCents: number
): { bookSide: BookSide; priceDollars: string } {
  if (side === "yes") {
    return {
      bookSide: action === "buy" ? "bid" : "ask",
      priceDollars: (priceCents / 100).toFixed(4),
    };
  }
  return {
    bookSide: action === "buy" ? "ask" : "bid",
    priceDollars: ((100 - priceCents) / 100).toFixed(4),
  };
}

/** Build a V2 create-order request body from a yes/no intent. */
export function toCreateOrderV2Request(input: {
  ticker: string;
  side: Side;
  action: Action;
  priceCents: number;
  count: number;
  clientOrderId?: string;
  postOnly?: boolean;
  timeInForce?: CreateOrderV2Request["time_in_force"];
}): CreateOrderV2Request {
  const { bookSide, priceDollars } = mapToYesBookOrder(
    input.side,
    input.action,
    input.priceCents
  );

  return {
    ticker: input.ticker,
    client_order_id: input.clientOrderId,
    side: bookSide,
    count: input.count.toFixed(2),
    price: priceDollars,
    time_in_force: input.timeInForce ?? "good_till_canceled",
    self_trade_prevention_type: "taker_at_cross",
    post_only: input.postOnly ?? false,
  };
}

export function parseFixedCount(value: string | undefined): number {
  if (value == null) return 0;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

/** Derive a human status from V2 placement counts. */
export function statusFromV2Counts(
  fillCount: string | undefined,
  remainingCount: string | undefined
): "open" | "filled" | "cancelled" {
  const remaining = parseFixedCount(remainingCount);
  const filled = parseFixedCount(fillCount);
  if (remaining > 0) return "open";
  if (filled > 0) return "filled";
  return "cancelled";
}

/**
 * Build the RSA-PSS auth headers Kalshi requires. The signed message is
 * `timestamp + METHOD + pathname` — pathname only (no query), matching the
 * `kalshi-typescript` BaseAPI interceptor.
 */
function signHeaders(
  apiKey: string,
  privateKeyPem: string,
  method: string,
  pathWithQuery: string
): Record<string, string> {
  const timestamp = Date.now().toString();
  const pathname = pathWithQuery.split("?")[0] ?? pathWithQuery;
  const message = timestamp + method.toUpperCase() + pathname;
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(message);
  sign.end();
  const signature = sign.sign({
    key: privateKeyPem,
    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
    saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
  });

  return {
    "KALSHI-ACCESS-KEY": apiKey,
    "KALSHI-ACCESS-SIGNATURE": signature.toString("base64"),
    "KALSHI-ACCESS-TIMESTAMP": timestamp,
  };
}

/**
 * Resolve the absolute request path (`/trade-api/v2/...`) that must be signed.
 * `basePath` is typically `https://host/trade-api/v2`.
 */
export function signingPath(basePath: string, relativePath: string): string {
  const base = new URL(basePath.endsWith("/") ? basePath : `${basePath}/`);
  const resolved = new URL(relativePath.replace(/^\//, ""), base);
  return resolved.pathname + resolved.search;
}

export interface OrdersV2Client {
  createOrder(body: CreateOrderV2Request): Promise<CreateOrderV2Response>;
  cancelOrder(orderId: string): Promise<CancelOrderV2Response>;
  batchCancelOrders(orderIds: string[]): Promise<BatchCancelOrdersV2Response>;
}

export class KalshiOrdersV2Client implements OrdersV2Client {
  private readonly apiKey: string;
  private readonly privateKey: string;
  private readonly basePath: string;
  private readonly http: AxiosInstance;

  constructor(config: KalshiConfig, http: AxiosInstance = axios.create()) {
    this.apiKey = config.apiKey;
    this.privateKey = config.privateKey;
    this.basePath = config.basePath.replace(/\/+$/, "");
    this.http = http;
  }

  private async request<T>(
    method: "POST" | "DELETE",
    relativePath: string,
    body?: unknown
  ): Promise<T> {
    const pathForSign = signingPath(this.basePath, relativePath);
    const headers = {
      "Content-Type": "application/json",
      ...signHeaders(this.apiKey, this.privateKey, method, pathForSign),
    };
    const url = `${this.basePath}${relativePath.startsWith("/") ? "" : "/"}${relativePath}`;

    const response = await this.http.request<T>({
      method,
      url,
      headers,
      data: body,
      validateStatus: () => true,
    });

    if (response.status < 200 || response.status >= 300) {
      const errData = response.data as
        | { message?: string; code?: string; error?: { message?: string } }
        | string
        | undefined;
      const msg =
        typeof errData === "string"
          ? errData
          : errData?.error?.message ??
            errData?.message ??
            `HTTP ${response.status}`;
      throw new Error(`OrdersV2 ${method} ${relativePath}: ${msg}`);
    }

    return response.data;
  }

  createOrder(body: CreateOrderV2Request): Promise<CreateOrderV2Response> {
    return this.request<CreateOrderV2Response>(
      "POST",
      "/portfolio/events/orders",
      body
    );
  }

  cancelOrder(orderId: string): Promise<CancelOrderV2Response> {
    return this.request<CancelOrderV2Response>(
      "DELETE",
      `/portfolio/events/orders/${encodeURIComponent(orderId)}`
    );
  }

  batchCancelOrders(orderIds: string[]): Promise<BatchCancelOrdersV2Response> {
    return this.request<BatchCancelOrdersV2Response>(
      "DELETE",
      "/portfolio/events/orders/batched",
      { orders: orderIds.map((order_id) => ({ order_id, exchange_index: 0 })) }
    );
  }
}

export function createOrdersV2Client(config: KalshiConfig): OrdersV2Client {
  return new KalshiOrdersV2Client(config);
}
