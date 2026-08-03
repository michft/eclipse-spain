import { destinationPoint, type GeoPoint } from "../domain/geo";
import {
  makeHorizonProfile,
  type ElevationSample,
  type HorizonProfile,
  type TerrainSkyline,
} from "../domain/horizon";
import type { FetchFunction, ServiceResult } from "./result";
import { createRequestTimeout } from "./requestTimeout";
import {
  DEFAULT_RATE_LIMIT_BACKOFF_BUDGET_MILLISECONDS,
  fetchWithRateLimitBackoff,
} from "./rateLimitBackoff";

export const OPEN_METEO_ELEVATION_URL = "https://api.open-meteo.com/v1/elevation";
export const OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
export const OPEN_METEO_ELEVATION_SOURCE_URL =
  "https://open-meteo.com/en/docs/elevation-api";
export const OPEN_METEO_FORECAST_SOURCE_URL = "https://open-meteo.com/en/docs";

const HORIZON_DISTANCES_KM = [0.25, 0.5, 1, 2, 5, 10, 20] as const;
const HORIZON_AZIMUTH_OFFSETS_DEGREES = [
  -40, -33.333, -26.667, -20, -13.333, -6.667, 0, 6.667, 13.333, 20,
  26.667, 33.333, 40,
] as const;
const FORECAST_RANGE_DAYS = 16;
const OPEN_METEO_TIMEOUT_MILLISECONDS =
  DEFAULT_RATE_LIMIT_BACKOFF_BUDGET_MILLISECONDS + 11_000;

interface ElevationResponse {
  elevation: number[];
}

export interface ElevationProfileResult {
  observerElevationMeters: number;
  horizon: HorizonProfile;
  skyline: TerrainSkyline;
  sourceUrl: string;
  retrievedUtc: string;
}

export interface CloudForecast {
  validUtc: string;
  retrievedUtc: string;
  totalPercent: number;
  lowPercent: number;
  middlePercent: number;
  highPercent: number;
  sourceUrl: string;
}

const isNumberArray = (value: unknown): value is number[] =>
  Array.isArray(value) && value.every((item) => typeof item === "number");

const parseElevationResponse = (value: unknown): ElevationResponse | null => {
  if (
    typeof value !== "object" ||
    value === null ||
    !("elevation" in value) ||
    !isNumberArray(value.elevation)
  ) {
    return null;
  }
  return { elevation: value.elevation };
};

const responseReason = async (response: Response): Promise<string> => {
  try {
    const value: unknown = await response.json();
    if (
      typeof value === "object" &&
      value !== null &&
      "reason" in value &&
      typeof value.reason === "string"
    ) {
      return value.reason;
    }
  } catch {
    // Provider error bodies are not guaranteed to be JSON.
  }
  return `Request failed with HTTP ${response.status}.`;
};

export const fetchElevationProfile = async (
  location: GeoPoint,
  azimuthDegrees: number,
  fetchFunction: FetchFunction = fetch,
  now: Date = new Date(),
): Promise<ServiceResult<ElevationProfileResult>> => {
  const skylineRays = HORIZON_AZIMUTH_OFFSETS_DEGREES.map((offsetDegrees) => ({
    azimuthDegrees: azimuthDegrees + offsetDegrees,
    offsetDegrees,
    locations: HORIZON_DISTANCES_KM.map((distanceKm) =>
      destinationPoint(location, azimuthDegrees + offsetDegrees, distanceKm),
    ),
  }));
  const requestLocations = [
    location,
    ...skylineRays.flatMap((ray) => ray.locations),
  ];
  const query = new URLSearchParams({
    latitude: requestLocations.map((point) => point.latitude.toFixed(6)).join(","),
    longitude: requestLocations
      .map((point) => point.longitude.toFixed(6))
      .join(","),
  });

  const timeout = createRequestTimeout(OPEN_METEO_TIMEOUT_MILLISECONDS);
  try {
    const response = await fetchWithRateLimitBackoff(
      fetchFunction,
      `${OPEN_METEO_ELEVATION_URL}?${query}`,
      { signal: timeout.signal },
    );
    if (!response.ok) {
      return { status: "error", reason: await responseReason(response) };
    }
    const parsed = parseElevationResponse(await response.json());
    if (!parsed || parsed.elevation.length !== requestLocations.length) {
      return { status: "error", reason: "Elevation response was incomplete." };
    }

    const observerElevationMeters = parsed.elevation[0];
    if (observerElevationMeters === undefined) {
      return { status: "error", reason: "Observer elevation was missing." };
    }
    const profiles = skylineRays.map((ray, rayIndex) => {
      const samples: ElevationSample[] = ray.locations.flatMap(
        (profileLocation, distanceIndex) => {
          const responseIndex =
            1 + rayIndex * HORIZON_DISTANCES_KM.length + distanceIndex;
          const elevationMeters = parsed.elevation[responseIndex];
          const distanceKm = HORIZON_DISTANCES_KM[distanceIndex];
          return elevationMeters === undefined || distanceKm === undefined
            ? []
            : [{ location: profileLocation, distanceKm, elevationMeters }];
        },
      );
      return {
        offsetDegrees: ray.offsetDegrees,
        profile: makeHorizonProfile(
          observerElevationMeters,
          ray.azimuthDegrees,
          samples,
        ),
      };
    });
    const centerProfile = profiles.find(
      (profile) => profile.offsetDegrees === 0,
    );
    if (!centerProfile) {
      return { status: "error", reason: "Terrain skyline was incomplete." };
    }

    return {
      status: "success",
      value: {
        observerElevationMeters,
        horizon: centerProfile.profile,
        skyline: {
          centerAzimuthDegrees: azimuthDegrees,
          fieldOfViewDegrees: 80,
          samples: profiles.map(({ offsetDegrees, profile }) => ({
            azimuthDegrees: profile.azimuthDegrees,
            azimuthOffsetDegrees: offsetDegrees,
            terrainAngleDegrees: profile.highestTerrainAngleDegrees,
          })),
        },
        sourceUrl: OPEN_METEO_ELEVATION_SOURCE_URL,
        retrievedUtc: now.toISOString(),
      },
    };
  } catch (error: unknown) {
    return {
      status: "error",
      reason: error instanceof Error ? error.message : "Elevation request failed.",
    };
  } finally {
    timeout.clear();
  }
};

