import type { ContactRecord } from "./audioTimeline";
import type { LocalEclipseCircumstances, ObserverSkyState } from "./eclipse";

export interface EclipsePhase {
  id:
    | "before-c1"
    | "c1"
    | "partial-increasing"
    | "c2"
    | "totality"
    | "annularity"
    | "c3"
    | "partial-maximum"
    | "partial-decreasing"
    | "c4"
    | "after-c4";
  label: string;
}

export interface EclipseDiscGeometry {
  directionX: number;
  directionY: number;
  moonRadiusDegrees: number;
  separationDegrees: number;
  sunRadiusDegrees: number;
}

const milliseconds = (utc: string | undefined): number =>
  Date.parse(utc ?? "");

export const eclipsePhaseAt = (
  contacts: ContactRecord,
  kind: LocalEclipseCircumstances["kind"],
  currentMilliseconds: number,
): EclipsePhase => {
  const c1 = milliseconds(contacts.c1?.utc);
  const c2 = milliseconds(contacts.c2?.utc);
  const maximum = milliseconds(contacts.maximum?.utc);
  const c3 = milliseconds(contacts.c3?.utc);
  const c4 = milliseconds(contacts.c4?.utc);

  if (currentMilliseconds < c1) {
    return { id: "before-c1", label: "Before C1 · no contact" };
  }
  if (currentMilliseconds === c1) {
    return { id: "c1", label: "C1 · edges touching" };
  }
  if (currentMilliseconds > c4) {
    return { id: "after-c4", label: "After C4 · no contact" };
  }
  if (currentMilliseconds === c4) {
    return { id: "c4", label: "C4 · contact ending" };
  }

  if (Number.isFinite(c2) && Number.isFinite(c3)) {
    if (currentMilliseconds < c2) {
      return {
        id: "partial-increasing",
        label: "Partial phase · increasing",
      };
    }
    if (currentMilliseconds === c2) {
      return {
        id: "c2",
        label:
          kind === "annular"
            ? "C2 · annularity begins"
            : "C2 · full obscuration begins",
      };
    }
    if (currentMilliseconds < c3) {
      return kind === "annular"
        ? { id: "annularity", label: "Annularity · ring of Sun visible" }
        : { id: "totality", label: "Totality · Sun fully obscured" };
    }
    if (currentMilliseconds === c3) {
      return {
        id: "c3",
        label:
          kind === "annular"
            ? "C3 · annularity ends"
            : "C3 · full obscuration ends",
      };
    }
    return {
      id: "partial-decreasing",
      label: "Partial phase · decreasing",
    };
  }

  if (currentMilliseconds < maximum) {
    return {
      id: "partial-increasing",
      label: "Partial phase · increasing",
    };
  }
  if (currentMilliseconds === maximum) {
    return {
      id: "partial-maximum",
      label: "Maximum partial eclipse",
    };
  }
  return {
    id: "partial-decreasing",
    label: "Partial phase · decreasing",
  };
};

const radians = (degrees: number): number => (degrees * Math.PI) / 180;
const degrees = (angleRadians: number): number =>
  (angleRadians * 180) / Math.PI;
const clampUnit = (value: number): number => Math.max(-1, Math.min(1, value));

export const eclipseDiscGeometry = (
  sky: ObserverSkyState,
): EclipseDiscGeometry => {
  const sunAltitude = radians(sky.sun.altitudeDegrees);
  const moonAltitude = radians(sky.moon.altitudeDegrees);
  const azimuthDelta = radians(
    sky.moon.azimuthDegrees - sky.sun.azimuthDegrees,
  );
  const actualSeparationDegrees = degrees(
    Math.acos(
      clampUnit(
        Math.sin(sunAltitude) * Math.sin(moonAltitude) +
          Math.cos(sunAltitude) *
            Math.cos(moonAltitude) *
            Math.cos(azimuthDelta),
      ),
    ),
  );
  const east = Math.cos(moonAltitude) * Math.sin(azimuthDelta);
  const up =
    Math.cos(sunAltitude) * Math.sin(moonAltitude) -
    Math.sin(sunAltitude) *
      Math.cos(moonAltitude) *
      Math.cos(azimuthDelta);
  const directionLength = Math.hypot(east, up);
  const directionX = directionLength === 0 ? 1 : east / directionLength;
  const directionY = directionLength === 0 ? 0 : -up / directionLength;
  const sunRadiusDegrees = sky.sun.angularRadiusDegrees;
  const moonRadiusDegrees = sky.moon.angularRadiusDegrees;

  return {
    directionX,
    directionY,
    moonRadiusDegrees,
    separationDegrees: actualSeparationDegrees,
    sunRadiusDegrees,
  };
};
