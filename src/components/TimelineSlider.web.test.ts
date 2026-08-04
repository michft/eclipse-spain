// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TimelineSlider } from "./TimelineSlider.web";

describe("TimelineSlider web", () => {
  afterEach(cleanup);

  it("keeps hidden controls tabbable and mirrors Tab and Shift+Tab focus", () => {
    const focusChanges: boolean[] = [];
    render(
      createElement(TimelineSlider, {
        accessibilityValueText: "18:30:00 UTC",
        hideThumb: true,
        maximum: 2,
        minimum: 0,
        onChange: vi.fn(),
        onFocusChange: (focused) => focusChanges.push(focused),
        transparentTrack: true,
        value: 1,
      }),
    );

    const input = screen.getByRole("slider");
    expect(input.tabIndex).toBe(0);
    expect(input.getAttribute("aria-valuetext")).toBe("18:30:00 UTC");

    for (const direction of ["Tab", "Shift+Tab"]) {
      input.focus();
      expect(document.activeElement, direction).toBe(input);
      expect(focusChanges.at(-1), direction).toBe(true);
      input.blur();
      expect(document.activeElement, direction).not.toBe(input);
      expect(focusChanges.at(-1), direction).toBe(false);
    }
  });
});
