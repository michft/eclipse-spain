import { describe, expect, it, vi } from "vitest";

import { fetchCloudForecast, fetchElevationProfile } from "./openMeteo";
import type { FetchFunction } from "./result";

const jsonResponse = (value: unknown): Response =>
  new Response(JSON.stringify(value), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

describe("Open-Meteo adapters", () => {
  it("builds an elevation and horizon profile", async () => {
    const fetchFunction = vi.fn<FetchFunction>(async () =>
      jsonResponse({ elevation: [100, ...Array<number>(15).fill(120)] }),
    );
    const result = await fetchElevationProfile(
      { latitude: 41.8, longitude: -3.2 },
      280,
      fetchFunction,
      new Date("2026-08-02T12:00:00Z"),
    );

    expect(result.status).toBe("success");
    if (result.status !== "success") {
      return;
    }
    expect(result.value.observerElevationMeters).toBe(100);
    expect(result.value.horizon.samples).toHaveLength(15);
    expect(String(fetchFunction.mock.calls[0]?.[0])).toContain("latitude=");
  });

  it("returns a not-yet-available cloud state outside forecast range", async () => {
    const fetchFunction = vi.fn<FetchFunction>();
    const result = await fetchCloudForecast(
      { latitude: 0, longitude: 0 },
      "2027-08-02T10:00:00Z",
      fetchFunction,
      new Date("2026-08-02T00:00:00Z"),
    );

    expect(result).toEqual({
      status: "unavailable",
      reason: "Forecast not available yet.",
    });
    expect(fetchFunction).not.toHaveBeenCalled();
  });

  it("selects the forecast hour nearest maximum", async () => {
    const fetchFunction = vi.fn<FetchFunction>(async () =>
      jsonResponse({
        hourly: {
          time: ["2026-08-12T18:00", "2026-08-12T19:00"],
          cloud_cover: [25, 75],
          cloud_cover_low: [10, 20],
          cloud_cover_mid: [15, 30],
          cloud_cover_high: [5, 40],
        },
      }),
    );
    const result = await fetchCloudForecast(
      { latitude: 41.8, longitude: -3.2 },
      "2026-08-12T18:20:00Z",
      fetchFunction,
      new Date("2026-08-02T00:00:00Z"),
    );

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.value.totalPercent).toBe(25);
      expect(result.value.validUtc).toBe("2026-08-12T18:00:00.000Z");
    }
  });
});
