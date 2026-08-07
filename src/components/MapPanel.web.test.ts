import { createElement, type ReactNode } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";

const mapMocks = vi.hoisted(() => ({
  eventHandlers: {} as Record<string, () => void>,
  fitBounds: vi.fn(),
  getCenter: vi.fn(() => ({ lat: 41.25, lng: -3.5 })),
  getZoom: vi.fn(() => 9),
  panTo: vi.fn(),
}));

vi.mock("leaflet", () => ({
  default: {
    latLng: (latitude: number, longitude: number) => ({ latitude, longitude }),
    latLngBounds: vi.fn(),
  },
}));

vi.mock("react-leaflet", async () => {
  const { createElement: makeElement } = await import("react");
  const component = (name: string) =>
    (props: Record<string, unknown> & { children?: ReactNode }) =>
      makeElement(name, props, props.children);
  return {
    CircleMarker: component("CircleMarker"),
    MapContainer: component("MapContainer"),
    Pane: component("Pane"),
    Polygon: component("Polygon"),
    Polyline: component("Polyline"),
    TileLayer: component("TileLayer"),
    Tooltip: component("Tooltip"),
    useMap: () => ({
      ...mapMocks,
      getBounds: () => ({ contains: () => true }),
    }),
    useMapEvents: (handlers: Record<string, () => void>) => {
      Object.assign(mapMocks.eventHandlers, handlers);
      return null;
    },
  };
});

import { CircleMarker, MapContainer, Pane, Tooltip } from "react-leaflet";
import { MapPanel } from "./MapPanel.web";

describe("MapPanel web stacking and controls", () => {
  let renderer: ReactTestRenderer | null = null;

  afterEach(async () => {
    if (renderer) await act(async () => renderer?.unmount());
    renderer = null;
    mapMocks.eventHandlers = {};
    mapMocks.fitBounds.mockClear();
    mapMocks.getCenter.mockClear();
    mapMocks.getZoom.mockClear();
    mapMocks.panTo.mockClear();
  });

  it("keeps the selected point above overlays and groups extent choices", async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const location = { latitude: 43.3717, longitude: -6.1883 };
    await act(async () => {
      renderer = create(
        createElement(MapPanel, {
          bounds: { east: 4, north: 46.5, south: 37, west: -12.5 },
          contours: { obscurationContours: [], timeContours: [] },
          location,
          onLocationChange: vi.fn(),
          path: {
            centerLine: [{ ...location, timeUtc: "18:00Z" }],
            northernLimit: [{ latitude: 44, longitude: -7 }],
            southernLimit: [{ latitude: 42, longitude: -5 }],
            totalityArea: [
              { latitude: 44, longitude: -7 },
              { latitude: 42, longitude: -5 },
            ],
          },
        }),
      );
    });

    const selectedPane = renderer?.root.findByType(Pane);
    expect(selectedPane?.props).toEqual(
      expect.objectContaining({
        name: "selected-location",
        style: { zIndex: 640 },
      }),
    );
    expect(
      selectedPane?.findByType(CircleMarker).props.center,
    ).toEqual([location.latitude, location.longitude]);
    expect(selectedPane?.findByType(Tooltip).props.pane).toBe("tooltipPane");
    expect(selectedPane?.findByType(Tooltip).props.children).toBe("Current point");
    expect(renderer?.root.findByType(MapContainer).props.scrollWheelZoom).toBe(false);
    const extentSelect = renderer?.root.findByType("select");
    expect(extentSelect?.props.value).toBe("full");
    await act(async () => {
      extentSelect?.props.onChange({ currentTarget: { value: "region" } });
    });
    expect(renderer?.root.findByType("select").props.value).toBe("region");
    expect(renderer?.root.findAllByType("button")).toHaveLength(0);
  });

  it("restores a saved center and zoom when the map remounts", async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const camera = {
      center: { latitude: 41, longitude: -3 },
      latitudeDelta: 0,
      longitudeDelta: 0,
      zoom: 9,
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

    expect(renderer?.root.findByType(MapContainer).props.center).toEqual([41, -3]);
    expect(renderer?.root.findByType(MapContainer).props.zoom).toBe(9);
  });

  it("reports camera changes and fits a user-selected extent after restoration", async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const onCameraChange = vi.fn();
    const props = {
      bounds: { east: 4, north: 46.5, south: 37, west: -12.5 },
      contours: { obscurationContours: [], timeContours: [] },
      location: { latitude: 43.3717, longitude: -6.1883 },
      onCameraChange,
      onLocationChange: vi.fn(),
      path: {
        centerLine: [],
        northernLimit: [],
        southernLimit: [],
        totalityArea: [
          { latitude: 44, longitude: -7 },
          { latitude: 42, longitude: -5 },
        ],
      },
    };
    await act(async () => {
      renderer = create(createElement(MapPanel, props));
    });
    await act(async () => mapMocks.eventHandlers.moveend?.());
    expect(onCameraChange).toHaveBeenCalledWith({
      center: { latitude: 41.25, longitude: -3.5 },
      latitudeDelta: 0,
      longitudeDelta: 0,
      zoom: 9,
    });

    await act(async () => {
      renderer?.update(
        createElement(MapPanel, {
          ...props,
          initialCamera: {
            center: { latitude: 41.25, longitude: -3.5 },
            latitudeDelta: 0,
            longitudeDelta: 0,
            zoom: 9,
          },
        }),
      );
    });
    mapMocks.fitBounds.mockClear();
    await act(async () =>
      renderer?.root.findByType("select").props.onChange({
        currentTarget: { value: "region" },
      }),
    );
    expect(mapMocks.fitBounds).toHaveBeenCalledOnce();
  });

  it("offers Spain and Iceland region choices", async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const onRegionChange = vi.fn();
    await act(async () => {
      renderer = create(
        createElement(MapPanel, {
          bounds: { east: 4, north: 46.5, south: 37, west: -12.5 },
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
          regionOptions: [
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
          ],
          selectedRegionId: "spain",
        }),
      );
    });

    const select = renderer?.root.findByType("select");
    expect(select?.props.value).toBe("spain");
    expect(select?.findAllByType("option").map((option) => option.props.children)).toEqual([
      "Spain",
      "Iceland",
    ]);
    mapMocks.fitBounds.mockClear();
    await act(async () =>
      select?.props.onChange({ currentTarget: { value: "iceland" } }),
    );
    expect(onRegionChange).toHaveBeenCalledWith("iceland");
    expect(mapMocks.fitBounds).toHaveBeenCalledOnce();
  });
});
