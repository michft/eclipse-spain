import { describe, expect, it } from "vitest";

import { getEclipseEvent } from "../data/eclipseEvents";
import {
  calculateLocalEclipse,
  calculateObserverSky,
  calculateSolarObscuration,
} from "./eclipse";
import { eclipseDiscGeometry } from "./eclipseOverlay";

const centralLocations = [
  {
    eventId: "spain-2026" as const,
    location: { latitude: 41.81667, longitude: -3.185 },
  },
  {
    eventId: "middle-east-2027" as const,
    location: { latitude: 26.06167, longitude: 32.33333 },
  },
  {
    eventId: "australia-2028" as const,
    location: { latitude: -34.165, longitude: 151.56833 },
  },
];

describe("local eclipse calculations", () => {
  it.each(centralLocations)(
    "calculates totality for $eventId",
    ({ eventId, location }) => {
      const result = calculateLocalEclipse(getEclipseEvent(eventId), location);

      expect(result.status).toBe("success");
      if (result.status !== "success") {
        return;
      }

      const { contacts } = result.value;
      expect(result.value.kind).toBe("total");
      expect(result.value.obscuration).toBe(1);
      expect(result.value.magnitude).toBeGreaterThan(1);
      expect(result.value.centerLineDistanceKm).toBeCloseTo(0, 6);
      expect(result.value.totalityDurationSeconds).toBeGreaterThan(60);
      expect(Date.parse(contacts.c1?.utc ?? "")).toBeLessThan(
        Date.parse(contacts.c2?.utc ?? ""),
      );
      expect(Date.parse(contacts.c2?.utc ?? "")).toBeLessThan(
        Date.parse(contacts.maximum?.utc ?? ""),
      );
      expect(Date.parse(contacts.maximum?.utc ?? "")).toBeLessThan(
        Date.parse(contacts.c3?.utc ?? ""),
      );
      expect(Date.parse(contacts.c3?.utc ?? "")).toBeLessThan(
        Date.parse(contacts.c4?.utc ?? ""),
      );
    },
  );

  it("returns partial contacts away from the totality path", () => {
    const result = calculateLocalEclipse(getEclipseEvent("spain-2026"), {
      latitude: 40.4168,
      longitude: -3.7038,
    });

    expect(result.status).toBe("success");
    if (result.status !== "success") {
      return;
    }

    expect(result.value.kind).toBe("partial");
    expect(result.value.contacts.c2).toBeNull();
    expect(result.value.contacts.c3).toBeNull();
    expect(result.value.contacts.c1).not.toBeNull();
    expect(result.value.contacts.c4).not.toBeNull();
    expect(result.value.obscuration).toBeGreaterThan(0.9);
  });

  it("rejects invalid coordinates without calling the astronomy library", () => {
    expect(
      calculateLocalEclipse(getEclipseEvent("spain-2026"), {
        latitude: 91,
        longitude: 0,
      }),
    ).toEqual({ status: "error", reason: "Latitude or longitude is invalid." });
  });

  it("calculates live obscuration from topocentric disc overlap", () => {
    const location = { latitude: 41.8167, longitude: -3.185 };
    const result = calculateLocalEclipse(getEclipseEvent("spain-2026"), location);
    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.value.contacts.maximum).not.toBeNull();
    }
    if (result.status !== "success" || !result.value.contacts.maximum) {
      return;
    }

    expect(
      calculateSolarObscuration(
        location,
        new Date(result.value.contacts.maximum.utc),
      ),
    ).toBeCloseTo(1, 6);
    expect(
      calculateSolarObscuration(location, new Date("2026-08-12T12:00:00Z")),
    ).toBe(0);
    expect(
      calculateSolarObscuration(
        location,
        new Date(result.value.contacts.maximum.utc),
        Number.NaN,
      ),
    ).toBe(0);
  });

  it("matches observer-sky obscuration during a partial overlap", () => {
    const location = { latitude: 40.4168, longitude: -3.7038 };
    const eclipse = calculateLocalEclipse(
      getEclipseEvent("spain-2026"),
      location,
    );
    expect(eclipse.status).toBe("success");
    if (eclipse.status !== "success" || !eclipse.value.contacts.maximum) {
      return;
    }
    const date = new Date(eclipse.value.contacts.maximum.utc);
    const obscuration = calculateSolarObscuration(location, date);
    const sky = calculateObserverSky(location, date);

    expect(obscuration).toBeGreaterThan(0);
    expect(obscuration).toBeLessThan(1);
    expect(sky?.obscuration).toBeCloseTo(obscuration, 9);
  });

  it("calculates live Sun and Moon positions for the observer sky", () => {
    const location = { latitude: 41.8167, longitude: -3.185 };
    const eclipse = calculateLocalEclipse(
      getEclipseEvent("spain-2026"),
      location,
    );
    expect(eclipse.status).toBe("success");
    if (eclipse.status !== "success" || !eclipse.value.contacts.maximum) {
      return;
    }

    const sky = calculateObserverSky(
      location,
      new Date(eclipse.value.contacts.maximum.utc),
    );

    expect(sky).not.toBeNull();
    expect(sky?.obscuration).toBeCloseTo(1, 6);
    expect(sky?.sun.altitudeDegrees).toBeGreaterThan(0);
    expect(
      Math.abs((sky?.sun.azimuthDegrees ?? 0) - (sky?.moon.azimuthDegrees ?? 0)),
    ).toBeLessThan(1);
  });

  it("preserves physical contact phases around C1 through C4", () => {
    const location = { latitude: 41.8167, longitude: -3.185 };
    const eclipse = calculateLocalEclipse(
      getEclipseEvent("spain-2026"),
      location,
    );
    expect(eclipse.status).toBe("success");
    if (eclipse.status !== "success") return;
    const { c1, c2, c3, c4 } = eclipse.value.contacts;
    if (!c1 || !c2 || !c3 || !c4) {
      throw new Error("Expected total-eclipse contacts.");
    }
    const obscurationAt = (milliseconds: number): number =>
      calculateObserverSky(location, new Date(milliseconds))?.obscuration ?? -1;
    const c1Time = Date.parse(c1.utc);
    const c2Time = Date.parse(c2.utc);
    const c3Time = Date.parse(c3.utc);
    const c4Time = Date.parse(c4.utc);

    expect(obscurationAt(c1Time - 1_000)).toBe(0);
    expect(obscurationAt(c1Time)).toBeCloseTo(0, 6);
    expect(obscurationAt((c1Time + c2Time) / 2)).toBeGreaterThan(0);
    expect(obscurationAt((c1Time + c2Time) / 2)).toBeLessThan(1);
    expect(obscurationAt(c2Time)).toBeCloseTo(1, 6);
    expect(obscurationAt((c2Time + c3Time) / 2)).toBeCloseTo(1, 6);
    expect(obscurationAt(c3Time)).toBeCloseTo(1, 6);
    expect(obscurationAt((c3Time + c4Time) / 2)).toBeGreaterThan(0);
    expect(obscurationAt((c3Time + c4Time) / 2)).toBeLessThan(1);
    expect(obscurationAt(c4Time)).toBeCloseTo(0, 6);
    expect(obscurationAt(c4Time + 1_000)).toBe(0);
  });

  it("calculates contact tangencies without display geometry overrides", () => {
    const location = { latitude: 41.8167, longitude: -3.185 };
    const eclipse = calculateLocalEclipse(
      getEclipseEvent("spain-2026"),
      location,
    );
    expect(eclipse.status).toBe("success");
    if (eclipse.status !== "success") return;
    const { c1, c2, c3, c4 } = eclipse.value.contacts;
    if (!c1 || !c2 || !c3 || !c4) {
      throw new Error("Expected total-eclipse contacts.");
    }

    const geometryAt = (utc: string) => {
      const sky = calculateObserverSky(location, new Date(utc));
      if (!sky) throw new Error("Expected observer sky at contact.");
      return eclipseDiscGeometry(sky);
    };
    for (const contact of [c1, c4]) {
      const geometry = geometryAt(contact.utc);
      expect(
        Math.abs(
          geometry.separationDegrees -
            (geometry.sunRadiusDegrees + geometry.moonRadiusDegrees),
        ),
      ).toBeLessThan(0.001);
    }
    for (const contact of [c2, c3]) {
      const geometry = geometryAt(contact.utc);
      expect(
        Math.abs(
          geometry.separationDegrees -
            Math.abs(
              geometry.moonRadiusDegrees - geometry.sunRadiusDegrees,
            ),
        ),
      ).toBeLessThan(0.001);
    }
  });
});
