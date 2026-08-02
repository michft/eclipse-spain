import type { ContactId, EclipseContact } from "./eclipse";

export interface AudioMarker {
  id: string;
  anchor: ContactId;
  offsetSeconds: number;
  label: string;
  spoken: boolean;
  enabled: boolean;
}

export interface ResolvedAudioMarker extends AudioMarker {
  targetUtcMilliseconds: number;
}

export type ContactRecord = Readonly<Record<ContactId, EclipseContact | null>>;

export const parseOffset = (input: string): number | null => {
  const normalized = input.trim();
  const match = /^(-)?(?:(\d+):([0-5]\d)|(\d+))$/.exec(normalized);
  if (!match) {
    return null;
  }
  const sign = match[1] ? -1 : 1;
  const minutes = match[2] ? Number(match[2]) : 0;
  const seconds = match[3] ? Number(match[3]) : Number(match[4]);
  const total = minutes * 60 + seconds;
  return Number.isSafeInteger(total) ? sign * total : null;
};

export const formatOffset = (offsetSeconds: number): string => {
  const sign = offsetSeconds < 0 ? "-" : "";
  const absolute = Math.abs(offsetSeconds);
  if (absolute < 60) {
    return `${sign}${absolute}`;
  }
  return `${sign}${Math.floor(absolute / 60)}:${String(absolute % 60).padStart(2, "0")}`;
};

export const resolveAudioMarkers = (
  markers: readonly AudioMarker[],
  contacts: ContactRecord,
): ResolvedAudioMarker[] =>
  markers
    .flatMap((marker): ResolvedAudioMarker[] => {
      const contact = contacts[marker.anchor];
      if (!marker.enabled || !contact) {
        return [];
      }
      return [
        {
          ...marker,
          targetUtcMilliseconds:
            Date.parse(contact.utc) - marker.offsetSeconds * 1000,
        },
      ];
    })
    .sort((first, second) =>
      first.targetUtcMilliseconds === second.targetUtcMilliseconds
        ? first.id.localeCompare(second.id)
        : first.targetUtcMilliseconds - second.targetUtcMilliseconds,
    );

export const findDueMarkers = (
  resolvedMarkers: readonly ResolvedAudioMarker[],
  previousUtcMilliseconds: number,
  currentUtcMilliseconds: number,
  firedIds: ReadonlySet<string>,
  lateToleranceMilliseconds = 3000,
): ResolvedAudioMarker[] =>
  resolvedMarkers.filter(
    (marker) =>
      !firedIds.has(marker.id) &&
      marker.targetUtcMilliseconds > previousUtcMilliseconds &&
      marker.targetUtcMilliseconds <= currentUtcMilliseconds &&
      currentUtcMilliseconds - marker.targetUtcMilliseconds <=
        lateToleranceMilliseconds,
  );

export const nextAudioMarker = (
  resolvedMarkers: readonly ResolvedAudioMarker[],
  currentUtcMilliseconds: number,
): ResolvedAudioMarker | null =>
  resolvedMarkers.find(
    (marker) => marker.targetUtcMilliseconds > currentUtcMilliseconds,
  ) ?? null;

export const DEFAULT_AUDIO_MARKERS: readonly AudioMarker[] = [
  {
    id: "c1-five-minutes",
    anchor: "c1",
    offsetSeconds: 5 * 60,
    label: "Five minutes to first contact",
    spoken: true,
    enabled: true,
  },
  {
    id: "c1-now",
    anchor: "c1",
    offsetSeconds: 0,
    label: "First contact",
    spoken: true,
    enabled: true,
  },
  {
    id: "c2-one-minute",
    anchor: "c2",
    offsetSeconds: 60,
    label: "One minute to totality",
    spoken: true,
    enabled: true,
  },
  {
    id: "c2-ten-seconds",
    anchor: "c2",
    offsetSeconds: 10,
    label: "Ten seconds to totality",
    spoken: true,
    enabled: true,
  },
  {
    id: "c2-now",
    anchor: "c2",
    offsetSeconds: 0,
    label: "Totality",
    spoken: true,
    enabled: true,
  },
  {
    id: "maximum-now",
    anchor: "maximum",
    offsetSeconds: 0,
    label: "Maximum eclipse",
    spoken: true,
    enabled: true,
  },
  {
    id: "c3-ten-seconds",
    anchor: "c3",
    offsetSeconds: 10,
    label: "Ten seconds to the end of totality",
    spoken: true,
    enabled: true,
  },
  {
    id: "c3-now",
    anchor: "c3",
    offsetSeconds: 0,
    label: "End of totality",
    spoken: true,
    enabled: true,
  },
  {
    id: "c4-now",
    anchor: "c4",
    offsetSeconds: 0,
    label: "End of eclipse",
    spoken: true,
    enabled: true,
  },
] as const;
