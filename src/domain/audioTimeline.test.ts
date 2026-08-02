import { describe, expect, it } from "vitest";

import type { EclipseContact } from "./eclipse";
import {
  findDueMarkers,
  formatOffset,
  parseOffset,
  resolveAudioMarkers,
  type AudioMarker,
  type ContactRecord,
} from "./audioTimeline";

const contact = (id: EclipseContact["id"], utc: string): EclipseContact => ({
  id,
  label: id,
  utc,
  sunAltitudeDegrees: 10,
  sunAzimuthDegrees: 200,
});

const contacts: ContactRecord = {
  c1: contact("c1", "2026-08-12T18:00:00.000Z"),
  c2: contact("c2", "2026-08-12T18:30:00.000Z"),
  maximum: contact("maximum", "2026-08-12T18:31:00.000Z"),
  c3: contact("c3", "2026-08-12T18:32:00.000Z"),
  c4: contact("c4", "2026-08-12T19:00:00.000Z"),
};

const marker: AudioMarker = {
  id: "marker",
  anchor: "c2",
  offsetSeconds: 90,
  label: "Soon",
  spoken: true,
  enabled: true,
};

describe("audio timeline", () => {
  it.each([
    ["45", 45],
    ["1:30", 90],
    ["-1:05", -65],
    ["0", 0],
  ])("parses %s", (input, expected) => {
    expect(parseOffset(input)).toBe(expected);
  });

  it.each(["", "1:60", "1.5", "+30", "abc"])("rejects %s", (input) => {
    expect(parseOffset(input)).toBeNull();
  });

  it("formats seconds and minutes", () => {
    expect(formatOffset(45)).toBe("45");
    expect(formatOffset(90)).toBe("1:30");
    expect(formatOffset(-65)).toBe("-1:05");
  });

  it("places positive offsets before and negative offsets after an anchor", () => {
    const before = resolveAudioMarkers([marker], contacts)[0];
    const after = resolveAudioMarkers(
      [{ ...marker, id: "after", offsetSeconds: -30 }],
      contacts,
    )[0];
    const c2 = Date.parse(contacts.c2?.utc ?? "");

    expect(before?.targetUtcMilliseconds).toBe(c2 - 90_000);
    expect(after?.targetUtcMilliseconds).toBe(c2 + 30_000);
  });

  it("does not resolve disabled or unavailable anchors", () => {
    expect(
      resolveAudioMarkers(
        [{ ...marker, enabled: false }, { ...marker, id: "missing", anchor: "c2" }],
        { ...contacts, c2: null },
      ),
    ).toEqual([]);
  });

  it("fires recent markers once and skips stale suspended-tab markers", () => {
    const target = Date.parse("2026-08-12T18:28:30.000Z");
    const resolved = resolveAudioMarkers([marker], contacts);

    expect(findDueMarkers(resolved, target - 1000, target + 500, new Set())).toHaveLength(1);
    expect(
      findDueMarkers(resolved, target - 1000, target + 500, new Set(["marker"])),
    ).toHaveLength(0);
    expect(findDueMarkers(resolved, target - 10_000, target + 5000, new Set())).toHaveLength(0);
  });
});
