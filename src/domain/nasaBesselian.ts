import type { EclipseEventDefinition } from "../data/eclipseEvents";
import type { GeoPoint } from "./geo";

interface Polynomial {
  readonly values: readonly [number, number, number, number];
}

interface BesselianElements {
  readonly t0HoursTdt: number;
  readonly deltaTSeconds: number;
  readonly x: Polynomial;
  readonly y: Polynomial;
  readonly d: Polynomial;
  readonly l1: Polynomial;
  readonly l2: Polynomial;
  readonly mu: Polynomial;
  readonly tanF1: number;
  readonly tanF2: number;
}

interface Circumstances {
  readonly l1: number;
  readonly l2: number;
  readonly distance: number;
  readonly altitudeDegrees: number;
  readonly azimuthDegrees: number;
}

export interface NasaLocalEclipse {
  readonly kind: "partial" | "annular" | "total";
  readonly magnitude: number;
  readonly obscuration: number;
  readonly contacts: {
    readonly c1: Date | null;
    readonly c2: Date | null;
    readonly maximum: Date;
    readonly c3: Date | null;
    readonly c4: Date | null;
  };
  readonly sky: {
    readonly c1: ContactSky | null;
    readonly c2: ContactSky | null;
    readonly maximum: ContactSky;
    readonly c3: ContactSky | null;
    readonly c4: ContactSky | null;
  };
}

export interface ContactSky {
  readonly altitudeDegrees: number;
  readonly azimuthDegrees: number;
}

const DEG = Math.PI / 180;
const EARTH_AXIS_RATIO = 0.99664719;
const EARTH_EQUATORIAL_RADIUS_METERS = 6_378_137;
const EARTH_ROTATION_DEGREES_PER_HOUR = 15.04106864;
const ELEMENTS_VALID_HOURS = 3;
const CONTACT_SCAN_STEP_HOURS = 1 / 60;

const p = (...values: [number, number, number, number]): Polynomial => ({values});

const ELEMENTS: Readonly<Record<EclipseEventDefinition["id"], BesselianElements>> = {
  "spain-2026": {
    t0HoursTdt: 18,
    deltaTSeconds: 71.4,
    x: p(0.475593, 0.5189288, -0.0000773, -0.0000088),
    y: p(0.771161, -0.2301664, -0.0001245, 0.0000037),
    d: p(14.79667, -0.012065, -0.000003, 0),
    l1: p(0.537954, 0.000094, -0.0000121, 0),
    l2: p(-0.008142, 0.0000935, -0.0000121, 0),
    mu: p(88.74776, 15.003093, 0, 0),
    tanF1: 0.0046141,
    tanF2: 0.0045911,
  },
  "middle-east-2027": {
    t0HoursTdt: 10,
    deltaTSeconds: 71.7,
    x: p(-0.019645, 0.5447105, -0.0000444, -0.0000091),
    y: p(0.160063, -0.2111569, -0.0001217, 0.0000037),
    d: p(17.76247, -0.010181, -0.000004, 0),
    l1: p(0.530596, 0.0000138, -0.0000128, 0),
    l2: p(-0.015464, 0.0000137, -0.0000128, 0),
    mu: p(328.42249, 15.002093, 0, 0),
    tanF1: 0.0046064,
    tanF2: 0.0045834,
  },
  "australia-2028": {
    t0HoursTdt: 3,
    deltaTSeconds: 72.1,
    x: p(-0.1543, 0.5449941, -0.0000226, -0.0000095),
    y: p(-0.58638, -0.1746077, -0.0001022, 0.0000029),
    d: p(20.18231, -0.007974, -0.000005, 0),
    l1: p(0.535236, -0.0000859, -0.0000123, 0),
    l2: p(-0.010847, -0.0000854, -0.0000122, 0),
    mu: p(223.37866, 15.001018, 0, 0),
    tanF1: 0.0046016,
    tanF2: 0.0045786,
  },
};

const polynomial = (polynomialValue: Polynomial, tauHours: number): number => {
  const [a0, a1, a2, a3] = polynomialValue.values;
  return a0 + tauHours * (a1 + tauHours * (a2 + tauHours * a3));
};

const eventMidnight = (event: EclipseEventDefinition): number =>
  Date.parse(`${event.eventDateUtc}T00:00:00.000Z`);

