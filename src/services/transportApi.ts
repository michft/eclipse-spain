import { isValidGeoPoint, type GeoPoint } from "../domain/geo";
import type { FetchFunction } from "./result";
import {
  makeTransportQuery,
  OVERPASS_PROVIDER_URL,
} from "./overpass";
import { createRequestTimeout } from "./requestTimeout";

const OVERPASS_PROXY_TIMEOUT_MILLISECONDS = 30_000;

const jsonError = (reason: string, status: number): Response =>
  Response.json(
    { reason },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    },
  );

const readLocation = (request: Request): GeoPoint | null => {
  const search = new URL(request.url).searchParams;
  const latitudeInput = search.get("latitude");
  const longitudeInput = search.get("longitude");
  if (!latitudeInput?.trim() || !longitudeInput?.trim()) {
    return null;
  }
  const location = {
    latitude: Number(latitudeInput),
    longitude: Number(longitudeInput),
  };
  return isValidGeoPoint(location) ? location : null;
};

export const handleTransportRequest = async (
  request: Request,
  fetchFunction: FetchFunction = fetch,
): Promise<Response> => {
  if (request.method !== "GET") {
    return jsonError("Method not allowed.", 405);
  }
  const location = readLocation(request);
  if (!location) {
    return jsonError("Latitude or longitude is invalid.", 400);
  }

  const timeout = createRequestTimeout(OVERPASS_PROXY_TIMEOUT_MILLISECONDS);
  try {
    const response = await fetchFunction(OVERPASS_PROVIDER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(makeTransportQuery(location))}`,
      signal: timeout.signal,
    });
    return new Response(response.body, {
      status: response.status,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": response.headers.get("Content-Type") ?? "application/json",
      },
    });
  } catch (error: unknown) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    return jsonError(
      timedOut ? "Transport provider timed out." : "Transport provider failed.",
      timedOut ? 504 : 502,
    );
  } finally {
    timeout.clear();
  }
};
