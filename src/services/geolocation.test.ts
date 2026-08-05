import { afterEach, describe, expect, it, vi } from "vitest";

const locationMocks = vi.hoisted(() => ({
  getCurrentPositionAsync: vi.fn(),
  requestForegroundPermissionsAsync: vi.fn(),
}));

vi.mock("expo-location", () => ({
  Accuracy: { High: 6 },
  ...locationMocks,
}));

import { getCurrentLocation } from "./geolocation";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("geolocation adapter", () => {
  it("reads a permitted native device location", async () => {
    vi.stubGlobal("navigator", {});
    locationMocks.requestForegroundPermissionsAsync.mockResolvedValue({
      status: "granted",
    });
    locationMocks.getCurrentPositionAsync.mockResolvedValue({
      coords: { latitude: 41.4, longitude: 2.2 },
    });

    await expect(getCurrentLocation()).resolves.toEqual({
      status: "success",
      value: { latitude: 41.4, longitude: 2.2 },
    });
  });

  it("maps a denied native location permission", async () => {
    vi.stubGlobal("navigator", {});
    locationMocks.requestForegroundPermissionsAsync.mockResolvedValue({
      status: "denied",
    });

    await expect(getCurrentLocation()).resolves.toEqual({
      status: "error",
      reason: "Location permission was denied.",
    });
  });

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
