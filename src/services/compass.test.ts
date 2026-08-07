import { createElement, type ComponentType } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CompassState } from "./compass";

const nativeMocks = vi.hoisted(() => ({
  addListener: vi.fn(),
  isAvailableAsync: vi.fn(),
  setUpdateInterval: vi.fn(),
}));

vi.mock("expo-sensors", () => ({ Magnetometer: nativeMocks }));

import { useCompassHeading as useNativeCompassHeading } from "./compass";
import { useCompassHeading as useWebCompassHeading } from "./compass.web";

const webMocks = {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

const Probe = ({
  hook,
}: {
  hook: () => CompassState;
}) => {
  const state = hook();
  return createElement("button", {
    "data-available": String(state.available),
    "data-heading": state.headingDegrees === null ? "null" : state.headingDegrees,
    onClick: state.requestHeading,
  });
};

const renderProbe = (hook: () => CompassState): ReactTestRenderer => {
  let renderer: ReactTestRenderer | null = null;
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  act(() => {
    renderer = create(createElement(Probe as ComponentType<{ hook: () => CompassState }>, { hook }));
  });
  if (!renderer) throw new Error("Compass probe did not render.");
  return renderer;
};

const stateOf = (renderer: ReactTestRenderer) => {
  const button = renderer.root.findByType("button");
  return {
    available: button.props["data-available"],
    heading: button.props["data-heading"],
  };
};

const installWebOrientation = (
  requestPermission?: () => Promise<PermissionState>,
) => {
  class OrientationEvent {}
  if (requestPermission) {
    Object.assign(OrientationEvent, { requestPermission });
  }
  vi.stubGlobal("DeviceOrientationEvent", OrientationEvent);
  vi.stubGlobal("window", webMocks);
};

describe("web compass", () => {
  let renderer: ReactTestRenderer | null = null;

  afterEach(async () => {
    if (renderer) await act(async () => renderer?.unmount());
    renderer = null;
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("reports unsupported orientation APIs", async () => {
    vi.stubGlobal("window", webMocks);
    vi.stubGlobal("DeviceOrientationEvent", undefined);
    renderer = renderProbe(useWebCompassHeading);
    await act(async () => renderer?.root.findByType("button").props.onClick());
    expect(stateOf(renderer)).toEqual({ available: "false", heading: "null" });
  });

  it("uses absolute alpha and rejects relative orientation", async () => {
    installWebOrientation();
    renderer = renderProbe(useWebCompassHeading);
    await act(async () => renderer?.root.findByType("button").props.onClick());
    const listener = webMocks.addEventListener.mock.calls[0]?.[1] as
      | ((event: DeviceOrientationEvent) => void)
      | undefined;
    expect(listener).toBeDefined();

    await act(async () => listener?.({ alpha: 20, absolute: false } as DeviceOrientationEvent));
    expect(stateOf(renderer)).toEqual({ available: "false", heading: "null" });
    await act(async () => listener?.({ alpha: 20, absolute: true } as DeviceOrientationEvent));
    expect(stateOf(renderer)).toEqual({ available: "true", heading: 340 });
  });

  it("single-flights permission and cleans up its listener", async () => {
    const permission = vi.fn().mockResolvedValue("granted" as PermissionState);
    installWebOrientation(permission);
    renderer = renderProbe(useWebCompassHeading);
    const button = renderer.root.findByType("button");
    await act(async () => {
      button.props.onClick();
      button.props.onClick();
    });
    expect(permission).toHaveBeenCalledOnce();
    await act(async () => undefined);
    expect(webMocks.addEventListener).toHaveBeenCalledOnce();
    const listener = webMocks.addEventListener.mock.calls[0]?.[1];
    await act(async () => renderer?.unmount());
    renderer = null;
    expect(webMocks.removeEventListener).toHaveBeenCalledWith(
      "deviceorientation",
      listener,
    );
  });

  it.each(["denied", "rejected"])("maps permission %s", async (result) => {
    const permission =
      result === "denied"
        ? vi.fn().mockResolvedValue("denied" as PermissionState)
        : vi.fn().mockRejectedValue(new Error("permission failed"));
    installWebOrientation(permission);
    renderer = renderProbe(useWebCompassHeading);
    await act(async () => renderer?.root.findByType("button").props.onClick());
    await act(async () => undefined);
    expect(stateOf(renderer)).toEqual({ available: "false", heading: "null" });
  });

  it("ignores a permission result after unmount", async () => {
    let resolvePermission: (value: PermissionState) => void = () => undefined;
    const permission = vi.fn(
      () => new Promise<PermissionState>((resolve) => { resolvePermission = resolve; }),
    );
    installWebOrientation(permission);
    renderer = renderProbe(useWebCompassHeading);
    await act(async () => renderer?.root.findByType("button").props.onClick());
    await act(async () => renderer?.unmount());
    renderer = null;
    await act(async () => resolvePermission("granted"));
    expect(webMocks.addEventListener).not.toHaveBeenCalled();
  });
});

describe("native compass", () => {
  let renderer: ReactTestRenderer | null = null;

  afterEach(async () => {
    if (renderer) await act(async () => renderer?.unmount());
    renderer = null;
    vi.clearAllMocks();
  });

  it("reports unavailable sensors and does not subscribe", async () => {
    nativeMocks.isAvailableAsync.mockResolvedValue(false);
    renderer = renderProbe(useNativeCompassHeading);
    await act(async () => undefined);
    await act(async () => renderer?.root.findByType("button").props.onClick());
    expect(stateOf(renderer)).toEqual({ available: "false", heading: "null" });
    expect(nativeMocks.addListener).not.toHaveBeenCalled();
  });

  it("normalizes magnetometer headings and removes the listener", async () => {
    const listener = vi.fn();
    const subscription = { remove: vi.fn() };
    nativeMocks.isAvailableAsync.mockResolvedValue(true);
    nativeMocks.addListener.mockImplementation((callback) => {
      listener.mockImplementation(callback);
      return subscription;
    });
    renderer = renderProbe(useNativeCompassHeading);
    await act(async () => undefined);
    await act(async () => renderer?.root.findByType("button").props.onClick());
    expect(nativeMocks.setUpdateInterval).toHaveBeenCalledWith(200);
    await act(async () => listener({ x: -1, y: 0 }));
    expect(stateOf(renderer)).toEqual({ available: "true", heading: 270 });
    await act(async () => renderer?.unmount());
    renderer = null;
    expect(subscription.remove).toHaveBeenCalledOnce();
  });
});
