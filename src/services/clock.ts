import type { FetchFunction } from "./result";
import { createRequestTimeout } from "./requestTimeout";

const MAX_CLOCK_SKEW_MILLISECONDS = 5_000;
const DATE_HEADER_PRECISION_MILLISECONDS = 1_000;
const UNVERIFIED_CLOCK_REASON =
  "Device time could not be verified against network time. Check it before relying on audio cues.";
const CLOCK_CHECK_TIMEOUT_MILLISECONDS = 5_000;

export type ClockTrustResult =
  | { status: "trusted"; differenceMilliseconds: number }
  | { status: "warning"; reason: string };

export const checkDeviceClock = async (
  fetchFunction: FetchFunction = fetch,
  now: () => number = Date.now,
  url: string = typeof window === "undefined" ? "/" : window.location.origin,
): Promise<ClockTrustResult> => {
  const startedUtcMilliseconds = now();
  const timeout = createRequestTimeout(CLOCK_CHECK_TIMEOUT_MILLISECONDS);
  try {
    const response = await fetchFunction(url, {
      method: "HEAD",
      cache: "no-store",
      signal: timeout.signal,
    });
    const finishedUtcMilliseconds = now();
    const serverDate = response.headers.get("Date");
    const serverUtcMilliseconds =
      serverDate === null ? Number.NaN : Date.parse(serverDate);
    if (!response.ok || !Number.isFinite(serverUtcMilliseconds)) {
      return { status: "warning", reason: UNVERIFIED_CLOCK_REASON };
    }

    const roundTripMilliseconds = Math.max(
      0,
      finishedUtcMilliseconds - startedUtcMilliseconds,
    );
    const localMidpointUtcMilliseconds =
      startedUtcMilliseconds + roundTripMilliseconds / 2;
    const differenceMilliseconds = Math.abs(
      localMidpointUtcMilliseconds - serverUtcMilliseconds,
    );
    const toleratedDifference =
      MAX_CLOCK_SKEW_MILLISECONDS +
      roundTripMilliseconds / 2 +
      DATE_HEADER_PRECISION_MILLISECONDS;
    if (differenceMilliseconds > toleratedDifference) {
      return {
        status: "warning",
        reason: `Device clock differs from network time by about ${Math.round(
          differenceMilliseconds / 1000,
        )} seconds. Correct it before relying on audio cues.`,
      };
    }
    return { status: "trusted", differenceMilliseconds };
  } catch {
    return { status: "warning", reason: UNVERIFIED_CLOCK_REASON };
  } finally {
    timeout.clear();
  }
};
