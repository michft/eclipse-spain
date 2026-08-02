import { describe, expect, it } from "vitest";

import {
  destinationPoint,
  distanceKm,
  distanceToPolylineKm,
  distanceToSegmentKm,
  isValidGeoPoint,
} from "./geo";

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

  it("uses the shared endpoint for a zero-length segment", () => {
    expect(
      distanceToSegmentKm(
        { latitude: 1, longitude: 0 },
        { latitude: 0, longitude: 0 },
        { latitude: 0, longitude: 0 },
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

  it("projects a destination along a bearing", () => {
    const destination = destinationPoint(
      { latitude: 0, longitude: 0 },
      90,
      111.2,
    );

    expect(destination.latitude).toBeCloseTo(0, 4);
    expect(destination.longitude).toBeCloseTo(1, 2);
  });

  it("validates coordinate boundaries and finite values", () => {
    expect(isValidGeoPoint({ latitude: -90, longitude: -180 })).toBe(true);
    expect(isValidGeoPoint({ latitude: 90, longitude: 180 })).toBe(true);
    expect(isValidGeoPoint({ latitude: 0, longitude: 180.0001 })).toBe(false);
    expect(isValidGeoPoint({ latitude: Number.NaN, longitude: 0 })).toBe(false);
    expect(isValidGeoPoint({ latitude: 0, longitude: Number.NaN })).toBe(false);
  });
});
