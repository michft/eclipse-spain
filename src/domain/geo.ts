export interface GeoPoint {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_KM = 6371.0088;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

const angularDistance = (from: GeoPoint, to: GeoPoint): number => {
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);
  const halfChord =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 2 * Math.atan2(Math.sqrt(halfChord), Math.sqrt(1 - halfChord));
};

const initialBearing = (from: GeoPoint, to: GeoPoint): number => {
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);

  return Math.atan2(
    Math.sin(longitudeDelta) * Math.cos(toLatitude),
    Math.cos(fromLatitude) * Math.sin(toLatitude) -
      Math.sin(fromLatitude) * Math.cos(toLatitude) * Math.cos(longitudeDelta),
  );
};

export const distanceKm = (from: GeoPoint, to: GeoPoint): number =>
  angularDistance(from, to) * EARTH_RADIUS_KM;

export const distanceToSegmentKm = (
  point: GeoPoint,
  start: GeoPoint,
  end: GeoPoint,
): number => {
  const segmentLength = angularDistance(start, end);
  if (segmentLength === 0) {
    return distanceKm(point, start);
  }

  const startToPoint = angularDistance(start, point);
  const segmentBearing = initialBearing(start, end);
  const pointBearing = initialBearing(start, point);
  const bearingDelta = pointBearing - segmentBearing;
  const crossTrack = Math.asin(
    Math.sin(startToPoint) * Math.sin(bearingDelta),
  );
  const alongTrack = Math.atan2(
    Math.sin(startToPoint) * Math.cos(bearingDelta),
    Math.cos(startToPoint),
  );

  if (alongTrack <= 0) {
    return distanceKm(point, start);
  }
  if (alongTrack >= segmentLength) {
    return distanceKm(point, end);
  }

  return Math.abs(crossTrack) * EARTH_RADIUS_KM;
};

export const distanceToPolylineKm = (
  point: GeoPoint,
  polyline: readonly GeoPoint[],
): number | null => {
  if (polyline.length === 0) {
    return null;
  }
  if (polyline.length === 1) {
    const onlyPoint = polyline[0];
    return onlyPoint ? distanceKm(point, onlyPoint) : null;
  }

  let shortest = Number.POSITIVE_INFINITY;
  for (let index = 1; index < polyline.length; index += 1) {
    const start = polyline[index - 1];
    const end = polyline[index];
    if (start && end) {
      shortest = Math.min(shortest, distanceToSegmentKm(point, start, end));
    }
  }

  return Number.isFinite(shortest) ? shortest : null;
};

export const isValidGeoPoint = (point: GeoPoint): boolean =>
  Number.isFinite(point.latitude) &&
  Number.isFinite(point.longitude) &&
  point.latitude >= -90 &&
  point.latitude <= 90 &&
  point.longitude >= -180 &&
  point.longitude <= 180;
