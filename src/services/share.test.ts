import { afterEach, describe, expect, it, vi } from "vitest";

const { setStringAsync } = vi.hoisted(() => ({
  setStringAsync: vi.fn(async () => true),
}));

vi.mock("expo-clipboard", () => ({ setStringAsync }));

import {
  copyText,
  makeQrCode,
  readSharedSelection,
  updateShareUrl,
} from "./share";

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("sharing adapters", () => {
  it("creates a cross-platform SVG QR code", async () => {
    const result = await makeQrCode("https://example.test/share");

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.value).toMatch(/^<svg/);
    }
  });

  it("creates a web share URL for a native window", () => {
    vi.stubGlobal("window", {});

    expect(readSharedSelection()).toBeNull();
    expect(
      updateShareUrl("spain-2026", { latitude: 40, longitude: -3 }),
    ).toBe(
      "https://eclipse-spain-ten.vercel.app/?event=spain-2026&lat=40.00000&lon=-3.00000",
    );
  });

  it.each([
    "https://example.test/?event=spain-2026&lat=&lon=0",
    "https://example.test/?event=spain-2026&lat=0&lon=",
    "https://example.test/?event=spain-2026&lat=NaN&lon=0",
  ])("rejects blank or non-finite coordinates in %s", (href) => {
    vi.stubGlobal("window", { location: { href } });

    expect(readSharedSelection()).toBeNull();
  });

  it("accepts finite zero coordinates", () => {
    vi.stubGlobal("window", {
      location: {
        href: "https://example.test/?event=spain-2026&lat=0&lon=0",
      },
    });

    expect(readSharedSelection()).toEqual({
      eventId: "spain-2026",
      location: { latitude: 0, longitude: 0 },
    });
  });

  it("returns false when clipboard writing rejects", async () => {
    const writeText = vi.fn(async () => {
      throw new Error("Clipboard blocked.");
    });
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    await expect(copyText("share link")).resolves.toBe(false);
  });

  it("uses the native clipboard when the browser clipboard is absent", async () => {
    vi.stubGlobal("navigator", {});

    await expect(copyText("share link")).resolves.toBe(true);
    expect(setStringAsync).toHaveBeenCalledWith("share link");
  });
});
