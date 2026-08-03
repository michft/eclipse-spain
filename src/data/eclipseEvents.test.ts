import { describe, expect, it } from "vitest";

import {
  ECLIPSE_EVENTS,
  type EclipseEventId,
  type SourceLink,
} from "./eclipseEvents";

const expectedNasaSources = {
  "spain-2026": [
    {
      label: "NASA path table",
      url: "https://eclipse.gsfc.nasa.gov/SEpath/SEpath2001/SE2026Aug12Tpath.html",
    },
    {
      label: "NASA global visibility map",
      url: "https://eclipse.gsfc.nasa.gov/SEplot/SEplot2001/SE2026Aug12T.GIF",
    },
    {
      label: "NASA Besselian elements",
      url: "https://eclipse.gsfc.nasa.gov/SEbeselm/SEbeselm2001/SE2026Aug12Tbeselm.html",
    },
  ],
  "middle-east-2027": [
    {
      label: "NASA path table",
      url: "https://eclipse.gsfc.nasa.gov/SEpath/SEpath2001/SE2027Aug02Tpath.html",
    },
    {
      label: "NASA global visibility map",
      url: "https://eclipse.gsfc.nasa.gov/SEplot/SEplot2001/SE2027Aug02T.GIF",
    },
    {
      label: "NASA Besselian elements",
      url: "https://eclipse.gsfc.nasa.gov/SEbeselm/SEbeselm2001/SE2027Aug02Tbeselm.html",
    },
  ],
  "australia-2028": [
    {
      label: "NASA path table",
      url: "https://eclipse.gsfc.nasa.gov/SEpath/SEpath2001/SE2028Jul22Tpath.html",
    },
    {
      label: "NASA global visibility map",
      url: "https://eclipse.gsfc.nasa.gov/SEplot/SEplot2001/SE2028Jul22T.GIF",
    },
    {
      label: "NASA Besselian elements",
      url: "https://eclipse.gsfc.nasa.gov/SEbeselm/SEbeselm2001/SE2028Jul22Tbeselm.html",
    },
  ],
} satisfies Record<EclipseEventId, readonly SourceLink[]>;

describe("eclipse event source contract", () => {
  it("gives every event NASA path, map, and Besselian comparison links", () => {
    ECLIPSE_EVENTS.forEach((event) => {
      expect(event.sources).toEqual(
        expect.arrayContaining(expectedNasaSources[event.id]),
      );
    });
  });
});
