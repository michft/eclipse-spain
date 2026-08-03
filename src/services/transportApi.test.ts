import { describe, expect, it, vi } from "vitest";

import type { FetchFunction } from "./result";
import {
  createTransportRequestLimiter,
  handleTransportRequest,
} from "./transportApi";

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
    expect(
      new Headers(fetchFunction.mock.calls[0]?.[1]?.headers).get("User-Agent"),
    ).toContain("github.com/michft/eclipse-spain/issues");
    expect(
      decodeURIComponent(String(fetchFunction.mock.calls[0]?.[1]?.body)),
    ).toContain("out center tags qt;");
  });

  it("retries an immediate provider failure on the fallback instance", async () => {
    const cancel = vi.fn();
    const primaryBody = new ReadableStream({ cancel });
    const fetchFunction = vi
      .fn<FetchFunction>()
      .mockResolvedValueOnce(new Response(primaryBody, { status: 500 }))
      .mockResolvedValueOnce(Response.json({ elements: [] }));

    const response = await handleTransportRequest(request(), fetchFunction);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ elements: [] });
    expect(fetchFunction).toHaveBeenCalledTimes(2);
    expect(String(fetchFunction.mock.calls[1]?.[0])).toContain(
      "overpass.private.coffee",
    );
    expect(cancel).toHaveBeenCalledOnce();
    expect(fetchFunction.mock.calls[0]?.[1]?.signal).toBe(
      fetchFunction.mock.calls[1]?.[1]?.signal,
    );
  });

  it("uses the fallback when the primary request rejects", async () => {
    const fetchFunction = vi
      .fn<FetchFunction>()
      .mockRejectedValueOnce(new Error("primary failed"))
      .mockResolvedValueOnce(Response.json({ elements: [] }));

    const response = await handleTransportRequest(request(), fetchFunction);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ elements: [] });
    expect(fetchFunction).toHaveBeenCalledTimes(2);
    expect(String(fetchFunction.mock.calls[1]?.[0])).toContain(
      "overpass.private.coffee",
    );
  });

  it.each([
    {
      name: "primary response",
      responses: [
        new Response(null, {
          status: 429,
          headers: { "Retry-After": "7" },
        }),
      ],
    },
    {
      name: "fallback response",
      responses: [
        new Response(null, { status: 500 }),
        new Response(null, {
          status: 429,
          headers: { "Retry-After": "11" },
        }),
      ],
    },
  ])("preserves Retry-After from the $name", async ({ responses }) => {
    const fetchFunction = vi.fn<FetchFunction>();
    responses.forEach((response) => {
      fetchFunction.mockResolvedValueOnce(response);
    });

    const response = await handleTransportRequest(request(), fetchFunction);

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe(
      responses.at(-1)?.headers.get("Retry-After"),
    );
  });

  it("limits starts and simultaneous requests", () => {
    const rateLimiter = createTransportRequestLimiter();
    for (let index = 0; index < 10; index += 1) {
      rateLimiter.acquire(1_000)?.release();
    }
    expect(rateLimiter.acquire(1_000)).toBeNull();

    const concurrencyLimiter = createTransportRequestLimiter();
    const permits = Array.from({ length: 10 }, () =>
      concurrencyLimiter.acquire(1_000),
    );
    expect(concurrencyLimiter.acquire(2_001)).toBeNull();
    permits.forEach((permit) => permit?.release());
    expect(concurrencyLimiter.acquire(2_001)).not.toBeNull();
  });

  it("returns a retry notice when the gateway limit is reached", async () => {
    const fetchFunction = vi.fn<FetchFunction>();
    const response = await handleTransportRequest(request(), fetchFunction, {
      acquire: () => null,
    });

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("1");
    await expect(response.json()).resolves.toEqual({
      reason: "Transport request limit reached. Retry shortly.",
    });
    expect(fetchFunction).not.toHaveBeenCalled();
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
    expect(fetchFunction).toHaveBeenCalledTimes(2);
  });

  it("shares one timeout across primary and fallback", async () => {
    vi.useFakeTimers();
    try {
      const fetchFunction = vi.fn<FetchFunction>((_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          const rejectAbort = () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          };
          if (init?.signal?.aborted) {
            rejectAbort();
          } else {
            init?.signal?.addEventListener("abort", rejectAbort, { once: true });
          }
        }),
      );

      const result = handleTransportRequest(request(), fetchFunction);
      await vi.advanceTimersByTimeAsync(30_000);
      const response = await result;

      expect(response.status).toBe(504);
      expect(fetchFunction).toHaveBeenCalledTimes(2);
      expect(fetchFunction.mock.calls[0]?.[1]?.signal).toBe(
        fetchFunction.mock.calls[1]?.[1]?.signal,
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
