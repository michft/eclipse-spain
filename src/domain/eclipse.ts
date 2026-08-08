import {
  Body,
  Equator,
  Horizon,
  type EquatorialCoordinates,
  type Observer,
} from "astronomy-engine";

import type { EclipseEventDefinition } from "../data/eclipseEvents";
import { createWgs84Observer } from "./astronomyObserver";
import { distanceToPolylineKm, isValidGeoPoint, type GeoPoint } from "./geo";
import { calculateNasaLocalEclipse } from "./nasaBesselian";

const ASTRONOMICAL_UNIT_KM = 149_597_870.7;
const SUN_RADIUS_KM = 695_700;
const MOON_RADIUS_KM = 1_737.4;

export const CONTACT_IDS = ["c1", "c2", "maximum", "c3", "c4"] as const;
export type ContactId = (typeof CONTACT_IDS)[number];

export interface EclipseContact {
  id: ContactId;
  label: string;
  utc: string;
  sunAltitudeDegrees: number;
  sunAzimuthDegrees: number;
}

export interface LocalEclipseCircumstances {
  eventId: EclipseEventDefinition["id"];
  kind: "partial" | "annular" | "total";
  obscuration: number;
  magnitude: number;
  contacts: Readonly<Record<ContactId, EclipseContact | null>>;
  totalityDurationSeconds: number | null;
  centerLineDistanceKm: number | null;
}

export interface SkyBodyPosition {
  altitudeDegrees: number;
  angularRadiusDegrees: number;
  azimuthDegrees: number;
}

export interface ObserverSkyState {
  moon: SkyBodyPosition;
  obscuration: number;
  sun: SkyBodyPosition;
  utc: string;
}

export type EclipseCalculationResult =
  | { status: "success"; value: LocalEclipseCircumstances }
  | { status: "unavailable"; reason: string }
  | { status: "error"; reason: string };

const clampUnit = (value: number): number => Math.max(-1, Math.min(1, value));

const angularSeparationRadians = (
  firstRaHours: number,
  firstDecDegrees: number,
  secondRaHours: number,
  secondDecDegrees: number,
): number => {
  const firstDec = (firstDecDegrees * Math.PI) / 180;
  const secondDec = (secondDecDegrees * Math.PI) / 180;
  const raDelta = ((firstRaHours - secondRaHours) * 15 * Math.PI) / 180;

  return Math.acos(
    clampUnit(
      Math.sin(firstDec) * Math.sin(secondDec) +
        Math.cos(firstDec) * Math.cos(secondDec) * Math.cos(raDelta),
    ),
  );
};

const circleOverlapFraction = (
  sunRadius: number,
  moonRadius: number,
  separation: number,
): number => {
  if (separation >= sunRadius + moonRadius) {
    return 0;
  }
  if (separation <= Math.abs(sunRadius - moonRadius)) {
    return Math.min(1, (moonRadius * moonRadius) / (sunRadius * sunRadius));
  }

  const sunAngle = Math.acos(
    clampUnit(
      (separation * separation + sunRadius * sunRadius - moonRadius * moonRadius) /
        (2 * separation * sunRadius),
    ),
  );
  const moonAngle = Math.acos(
    clampUnit(
      (separation * separation + moonRadius * moonRadius - sunRadius * sunRadius) /
        (2 * separation * moonRadius),
    ),
  );
  const lens =
    sunRadius * sunRadius * sunAngle +
    moonRadius * moonRadius * moonAngle -
    0.5 *
      Math.sqrt(
        Math.max(
          0,
          (-separation + sunRadius + moonRadius) *
            (separation + sunRadius - moonRadius) *
            (separation - sunRadius + moonRadius) *
            (separation + sunRadius + moonRadius),
        ),
      );

  return Math.max(0, Math.min(1, lens / (Math.PI * sunRadius * sunRadius)));
};

const obscurationFrom = (
  sun: EquatorialCoordinates,
  moon: EquatorialCoordinates,
): number => {
  const separation = angularSeparationRadians(sun.ra, sun.dec, moon.ra, moon.dec);
  const sunRadius = Math.asin(SUN_RADIUS_KM / (sun.dist * ASTRONOMICAL_UNIT_KM));
  const moonRadius = Math.asin(
    MOON_RADIUS_KM / (moon.dist * ASTRONOMICAL_UNIT_KM),
  );
  return circleOverlapFraction(sunRadius, moonRadius, separation);
};

export const calculateSolarObscuration = (
  location: GeoPoint,
  date: Date,
  elevationMeters = 0,
): number => {
  if (
    !isValidGeoPoint(location) ||
    !Number.isFinite(date.getTime()) ||
    !Number.isFinite(elevationMeters)
  ) {
    return 0;
  }
  const observer = createWgs84Observer(location, elevationMeters);
  const sun = Equator(Body.Sun, date, observer, false, true);
  const moon = Equator(Body.Moon, date, observer, false, true);
  return obscurationFrom(sun, moon);
};

