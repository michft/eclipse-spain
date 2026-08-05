import { afterEach, describe, expect, it, vi } from "vitest";

import type { FetchFunction } from "./result";
import { checkDeviceClock } from "./clock";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("device clock check", () => {
  it("preserves the warning when no clock URL is available", async () => {
    const fetchFunction = vi.fn<FetchFunction>();
    vi.stubGlobal("window", {});

    await expect(
      checkDeviceClock(fetchFunction, Date.now, null),
    ).resolves.toMatchObject({ status: "warning" });
    expect(fetchFunction).not.toHaveBeenCalled();
  });

  it("uses the configured public network-time URL on native", async () => {
    vi.stubGlobal("window", {});
    vi.stubEnv("EXPO_PUBLIC_NETWORK_TIME_URL", "https://time.example.test/");
    const fetchFunction = vi.fn<FetchFunction>(async () =>
      new Response(null, {
        headers: { Date: "Sun, 02 Aug 2026 14:00:00 GMT" },
      }),
    );
    const times = [
      Date.parse("2026-08-02T14:00:00.000Z"),
      Date.parse("2026-08-02T14:00:00.100Z"),
    ];

    await expect(
      checkDeviceClock(fetchFunction, () => times.shift() ?? 0),
    ).resolves.toMatchObject({ status: "trusted" });
    expect(fetchFunction).toHaveBeenCalledWith(
      "https://time.example.test/",
      expect.objectContaining({ method: "HEAD" }),
    );
  });

  it("warns for an unavailable native network-time response", async () => {
    vi.stubGlobal("window", {});
    vi.stubEnv("EXPO_PUBLIC_NETWORK_TIME_URL", "https://time.example.test/");
    const fetchFunction = vi.fn<FetchFunction>(async () =>
      new Response(null, { status: 503 }),
    );

    await expect(checkDeviceClock(fetchFunction)).resolves.toEqual({
      status: "warning",
      reason:
        "Device time could not be verified against network time. Check it before relying on audio cues.",
    });
    expect(fetchFunction).toHaveBeenCalledWith(
      "https://time.example.test/",
      expect.objectContaining({ method: "HEAD" }),
    );
  });

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

  it("measures clock skew from the successful retry, excluding backoff", async () => {
    vi.useFakeTimers();
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    try {
      const serverTime = Date.parse("2026-08-02T14:00:01.000Z");
      vi.setSystemTime(serverTime - 1_000);
      const fetchFunction = vi
        .fn<FetchFunction>()
        .mockResolvedValueOnce(new Response(null, { status: 429 }))
        .mockResolvedValueOnce(
          new Response(null, {
            headers: { Date: new Date(serverTime).toUTCString() },
          }),
        );

      const result = checkDeviceClock(fetchFunction, Date.now, "/");
      await vi.advanceTimersByTimeAsync(1_000);

      await expect(result).resolves.toEqual({
        status: "trusted",
        differenceMilliseconds: 0,
      });
    } finally {
      random.mockRestore();
      vi.useRealTimers();
    }
  });

  it("bounds a stalled network-time request", async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal("window", {});
      vi.stubEnv("EXPO_PUBLIC_NETWORK_TIME_URL", "https://time.example.test/");
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

      const result = checkDeviceClock(fetchFunction);
      await vi.advanceTimersByTimeAsync(20_000);

      await expect(result).resolves.toEqual({
        status: "warning",
        reason:
          "Device time could not be verified against network time. Check it before relying on audio cues.",
      });
      expect(fetchFunction).toHaveBeenCalledWith(
        "https://time.example.test/",
        expect.objectContaining({ method: "HEAD" }),
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
