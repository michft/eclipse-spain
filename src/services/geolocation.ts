import {
  Accuracy,
  getCurrentPositionAsync,
  requestForegroundPermissionsAsync,
} from "expo-location";

import type { GeoPoint } from "../domain/geo";
import type { ServiceResult } from "./result";

const getBrowserLocation = (): Promise<ServiceResult<GeoPoint>> =>
  new Promise((resolve) => {
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
        const mappedReason =
          error.code === 1
            ? "Location permission was denied."
            : error.code === 2
              ? "Your location is currently unavailable."
              : error.code === 3
                ? "Finding your location timed out."
                : null;
        resolve({
          status: "error",
          reason: mappedReason ?? (error.message || "Could not determine location."),
        });
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 15_000 },
    );
  });

export const getCurrentLocation = async (): Promise<ServiceResult<GeoPoint>> => {
  if (typeof navigator !== "undefined" && navigator.geolocation) {
    return getBrowserLocation();
  }

  try {
    const permission = await requestForegroundPermissionsAsync();
    if (permission.status !== "granted") {
      return { status: "error", reason: "Location permission was denied." };
    }
    const position = await getCurrentPositionAsync({ accuracy: Accuracy.High });
    return {
      status: "success",
      value: {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      },
    };
  } catch (error: unknown) {
    return {
      status: "error",
      reason:
        error instanceof Error && error.message
          ? error.message
          : "Your location is currently unavailable.",
    };
  }
};
