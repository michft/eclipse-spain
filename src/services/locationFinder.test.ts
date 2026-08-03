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
          skyline: {
            centerAzimuthDegrees: 280,
            fieldOfViewDegrees: 80,
            samples: [],
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
      expect(result.value.candidates[0]?.name).toBe("Rail site");
      expect(elevation).toHaveBeenCalledTimes(2);
      expect(elevation).toHaveBeenCalledWith(
        { latitude: 43.3717, longitude: -6.1883 },
        expect.any(Number),
      );
      expect(elevation).toHaveBeenCalledWith(
        { latitude: 43.5, longitude: -6.2 },
        expect.any(Number),
      );
    }
  });

  it("keeps a candidate with a warning when terrain is unavailable", async () => {
    const transport = vi.fn(
      async (): Promise<ServiceResult<TransportProximity>> => ({
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
            parking: null,
            bus: null,
            airport: null,
            ferry: null,
          },
        },
      }),
    );
    const elevation = vi.fn(
      async (): Promise<ServiceResult<ElevationProfileResult>> => ({
        status: "error",
        reason: "Elevation unavailable.",
      }),
    );

    const result = await findObservingLocationCandidates(
      getEclipseEvent("spain-2026"),
      { latitude: 43.4, longitude: -6.2 },
      { transport, elevation },
    );

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.value.candidates[0]?.terrainClearanceDegrees).toBeNull();
      expect(result.value.warnings).toEqual([
        "Terrain could not be scored for 1 candidate(s).",
      ]);
    }
  });
});
