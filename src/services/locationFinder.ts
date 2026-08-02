import type { EclipseEventDefinition } from "../data/eclipseEvents";
import { calculateLocalEclipse } from "../domain/eclipse";
import type { GeoPoint } from "../domain/geo";
import { fetchElevationProfile } from "./openMeteo";
import {
  fetchTransportProximity,
  type NearbyTransport,
  type TransportMode,
} from "./overpass";
import type { ServiceResult } from "./result";

export interface CandidateScore {
  eclipse: number;
  horizon: number;
  path: number;
  searchProximity: number;
  total: number;
}

export interface ObservingLocationCandidate {
  id: string;
  name: string;
  mode: TransportMode;
  location: GeoPoint;
  osmUrl: string;
  distanceFromSearchKm: number;
  centerLineDistanceKm: number | null;
  eclipseKind: "partial" | "annular" | "total";
  totalityDurationSeconds: number | null;
  observerElevationMeters: number | null;
  terrainClearanceDegrees: number | null;
  score: CandidateScore;
}

export interface LocationCandidateSearch {
  candidates: readonly ObservingLocationCandidate[];
  radiusKm: number;
  warnings: readonly string[];
}

interface LocationFinderDependencies {
  transport: typeof fetchTransportProximity;
  elevation: typeof fetchElevationProfile;
}

const clampUnit = (value: number): number => Math.max(0, Math.min(1, value));

export const scoreCandidate = (
  kind: ObservingLocationCandidate["eclipseKind"],
  terrainClearanceDegrees: number | null,
  centerLineDistanceKm: number | null,
  distanceFromSearchKm: number,
): CandidateScore => {
  const eclipse = kind === "total" ? 15 : kind === "annular" ? 10 : 5;
  const horizon =
    terrainClearanceDegrees === null
      ? 0
      : Math.round(40 * clampUnit((terrainClearanceDegrees + 2) / 20));
  const path =
    centerLineDistanceKm === null
      ? 0
      : Math.round(25 * clampUnit(1 - centerLineDistanceKm / 50));
  const searchProximity = Math.round(
    20 * clampUnit(1 - distanceFromSearchKm / 25),
  );
  return {
    eclipse,
    horizon,
    path,
    searchProximity,
    total: eclipse + horizon + path + searchProximity,
  };
};

const evaluateCandidate = async (
  event: EclipseEventDefinition,
  transport: NearbyTransport,
  elevationProvider: typeof fetchElevationProfile,
): Promise<ObservingLocationCandidate | null> => {
  const initialEclipse = calculateLocalEclipse(event, transport.location);
  if (initialEclipse.status !== "success") {
    return null;
  }
  const initialMaximum = initialEclipse.value.contacts.maximum;
  if (!initialMaximum) {
    return null;
  }
  const elevation = await elevationProvider(
    transport.location,
    initialMaximum.sunAzimuthDegrees,
  );
  const observerElevationMeters =
    elevation.status === "success"
      ? elevation.value.observerElevationMeters
      : null;
  const refinedEclipse =
    observerElevationMeters === null
      ? initialEclipse
      : calculateLocalEclipse(event, transport.location, observerElevationMeters);
  if (refinedEclipse.status !== "success") {
    return null;
  }
  const maximum = refinedEclipse.value.contacts.maximum;
  if (!maximum) {
    return null;
  }
  const terrainClearanceDegrees =
    elevation.status === "success"
      ? maximum.sunAltitudeDegrees -
        elevation.value.horizon.highestTerrainAngleDegrees
      : null;
  const score = scoreCandidate(
    refinedEclipse.value.kind,
    terrainClearanceDegrees,
    refinedEclipse.value.centerLineDistanceKm,
    transport.distanceKm,
  );
  return {
    id: transport.osmUrl,
    name: transport.name,
    mode: transport.mode,
    location: transport.location,
    osmUrl: transport.osmUrl,
    distanceFromSearchKm: transport.distanceKm,
    centerLineDistanceKm: refinedEclipse.value.centerLineDistanceKm,
    eclipseKind: refinedEclipse.value.kind,
    totalityDurationSeconds: refinedEclipse.value.totalityDurationSeconds,
    observerElevationMeters,
    terrainClearanceDegrees,
    score,
  };
};

export const findObservingLocationCandidates = async (
  event: EclipseEventDefinition,
  searchCenter: GeoPoint,
  dependencies: LocationFinderDependencies = {
    transport: fetchTransportProximity,
    elevation: fetchElevationProfile,
  },
): Promise<ServiceResult<LocationCandidateSearch>> => {
  const transport = await dependencies.transport(searchCenter);
  if (transport.status !== "success") {
    return transport;
  }
  const anchors = Object.values(transport.value.nearest).filter(
    (item): item is NearbyTransport => item !== null,
  );
  if (anchors.length === 0) {
    return {
      status: "unavailable",
      reason: `No transport anchors were found within ${transport.value.radiusKm} km.`,
    };
  }
  const evaluated = await Promise.all(
    anchors.map((anchor) =>
      evaluateCandidate(event, anchor, dependencies.elevation),
    ),
  );
  const candidates = evaluated
    .filter((candidate): candidate is ObservingLocationCandidate =>
      candidate !== null,
    )
    .sort((first, second) => second.score.total - first.score.total);
  if (candidates.length === 0) {
    return {
      status: "unavailable",
      reason: "No transport anchor produced eclipse circumstances at this search area.",
    };
  }
  const missingTerrain = candidates.filter(
    (candidate) => candidate.terrainClearanceDegrees === null,
  ).length;
  return {
    status: "success",
    value: {
      candidates,
      radiusKm: transport.value.radiusKm,
      warnings:
        missingTerrain === 0
          ? []
          : [`Terrain could not be scored for ${missingTerrain} candidate(s).`],
    },
  };
};
