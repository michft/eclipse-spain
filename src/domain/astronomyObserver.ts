import { Observer } from "astronomy-engine";

import type { GeoPoint } from "./geo";

/**
 * Builds Astronomy Engine's geodetic observer from WGS84 coordinates.
 *
 * Astronomy Engine does not accept a projection or datum argument. Its
 * Observer API expects latitude/longitude in degrees and height above mean
 * sea level in metres. GeoPoint uses that same WGS84 form: latitude
 * north-positive and longitude east-positive.
 */
export const createWgs84Observer = (
  location: GeoPoint,
  elevationMeters = 0,
): Observer => {
  const longitude = ((((location.longitude + 180) % 360) + 360) % 360) - 180;
  return new Observer(location.latitude, longitude, elevationMeters);
};
