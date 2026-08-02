import { describe, expect, it, vi } from "vitest";

import type { FetchFunction } from "./result";
import { checkDeviceClock } from "./clock";

describe("device clock check", () => {
  it("accepts a clock close to the response Date header", async () => {
    const fetchFunction = vi.fn<FetchFunction>(async () =>
      new Response(null, {
        headers: { Date: "Sun, 02 Aug 2026 14:00:00 GMT" },
      }),
    );
    const times = [
      Date.parse("2026-08-02T14:00:00.000Z"),
      Date.parse("2026-08-02T14:00:00.100Z"),
    ];
    const now = vi.fn(() => times.shift() ?? 0);

    await expect(checkDeviceClock(fetchFunction, now, "/")).resolves.toMatchObject({
      status: "trusted",
    });
    expect(fetchFunction).toHaveBeenCalledWith(
      "/",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("warns when the device clock is materially different", async () => {
    const fetchFunction = vi.fn<FetchFunction>(async () =>
      new Response(null, {
        headers: { Date: "Sun, 02 Aug 2026 14:00:00 GMT" },
      }),
    );
    const localTime = Date.parse("2026-08-02T14:00:20.000Z");

    const result = await checkDeviceClock(fetchFunction, () => localTime, "/");

    expect(result.status).toBe("warning");
    if (result.status === "warning") {
      expect(result.reason).toContain("20 seconds");
    }
  });

  it("warns when network time cannot be read", async () => {
    const fetchFunction = vi.fn<FetchFunction>(async () => new Response(null));

    await expect(checkDeviceClock(fetchFunction, Date.now, "/")).resolves.toEqual({
      status: "warning",
      reason:
        "Device time could not be verified against network time. Check it before relying on audio cues.",
    });
  });

  it("bounds a stalled network-time request", async () => {
    vi.useFakeTimers();
    try {
      const fetchFunction = vi.fn<FetchFunction>(
        (_input, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              const error = new Error("aborted");
              error.name = "AbortError";
              reject(error);
            });
          }),
      );

      const result = checkDeviceClock(fetchFunction, Date.now, "/");
      await vi.advanceTimersByTimeAsync(5_000);

      await expect(result).resolves.toEqual({
        status: "warning",
        reason:
          "Device time could not be verified against network time. Check it before relying on audio cues.",
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
