import { distanceKm, type GeoPoint } from "../domain/geo";
import type { FetchFunction, ServiceResult } from "./result";
import { createRequestTimeout } from "./requestTimeout";

export const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
export const OPENSTREETMAP_SOURCE_URL = "https://www.openstreetmap.org/copyright";
export const TRANSPORT_RADIUS_KM = 25;
const OVERPASS_TIMEOUT_MILLISECONDS = 30_000;

export type TransportMode = "rail" | "bus" | "airport" | "ferry" | "parking";

export interface NearbyTransport {
  mode: TransportMode;
  name: string;
  distanceKm: number;
  osmUrl: string;
}

export interface TransportProximity {
  radiusKm: number;
  retrievedUtc: string;
  sourceUrl: string;
  nearest: Readonly<Record<TransportMode, NearbyTransport | null>>;
}

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

const parseElements = (value: unknown): OverpassElement[] | null => {
  if (
    typeof value !== "object" ||
    value === null ||
    !("elements" in value) ||
    !Array.isArray(value.elements)
  ) {
    return null;
  }

  return value.elements.flatMap((candidate): OverpassElement[] => {
    if (
      typeof candidate !== "object" ||
      candidate === null ||
      !("type" in candidate) ||
      !("id" in candidate) ||
      (candidate.type !== "node" &&
        candidate.type !== "way" &&
        candidate.type !== "relation") ||
      typeof candidate.id !== "number" ||
      !Number.isFinite(candidate.id)
    ) {
      return [];
    }
    let tags: Record<string, string> | undefined;
    if ("tags" in candidate) {
      if (
        typeof candidate.tags !== "object" ||
        candidate.tags === null ||
        Array.isArray(candidate.tags) ||
        !Object.values(candidate.tags).every((tag) => typeof tag === "string")
      ) {
        return [];
      }
      tags = Object.fromEntries(
        Object.entries(candidate.tags).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
      );
    }
    const withTags = tags ? { tags } : {};

    if (candidate.type === "node") {
      if (
        !("lat" in candidate) ||
        !("lon" in candidate) ||
        typeof candidate.lat !== "number" ||
        typeof candidate.lon !== "number" ||
        !Number.isFinite(candidate.lat) ||
        !Number.isFinite(candidate.lon)
      ) {
        return [];
      }
      return [
        {
          type: "node",
          id: candidate.id,
          lat: candidate.lat,
          lon: candidate.lon,
          ...withTags,
        },
      ];
    }

    if (
      !("center" in candidate) ||
      typeof candidate.center !== "object" ||
      candidate.center === null ||
      !("lat" in candidate.center) ||
      !("lon" in candidate.center) ||
      typeof candidate.center.lat !== "number" ||
      typeof candidate.center.lon !== "number" ||
      !Number.isFinite(candidate.center.lat) ||
      !Number.isFinite(candidate.center.lon)
    ) {
      return [];
    }
    return [
      {
        type: candidate.type,
        id: candidate.id,
        center: { lat: candidate.center.lat, lon: candidate.center.lon },
        ...withTags,
      },
    ];
  });
};

const classify = (tags: Record<string, string>): TransportMode | null => {
  if (tags.railway === "station" || tags.railway === "halt") {
    return "rail";
  }
  if (tags.aeroway === "aerodrome" || tags.aeroway === "terminal") {
    return "airport";
  }
  if (tags.amenity === "ferry_terminal") {
    return "ferry";
  }
  if (tags.amenity === "parking") {
    return "parking";
  }
  if (
    tags.highway === "bus_stop" ||
    tags.bus === "yes"
  ) {
    return "bus";
  }
  return null;
};

const elementLocation = (element: OverpassElement): GeoPoint | null => {
  if (element.lat !== undefined && element.lon !== undefined) {
    return { latitude: element.lat, longitude: element.lon };
  }
  if (element.center) {
    return {
      latitude: element.center.lat,
      longitude: element.center.lon,
    };
  }
  return null;
};

const emptyNearest = (): Record<TransportMode, NearbyTransport | null> => ({
  rail: null,
  bus: null,
  airport: null,
  ferry: null,
  parking: null,
});

const makeQuery = (location: GeoPoint): string => {
  const around = `around:${TRANSPORT_RADIUS_KM * 1000},${location.latitude},${location.longitude}`;
  return `[out:json][timeout:25];(
    nwr(${around})["railway"~"^(station|halt)$"];
    nwr(${around})["highway"="bus_stop"];
    nwr(${around})["public_transport"~"^(platform|station)$"]["bus"="yes"];
    nwr(${around})["aeroway"~"^(aerodrome|terminal)$"];
    nwr(${around})["amenity"="ferry_terminal"];
    nwr(${around})["amenity"="parking"];
  );out center tags;`;
};

export const fetchTransportProximity = async (
  location: GeoPoint,
  fetchFunction: FetchFunction = fetch,
  now: Date = new Date(),
): Promise<ServiceResult<TransportProximity>> => {
  const timeout = createRequestTimeout(OVERPASS_TIMEOUT_MILLISECONDS);
  try {
    const response = await fetchFunction(OVERPASS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(makeQuery(location))}`,
      signal: timeout.signal,
    });
    if (!response.ok) {
      return {
        status: "error",
        reason: `Transport request failed with HTTP ${response.status}.`,
      };
    }
    const elements = parseElements(await response.json());
    if (!elements) {
      return { status: "error", reason: "Transport response was invalid." };
    }
    const nearest = emptyNearest();
    elements.forEach((element) => {
      const tags = element.tags ?? {};
      const mode = classify(tags);
      const itemLocation = elementLocation(element);
      if (!mode || !itemLocation) {
        return;
      }
      const candidate: NearbyTransport = {
        mode,
        name: tags.name ?? `Unnamed ${mode} location`,
        distanceKm: distanceKm(location, itemLocation),
        osmUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
      };
      if (!nearest[mode] || candidate.distanceKm < nearest[mode].distanceKm) {
        nearest[mode] = candidate;
      }
    });

    return {
      status: "success",
      value: {
        radiusKm: TRANSPORT_RADIUS_KM,
        retrievedUtc: now.toISOString(),
        sourceUrl: OPENSTREETMAP_SOURCE_URL,
        nearest,
      },
    };
  } catch (error: unknown) {
    return {
      status: "error",
      reason: error instanceof Error ? error.message : "Transport request failed.",
    };
  } finally {
    timeout.clear();
  }
};
