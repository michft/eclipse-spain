import { describe, expect, it, vi } from "vitest";

import type { FetchFunction } from "./result";
import { handleTransportRequest } from "./transportApi";

const request = (
  query = "latitude=43.3717&longitude=-6.1883",
  method = "GET",
): Request =>
  new Request(`https://example.com/api/transport?${query}`, { method });

describe("transport API", () => {
  it("validates the method and coordinates", async () => {
    await expect(
      handleTransportRequest(request("", "POST")),
    ).resolves.toMatchObject({ status: 405 });
    await expect(
      handleTransportRequest(request("latitude=&longitude=-6")),
    ).resolves.toMatchObject({ status: 400 });
    await expect(
      handleTransportRequest(request("latitude=91&longitude=0")),
    ).resolves.toMatchObject({ status: 400 });
  });

  it("forwards a fixed transport query to Overpass", async () => {
    const fetchFunction = vi.fn<FetchFunction>(async () =>
      Response.json({ elements: [] }),
    );
    const response = await handleTransportRequest(request(), fetchFunction);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ elements: [] });
    expect(fetchFunction.mock.calls[0]?.[1]?.method).toBe("POST");
    expect(fetchFunction.mock.calls[0]?.[1]?.body).toContain("data=");
  });

  it("maps provider rejection to a stable gateway error", async () => {
    const fetchFunction = vi.fn<FetchFunction>(async () => {
      throw new Error("network failed");
    });
    const response = await handleTransportRequest(request(), fetchFunction);

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      reason: "Transport provider failed.",
    });
  });

  it("maps provider timeout to a stable gateway timeout", async () => {
    const fetchFunction = vi.fn<FetchFunction>(async () => {
      const error = new Error("aborted");
      error.name = "AbortError";
      throw error;
    });
    const response = await handleTransportRequest(request(), fetchFunction);

    expect(response.status).toBe(504);
    await expect(response.json()).resolves.toEqual({
      reason: "Transport provider timed out.",
    });
  });
});
