import { createElement } from "react";
import { Text } from "react-native";
import { Text as SvgText } from "react-native-svg";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ContactRecord } from "../domain/audioTimeline";
import type { ElevationProfileResult } from "../services/openMeteo";
import { theme } from "../styles/theme";

const mocks = vi.hoisted(() => ({
  sliderProps: [] as Record<string, unknown>[],
}));

vi.mock("react-native", () => ({
  Pressable: "Pressable",
  StyleSheet: { create: <T,>(styles: T) => styles },
  Text: "Text",
  View: "View",
}));

vi.mock("react-native-svg", () => ({
  default: "Svg",
  Circle: "Circle",
  Defs: "Defs",
  Ellipse: "Ellipse",
  G: "G",
  LinearGradient: "LinearGradient",
  Line: "Line",
  Polygon: "Polygon",
  Polyline: "Polyline",
  Rect: "Rect",
  Stop: "Stop",
  Text: "SvgText",
}));

vi.mock("../domain/eclipse", () => ({
  CONTACT_IDS: ["c1", "c2", "maximum", "c3", "c4"],
  calculateObserverSky: (_location: unknown, date: Date) => ({
    utc: date.toISOString(),
    obscuration: 1,
    sun: {
      altitudeDegrees: 80,
      azimuthDegrees: 180,
      angularRadiusDegrees: 0.25,
    },
    moon: {
      altitudeDegrees: 10.1,
      azimuthDegrees: 180.1,
      angularRadiusDegrees: 0.25,
    },
  }),
}));

vi.mock("./TimelineSlider", () => ({
  TimelineSlider: (props: Record<string, unknown>) => {
    mocks.sliderProps.push(props);
    return createElement(Text, null, "slider");
  },
}));

import { HorizonSimulator } from "./HorizonSimulator";

const contacts: ContactRecord = {
  c1: {
    id: "c1",
    label: "First contact",
    sunAltitudeDegrees: 10,
    sunAzimuthDegrees: 180,
    utc: "2026-08-12T17:30:00.000Z",
  },
  c2: {
    id: "c2",
    label: "Start of totality",
    sunAltitudeDegrees: 8,
    sunAzimuthDegrees: 182,
    utc: "2026-08-12T18:25:00.000Z",
  },
  maximum: {
    id: "maximum",
    label: "Maximum eclipse",
    sunAltitudeDegrees: 7,
    sunAzimuthDegrees: 183,
    utc: "2026-08-12T18:26:00.000Z",
  },
  c3: {
    id: "c3",
    label: "End of totality",
    sunAltitudeDegrees: 7,
    sunAzimuthDegrees: 184,
    utc: "2026-08-12T18:27:00.000Z",
  },
  c4: {
    id: "c4",
    label: "Last contact",
    sunAltitudeDegrees: 2,
    sunAzimuthDegrees: 190,
    utc: "2026-08-12T20:30:00.000Z",
  },
};

const elevation: ElevationProfileResult = {
  observerElevationMeters: 100,
  horizon: {
    observerElevationMeters: 100,
    azimuthDegrees: 180,
    highestTerrainAngleDegrees: 1,
    samples: [],
  },
  skyline: {
    centerAzimuthDegrees: 180,
    fieldOfViewDegrees: 180,
    samples: [
      { azimuthDegrees: 90, azimuthOffsetDegrees: -90, terrainAngleDegrees: 1 },
      { azimuthDegrees: 140, azimuthOffsetDegrees: -40, terrainAngleDegrees: 1 },
      { azimuthDegrees: 180, azimuthOffsetDegrees: 0, terrainAngleDegrees: 1 },
      { azimuthDegrees: 220, azimuthOffsetDegrees: 40, terrainAngleDegrees: 1 },
      { azimuthDegrees: 270, azimuthOffsetDegrees: 90, terrainAngleDegrees: 1 },
    ],
  },
  retrievedUtc: "2026-08-01T00:00:00.000Z",
  sourceUrl: "https://example.com/elevation",
};

