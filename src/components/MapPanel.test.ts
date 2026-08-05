import { createElement, type ReactNode } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";

const mapMocks = vi.hoisted(() => ({
  animateCamera: vi.fn(),
  fitToCoordinates: vi.fn(),
}));

vi.mock("react-native", () => ({
  Pressable: "Pressable",
  StyleSheet: {
    absoluteFill: {},
    create: <T,>(styles: T) => styles,
  },
  Text: "Text",
  View: "View",
}));

vi.mock("react-native-maps", async () => {
  const {
    createElement: makeElement,
    forwardRef,
    useImperativeHandle,
  } = await import("react");
  const component = (name: string) =>
    (props: Record<string, unknown> & { children?: ReactNode }) =>
      makeElement(name, props, props.children);
  const MapView = forwardRef(
    (
      props: Record<string, unknown> & { children?: ReactNode },
      ref,
    ) => {
      useImperativeHandle(ref, () => mapMocks);
      return makeElement("MapView", props, props.children);
    },
  );
  MapView.displayName = "MapView";
  return {
    default: MapView,
    Marker: component("Marker"),
    Polygon: component("Polygon"),
    Polyline: component("Polyline"),
  };
});

import MapView, { Marker, Polygon, Polyline } from "react-native-maps";
import { MapPanel } from "./MapPanel";

describe("MapPanel native parity", () => {
  let renderer: ReactTestRenderer | null = null;

  afterEach(async () => {
    if (renderer) await act(async () => renderer?.unmount());
    renderer = null;
    vi.clearAllMocks();
  });

  it("renders eclipse overlays and supports selection and extent controls", async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const onLocationChange = vi.fn();
    const location = { latitude: 43.3717, longitude: -6.1883 };
    const totalityArea = [
      { latitude: 44, longitude: -7 },
      { latitude: 42, longitude: -5 },
      { latitude: 41.5, longitude: -6 },
    ];

    await act(async () => {
      renderer = create(
        createElement(MapPanel, {
          bounds: { east: 4, north: 46.5, south: 37, west: -12.5 },
          candidates: [{ latitude: 43, longitude: -5.5 }],
          contours: {
            obscurationContours: [
              {
                paths: [[[40, -4], [41, -3], [40, -2]]],
                percent: 1,
              },
              {
                paths: [[[40, -4], [41, -3]]],
                percent: 80,
              },
            ],
            timeContours: [
              { label: "18:00Z", paths: [[[40, -4], [41, -3]]] },
            ],
          },
          location,
          onLocationChange,
          path: {
            centerLine: [
              { ...location, timeUtc: "18:00Z" },
              { latitude: 42, longitude: -5, timeUtc: "18:02Z" },
            ],
            northernLimit: [{ latitude: 44, longitude: -7 }],
            southernLimit: [{ latitude: 42, longitude: -5 }],
            totalityArea,
          },
        }),
      );
    });

    expect(renderer?.root.findAllByType(Polygon)).toHaveLength(2);
    expect(renderer?.root.findAllByType(Polyline)).toHaveLength(5);
    expect(renderer?.root.findAllByType(Marker)).toHaveLength(3);
    expect(
      renderer?.root.findByProps({ identifier: "selected-location" }).props.zIndex,
    ).toBeGreaterThan(0);

    const map = renderer?.root.findByType(MapView);
    await act(async () => map?.props.onMapReady());
    expect(mapMocks.fitToCoordinates).toHaveBeenCalledWith(
      totalityArea,
      expect.objectContaining({ animated: false }),
    );

    await act(async () =>
      map?.props.onPress({
        nativeEvent: { coordinate: { latitude: 40.4, longitude: -3.7 } },
      }),
    );
    expect(onLocationChange).toHaveBeenCalledWith({
      latitude: 40.4,
      longitude: -3.7,
    });

    await act(async () =>
      renderer?.root
        .findByProps({ accessibilityLabel: "Show selected region" })
        .props.onPress(),
    );
    expect(mapMocks.fitToCoordinates).toHaveBeenLastCalledWith(
      [
        { latitude: 46.5, longitude: -12.5 },
        { latitude: 46.5, longitude: 4 },
        { latitude: 37, longitude: 4 },
        { latitude: 37, longitude: -12.5 },
      ],
      expect.objectContaining({ animated: true }),
    );
  });
});
