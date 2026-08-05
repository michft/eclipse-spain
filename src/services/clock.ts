import type { FetchFunction } from "./result";
import { createRequestTimeout } from "./requestTimeout";
import {
  DEFAULT_RATE_LIMIT_BACKOFF_BUDGET_MILLISECONDS,
  fetchWithRateLimitBackoff,
} from "./rateLimitBackoff";

const MAX_CLOCK_SKEW_MILLISECONDS = 5_000;
const DATE_HEADER_PRECISION_MILLISECONDS = 1_000;
const UNVERIFIED_CLOCK_REASON =
  "Device time could not be verified against network time. Check it before relying on audio cues.";
const CLOCK_CHECK_TIMEOUT_MILLISECONDS =
  DEFAULT_RATE_LIMIT_BACKOFF_BUDGET_MILLISECONDS + 6_000;
const DEFAULT_NETWORK_TIME_URL = "https://eclipse-spain-ten.vercel.app/";

const configuredNetworkTimeUrl = (): string | null => {
  const value =
    process.env.EXPO_PUBLIC_NETWORK_TIME_URL?.trim() ||
    DEFAULT_NETWORK_TIME_URL;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
};

const defaultClockUrl = (): string | null =>
  typeof window !== "undefined" && window.location?.origin
    ? window.location.origin
    : configuredNetworkTimeUrl();

export type ClockTrustResult =
  | { status: "trusted"; differenceMilliseconds: number }
  | { status: "warning"; reason: string };

export const checkDeviceClock = async (
  fetchFunction: FetchFunction = fetch,
  now: () => number = Date.now,
  url: string | null = defaultClockUrl(),
): Promise<ClockTrustResult> => {
  if (!url) {
    return { status: "warning", reason: UNVERIFIED_CLOCK_REASON };
  }
  let startedUtcMilliseconds = 0;
  const timeout = createRequestTimeout(CLOCK_CHECK_TIMEOUT_MILLISECONDS);
  try {
    const response = await fetchWithRateLimitBackoff(
      (input, init) => {
        startedUtcMilliseconds = now();
        return fetchFunction(input, init);
      },
      url,
      {
        method: "HEAD",
        cache: "no-store",
        signal: timeout.signal,
      },
    );
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
