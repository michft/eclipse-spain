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

interface ClockBaseline {
  monotonicMilliseconds: number;
  utcMilliseconds: number;
}

const monotonicNow = (): number =>
  typeof performance === "undefined" ? Date.now() : performance.now();

const currentUtcFromBaseline = (baseline: ClockBaseline): number =>
  baseline.utcMilliseconds + monotonicNow() - baseline.monotonicMilliseconds;

export const useAudioTimeline = (contacts: ContactRecord) => {
  const [markers, setMarkers] = useState<AudioMarker[]>(loadAudioMarkers);
  const [armed, setArmed] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [pageWasHidden, setPageWasHidden] = useState(isPageHidden);
  const [message, setMessage] = useState(
    "Test audio, then arm the timeline while keeping this page open.",
  );
  const clockBaseline = useRef<ClockBaseline>({
    monotonicMilliseconds: monotonicNow(),
    utcMilliseconds: Date.now(),
  });
  const previousTick = useRef(clockBaseline.current.utcMilliseconds);
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
    () =>
      subscribeToPageVisibility((hidden) => {
        if (hidden) {
          setPageWasHidden(true);
          return;
        }
        const utcMilliseconds = Date.now();
        clockBaseline.current = {
          monotonicMilliseconds: monotonicNow(),
          utcMilliseconds,
        };
        previousTick.current = utcMilliseconds;
        setNow(utcMilliseconds);
      }),
    [],
  );

  useEffect(() => {
    setArmed(false);
    firedIds.current.clear();
    const utcMilliseconds = Date.now();
    clockBaseline.current = {
      monotonicMilliseconds: monotonicNow(),
      utcMilliseconds,
    };
    previousTick.current = utcMilliseconds;
    setNow(utcMilliseconds);
    setMessage("Eclipse contacts changed. Test audio, then arm again.");
  }, [contacts]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const current = currentUtcFromBaseline(clockBaseline.current);
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
    firedIds.current.delete(id);
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
      const utcMilliseconds = Date.now();
      clockBaseline.current = {
        monotonicMilliseconds: monotonicNow(),
        utcMilliseconds,
      };
      previousTick.current = utcMilliseconds;
      setNow(utcMilliseconds);
      firedIds.current.clear();
      setPageWasHidden(false);
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
    pageWasHidden,
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
