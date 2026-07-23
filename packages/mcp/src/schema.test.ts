import { describe, it, expect } from "vitest";
import { fp, cents } from "./schema.js";

describe("fp", () => {
  it("parses fixed-point count strings", () => {
    expect(fp("10.00")).toBe(10);
    expect(fp("6517424.20")).toBe(6517424.2);
  });

  it("passes through numbers", () => {
    expect(fp(42)).toBe(42);
  });

  it("returns null for missing/unparseable input", () => {
    expect(fp(null)).toBeNull();
    expect(fp(undefined)).toBeNull();
    expect(fp("")).toBeNull();
    expect(fp("abc")).toBeNull();
  });
});

describe("cents", () => {
  it("converts whole-cent dollar strings to integer cents", () => {
    expect(cents("0.7400")).toBe(74);
    expect(cents("0.2500")).toBe(25);
    expect(cents("1.0000")).toBe(100);
    expect(cents("0.0100")).toBe(1);
  });

  it("preserves 0.1¢ precision for deci_cent markets", () => {
    expect(cents("0.7350")).toBe(73.5);
    expect(cents("0.0150")).toBe(1.5);
    expect(cents("0.9990")).toBe(99.9);
  });

  it("kills floating-point noise from dollars * 100", () => {
    // 0.29 * 100 = 28.999999999999996 in IEEE754; must land on 29.0.
    expect(cents("0.2900")).toBe(29);
    expect(cents(0.07)).toBe(7);
  });

  it("returns null for missing/unparseable input", () => {
    expect(cents(null)).toBeNull();
    expect(cents(undefined)).toBeNull();
    expect(cents("")).toBeNull();
  });
});
