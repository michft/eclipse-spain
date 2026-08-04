import { describe, expect, it } from "vitest";

import type { ContactRecord } from "./audioTimeline";
import type { ObserverSkyState } from "./eclipse";
import {
  eclipseDiscGeometry,
  eclipsePhaseAt,
} from "./eclipseOverlay";

const contacts: ContactRecord = {
  c1: { id: "c1", label: "C1", sunAltitudeDegrees: 10, sunAzimuthDegrees: 180, utc: "2026-08-12T17:30:00.000Z" },
  c2: { id: "c2", label: "C2", sunAltitudeDegrees: 8, sunAzimuthDegrees: 182, utc: "2026-08-12T18:25:00.000Z" },
  maximum: { id: "maximum", label: "Maximum", sunAltitudeDegrees: 7, sunAzimuthDegrees: 183, utc: "2026-08-12T18:26:00.000Z" },
  c3: { id: "c3", label: "C3", sunAltitudeDegrees: 7, sunAzimuthDegrees: 184, utc: "2026-08-12T18:27:00.000Z" },
  c4: { id: "c4", label: "C4", sunAltitudeDegrees: 2, sunAzimuthDegrees: 190, utc: "2026-08-12T19:30:00.000Z" },
};

const time = (contact: NonNullable<ContactRecord["c1"]>): number =>
  Date.parse(contact.utc);

describe("eclipse contact overlay", () => {
  it("labels every contact phase and the no-contact context", () => {
    const c1 = time(contacts.c1!);
    const c2 = time(contacts.c2!);
    const maximum = time(contacts.maximum!);
    const c3 = time(contacts.c3!);
    const c4 = time(contacts.c4!);

    expect(eclipsePhaseAt(contacts, "total", c1 - 1).id).toBe("before-c1");
    expect(eclipsePhaseAt(contacts, "total", c1).id).toBe("c1");
    expect(eclipsePhaseAt(contacts, "total", (c1 + c2) / 2).id).toBe("partial-increasing");
    expect(eclipsePhaseAt(contacts, "total", c2).id).toBe("c2");
    expect(eclipsePhaseAt(contacts, "total", maximum).id).toBe("totality");
    expect(eclipsePhaseAt(contacts, "total", c3).id).toBe("c3");
    expect(eclipsePhaseAt(contacts, "total", (c3 + c4) / 2).id).toBe("partial-decreasing");
    expect(eclipsePhaseAt(contacts, "total", c4).id).toBe("c4");
    expect(eclipsePhaseAt(contacts, "total", c4 + 1).id).toBe("after-c4");
  });

  it("uses calculated angular separation without changing contact geometry", () => {
    const sky: ObserverSkyState = {
      utc: "2026-08-12T17:30:00.000Z",
      obscuration: 0,
      sun: { altitudeDegrees: 20, angularRadiusDegrees: 0.25, azimuthDegrees: 180 },
      moon: { altitudeDegrees: 20, angularRadiusDegrees: 0.27, azimuthDegrees: 181 },
    };

    const geometry = eclipseDiscGeometry(sky);
    expect(geometry.separationDegrees).toBeCloseTo(0.939691, 6);
  });

  it("labels maximum correctly when C2 and C3 are absent", () => {
    const partialContacts: ContactRecord = { ...contacts, c2: null, c3: null };
    const maximum = time(partialContacts.maximum!);

    expect(eclipsePhaseAt(partialContacts, "partial", maximum - 1).id).toBe(
      "partial-increasing",
    );
    expect(eclipsePhaseAt(partialContacts, "partial", maximum).id).toBe(
      "partial-maximum",
    );
    expect(eclipsePhaseAt(partialContacts, "partial", maximum + 1).id).toBe(
      "partial-decreasing",
    );
  });

  it("labels the C2–C3 interval as annularity for an annular eclipse", () => {
    const annularEclipse = { contacts, kind: "annular" as const };
    const c2 = time(annularEclipse.contacts.c2!);
    const maximum = time(annularEclipse.contacts.maximum!);
    const c3 = time(annularEclipse.contacts.c3!);

    expect(eclipsePhaseAt(annularEclipse.contacts, annularEclipse.kind, c2)).toEqual({
      id: "c2",
      label: "C2 · annularity begins",
    });
    expect(
      eclipsePhaseAt(
        annularEclipse.contacts,
        annularEclipse.kind,
        maximum,
      ),
    ).toEqual({
      id: "annularity",
      label: "Annularity · ring of Sun visible",
    });
    expect(eclipsePhaseAt(annularEclipse.contacts, annularEclipse.kind, c3)).toEqual({
      id: "c3",
      label: "C3 · annularity ends",
    });
  });
});