const dateFromTdtHours = (
  event: EclipseEventDefinition,
  hours: number,
  elements: BesselianElements,
): Date =>
  new Date(
    eventMidnight(event) + (hours - elements.deltaTSeconds / 3600) * 3_600_000,
  );

const observerFactors = (location: GeoPoint, elevationMeters: number) => {
  const latitude = location.latitude * DEG;
  const u = Math.atan(EARTH_AXIS_RATIO * Math.tan(latitude));
  const h = elevationMeters / EARTH_EQUATORIAL_RADIUS_METERS;
  return {
    rhoSinPhi: EARTH_AXIS_RATIO * Math.sin(u) + h * Math.sin(latitude),
    rhoCosPhi: Math.cos(u) + h * Math.cos(latitude),
    latitude,
  };
};

const atTau = (
  elements: BesselianElements,
  longitudeDegrees: number,
  factors: ReturnType<typeof observerFactors>,
  tauHours: number,
): Circumstances => {
  const {rhoSinPhi, rhoCosPhi, latitude} = factors;
  const d = polynomial(elements.d, tauHours) * DEG;
  const sinD = Math.sin(d);
  const cosD = Math.cos(d);
  const mu = polynomial(elements.mu, tauHours) * DEG;
  const x = polynomial(elements.x, tauHours);
  const y = polynomial(elements.y, tauHours);
  const l1 = polynomial(elements.l1, tauHours);
  const l2 = polynomial(elements.l2, tauHours);
  const hourAngle =
    mu + longitudeDegrees * DEG -
    (EARTH_ROTATION_DEGREES_PER_HOUR * elements.deltaTSeconds / 3600) * DEG;
  const sinH = Math.sin(hourAngle);
  const cosH = Math.cos(hourAngle);
  const xi = rhoCosPhi * sinH;
  const eta = rhoSinPhi * cosD - rhoCosPhi * cosH * sinD;
  const zeta = rhoSinPhi * sinD + rhoCosPhi * cosH * cosD;
  const u = x - xi;
  const v = y - eta;
  const altitude = Math.asin(
    Math.sin(latitude) * sinD + Math.cos(latitude) * cosD * cosH,
  );
  const azimuth = Math.atan2(
    sinH,
    cosH * Math.sin(latitude) - (sinD / cosD) * Math.cos(latitude),
  );
  return {
    l1: l1 - zeta * elements.tanF1,
    l2: l2 - zeta * elements.tanF2,
    distance: Math.hypot(u, v),
    altitudeDegrees: altitude / DEG,
    azimuthDegrees: (azimuth / DEG + 180 + 360) % 360,
  };
};

const minimise = (valueAt: (hours: number) => number, start: number, end: number): number => {
  let left = start;
  let right = end;
  const ratio = (Math.sqrt(5) - 1) / 2;
  let x1 = right - ratio * (right - left);
  let x2 = left + ratio * (right - left);
  let y1 = valueAt(x1);
  let y2 = valueAt(x2);
  for (let index = 0; index < 80; index += 1) {
    if (y1 < y2) {
      right = x2;
      x2 = x1;
      y2 = y1;
      x1 = right - ratio * (right - left);
      y1 = valueAt(x1);
    } else {
      left = x1;
      x1 = x2;
      y1 = y2;
      x2 = left + ratio * (right - left);
      y2 = valueAt(x2);
    }
  }
  return (left + right) / 2;
};

const root = (
  valueAt: (hours: number) => number,
  start: number,
  end: number,
): number => {
  let left = start;
  let right = end;
  let leftValue = valueAt(left);
  for (let index = 0; index < 60; index += 1) {
    const middle = (left + right) / 2;
    const middleValue = valueAt(middle);
    if (Math.abs(middleValue) < 1e-10) return middle;
    if (Math.sign(leftValue) === Math.sign(middleValue)) {
      left = middle;
      leftValue = middleValue;
    } else {
      right = middle;
    }
  }
  return (left + right) / 2;
};

const findContact = (
  valueAt: (hours: number) => number,
  maximumHours: number,
  before: boolean,
  limitHours: number,
): number | null => {
  let previous = maximumHours;
  let previousValue = valueAt(previous);
  const step = before ? -CONTACT_SCAN_STEP_HOURS : CONTACT_SCAN_STEP_HOURS;
  const steps = Math.floor(
    Math.abs(limitHours - maximumHours) / CONTACT_SCAN_STEP_HOURS,
  );
  for (let index = 0; index < steps; index += 1) {
    const current = previous + step;
    const currentValue = valueAt(current);
    if (Math.sign(previousValue) !== Math.sign(currentValue)) {
      return root(valueAt, Math.min(previous, current), Math.max(previous, current));
    }
    previous = current;
    previousValue = currentValue;
  }
  return null;
};

