import { describe, expect, it, vi } from "vitest";

import { getEclipseEvent } from "../data/eclipseEvents";
import type { ElevationProfileResult } from "./openMeteo";
import {
  findObservingLocationCandidates,
  scoreCandidate,
} from "./locationFinder";
import type { TransportProximity } from "./overpass";
import type { ServiceResult } from "./result";

describe("observing location finder", () => {
  it("makes horizon, path, and search proximity explicit score components", () => {
    const strong = scoreCandidate("total", 12, 2, 3);
    const weak = scoreCandidate("partial", -2, 50, 25);

    expect(strong.total).toBe(
      strong.eclipse + strong.horizon + strong.path + strong.searchProximity,
    );
    expect(strong.total).toBeGreaterThan(weak.total);
  });

  it("ranks transport anchors after evaluating their terrain horizon", async () => {
    const transport = vi.fn(async (): Promise<ServiceResult<TransportProximity>> => ({
      status: "success",
      value: {
        radiusKm: 25,
        retrievedUtc: "2026-08-02T00:00:00.000Z",
        sourceUrl: "https://www.openstreetmap.org/copyright",
        nearest: {
          rail: {
            mode: "rail",
            name: "Rail site",
            distanceKm: 2,
            location: { latitude: 43.3717, longitude: -6.1883 },
            osmUrl: "https://www.openstreetmap.org/node/1",
          },
          parking: {
            mode: "parking",
            name: "Parking site",
            distanceKm: 8,
            location: { latitude: 43.5, longitude: -6.2 },
            osmUrl: "https://www.openstreetmap.org/way/2",
          },
          bus: null,
          airport: null,
          ferry: null,
        },
      },
    }));
    const elevation = vi.fn(
      async (): Promise<ServiceResult<ElevationProfileResult>> => ({
        status: "success",
        value: {
          observerElevationMeters: 100,
          horizon: {
            observerElevationMeters: 100,
            azimuthDegrees: 280,
            samples: [],
            highestTerrainAngleDegrees: 0,
          },
          sourceUrl: "https://open-meteo.com/en/docs/elevation-api",
          retrievedUtc: "2026-08-02T00:00:00.000Z",
        },
      }),
    );

    const result = await findObservingLocationCandidates(
      getEclipseEvent("spain-2026"),
      { latitude: 43.4, longitude: -6.2 },
      { transport, elevation },
    );

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.value.candidates).toHaveLength(2);
      expect(result.value.candidates[0]?.score.total).toBeGreaterThanOrEqual(
        result.value.candidates[1]?.score.total ?? Number.POSITIVE_INFINITY,
      );
    }
  });
});