describe("HorizonSimulator", () => {
  let renderer: ReactTestRenderer | null = null;

  afterEach(async () => {
    if (renderer) {
      await act(async () => renderer?.unmount());
    }
    renderer = null;
    mocks.sliderProps.length = 0;
  });

  it("visibly labels chart lines and every interaction group", async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    await act(async () => {
      renderer = create(
        createElement(HorizonSimulator, {
          contacts,
          elevation,
          kind: "total",
          location: { latitude: 43.3717, longitude: -6.1883 },
        }),
      );
    });

    const text = renderer?.root
      .findAllByType(Text)
      .flatMap((node) => node.children)
      .filter((value): value is string => typeof value === "string");

    expect(text).toEqual(
      expect.arrayContaining([
        "Sun path",
        "Moon path",
        "Terrain skyline",
        "Astronomical horizon (0° altitude)",
        "Eclipse contact",
        "Totality · Sun fully obscured",
        "To-scale angular view · glow is decorative",
        "Field of view",
        "Simulation time",
        "Playback controls",
        "Jump to eclipse contact",
        "Before C1",
        "After C4",
        "Outside eclipse · white",
        "C1–C4 eclipse · orange",
      ]),
    );

    const visibleText = renderer?.root
      .findAllByType(Text)
      .map((node) => node.children.join(""));
    expect(visibleText).toEqual(
      expect.arrayContaining(["45°", "N 0°", "E 90°", "S 180°", "W 270°"]),
    );

    const altitudeLabels = renderer?.root
      .findAllByType(SvgText)
      .map((node) => node.children.join(""));
    expect(altitudeLabels).toEqual(
      expect.arrayContaining([
        "0°",
        "10°",
        "20°",
        "40°",
        "60°",
        "80°",
        "17:00Z",
        "18:00Z",
        "19:00Z",
        "20:00Z",
        "21:00Z",
      ]),
    );

    const fieldOfViewSlider = mocks.sliderProps.find(
      (props) => props.accessibilityLabel === "Horizon field of view",
    );
    expect(fieldOfViewSlider).toEqual(
      expect.objectContaining({ maximum: 180, minimum: 30, step: 5, value: 45 }),
    );
    const onFieldOfViewChange = fieldOfViewSlider?.onChange;
    if (typeof onFieldOfViewChange !== "function") {
      throw new Error("Horizon field-of-view control was not interactive.");
    }
    await act(async () => onFieldOfViewChange(180));
    expect(
      renderer?.root.findAllByType(Text).map((node) => node.children.join("")),
    ).toContain("180°");

    const simulationSlider = mocks.sliderProps.find(
      (props) => props.accessibilityLabel === "Horizon simulation time",
    );
    expect(simulationSlider).toEqual(
      expect.objectContaining({
        minimum: Date.parse(contacts.c1!.utc) - 30 * 60_000,
        maximum: Date.parse(contacts.c4!.utc) + 30 * 60_000,
      }),
    );

    expect(visibleText).toEqual(
      expect.arrayContaining([
        "17:00:00 UTC · 30 min before C1",
        "21:00:00 UTC · 30 min after C4",
      ]),
    );

    const pathLines = renderer?.root.findAll(
      (node) => typeof node.props.accessibilityLabel === "string" &&
        node.props.accessibilityLabel.endsWith("path"),
    );
    expect(pathLines?.map((node) => node.props.accessibilityLabel)).toEqual(
      expect.arrayContaining([
        "Sun before C1 path",
        "Sun C1 to C4 eclipse path",
        "Sun after C4 path",
        "Moon before C1 path",
        "Moon C1 to C4 eclipse path",
        "Moon after C4 path",
      ]),
    );
    expect(
      pathLines?.filter((node) => node.props.stroke === theme.color.text),
    ).toHaveLength(4);
    expect(
      pathLines?.filter((node) => node.props.stroke === theme.color.accentStrong),
    ).toHaveLength(2);
  });
});
