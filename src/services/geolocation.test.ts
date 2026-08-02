import { afterEach, describe, expect, it, vi } from "vitest";

import { getCurrentLocation } from "./geolocation";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("geolocation adapter", () => {
  it.each([
    [1, "Location permission was denied."],
    [2, "Your location is currently unavailable."],
    [3, "Finding your location timed out."],
  ])("maps browser error code %s", async (code, reason) => {
    const getCurrentPosition: Geolocation["getCurrentPosition"] = (
      _success,
      error,
    ) => {
      error?.({
        code,
        message: "",
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      });
    };
    vi.stubGlobal("navigator", {
      geolocation: { getCurrentPosition },
    });

    await expect(getCurrentLocation()).resolves.toEqual({
      status: "error",
      reason,
    });
  });
});
