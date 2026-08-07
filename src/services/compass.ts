import { useCallback, useEffect, useState } from "react";
import { Magnetometer } from "expo-sensors";

export interface CompassState {
  headingDegrees: number | null;
  available: boolean | null;
  requestHeading: () => void;
}

const normalizeHeading = (heading: number): number =>
  ((heading % 360) + 360) % 360;

export const useCompassHeading = (): CompassState => {
  const [headingDegrees, setHeadingDegrees] = useState<number | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [requested, setRequested] = useState(false);

  useEffect(() => {
    let active = true;
    void Magnetometer.isAvailableAsync().then((isAvailable) => {
      if (active) setAvailable(isAvailable);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!requested || available !== true) return;
    Magnetometer.setUpdateInterval(200);
    const subscription = Magnetometer.addListener(({ x, y }) => {
      if (x === 0 && y === 0) return;
      setHeadingDegrees(normalizeHeading((Math.atan2(x, y) * 180) / Math.PI));
    });
    return () => subscription.remove();
  }, [available, requested]);

  return {
    available,
    headingDegrees,
    requestHeading: useCallback(() => setRequested(true), []),
  };
};
