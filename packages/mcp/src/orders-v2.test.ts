import { describe, it, expect } from "vitest";
import * as crypto from "crypto";
import type { AxiosInstance } from "axios";
import {
  mapToYesBookOrder,
  toCreateOrderV2Request,
  statusFromV2Counts,
  signingPath,
  KalshiOrdersV2Client,
} from "./orders-v2.js";

describe("mapToYesBookOrder", () => {
  it("maps buy YES to bid at same dollars", () => {
    expect(mapToYesBookOrder("yes", "buy", 10)).toEqual({
      bookSide: "bid",
      priceDollars: "0.1000",
    });
  });
  it("maps sell YES to ask at same dollars", () => {
    expect(mapToYesBookOrder("yes", "sell", 61)).toEqual({
      bookSide: "ask",
      priceDollars: "0.6100",
    });
  });
  it("maps buy NO to ask at inverted dollars", () => {
    expect(mapToYesBookOrder("no", "buy", 39)).toEqual({
      bookSide: "ask",
      priceDollars: "0.6100",
    });
  });
  it("maps sell NO to bid at inverted dollars", () => {
    expect(mapToYesBookOrder("no", "sell", 39)).toEqual({
      bookSide: "bid",
      priceDollars: "0.6100",
    });
  });
});

describe("toCreateOrderV2Request", () => {
  it("builds a GTC limit body, post_only false by default", () => {
    expect(
      toCreateOrderV2Request({
        ticker: "KXFEDDECISION-26JUL-H0",
        side: "yes",
        action: "buy",
        priceCents: 77,
        count: 5,
        clientOrderId: "cli-1",
      })
    ).toEqual({
      ticker: "KXFEDDECISION-26JUL-H0",
      client_order_id: "cli-1",
      side: "bid",
      count: "5.00",
      price: "0.7700",
      time_in_force: "good_till_canceled",
      self_trade_prevention_type: "taker_at_cross",
      post_only: false,
    });
  });

  it("honors post_only and inverts NO prices onto the YES book", () => {
    const req = toCreateOrderV2Request({
      ticker: "T",
      side: "no",
      action: "buy",
      priceCents: 25,
      count: 1,
      postOnly: true,
    });
    expect(req.side).toBe("ask");
    expect(req.price).toBe("0.7500");
    expect(req.post_only).toBe(true);
  });
});

describe("statusFromV2Counts", () => {
  it("open when remaining > 0", () => {
    expect(statusFromV2Counts("0.00", "5.00")).toBe("open");
  });
  it("filled when nothing remains but some filled", () => {
    expect(statusFromV2Counts("5.00", "0.00")).toBe("filled");
  });
  it("cancelled when nothing filled or remaining", () => {
    expect(statusFromV2Counts("0.00", "0.00")).toBe("cancelled");
  });
});

describe("signingPath", () => {
  it("resolves the absolute /trade-api/v2 path to sign", () => {
    expect(
      signingPath(
        "https://api.elections.kalshi.com/trade-api/v2",
        "/portfolio/events/orders"
      )
    ).toBe("/trade-api/v2/portfolio/events/orders");
  });
});

// --- HTTP/signing layer with an injected mock axios instance ---

const { privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

function mockHttp(response: { status: number; data: unknown }) {
  const calls: Array<Record<string, unknown>> = [];
  const http = {
    request: async (cfg: Record<string, unknown>) => {
      calls.push(cfg);
      return response;
    },
  } as unknown as AxiosInstance;
  return { http, calls };
}

const config = {
  apiKey: "test-key-id",
  privateKey,
  basePath: "https://api.elections.kalshi.com/trade-api/v2",
};

describe("KalshiOrdersV2Client", () => {
  it("createOrder POSTs to the V2 endpoint with signed headers and body", async () => {
    const { http, calls } = mockHttp({
      status: 200,
      data: {
        order_id: "ord-1",
        fill_count: "0.00",
        remaining_count: "5.00",
        ts_ms: 1,
      },
    });
    const client = new KalshiOrdersV2Client(config, http);
    const body = toCreateOrderV2Request({
      ticker: "T",
      side: "yes",
      action: "buy",
      priceCents: 77,
      count: 5,
    });
    const res = await client.createOrder(body);

    expect(res.order_id).toBe("ord-1");
    expect(calls).toHaveLength(1);
    const call = calls[0];
    expect(call.method).toBe("POST");
    expect(call.url).toBe(
      "https://api.elections.kalshi.com/trade-api/v2/portfolio/events/orders"
    );
    expect(call.data).toEqual(body);
    const headers = call.headers as Record<string, string>;
    expect(headers["KALSHI-ACCESS-KEY"]).toBe("test-key-id");
    expect(headers["KALSHI-ACCESS-SIGNATURE"]).toMatch(/.+/);
    expect(headers["KALSHI-ACCESS-TIMESTAMP"]).toMatch(/^\d+$/);
  });

  it("throws a descriptive error on non-2xx, surfacing the API message", async () => {
    const { http } = mockHttp({
      status: 403,
      data: { error: { message: "missing write permission" } },
    });
    const client = new KalshiOrdersV2Client(config, http);
    await expect(
      client.createOrder(
        toCreateOrderV2Request({
          ticker: "T",
          side: "yes",
          action: "buy",
          priceCents: 50,
          count: 1,
        })
      )
    ).rejects.toThrow(/missing write permission/);
  });

  it("cancelOrder DELETEs the url-encoded order id", async () => {
    const { http, calls } = mockHttp({
      status: 200,
      data: { order_id: "a/b", reduced_by: "1.00", ts_ms: 1 },
    });
    const client = new KalshiOrdersV2Client(config, http);
    await client.cancelOrder("a/b");
    expect(calls[0].method).toBe("DELETE");
    expect(calls[0].url).toContain("/portfolio/events/orders/a%2Fb");
  });

  it("batchCancelOrders sends order_id objects", async () => {
    const { http, calls } = mockHttp({ status: 200, data: { orders: [] } });
    const client = new KalshiOrdersV2Client(config, http);
    await client.batchCancelOrders(["o1", "o2"]);
    expect(calls[0].method).toBe("DELETE");
    expect(calls[0].data).toEqual({
      orders: [
        { order_id: "o1", exchange_index: 0 },
        { order_id: "o2", exchange_index: 0 },
      ],
    });
  });
});
