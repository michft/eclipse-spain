import type { GeoPoint } from "../domain/geo";

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
    centerLine: [
      { latitude: 47.1017, longitude: -11.715 },
      { latitude: 45.9433, longitude: -10.19 },
      { latitude: 44.7133, longitude: -8.3983 },
      { latitude: 43.3717, longitude: -6.1883 },
      { latitude: 41.8167, longitude: -3.185 },
      { latitude: 39.4083, longitude: 2.95 },
      { latitude: 38.68, longitude: 5.415 },
    ],
    sources: [
      {
        label: "NASA path table",
        url: "https://eclipse.gsfc.nasa.gov/SEpath/SEpath2001/SE2026Aug12Tpath.html",
      },
      {
        label: "NASA event page",
        url: "https://eclipse.gsfc.nasa.gov/SEsearch/SEsearchmap.php?Ecl=20260812",
      },
      ASTRONOMY_ENGINE_SOURCE,
    ],
  },
  {
    id: "middle-east-2027",
    name: "2 August 2027 total solar eclipse",
    region: "North Africa and Middle East",
    eventDateUtc: "2027-08-02",
    searchStartUtc: "2027-08-02T00:00:00.000Z",
    mapCenter: { latitude: 25.5, longitude: 32.5 },
    mapBounds: { north: 37.5, east: 47, south: 13, west: 17 },
    centerLine: [
      { latitude: 32.535, longitude: 18.805 },
      { latitude: 31.9367, longitude: 20.5433 },
      { latitude: 31.3033, longitude: 22.2083 },
      { latitude: 30.6383, longitude: 23.8083 },
      { latitude: 29.9433, longitude: 25.3467 },
      { latitude: 29.22, longitude: 26.8317 },
      { latitude: 28.4683, longitude: 28.2683 },
      { latitude: 27.6917, longitude: 29.66 },
      { latitude: 26.8883, longitude: 31.0133 },
      { latitude: 26.0617, longitude: 32.3333 },
      { latitude: 25.21, longitude: 33.6217 },
      { latitude: 24.335, longitude: 34.885 },
      { latitude: 23.4367, longitude: 36.1267 },
      { latitude: 22.5133, longitude: 37.3517 },
      { latitude: 21.5667, longitude: 38.5633 },
      { latitude: 20.5967, longitude: 39.7683 },
      { latitude: 19.6017, longitude: 40.97 },
      { latitude: 18.5817, longitude: 42.1733 },
      { latitude: 17.5333, longitude: 43.3833 },
      { latitude: 16.46, longitude: 44.6067 },
    ],
    sources: [
      {
        label: "NASA path table",
        url: "https://eclipse.gsfc.nasa.gov/SEpath/SEpath2001/SE2027Aug02Tpath.html",
      },
      {
        label: "NASA event page",
        url: "https://eclipse.gsfc.nasa.gov/SEsearch/SEsearchmap.php?Ecl=20270802",
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
    centerLine: [
      { latitude: -16.345, longitude: 128.03 },
      { latitude: -17.0667, longitude: 129.1933 },
      { latitude: -17.8283, longitude: 130.3633 },
      { latitude: -18.635, longitude: 131.5433 },
      { latitude: -19.485, longitude: 132.74 },
      { latitude: -20.3833, longitude: 133.96 },
      { latitude: -21.3317, longitude: 135.2133 },
      { latitude: -22.3333, longitude: 136.5067 },
      { latitude: -23.3933, longitude: 137.85 },
      { latitude: -24.5183, longitude: 139.2567 },
      { latitude: -25.7117, longitude: 140.74 },
      { latitude: -26.9867, longitude: 142.3217 },
      { latitude: -28.3533, longitude: 144.025 },
      { latitude: -29.8283, longitude: 145.8817 },
      { latitude: -31.435, longitude: 147.9417 },
      { latitude: -33.2033, longitude: 150.27 },
      { latitude: -34.165, longitude: 151.5683 },
      { latitude: -35.1883, longitude: 152.98 },
      { latitude: -37.48, longitude: 156.265 },
    ],
    sources: [
      {
        label: "NASA path table",
        url: "https://eclipse.gsfc.nasa.gov/SEpath/SEpath2001/SE2028Jul22Tpath.html",
      },
      {
        label: "NASA event page",
        url: "https://eclipse.gsfc.nasa.gov/SEsearch/SEsearchmap.php?Ecl=20280722",
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
