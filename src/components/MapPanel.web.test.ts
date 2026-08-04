import { createElement, type ReactNode } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";

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
      fitBounds: vi.fn(),
      getBounds: () => ({ contains: () => true }),
      panTo: vi.fn(),
    }),
    useMapEvents: vi.fn(),
  };
});

import { CircleMarker, Pane, Tooltip } from "react-leaflet";
import { MapPanel } from "./MapPanel.web";

describe("MapPanel web stacking and controls", () => {
  let renderer: ReactTestRenderer | null = null;

  afterEach(async () => {
    if (renderer) await act(async () => renderer?.unmount());
    renderer = null;
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
    const extentSelect = renderer?.root.findByType("select");
    expect(extentSelect?.props.value).toBe("full");
    await act(async () => {
      extentSelect?.props.onChange({ currentTarget: { value: "region" } });
    });
    expect(renderer?.root.findByType("select").props.value).toBe("region");
    expect(renderer?.root.findAllByType("button")).toHaveLength(0);
  });
});
