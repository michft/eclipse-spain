import { describe, expect, it } from "vitest";

import { makeHorizonProfile } from "./horizon";

describe("terrain horizon", () => {
  it("returns a finite guarded maximum for an empty profile", () => {
    const profile = makeHorizonProfile(100, 270, []);

    expect(profile.samples).toEqual([]);
    expect(profile.highestTerrainAngleDegrees).toBe(0);
  });

  it("calculates an elevated terrain angle", () => {
    const profile = makeHorizonProfile(100, 270, [
      {
        location: { latitude: 0, longitude: 0 },
        distanceKm: 1,
        elevationMeters: 200,
      },
    ]);

    expect(profile.samples[0]?.apparentTerrainAngleDegrees).toBeCloseTo(5.7, 1);
    expect(profile.highestTerrainAngleDegrees).toBeGreaterThan(5);
  });

  it("accounts for Earth curvature at distance", () => {
    const profile = makeHorizonProfile(0, 0, [
      {
        location: { latitude: 0, longitude: 0 },
        distanceKm: 50,
        elevationMeters: 0,
      },
    ]);

    expect(profile.samples[0]?.curvatureDropMeters).toBeCloseTo(196.2, 0);
    expect(profile.samples[0]?.apparentTerrainAngleDegrees).toBeLessThan(0);
  });
});
