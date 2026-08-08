import { describe, expect, it } from "vitest";

import { getEclipseEvent } from "../data/eclipseEvents";
import { calculateNasaLocalEclipse } from "./nasaBesselian";

describe("NASA Besselian local eclipse calculations", () => {
  it.each([
    ["spain-2026", { latitude: 41.81667, longitude: -3.185 }, 104.6],
    ["middle-east-2027", { latitude: 26.06167, longitude: 32.33333 }, 383.0],
    ["australia-2028", { latitude: -34.165, longitude: 151.56833 }, 227.2],
  ] as const)("matches NASA centre-line duration for %s", (eventId, location, durationSeconds) => {
    const result = calculateNasaLocalEclipse(getEclipseEvent(eventId), location, 0);

    expect(result).not.toBeNull();
    expect(result?.kind).toBe("total");
    expect(result?.obscuration).toBe(1);
    expect(result?.contacts.c2).not.toBeNull();
    expect(result?.contacts.c3).not.toBeNull();
    expect(
      ((result?.contacts.c3?.getTime() ?? 0) -
        (result?.contacts.c2?.getTime() ?? 0)) /
        1_000,
    ).toBeCloseTo(durationSeconds, 0);
    expect(result?.sky.c1?.azimuthDegrees).not.toBe(
      result?.sky.maximum.azimuthDegrees,
    );
  });

  it("returns partial circumstances without C2 and C3", () => {
    const result = calculateNasaLocalEclipse(
      getEclipseEvent("spain-2026"),
      { latitude: 40.4168, longitude: -3.7038 },
      0,
    );

    expect(result?.kind).toBe("partial");
    expect(result?.contacts.c2).toBeNull();
    expect(result?.contacts.c3).toBeNull();
    expect(result?.obscuration).toBeGreaterThan(0);
  });

  it("returns null when the eclipse does not reach the location", () => {
    expect(
      calculateNasaLocalEclipse(
        getEclipseEvent("spain-2026"),
        { latitude: -60, longitude: 0 },
        0,
      ),
    ).toBeNull();
  });
});
