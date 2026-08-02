import type { GeoPoint } from "../domain/geo";
import type { ServiceResult } from "./result";

export const getCurrentLocation = (): Promise<ServiceResult<GeoPoint>> =>
  new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve({ status: "unavailable", reason: "Location is not available here." });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          status: "success",
          value: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
        });
      },
      (error) => {
        resolve({ status: "error", reason: error.message });
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 15_000 },
    );
  });
