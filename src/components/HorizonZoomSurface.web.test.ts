import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HorizonZoomSurface } from "./HorizonZoomSurface.web";

describe("HorizonZoomSurface web", () => {
  let renderer: ReactTestRenderer | null = null;

  afterEach(async () => {
    if (renderer) {
      await act(async () => renderer?.unmount());
    }
    renderer = null;
  });

  it("changes field of view on wheel only while focused", async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const onZoomBy = vi.fn();
    await act(async () => {
      renderer = create(
        createElement(HorizonZoomSurface, {
          children: createElement("span", null, "chart"),
          onZoomBy,
        }),
      );
    });
    const root = renderer?.root;
    if (!root) throw new Error("Horizon zoom surface did not render.");
    const surface = root.findByType("div");
    const unfocusedWheel = { deltaY: 1, preventDefault: vi.fn() };
    const keys = ["ArrowUp", "ArrowDown", "+", "-"] as const;

    await act(async () => surface.props.onWheel(unfocusedWheel));
    for (const key of keys) {
      await act(async () =>
        surface.props.onKeyDown({ key, preventDefault: vi.fn() }),
      );
    }
    expect(onZoomBy).not.toHaveBeenCalled();
    expect(unfocusedWheel.preventDefault).not.toHaveBeenCalled();

    await act(async () => surface.props.onFocus());
    const focusedWheel = { deltaY: 1, preventDefault: vi.fn() };
    await act(async () => surface.props.onWheel(focusedWheel));
    expect(focusedWheel.preventDefault).toHaveBeenCalledOnce();

    const zeroWheel = { deltaY: 0, preventDefault: vi.fn() };
    await act(async () => surface.props.onWheel(zeroWheel));
    expect(zeroWheel.preventDefault).not.toHaveBeenCalled();

    const focusedKeyEvents = keys.map((key) => ({
      key,
      preventDefault: vi.fn(),
    }));
    for (const event of focusedKeyEvents) {
      await act(async () => surface.props.onKeyDown(event));
      expect(event.preventDefault).toHaveBeenCalledOnce();
    }
    expect(onZoomBy.mock.calls).toEqual([[5], [-5], [5], [-5], [5]]);

    await act(async () => surface.props.onBlur());
    await act(async () => surface.props.onWheel(unfocusedWheel));
    for (const key of keys) {
      await act(async () =>
        surface.props.onKeyDown({ key, preventDefault: vi.fn() }),
      );
    }
    expect(onZoomBy).toHaveBeenCalledTimes(5);
  });
});
