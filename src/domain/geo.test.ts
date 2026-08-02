import { describe, expect, it } from "vitest";

import { distanceKm, distanceToPolylineKm, distanceToSegmentKm } from "./geo";

describe("geodesy", () => {
  it("returns about 111 km for one degree of latitude", () => {
    expect(
      distanceKm(
        { latitude: 0, longitude: 0 },
        { latitude: 1, longitude: 0 },
      ),
    ).toBeCloseTo(111.2, 1);
  });

  it("finds a point on a segment", () => {
    expect(
      distanceToSegmentKm(
        { latitude: 0, longitude: 1 },
        { latitude: 0, longitude: 0 },
        { latitude: 0, longitude: 2 },
      ),
    ).toBeCloseTo(0, 6);
  });

  it("uses segment endpoints when the projection is outside", () => {
    expect(
      distanceToSegmentKm(
        { latitude: 0, longitude: 3 },
        { latitude: 0, longitude: 0 },
        { latitude: 0, longitude: 2 },
      ),
    ).toBeCloseTo(111.2, 1);
  });

  it("handles empty and one-point polylines", () => {
    expect(distanceToPolylineKm({ latitude: 0, longitude: 0 }, [])).toBeNull();
    expect(
      distanceToPolylineKm(
        { latitude: 0, longitude: 0 },
        [{ latitude: 1, longitude: 0 }],
      ),
    ).toBeCloseTo(111.2, 1);
  });
});