export const calculateObserverSky = (
  location: GeoPoint,
  date: Date,
  elevationMeters = 0,
): ObserverSkyState | null => {
  if (
    !isValidGeoPoint(location) ||
    !Number.isFinite(date.getTime()) ||
    !Number.isFinite(elevationMeters)
  ) {
    return null;
  }
  const observer = createWgs84Observer(location, elevationMeters);
  const sunEquator = Equator(Body.Sun, date, observer, true, true);
  const moonEquator = Equator(Body.Moon, date, observer, true, true);
  const sunHorizon = Horizon(
    date,
    observer,
    sunEquator.ra,
    sunEquator.dec,
    "normal",
  );
  const moonHorizon = Horizon(
    date,
    observer,
    moonEquator.ra,
    moonEquator.dec,
    "normal",
  );
  const angularRadiusDegrees = (radiusKm: number, distanceAu: number): number =>
    (Math.asin(radiusKm / (distanceAu * ASTRONOMICAL_UNIT_KM)) * 180) /
    Math.PI;
  return {
    utc: date.toISOString(),
    obscuration: obscurationFrom(sunEquator, moonEquator),
    sun: {
      altitudeDegrees: sunHorizon.altitude,
      azimuthDegrees: sunHorizon.azimuth,
      angularRadiusDegrees: angularRadiusDegrees(SUN_RADIUS_KM, sunEquator.dist),
    },
    moon: {
      altitudeDegrees: moonHorizon.altitude,
      azimuthDegrees: moonHorizon.azimuth,
      angularRadiusDegrees: angularRadiusDegrees(MOON_RADIUS_KM, moonEquator.dist),
    },
  };
};

const makeContact = (
  id: ContactId,
  label: string,
  utc: Date | null,
  sunAltitudeDegrees: number | null,
  sunAzimuthDegrees: number,
): EclipseContact | null => {
  if (!utc || !Number.isFinite(utc.getTime()) || sunAltitudeDegrees === null) {
    return null;
  }
  return {
    id,
    label,
    utc: utc.toISOString(),
    sunAltitudeDegrees,
    sunAzimuthDegrees,
  };
};

const durationSeconds = (
  start: EclipseContact | null,
  end: EclipseContact | null,
): number | null => {
  if (!start || !end) {
    return null;
  }
  return (Date.parse(end.utc) - Date.parse(start.utc)) / 1000;
};

export const calculateLocalEclipse = (
  definition: EclipseEventDefinition,
  location: GeoPoint,
  elevationMeters = 0,
): EclipseCalculationResult => {
  if (!isValidGeoPoint(location)) {
    return { status: "error", reason: "Latitude or longitude is invalid." };
  }
  if (!Number.isFinite(elevationMeters)) {
    return { status: "error", reason: "Elevation is invalid." };
  }

  try {
    const nasa = calculateNasaLocalEclipse(definition, location, elevationMeters);
    if (!nasa) {
      return {
        status: "unavailable",
        reason: "This eclipse does not reach the selected location.",
      };
    }

    const c1 = makeContact(
      "c1",
      "Initial contact",
      nasa.contacts.c1,
      nasa.sky.c1?.altitudeDegrees ?? null,
      nasa.sky.c1?.azimuthDegrees ?? 0,
    );
    const c2 = makeContact(
      "c2",
      "Start of totality",
      nasa.contacts.c2,
      nasa.sky.c2?.altitudeDegrees ?? null,
      nasa.sky.c2?.azimuthDegrees ?? 0,
    );
    const maximum = makeContact(
      "maximum",
      "Maximum eclipse",
      nasa.contacts.maximum,
      nasa.sky.maximum.altitudeDegrees,
      nasa.sky.maximum.azimuthDegrees,
    );
    const c3 = makeContact(
      "c3",
      "End of totality",
      nasa.contacts.c3,
      nasa.sky.c3?.altitudeDegrees ?? null,
      nasa.sky.c3?.azimuthDegrees ?? 0,
    );
    const c4 = makeContact(
      "c4",
      "End of eclipse",
      nasa.contacts.c4,
      nasa.sky.c4?.altitudeDegrees ?? null,
      nasa.sky.c4?.azimuthDegrees ?? 0,
    );

    return {
      status: "success",
      value: {
        eventId: definition.id,
        kind: nasa.kind,
        obscuration: nasa.obscuration,
        magnitude: nasa.magnitude,
        contacts: { c1, c2, maximum, c3, c4 },
        totalityDurationSeconds: durationSeconds(c2, c3),
        centerLineDistanceKm: distanceToPolylineKm(
          location,
          definition.centerLine,
        ),
      },
    };
  } catch (error: unknown) {
    return {
      status: "error",
      reason: error instanceof Error ? error.message : "Eclipse calculation failed.",
    };
  }
};
