import { useCallback, useEffect, useRef, useState } from "react";

import type { CompassState } from "./compass";

interface WebOrientationEvent extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
}

const normalizeHeading = (heading: number): number =>
  ((heading % 360) + 360) % 360;

export const useCompassHeading = (): CompassState => {
  const [headingDegrees, setHeadingDegrees] = useState<number | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const listenerRef = useRef<((event: DeviceOrientationEvent) => void) | null>(null);
  const permissionRequestRef = useRef<Promise<PermissionState> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (listenerRef.current) {
        window.removeEventListener("deviceorientation", listenerRef.current);
        listenerRef.current = null;
      }
      permissionRequestRef.current = null;
    };
  }, []);

  const requestHeading = useCallback(() => {
    if (
      !mountedRef.current ||
      listenerRef.current ||
      permissionRequestRef.current
    ) {
      return;
    }
    if (typeof DeviceOrientationEvent === "undefined") {
      setAvailable(false);
      return;
    }
    const orientation = (event: DeviceOrientationEvent): void => {
      if (!mountedRef.current) return;
      const compassEvent = event as WebOrientationEvent;
      const heading = compassEvent.webkitCompassHeading;
      const alpha = compassEvent.alpha;
      if (typeof heading === "number" && Number.isFinite(heading)) {
        setHeadingDegrees(normalizeHeading(heading));
        setAvailable(true);
      } else if (
        compassEvent.absolute === true &&
        typeof alpha === "number" &&
        Number.isFinite(alpha)
      ) {
        setHeadingDegrees(normalizeHeading(360 - alpha));
        setAvailable(true);
      } else {
        setHeadingDegrees(null);
        setAvailable(false);
      }
    };
    const orientationConstructor = DeviceOrientationEvent as typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<PermissionState>;
    };
    const permission = orientationConstructor.requestPermission;
    if (permission) {
      let request: Promise<PermissionState>;
      try {
        request = permission();
      } catch {
        setAvailable(false);
        return;
      }
      permissionRequestRef.current = request;
      void request.then(
        (result) => {
          if (permissionRequestRef.current === request) {
            permissionRequestRef.current = null;
          }
          if (!mountedRef.current) return;
          if (result === "granted") {
            window.addEventListener("deviceorientation", orientation);
            listenerRef.current = orientation;
          } else {
            setAvailable(false);
          }
        },
        () => {
          if (permissionRequestRef.current === request) {
            permissionRequestRef.current = null;
          }
          if (mountedRef.current) setAvailable(false);
        },
      );
    } else {
      window.addEventListener("deviceorientation", orientation);
      listenerRef.current = orientation;
    }
  }, []);

  return { available, headingDegrees, requestHeading };
};
