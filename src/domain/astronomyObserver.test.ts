import { describe, expect, it } from "vitest";

import { createWgs84Observer } from "./astronomyObserver";

describe("createWgs84Observer", () => {
  it("passes WGS84 geodetic latitude, east-positive longitude, and metres", () => {
    const observer = createWgs84Observer(
      { latitude: 41.81667, longitude: -363.185 },
      742,
    );

    expect(observer.latitude).toBe(41.81667);
    expect(observer.longitude).toBeCloseTo(-3.185, 12);
    expect(observer.height).toBe(742);
  });

  it("normalises the +180 meridian to -180 and defaults height to zero", () => {
    const observer = createWgs84Observer({ latitude: 0, longitude: 180 });

    expect(observer.longitude).toBeCloseTo(-180, 12);
    expect(observer.height).toBe(0);
  });
});