interface CloudHourlyResponse {
  time: string[];
  cloud_cover: number[];
  cloud_cover_low: number[];
  cloud_cover_mid: number[];
  cloud_cover_high: number[];
}

const parseCloudHourly = (value: unknown): CloudHourlyResponse | null => {
  if (
    typeof value !== "object" ||
    value === null ||
    !("hourly" in value) ||
    typeof value.hourly !== "object" ||
    value.hourly === null
  ) {
    return null;
  }
  const hourly = value.hourly;
  if (
    !("time" in hourly) ||
    !Array.isArray(hourly.time) ||
    !hourly.time.every((item) => typeof item === "string") ||
    !("cloud_cover" in hourly) ||
    !isNumberArray(hourly.cloud_cover) ||
    !("cloud_cover_low" in hourly) ||
    !isNumberArray(hourly.cloud_cover_low) ||
    !("cloud_cover_mid" in hourly) ||
    !isNumberArray(hourly.cloud_cover_mid) ||
    !("cloud_cover_high" in hourly) ||
    !isNumberArray(hourly.cloud_cover_high)
  ) {
    return null;
  }

  return {
    time: hourly.time,
    cloud_cover: hourly.cloud_cover,
    cloud_cover_low: hourly.cloud_cover_low,
    cloud_cover_mid: hourly.cloud_cover_mid,
    cloud_cover_high: hourly.cloud_cover_high,
  };
};

const asUtcMilliseconds = (value: string): number =>
  Date.parse(value.endsWith("Z") ? value : `${value}Z`);

export const fetchCloudForecast = async (
  location: GeoPoint,
  targetUtc: string,
  fetchFunction: FetchFunction = fetch,
  now: Date = new Date(),
): Promise<ServiceResult<CloudForecast>> => {
  const targetTime = Date.parse(targetUtc);
  if (!Number.isFinite(targetTime)) {
    return { status: "error", reason: "Cloud forecast time is invalid." };
  }
  const rangeEnd = now.getTime() + FORECAST_RANGE_DAYS * 24 * 60 * 60 * 1000;
  if (targetTime < now.getTime()) {
    return {
      status: "unavailable",
      reason: "Forecast for this past time is no longer available.",
    };
  }
  if (targetTime > rangeEnd) {
    return {
      status: "unavailable",
      reason: "Forecast not available yet.",
    };
  }

  const date = new Date(targetTime).toISOString().slice(0, 10);
  const query = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    hourly: "cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high",
    timezone: "UTC",
    start_date: date,
    end_date: date,
  });

  const timeout = createRequestTimeout(OPEN_METEO_TIMEOUT_MILLISECONDS);
  try {
    const response = await fetchWithRateLimitBackoff(
      fetchFunction,
      `${OPEN_METEO_FORECAST_URL}?${query}`,
      { signal: timeout.signal },
    );
    if (!response.ok) {
      return { status: "error", reason: await responseReason(response) };
    }
    const hourly = parseCloudHourly(await response.json());
    if (!hourly || hourly.time.length === 0) {
      return { status: "error", reason: "Cloud forecast response was incomplete." };
    }
    let nearestIndex = 0;
    let nearestDifference = Number.POSITIVE_INFINITY;
    hourly.time.forEach((time, index) => {
      const difference = Math.abs(asUtcMilliseconds(time) - targetTime);
      if (difference < nearestDifference) {
        nearestDifference = difference;
        nearestIndex = index;
      }
    });
    const totalPercent = hourly.cloud_cover[nearestIndex];
    const lowPercent = hourly.cloud_cover_low[nearestIndex];
    const middlePercent = hourly.cloud_cover_mid[nearestIndex];
    const highPercent = hourly.cloud_cover_high[nearestIndex];
    const validTime = hourly.time[nearestIndex];
    if (
      totalPercent === undefined ||
      lowPercent === undefined ||
      middlePercent === undefined ||
      highPercent === undefined ||
      validTime === undefined
    ) {
      return { status: "error", reason: "Cloud forecast response was incomplete." };
    }

    return {
      status: "success",
      value: {
        validUtc: new Date(asUtcMilliseconds(validTime)).toISOString(),
        retrievedUtc: now.toISOString(),
        totalPercent,
        lowPercent,
        middlePercent,
        highPercent,
        sourceUrl: OPEN_METEO_FORECAST_SOURCE_URL,
      },
    };
  } catch (error: unknown) {
    return {
      status: "error",
      reason: error instanceof Error ? error.message : "Cloud forecast request failed.",
    };
  } finally {
    timeout.clear();
  }
};
