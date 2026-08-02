import { afterEach, describe, expect, it, vi } from "vitest";

import { copyText, readSharedSelection } from "./share";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sharing adapters", () => {
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
});
