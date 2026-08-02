import { describe, expect, it, vi } from "vitest";

import { fetchTransportProximity } from "./overpass";
import type { FetchFunction } from "./result";

describe("Overpass transport adapter", () => {
  it("keeps modes separate and chooses the nearest item", async () => {
    const fetchFunction = vi.fn<FetchFunction>(async () =>
      new Response(
        JSON.stringify({
          elements: [
            {
              type: "node",
              id: 1,
              lat: 41.9,
              lon: -3.2,
              tags: { railway: "station", name: "Far station" },
            },
            {
              type: "node",
              id: 2,
              lat: 41.81,
              lon: -3.2,
              tags: { railway: "halt", name: "Near halt" },
            },
            {
              type: "way",
              id: 3,
              center: { lat: 41.82, lon: -3.2 },
              tags: { amenity: "parking", name: "Observer parking" },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const result = await fetchTransportProximity(
      { latitude: 41.8, longitude: -3.2 },
      fetchFunction,
      new Date("2026-08-02T00:00:00Z"),
    );

    expect(result.status).toBe("success");
    if (result.status !== "success") {
      return;
    }
    expect(result.value.nearest.rail?.name).toBe("Near halt");
    expect(result.value.nearest.parking?.name).toBe("Observer parking");
    expect(result.value.nearest.bus).toBeNull();
    expect(result.value.nearest.rail?.osmUrl).toContain("/node/2");
    expect(fetchFunction.mock.calls[0]?.[1]?.method).toBe("POST");
    expect(fetchFunction.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it("returns the HTTP status for non-ok responses", async () => {
    const fetchFunction = vi.fn<FetchFunction>(async () =>
      new Response("Unavailable", { status: 502 }),
    );

    await expect(
      fetchTransportProximity({ latitude: 0, longitude: 0 }, fetchFunction),
    ).resolves.toEqual({
      status: "error",
      reason: "Transport request failed with HTTP 502.",
    });
  });

  it("rejects payloads without an elements array", async () => {
    const fetchFunction = vi.fn<FetchFunction>(async () =>
      new Response(JSON.stringify({ remark: "no elements" }), { status: 200 }),
    );

    await expect(
      fetchTransportProximity({ latitude: 0, longitude: 0 }, fetchFunction),
    ).resolves.toEqual({
      status: "error",
      reason: "Transport response was invalid.",
    });
  });

  it("skips locationless and malformed elements", async () => {
    const fetchFunction = vi.fn<FetchFunction>(async () =>
      new Response(
        JSON.stringify({
          elements: [
            { type: "node", id: 1, tags: { railway: "station" } },
            {
              type: "way",
              id: 2,
              center: { lat: "bad", lon: 0 },
              tags: { amenity: "parking" },
            },
            {
              type: "node",
              id: 3,
              lat: 0,
              lon: 0,
              tags: { railway: 42 },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const result = await fetchTransportProximity(
      { latitude: 0, longitude: 0 },
      fetchFunction,
    );

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(Object.values(result.value.nearest).every((item) => item === null)).toBe(
        true,
      );
    }
  });

  it("maps rejected requests to the public error result", async () => {
    const fetchFunction = vi.fn<FetchFunction>(async () => {
      throw new Error("Overpass network failed.");
    });

    await expect(
      fetchTransportProximity({ latitude: 0, longitude: 0 }, fetchFunction),
    ).resolves.toEqual({
      status: "error",
      reason: "Overpass network failed.",
    });
  });
});
