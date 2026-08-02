import type { GeoPoint } from "./geo";

const EARTH_RADIUS_METERS = 6_371_008.8;

export interface ElevationSample {
  location: GeoPoint;
  distanceKm: number;
  elevationMeters: number;
}

export interface HorizonSample extends ElevationSample {
  curvatureDropMeters: number;
  apparentTerrainAngleDegrees: number;
}

export interface HorizonProfile {
  observerElevationMeters: number;
  azimuthDegrees: number;
  samples: readonly HorizonSample[];
  highestTerrainAngleDegrees: number;
}

export const makeHorizonProfile = (
  observerElevationMeters: number,
  azimuthDegrees: number,
  samples: readonly ElevationSample[],
): HorizonProfile => {
  const horizonSamples = samples.map((sample): HorizonSample => {
    const distanceMeters = sample.distanceKm * 1000;
    const curvatureDropMeters =
      distanceMeters === 0
        ? 0
        : (distanceMeters * distanceMeters) / (2 * EARTH_RADIUS_METERS);
    const apparentTerrainAngleDegrees =
      distanceMeters === 0
        ? 0
        : (Math.atan2(
            sample.elevationMeters -
              observerElevationMeters -
              curvatureDropMeters,
            distanceMeters,
          ) *
            180) /
          Math.PI;

    return {
      ...sample,
      curvatureDropMeters,
      apparentTerrainAngleDegrees,
    };
  });

  return {
    observerElevationMeters,
    azimuthDegrees,
    samples: horizonSamples,
    highestTerrainAngleDegrees: Math.max(
      0,
      ...horizonSamples.map((sample) => sample.apparentTerrainAngleDegrees),
    ),
  };
};
