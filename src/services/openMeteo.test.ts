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
    let requestIndex = 0;
    const fetchFunction = vi.fn<FetchFunction>(async (input) => {
      const coordinateCount =
        new URL(String(input)).searchParams.get("latitude")?.split(",").length ?? 0;
      const elevation = Array<number>(coordinateCount).fill(120);
      if (requestIndex === 0) elevation[0] = 100;
      requestIndex += 1;
      return jsonResponse({ elevation });
    });
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
    expect(result.value.horizon.samples).toHaveLength(7);
    expect(result.value.skyline.samples).toHaveLength(25);
    expect(result.value.skyline.fieldOfViewDegrees).toBe(180);
    expect(fetchFunction).toHaveBeenCalledTimes(2);
    expect(String(fetchFunction.mock.calls[0]?.[0])).toContain("latitude=");
    const requestUrl = new URL(String(fetchFunction.mock.calls[0]?.[0]));
    expect(requestUrl.searchParams.get("latitude")?.split(",")).toHaveLength(100);
    expect(requestUrl.searchParams.get("longitude")?.split(",")).toHaveLength(100);
    const secondRequestUrl = new URL(String(fetchFunction.mock.calls[1]?.[0]));
    expect(secondRequestUrl.searchParams.get("latitude")?.split(",")).toHaveLength(76);
    expect(secondRequestUrl.searchParams.get("longitude")?.split(",")).toHaveLength(76);
    expect(fetchFunction.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
    expect(fetchFunction.mock.calls[1]?.[1]?.signal).toBeInstanceOf(AbortSignal);
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

  it("labels a past forecast separately", async () => {
    const result = await fetchCloudForecast(
      { latitude: 0, longitude: 0 },
      "2026-08-01T10:00:00Z",
      vi.fn<FetchFunction>(),
      new Date("2026-08-02T00:00:00Z"),
    );

    expect(result).toEqual({
      status: "unavailable",
      reason: "Forecast for this past time is no longer available.",
    });
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

  it("returns the provider reason for a non-ok JSON response", async () => {
    const fetchFunction = vi.fn<FetchFunction>(async () =>
      new Response(JSON.stringify({ reason: "Provider rejected the location." }), {
        status: 400,
      }),
    );

    await expect(
      fetchElevationProfile({ latitude: 0, longitude: 0 }, 0, fetchFunction),
    ).resolves.toEqual({
      status: "error",
      reason: "Provider rejected the location.",
    });
  });

  it("falls back to HTTP status for a non-JSON error", async () => {
    const fetchFunction = vi.fn<FetchFunction>(async () =>
      new Response("Service unavailable", { status: 503 }),
    );

    await expect(
      fetchCloudForecast(
        { latitude: 0, longitude: 0 },
        "2026-08-12T18:20:00Z",
        fetchFunction,
        new Date("2026-08-02T00:00:00Z"),
      ),
    ).resolves.toEqual({
      status: "error",
      reason: "Request failed with HTTP 503.",
    });
  });

  it.each([
    [null, "null payload"],
    [{ elevation: [100] }, "short elevation array"],
  ])("rejects incomplete elevation data: %s", async (payload, _label) => {
    const fetchFunction = vi.fn<FetchFunction>(async () => jsonResponse(payload));

    await expect(
      fetchElevationProfile({ latitude: 0, longitude: 0 }, 0, fetchFunction),
    ).resolves.toEqual({
      status: "error",
      reason: "Elevation response was incomplete.",
    });
  });

  it.each([
    [null, "null payload"],
    [
      {
        hourly: {
          time: [],
          cloud_cover: [],
          cloud_cover_low: [],
          cloud_cover_mid: [],
          cloud_cover_high: [],
        },
      },
      "empty hourly data",
    ],
  ])("rejects incomplete cloud data: %s", async (payload, _label) => {
    const fetchFunction = vi.fn<FetchFunction>(async () => jsonResponse(payload));

    await expect(
      fetchCloudForecast(
        { latitude: 0, longitude: 0 },
        "2026-08-12T18:20:00Z",
        fetchFunction,
        new Date("2026-08-02T00:00:00Z"),
      ),
    ).resolves.toEqual({
      status: "error",
      reason: "Cloud forecast response was incomplete.",
    });
  });

  it("maps elevation fetch rejection to its user-visible message", async () => {
    const fetchFunction = vi.fn<FetchFunction>(async () => {
      throw new Error("Elevation network failed.");
    });

    await expect(
      fetchElevationProfile({ latitude: 0, longitude: 0 }, 0, fetchFunction),
    ).resolves.toEqual({
      status: "error",
      reason: "Elevation network failed.",
    });
  });

  it("maps cloud fetch rejection to its user-visible message", async () => {
    const fetchFunction = vi.fn<FetchFunction>(async () => {
      throw new Error("Cloud network failed.");
    });

    await expect(
      fetchCloudForecast(
        { latitude: 0, longitude: 0 },
        "2026-08-12T18:20:00Z",
        fetchFunction,
        new Date("2026-08-02T00:00:00Z"),
      ),
    ).resolves.toEqual({
      status: "error",
      reason: "Cloud network failed.",
    });
  });
});
