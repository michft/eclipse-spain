import {
  Body,
  EclipseKind,
  Equator,
  Horizon,
  Observer,
  SearchLocalSolarEclipse,
  type EclipseEvent,
  type EquatorialCoordinates,
} from "astronomy-engine";

import type { EclipseEventDefinition } from "../data/eclipseEvents";
import { distanceToPolylineKm, isValidGeoPoint, type GeoPoint } from "./geo";

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

const calculateMagnitude = (
  observer: Observer,
  peakTime: EclipseEvent["time"],
): number => {
  const sun = Equator(Body.Sun, peakTime, observer, false, true);
  const moon = Equator(Body.Moon, peakTime, observer, false, true);
  const separation = angularSeparationRadians(sun.ra, sun.dec, moon.ra, moon.dec);
  const sunRadius = Math.asin(SUN_RADIUS_KM / (sun.dist * ASTRONOMICAL_UNIT_KM));
  const moonRadius = Math.asin(
    MOON_RADIUS_KM / (moon.dist * ASTRONOMICAL_UNIT_KM),
  );

  return Math.max(0, (sunRadius + moonRadius - separation) / (2 * sunRadius));
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
  const observer = new Observer(
    location.latitude,
    location.longitude,
    elevationMeters,
  );
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
  const observer = new Observer(
    location.latitude,
    location.longitude,
    elevationMeters,
  );
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
  event: EclipseEvent | undefined,
  observer: Observer,
): EclipseContact | null => {
  if (!event) {
    return null;
  }

  const sun = Equator(Body.Sun, event.time, observer, true, true);
  const horizontal = Horizon(
    event.time,
    observer,
    sun.ra,
    sun.dec,
    "normal",
  );

  return {
    id,
    label,
    utc: event.time.date.toISOString(),
    sunAltitudeDegrees: event.altitude,
    sunAzimuthDegrees: horizontal.azimuth,
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

const isSupportedEventResult = (
  peakDate: Date,
  definition: EclipseEventDefinition,
): boolean => peakDate.toISOString().slice(0, 10) === definition.eventDateUtc;

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
    const observer = new Observer(
      location.latitude,
      location.longitude,
      elevationMeters,
    );
    const eclipse = SearchLocalSolarEclipse(
      new Date(definition.searchStartUtc),
      observer,
    );

    if (!isSupportedEventResult(eclipse.peak.time.date, definition)) {
      return {
        status: "unavailable",
        reason: "This eclipse does not reach the selected location.",
      };
    }

    const c1 = makeContact("c1", "Initial contact", eclipse.partial_begin, observer);
    const c2 = makeContact("c2", "Start of totality", eclipse.total_begin, observer);
    const maximum = makeContact("maximum", "Maximum eclipse", eclipse.peak, observer);
    const c3 = makeContact("c3", "End of totality", eclipse.total_end, observer);
    const c4 = makeContact("c4", "End of eclipse", eclipse.partial_end, observer);

    return {
      status: "success",
      value: {
        eventId: definition.id,
        kind:
          eclipse.kind === EclipseKind.Total
            ? "total"
            : eclipse.kind === EclipseKind.Annular
              ? "annular"
              : "partial",
        obscuration: eclipse.obscuration,
        magnitude: calculateMagnitude(observer, eclipse.peak.time),
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
