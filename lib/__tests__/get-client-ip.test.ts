/**
 * @jest-environment node
 */
import { getClientIp } from "../get-client-ip";
import { NextRequest } from "next/server";

function makeReq(headers: Record<string, string> = {}): NextRequest {
  const h = new Headers(headers);
  return { headers: h } as unknown as NextRequest;
}

describe("getClientIp", () => {
  it("returns first IP from x-forwarded-for", () => {
    expect(getClientIp(makeReq({ "x-forwarded-for": "203.0.113.50, 10.0.0.1" }))).toBe("203.0.113.50");
  });

  it("returns x-real-ip when x-forwarded-for is absent", () => {
    expect(getClientIp(makeReq({ "x-real-ip": "198.51.100.1" }))).toBe("198.51.100.1");
  });

  it("prefers x-forwarded-for over x-real-ip", () => {
    expect(
      getClientIp(makeReq({ "x-forwarded-for": "203.0.113.50", "x-real-ip": "198.51.100.1" }))
    ).toBe("203.0.113.50");
  });

  it("returns null when no IP headers present", () => {
    expect(getClientIp(makeReq())).toBeNull();
  });

  it("trims whitespace from IP", () => {
    expect(getClientIp(makeReq({ "x-forwarded-for": "  203.0.113.50  " }))).toBe("203.0.113.50");
  });
});
