import { describe, expect, it, vi } from "vitest";

import type { FetchFunction } from "./result";
import { fetchWithRateLimitBackoff } from "./rateLimitBackoff";

describe("client rate-limit backoff", () => {
  it("halves effective retry rate after every 429", async () => {
    const fetchFunction = vi
      .fn<FetchFunction>()
      .mockResolvedValueOnce(new Response("limited", { status: 429 }))
      .mockResolvedValueOnce(
        new Response("limited", {
          status: 429,
          headers: { "Retry-After": "1" },
        }),
      )
      .mockResolvedValueOnce(Response.json({ ok: true }));
    const wait = vi.fn<
      (
        milliseconds: number,
        signal: AbortSignal | null | undefined,
      ) => Promise<void>
    >(async () => undefined);

    const response = await fetchWithRateLimitBackoff(
      fetchFunction,
      "https://example.com/data",
      undefined,
      { delay: wait },
    );

    expect(response.status).toBe(200);
    expect(fetchFunction).toHaveBeenCalledTimes(3);
    expect(wait.mock.calls.map(([milliseconds]) => milliseconds)).toEqual([
      1_000, 2_000,
    ]);
  });

  it("returns the last 429 after the bounded retries", async () => {
    const fetchFunction = vi.fn<FetchFunction>(async () =>
      new Response(null, { status: 429 }),
    );
    const wait = vi.fn<
      (
        milliseconds: number,
        signal: AbortSignal | null | undefined,
      ) => Promise<void>
    >(async () => undefined);

    const response = await fetchWithRateLimitBackoff(
      fetchFunction,
      "https://example.com/data",
      undefined,
      { delay: wait, maximumRetries: 2 },
    );

    expect(response.status).toBe(429);
    expect(fetchFunction).toHaveBeenCalledTimes(3);
    expect(wait.mock.calls.map(([milliseconds]) => milliseconds)).toEqual([
      1_000, 2_000,
    ]);
  });

  it("halves the rate from a longer provider-requested delay", async () => {
    const fetchFunction = vi
      .fn<FetchFunction>()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 429,
          headers: { "Retry-After": "5" },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
      .mockResolvedValueOnce(new Response(null));
    const wait = vi.fn<
      (
        milliseconds: number,
        signal: AbortSignal | null | undefined,
      ) => Promise<void>
    >(async () => undefined);

    await fetchWithRateLimitBackoff(
      fetchFunction,
      "https://example.com/data",
      undefined,
      { delay: wait },
    );

    expect(wait.mock.calls.map(([milliseconds]) => milliseconds)).toEqual([
      5_000, 10_000,
    ]);
  });
});
