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
    Callout: component("Callout"),
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
    const onCameraChange = vi.fn();
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
          onCameraChange,
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
      map?.props.onRegionChangeComplete({
        latitude: 41.25,
        latitudeDelta: 0.4,
        longitude: -3.5,
        longitudeDelta: 0.6,
      }),
    );
    expect(onCameraChange).toHaveBeenCalledWith({
      center: { latitude: 41.25, longitude: -3.5 },
      latitudeDelta: 0.4,
      longitudeDelta: 0.6,
      zoom: 0,
    });

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

  it("restores a saved camera without fitting the event bounds", async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const camera = {
      center: { latitude: 41, longitude: -3 },
      latitudeDelta: 0.4,
      longitudeDelta: 0.6,
      zoom: 0,
    };
    await act(async () => {
      renderer = create(
        createElement(MapPanel, {
          bounds: { east: 4, north: 46.5, south: 37, west: -12.5 },
          contours: { obscurationContours: [], timeContours: [] },
          initialCamera: camera,
          location: camera.center,
          onLocationChange: vi.fn(),
          path: {
            centerLine: [],
            northernLimit: [],
            southernLimit: [],
            totalityArea: [{ latitude: 44, longitude: -7 }],
          },
        }),
      );
    });

    const map = renderer?.root.findByType(MapView);
    expect(map?.props.initialRegion).toEqual({
      latitude: 41,
      latitudeDelta: 0.4,
      longitude: -3,
      longitudeDelta: 0.6,
    });
    await act(async () => map?.props.onMapReady());
    expect(mapMocks.fitToCoordinates).not.toHaveBeenCalled();
  });

  it("offers Spain and Iceland region choices", async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const onRegionChange = vi.fn();
    const regions = [
      {
        bounds: { east: 4, north: 46.5, south: 37, west: -12.5 },
        id: "spain",
        label: "Spain",
      },
      {
        bounds: { east: -12.5, north: 67, south: 60, west: -35 },
        id: "iceland",
        label: "Iceland",
      },
    ];
    const spainBounds = regions[0]!;
    await act(async () => {
      renderer = create(
        createElement(MapPanel, {
          bounds: spainBounds.bounds,
          contours: { obscurationContours: [], timeContours: [] },
          location: { latitude: 43, longitude: -4 },
          onLocationChange: vi.fn(),
          onRegionChange,
          path: {
            centerLine: [],
            northernLimit: [],
            southernLimit: [],
            totalityArea: [{ latitude: 44, longitude: -7 }],
          },
          regionOptions: regions,
          selectedRegionId: "spain",
        }),
      );
    });

    expect(
      renderer?.root.findAllByProps({ accessibilityRole: "radio" }),
    ).toHaveLength(2);
    const map = renderer?.root.findByType(MapView);
    await act(async () => map?.props.onMapReady());
    mapMocks.fitToCoordinates.mockClear();
    await act(async () =>
      renderer?.root.findByProps({ accessibilityLabel: "Show Iceland" }).props.onPress(),
    );
    expect(onRegionChange).toHaveBeenCalledWith("iceland");
    expect(mapMocks.fitToCoordinates).toHaveBeenCalledWith(
      [
        { latitude: 67, longitude: -35 },
        { latitude: 67, longitude: -12.5 },
        { latitude: 60, longitude: -12.5 },
        { latitude: 60, longitude: -35 },
      ],
      expect.objectContaining({ animated: true }),
    );
  });
});
