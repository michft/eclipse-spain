import {
  DEFAULT_AUDIO_MARKERS,
  type AudioMarker,
} from "../domain/audioTimeline";
import { CONTACT_IDS, type ContactId } from "../domain/eclipse";

const STORAGE_KEY = "eclipse-observer.audio-markers";

const isContactId = (value: unknown): value is ContactId =>
  typeof value === "string" && CONTACT_IDS.some((anchor) => anchor === value);

const isAudioMarker = (value: unknown): value is AudioMarker =>
  typeof value === "object" &&
  value !== null &&
  "id" in value &&
  typeof value.id === "string" &&
  "anchor" in value &&
  isContactId(value.anchor) &&
  "offsetSeconds" in value &&
  typeof value.offsetSeconds === "number" &&
  Number.isSafeInteger(value.offsetSeconds) &&
  "label" in value &&
  typeof value.label === "string" &&
  "spoken" in value &&
  typeof value.spoken === "boolean" &&
  "enabled" in value &&
  typeof value.enabled === "boolean";

export const loadAudioMarkers = (): AudioMarker[] => {
  if (typeof localStorage === "undefined") {
    return DEFAULT_AUDIO_MARKERS.map((marker) => ({ ...marker }));
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return DEFAULT_AUDIO_MARKERS.map((marker) => ({ ...marker }));
    }
    const value: unknown = JSON.parse(stored);
    return Array.isArray(value) && value.every(isAudioMarker)
      ? value
      : DEFAULT_AUDIO_MARKERS.map((marker) => ({ ...marker }));
  } catch {
    return DEFAULT_AUDIO_MARKERS.map((marker) => ({ ...marker }));
  }
};

export const saveAudioMarkers = (markers: readonly AudioMarker[]): boolean => {
  if (typeof localStorage === "undefined") {
    return false;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(markers));
    return true;
  } catch {
    return false;
  }
};

export const makeAudioMarkerId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `marker-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};
