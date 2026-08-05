import { setStringAsync } from "expo-clipboard";
import QRCode from "qrcode";

import {
  ECLIPSE_EVENTS,
  type EclipseEventId,
} from "../data/eclipseEvents";
import { isValidGeoPoint, type GeoPoint } from "../domain/geo";
import type { ServiceResult } from "./result";

export interface SharedSelection {
  eventId: EclipseEventId;
  location: GeoPoint;
}

const DEFAULT_SHARE_ORIGIN = "https://eclipse-spain-ten.vercel.app/";

const isEventId = (value: string): value is EclipseEventId =>
  ECLIPSE_EVENTS.some((event) => event.id === value);

export const readSharedSelection = (): SharedSelection | null => {
  if (typeof window === "undefined" || !window.location?.href) {
    return null;
  }
  const params = new URL(window.location.href).searchParams;
  const eventId = params.get("event");
  const latitudeParam = params.get("lat");
  const longitudeParam = params.get("lon");
  if (!latitudeParam?.trim() || !longitudeParam?.trim()) {
    return null;
  }
  const latitude = Number(latitudeParam);
  const longitude = Number(longitudeParam);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  const location = { latitude, longitude };

  return eventId && isEventId(eventId) && isValidGeoPoint(location)
    ? { eventId, location }
    : null;
};

export const updateShareUrl = (
  eventId: EclipseEventId,
  location: GeoPoint,
): string => {
  const browserUrl =
    typeof window !== "undefined" && window.location?.href
      ? window.location.href
      : null;
  const url = new URL(
    browserUrl ??
      (process.env.EXPO_PUBLIC_SHARE_ORIGIN?.trim() || DEFAULT_SHARE_ORIGIN),
  );
  url.searchParams.set("event", eventId);
  url.searchParams.set("lat", location.latitude.toFixed(5));
  url.searchParams.set("lon", location.longitude.toFixed(5));
  if (browserUrl && typeof window.history?.replaceState === "function") {
    window.history.replaceState(null, "", url);
  }
  return url.toString();
};

export const makeQrCode = async (
  value: string,
): Promise<ServiceResult<string>> => {
  try {
    return {
      status: "success",
      value: await QRCode.toString(value, {
        errorCorrectionLevel: "M",
        margin: 2,
        type: "svg",
        width: 360,
        color: { dark: "#081018", light: "#f7f2df" },
      }),
    };
  } catch {
    return { status: "error", reason: "QR code could not be generated." };
  }
};

export const copyText = async (value: string): Promise<boolean> => {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(value);
      return true;
    }
    return await setStringAsync(value);
  } catch {
    return false;
  }
};
