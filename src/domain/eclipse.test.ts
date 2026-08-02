import { describe, expect, it } from "vitest";

import { getEclipseEvent } from "../data/eclipseEvents";
import { calculateLocalEclipse, calculateSolarObscuration } from "./eclipse";

const centralLocations = [
  {
    eventId: "spain-2026" as const,
    location: { latitude: 41.8167, longitude: -3.185 },
  },
  {
    eventId: "middle-east-2027" as const,
    location: { latitude: 26.0617, longitude: 32.3333 },
  },
  {
    eventId: "australia-2028" as const,
    location: { latitude: -34.165, longitude: 151.5683 },
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
});
