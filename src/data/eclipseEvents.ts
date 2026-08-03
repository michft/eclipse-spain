import type { GeoPoint } from "../domain/geo";
import { ECLIPSE_CONTOURS } from "./eclipseContours.generated";
import { ECLIPSE_PATHS, type EclipsePathGeometry } from "./eclipsePaths";

export type EclipseEventId = "spain-2026" | "middle-east-2027" | "australia-2028";

export interface MapBounds {
  north: number;
  east: number;
  south: number;
  west: number;
}

export interface SourceLink {
  label: string;
  url: string;
}

export interface EclipseEventDefinition {
  id: EclipseEventId;
  name: string;
  region: string;
  eventDateUtc: string;
  searchStartUtc: string;
  mapCenter: GeoPoint;
  mapBounds: MapBounds;
  centerLine: readonly GeoPoint[];
  path: EclipsePathGeometry;
  contours: (typeof ECLIPSE_CONTOURS)[EclipseEventId];
  sources: readonly SourceLink[];
}

const ASTRONOMY_ENGINE_SOURCE: SourceLink = {
  label: "Astronomy Engine",
  url: "https://github.com/cosinekitty/astronomy",
};

export const ECLIPSE_EVENTS: readonly EclipseEventDefinition[] = [
  {
    id: "spain-2026",
    name: "12 August 2026 total solar eclipse",
    region: "Spain",
    eventDateUtc: "2026-08-12",
    searchStartUtc: "2026-08-12T00:00:00.000Z",
    mapCenter: { latitude: 42.5, longitude: -4.3 },
    mapBounds: { north: 46.5, east: 4, south: 37, west: -12.5 },
    centerLine: ECLIPSE_PATHS["spain-2026"].centerLine,
    path: ECLIPSE_PATHS["spain-2026"],
    contours: ECLIPSE_CONTOURS["spain-2026"],
    sources: [
      {
        label: "NASA path table",
        url: "https://eclipse.gsfc.nasa.gov/SEpath/SEpath2001/SE2026Aug12Tpath.html",
      },
      {
        label: "NASA event page",
        url: "https://eclipse.gsfc.nasa.gov/SEsearch/SEsearchmap.php?Ecl=20260812",
      },
      {
        label: "NASA global visibility map",
        url: "https://eclipse.gsfc.nasa.gov/SEplot/SEplot2001/SE2026Aug12T.GIF",
      },
      {
        label: "NASA Besselian elements",
        url: "https://eclipse.gsfc.nasa.gov/SEbeselm/SEbeselm2001/SE2026Aug12Tbeselm.html",
      },
      ASTRONOMY_ENGINE_SOURCE,
    ],
  },
  {
    id: "middle-east-2027",
    name: "2 August 2027 total solar eclipse",
    region: "North Africa and the Middle East",
    eventDateUtc: "2027-08-02",
    searchStartUtc: "2027-08-02T00:00:00.000Z",
    mapCenter: { latitude: 25.5, longitude: 32.5 },
    mapBounds: { north: 37.5, east: 47, south: 13, west: 17 },
    centerLine: ECLIPSE_PATHS["middle-east-2027"].centerLine,
    path: ECLIPSE_PATHS["middle-east-2027"],
    contours: ECLIPSE_CONTOURS["middle-east-2027"],
    sources: [
      {
        label: "NASA path table",
        url: "https://eclipse.gsfc.nasa.gov/SEpath/SEpath2001/SE2027Aug02Tpath.html",
      },
      {
        label: "NASA event page",
        url: "https://eclipse.gsfc.nasa.gov/SEsearch/SEsearchmap.php?Ecl=20270802",
      },
      {
        label: "NASA global visibility map",
        url: "https://eclipse.gsfc.nasa.gov/SEplot/SEplot2001/SE2027Aug02T.GIF",
      },
      {
        label: "NASA Besselian elements",
        url: "https://eclipse.gsfc.nasa.gov/SEbeselm/SEbeselm2001/SE2027Aug02Tbeselm.html",
      },
      ASTRONOMY_ENGINE_SOURCE,
    ],
  },
  {
    id: "australia-2028",
    name: "22 July 2028 total solar eclipse",
    region: "Sydney and Australia",
    eventDateUtc: "2028-07-22",
    searchStartUtc: "2028-07-22T00:00:00.000Z",
    mapCenter: { latitude: -29.5, longitude: 144.5 },
    mapBounds: { north: -15, east: 158, south: -39, west: 127 },
    centerLine: ECLIPSE_PATHS["australia-2028"].centerLine,
    path: ECLIPSE_PATHS["australia-2028"],
    contours: ECLIPSE_CONTOURS["australia-2028"],
    sources: [
      {
        label: "NASA path table",
        url: "https://eclipse.gsfc.nasa.gov/SEpath/SEpath2001/SE2028Jul22Tpath.html",
      },
      {
        label: "NASA event page",
        url: "https://eclipse.gsfc.nasa.gov/SEsearch/SEsearchmap.php?Ecl=20280722",
      },
      {
        label: "NASA global visibility map",
        url: "https://eclipse.gsfc.nasa.gov/SEplot/SEplot2001/SE2028Jul22T.GIF",
      },
      {
        label: "NASA Besselian elements",
        url: "https://eclipse.gsfc.nasa.gov/SEbeselm/SEbeselm2001/SE2028Jul22Tbeselm.html",
      },
      ASTRONOMY_ENGINE_SOURCE,
    ],
  },
] as const;

export const getEclipseEvent = (
  id: EclipseEventId,
): EclipseEventDefinition => {
  const event = ECLIPSE_EVENTS.find((candidate) => candidate.id === id);
  if (!event) {
    throw new Error(`Unknown eclipse event: ${id}`);
  }
  return event;
};
