import { createElement } from "react";
import { Text } from "react-native";
import { Text as SvgText } from "react-native-svg";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ContactRecord } from "../domain/audioTimeline";
import type { ElevationProfileResult } from "../services/openMeteo";
import { theme } from "../styles/theme";
import { ActionButton } from "./ActionButton";

const mocks = vi.hoisted(() => ({
  compassAvailable: false,
  compassHeading: null as number | null,
  requestHeading: vi.fn(),
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

vi.mock("../services/compass", () => ({
  useCompassHeading: () => ({
    available: mocks.compassAvailable,
    headingDegrees: mocks.compassHeading,
    requestHeading: mocks.requestHeading,
  }),
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
    mocks.compassAvailable = false;
    mocks.compassHeading = null;
    mocks.requestHeading.mockClear();
    vi.unstubAllGlobals();
  });

  it("animates playback continuously between frames", async () => {
    const frames: Array<(timestamp: number) => void> = [];
    vi.stubGlobal("requestAnimationFrame", (callback: (timestamp: number) => void) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

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

    const playButton = renderer?.root.findAllByType(ActionButton).find((node) =>
      node.findAllByType(Text).some((textNode) => textNode.children.join("") === "Play"),
    );
    await act(async () => playButton?.props.onPress());
    expect(frames).toHaveLength(1);

    await act(async () => frames.shift()?.(1000));
    await act(async () => frames.shift()?.(1016));

    expect(
      renderer?.root.findAllByType(Text).map((node) => node.children.join("")),
    ).toContain("18:26:04 UTC");
    expect(frames).toHaveLength(1);
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

    const button = (label: string) =>
      renderer?.root
        .findAllByType(ActionButton)
        .find((node) =>
          node.findAllByType(Text).some((textNode) =>
            textNode.children.join("") === label,
          ),
        );
    expect(button("Guide · Show")?.props.accessibilityState).toEqual({
      expanded: false,
    });
    const renderedText = () =>
      renderer?.root
        .findAllByType(Text)
        .map((node) => node.children.join("")) ?? [];
    expect(renderedText()).not.toContain("Sun path");
    expect(
      renderedText().some((value) =>
        value.includes("Terrain uses a 90 m DEM sampled across a 180° view."),
      ),
    ).toBe(false);

    await act(async () => button("Guide · Show")?.props.onPress());
    expect(button("Guide · Hide")?.props.accessibilityState).toEqual({
      expanded: true,
    });
    expect(renderedText()).toContain("Sun path");

    await act(async () => {
      renderer?.update(
        createElement(HorizonSimulator, {
          contacts,
          elevation,
          kind: "total",
          location: { latitude: 43.3717, longitude: -6.1883 },
          showTechnicalDetails: true,
        }),
      );
    });
    expect(
      renderedText().some((value) =>
        value.includes("Terrain uses a 90 m DEM sampled across a 180° view."),
      ),
    ).toBe(true);

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
        "Simulation time",
        "Step ▾",
        "Outside eclipse · white",
        "C1–C4 eclipse · orange",
      ]),
    );

    const visibleText = renderer?.root
      .findAllByType(Text)
      .map((node) => node.children.join(""));
    expect(visibleText).toEqual(
      expect.arrayContaining([
        "N 0°",
        "E 90°",
        "S 180°",
        "W 270°",
        "View · 45° ▾",
        "Speed · 300× ▾",
        "Jump · Maximum ▾",
        "-30m",
        "+30m",
        "C1",
        "C2",
        "Max",
        "C3",
        "C4",
      ]),
    );
    expect(visibleText).not.toContain("Before C1 · 30 min");
    expect(visibleText).not.toContain("C1–C4 eclipse");
    expect(visibleText).not.toContain("After C4 · 30 min");

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

    expect(mocks.sliderProps.length).toBeGreaterThan(0);
    expect(mocks.sliderProps.at(-1)).toEqual(
      expect.objectContaining({
        accessibilityLabel: "Horizon simulation time",
        accessibilityValueText: "18:26:00 UTC",
        hideThumb: true,
        transparentTrack: true,
      }),
    );
    expect(
      renderer?.root.findAll(
        (node) => node.props.accessibilityLabel === "Eclipse disc inset",
      ),
    ).toHaveLength(1);
    const skyPlot = renderer?.root.find(
      (node) => node.props.accessibilityLabel === "Observer sky plot",
    );
    await act(async () => {
      skyPlot?.props.onLayout({ nativeEvent: { layout: { width: 1200 } } });
    });
    expect(
      renderer?.root.find(
        (node) =>
          node.props.accessibilityLabel ===
          "Animated observer sky showing Sun and Moon above the sampled terrain horizon",
    ).props.viewBox,
    ).toBe("0 0 1200 360");
    expect(
      renderer?.root.find(
        (node) =>
          node.props.accessibilityLabel ===
          "Animated observer sky showing Sun and Moon above the sampled terrain horizon",
      ).props.height,
    ).toBe(600);
    expect(
      renderer?.root.findAll(
        (node) => node.props.accessibilityLabel === "Simulation time pin",
      ),
    ).toHaveLength(1);
    const onTimelineFocusChange = mocks.sliderProps.at(-1)?.onFocusChange;
    if (typeof onTimelineFocusChange !== "function") {
      throw new Error("Timeline focus state was not connected to the visible pin.");
    }
    await act(async () => onTimelineFocusChange(true));
    expect(
      renderer?.root.findAll(
        (node) =>
          node.props.accessibilityLabel ===
          "Simulation time pin focus indicator",
      ),
    ).toHaveLength(1);
    await act(async () => onTimelineFocusChange(false));
    expect(
      renderer?.root.findAll(
        (node) =>
          node.props.accessibilityLabel ===
          "Simulation time pin focus indicator",
      ),
    ).toHaveLength(0);
    expect(
      renderer?.root
        .findAll(
          (node) =>
            typeof node.props.accessibilityLabel === "string" &&
            node.props.accessibilityLabel.endsWith("timeline fork"),
        )
        .map((node) => node.props.accessibilityLabel),
    ).toEqual([
      "C2 timeline fork",
      "Max timeline fork",
      "C3 timeline fork",
    ]);
    expect(
      renderer?.root
        .findAll(
          (node) =>
            typeof node.props.accessibilityLabel === "string" &&
            node.props.accessibilityLabel.endsWith("timeline marker"),
        )
        .map((node) => node.props.accessibilityLabel),
    ).toEqual([
      "C1 timeline marker",
      "C2 timeline marker",
      "Max timeline marker",
      "C3 timeline marker",
      "C4 timeline marker",
    ]);

    expect(button("180°")).toBeUndefined();
    await act(async () => button("View · 45° ▾")?.props.onPress());
    expect(button("180°")).toBeDefined();
    expect(button("View · 45° ▾")?.props.accessibilityState).toEqual({
      expanded: true,
    });
    await act(async () => button("180°")?.props.onPress());
    expect(button("180°")).toBeUndefined();
    expect(
      renderer?.root.findAllByType(Text).map((node) => node.children.join("")),
    ).toContain("View · 180° ▾");
    expect(button("View · 180° ▾")?.props.accessibilityState).toEqual({
      expanded: false,
    });

    expect(button("−1 min")).toBeUndefined();
    await act(async () => button("Step ▾")?.props.onPress());
    expect(button("−1 min")).toBeDefined();
    expect(button("+1 min")).toBeDefined();
    await act(async () => button("+1 min")?.props.onPress());
    expect(
      renderer?.root.findAllByType(Text).map((node) => node.children.join("")),
    ).toContain("18:27:00 UTC");

    await act(async () => button("Jump · C3 ▾")?.props.onPress());
    expect(button("−1 min")).toBeUndefined();
    expect(button("Jump · C3 ▾")?.props.accessibilityState).toEqual({
      expanded: true,
    });
    for (const contactLabel of ["C1", "C2", "Maximum", "C3", "C4"]) {
      expect(button(contactLabel)).toBeDefined();
    }
    await act(async () => button("Before C1")?.props.onPress());
    await act(async () => button("Step ▾")?.props.onPress());
    await act(async () => button("−1 min")?.props.onPress());
    expect(
      renderer?.root.findAllByType(Text).map((node) => node.children.join("")),
    ).toContain("17:00:00 UTC");
    await act(async () => button("Jump · Before C1 ▾")?.props.onPress());
    await act(async () => button("C1")?.props.onPress());
    expect(
      renderer?.root.findAllByType(Text).map((node) => node.children.join("")),
    ).toContain("17:30:00 UTC");

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

  it("offers compass alignment and recentres azimuth labels", async () => {
    mocks.compassAvailable = true;
    mocks.compassHeading = 0;
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

    const alignButton = renderer?.root.findByProps({
      accessibilityLabel: "Align horizon with compass",
    });
    expect(alignButton).toBeDefined();
    await act(async () => alignButton?.props.onPress());
    expect(mocks.requestHeading).toHaveBeenCalled();
    expect(
      renderer?.root.findAllByType(SvgText).map((node) => node.children.join("")),
    ).toEqual(expect.arrayContaining(["90° az", "135° az"]));
    mocks.compassAvailable = false;
    mocks.compassHeading = null;
  });

  it("omits timeline markers with invalid contact times", async () => {
    const invalidContacts: ContactRecord = {
      ...contacts,
      c2: { ...contacts.c2!, utc: "invalid-c2" },
      maximum: { ...contacts.maximum!, utc: "invalid-maximum" },
      c3: { ...contacts.c3!, utc: "invalid-c3" },
    };

    await act(async () => {
      renderer = create(
        createElement(HorizonSimulator, {
          contacts: invalidContacts,
          elevation,
          kind: "total",
          location: { latitude: 43.3717, longitude: -6.1883 },
        }),
      );
    });

    expect(
      renderer?.root
        .findAll(
          (node) =>
            typeof node.props.accessibilityLabel === "string" &&
            node.props.accessibilityLabel.endsWith("timeline marker"),
        )
        .map((node) => node.props.accessibilityLabel),
    ).toEqual(["C1 timeline marker", "C4 timeline marker"]);

    const button = (label: string) =>
      renderer?.root
        .findAllByType(ActionButton)
        .find((node) =>
          node.findAllByType(Text).some((textNode) =>
            textNode.children.join("") === label,
          ),
        );
    await act(async () => button("Jump · C1 ▾")?.props.onPress());
    expect(button("C1")).toBeDefined();
    expect(button("C4")).toBeDefined();
    for (const invalidContactLabel of ["C2", "Maximum", "C3"]) {
      expect(button(invalidContactLabel)).toBeUndefined();
    }
  });
});
