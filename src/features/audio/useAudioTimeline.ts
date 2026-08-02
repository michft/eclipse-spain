import { useEffect, useMemo, useRef, useState } from "react";

import {
  DEFAULT_AUDIO_MARKERS,
  findDueMarkers,
  nextAudioMarker,
  resolveAudioMarkers,
  type AudioMarker,
  type ContactRecord,
} from "../../domain/audioTimeline";
import { playAudioCue, primeAudio } from "../../services/audio";
import {
  loadAudioMarkers,
  makeAudioMarkerId,
  saveAudioMarkers,
} from "../../services/audioStorage";
import {
  isPageHidden,
  subscribeToPageVisibility,
} from "../../services/pageVisibility";

export const useAudioTimeline = (contacts: ContactRecord) => {
  const [markers, setMarkers] = useState<AudioMarker[]>(loadAudioMarkers);
  const [armed, setArmed] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [pageHidden, setPageHidden] = useState(isPageHidden);
  const [message, setMessage] = useState(
    "Test audio, then arm the timeline while keeping this page open.",
  );
  const previousTick = useRef(Date.now());
  const firedIds = useRef(new Set<string>());
  const resolvedMarkers = useMemo(
    () => resolveAudioMarkers(markers, contacts),
    [contacts, markers],
  );
  const nextMarker = nextAudioMarker(resolvedMarkers, now);

  useEffect(() => {
    saveAudioMarkers(markers);
  }, [markers]);

  useEffect(
    () => subscribeToPageVisibility(setPageHidden),
    [],
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (armed) {
        const due = findDueMarkers(
          resolvedMarkers,
          previousTick.current,
          current,
          firedIds.current,
        );
        due.forEach((marker) => {
          firedIds.current.add(marker.id);
          void playAudioCue(marker.label, marker.spoken)
            .then((mode) => setMessage(`${marker.label} · ${mode}`))
            .catch((error: unknown) =>
              setMessage(
                error instanceof Error ? error.message : "Audio cue failed.",
              ),
            );
        });
      }
      previousTick.current = current;
    }, 250);
    return () => window.clearInterval(timer);
  }, [armed, resolvedMarkers]);

  const updateMarker = (id: string, update: Partial<AudioMarker>): void => {
    setMarkers((current) =>
      current.map((marker) =>
        marker.id === id ? { ...marker, ...update, id: marker.id } : marker,
      ),
    );
  };

  const addMarker = (): void => {
    setMarkers((current) => [
      ...current,
      {
        id: makeAudioMarkerId(),
        anchor: "c2",
        offsetSeconds: 30,
        label: "Custom marker",
        spoken: true,
        enabled: true,
      },
    ]);
  };

  const removeMarker = (id: string): void => {
    firedIds.current.delete(id);
    setMarkers((current) => current.filter((marker) => marker.id !== id));
  };

  const restoreDefaults = (): void => {
    setArmed(false);
    firedIds.current.clear();
    setMarkers(DEFAULT_AUDIO_MARKERS.map((marker) => ({ ...marker })));
    setMessage("Default markers restored.");
  };

  const arm = async (): Promise<void> => {
    try {
      await primeAudio();
      previousTick.current = Date.now();
      firedIds.current.clear();
      setArmed(true);
      setMessage("Timeline armed. Keep this page awake and visible.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not arm audio.");
    }
  };

  const disarm = (): void => {
    setArmed(false);
    setMessage("Timeline disarmed.");
  };

  const test = async (): Promise<void> => {
    try {
      const mode = await playAudioCue("Eclipse audio test", true);
      setMessage(`Audio test played using ${mode}.`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Audio test failed.");
    }
  };

  return {
    markers,
    resolvedMarkers,
    nextMarker,
    now,
    armed,
    pageHidden,
    message,
    addMarker,
    updateMarker,
    removeMarker,
    restoreDefaults,
    arm,
    disarm,
    test,
  };
};
