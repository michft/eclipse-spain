import { describe, expect, it } from "vitest";

import { ECLIPSE_CONTOURS } from "./eclipseContours.generated";
import { ECLIPSE_PATHS } from "./eclipsePaths";

describe("eclipse map overlays", () => {
  it.each([
    ["spain-2026", 48, ["18:00Z"]],
    ["middle-east-2027", 104, ["09:00Z", "10:00Z", "11:00Z"]],
    ["australia-2028", 85, ["02:00Z", "03:00Z", "04:00Z"]],
  ] as const)(
    "keeps the complete NASA path for %s",
    (eventId, expectedCenterPoints, expectedCenterHours) => {
      const path = ECLIPSE_PATHS[eventId];
      expect(path.centerLine).toHaveLength(expectedCenterPoints);
      expect(path.northernLimit.length).toBeGreaterThan(expectedCenterPoints - 2);
      expect(path.southernLimit.length).toBeGreaterThan(expectedCenterPoints - 2);
      expect(path.totalityArea).toHaveLength(
        path.northernLimit.length + path.southernLimit.length,
      );
      expect(
        path.centerLine.flatMap((point) =>
          point.timeUtc?.endsWith(":00Z") ? [point.timeUtc] : [],
        ),
      ).toEqual(expectedCenterHours);
    },
  );

  it("provides partial-obscuration areas and real UTC hour contours", () => {
    for (const contours of Object.values(ECLIPSE_CONTOURS)) {
      expect(contours.obscurationContours.map((contour) => contour.percent)).toEqual([
        0.1, 20, 40, 60, 80,
      ]);
      expect(
        contours.obscurationContours.every((contour) => contour.paths.length > 0),
      ).toBe(true);
      expect(contours.timeContours.length).toBeGreaterThan(0);
      expect(
        contours.timeContours.every((contour) => /^\d{2}:00Z$/.test(contour.label)),
      ).toBe(true);
    }
    expect(ECLIPSE_CONTOURS["spain-2026"].timeContours.map(({ label }) => label))
      .toContain("19:00Z");
  });
});