const obscuration = (
  distance: number,
  l1: number,
  l2: number,
  ratio: number,
  total: boolean,
): number => {
  if (distance >= l1) return 0;
  if (total) return 1;
  const c = Math.acos(
    Math.max(-1, Math.min(1, (l1 ** 2 + l2 ** 2 - 2 * distance ** 2) / (l1 ** 2 - l2 ** 2))),
  );
  const b = Math.acos(
    Math.max(-1, Math.min(1, (l1 * l2 + distance ** 2) / (distance * (l1 + l2)))),
  );
  return Math.max(
    0,
    Math.min(1, (ratio ** 2 * (Math.PI - b - c) + b - ratio * Math.sin(c)) / Math.PI),
  );
};

export const calculateNasaLocalEclipse = (
  event: EclipseEventDefinition,
  location: GeoPoint,
  elevationMeters: number,
): NasaLocalEclipse | null => {
  const elements = ELEMENTS[event.id];
  const factors = observerFactors(location, elevationMeters);
  const at = (hours: number): Circumstances =>
    atTau(elements, location.longitude, factors, hours - elements.t0HoursTdt);
  const minimumHours = elements.t0HoursTdt - ELEMENTS_VALID_HOURS;
  const maximumLimitHours = elements.t0HoursTdt + ELEMENTS_VALID_HOURS;
  const maximumHours = minimise(
    (hours) => at(hours).distance,
    minimumHours,
    maximumLimitHours,
  );
  const maximum = at(maximumHours);
  if (maximum.distance >= maximum.l1) return null;
  const ratio = (maximum.l1 - maximum.l2) / (maximum.l1 + maximum.l2);
  const magnitude = (maximum.l1 - maximum.distance) / (maximum.l1 + maximum.l2);
  const total = maximum.l2 < 0 && maximum.distance < Math.abs(maximum.l2);
  const kind = total ? "total" : maximum.l2 >= 0 && maximum.distance < maximum.l2 ? "annular" : "partial";
  const outerGap = (hours: number): number => {
    const circumstances = at(hours);
    return circumstances.distance - circumstances.l1;
  };
  const innerGap = (hours: number): number => {
    const circumstances = at(hours);
    return circumstances.distance - Math.abs(circumstances.l2);
  };
  const central = kind === "total" || kind === "annular";
  const c1Hours = findContact(outerGap, maximumHours, true, minimumHours);
  const c4Hours = findContact(outerGap, maximumHours, false, maximumLimitHours);
  const c2Hours = central
    ? findContact(innerGap, maximumHours, true, minimumHours)
    : null;
  const c3Hours = central
    ? findContact(innerGap, maximumHours, false, maximumLimitHours)
    : null;
  const c1 = c1Hours === null ? null : dateFromTdtHours(event, c1Hours, elements);
  const c2 = c2Hours === null ? null : dateFromTdtHours(event, c2Hours, elements);
  const c3 = c3Hours === null ? null : dateFromTdtHours(event, c3Hours, elements);
  const c4 = c4Hours === null ? null : dateFromTdtHours(event, c4Hours, elements);
  const skyAt = (hours: number | null): ContactSky | null => {
    if (hours === null) return null;
    const circumstances = at(hours);
    return {
      altitudeDegrees: circumstances.altitudeDegrees,
      azimuthDegrees: circumstances.azimuthDegrees,
    };
  };
  return {
    kind,
    magnitude: total || kind === "annular" ? ratio : magnitude,
    obscuration: obscuration(
      maximum.distance,
      maximum.l1,
      maximum.l2,
      ratio,
      total,
    ),
    contacts: {
      c1,
      c2,
      maximum: dateFromTdtHours(event, maximumHours, elements),
      c3,
      c4,
    },
    sky: {
      c1: skyAt(c1Hours),
      c2: skyAt(c2Hours),
      maximum: {
        altitudeDegrees: maximum.altitudeDegrees,
        azimuthDegrees: maximum.azimuthDegrees,
      },
      c3: skyAt(c3Hours),
      c4: skyAt(c4Hours),
    },
  };
};
