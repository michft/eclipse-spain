import { createRequire } from "node:module";
import { createElement } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  props: null as Record<string, unknown> | null,
}));

vi.mock("@react-native-community/slider", () => ({
  default: (props: Record<string, unknown>) => {
    mocks.props = props;
    return null;
  },
}));

vi.mock("react-native", () => ({
  StyleSheet: { create: (styles: Record<string, unknown>) => styles },
}));

import { TimelineSlider } from "./TimelineSlider";

const nodeRequire = createRequire(import.meta.url);
const reactNativeModulePath = nodeRequire.resolve("react-native");
const originalReactNativeModule = nodeRequire.cache[reactNativeModulePath];

describe("TimelineSlider native", () => {
  let unmount: (() => Promise<void>) | null = null;

  beforeAll(() => {
    nodeRequire.cache[reactNativeModulePath] = {
      exports: {
        StyleSheet: {
          create: (styles: Record<string, unknown>) => styles,
          flatten: (style: Record<string, unknown> | null) => style ?? {},
        },
      },
    } as NodeJS.Module;
  });

  afterAll(() => {
    if (originalReactNativeModule) {
      nodeRequire.cache[reactNativeModulePath] = originalReactNativeModule;
    } else {
      delete nodeRequire.cache[reactNativeModulePath];
    }
  });

  afterEach(async () => {
    if (unmount) await unmount();
    unmount = null;
    mocks.props = null;
  });

  it("exposes the UTC value to native accessibility", async () => {
    const { render } = await import("@testing-library/react-native/pure");
    const rendered = await render(
      createElement(TimelineSlider, {
        accessibilityValueText: "18:30:00 UTC",
        maximum: 2,
        minimum: 0,
        onChange: vi.fn(),
        value: 1,
      }),
    );
    unmount = rendered.unmount;

    expect(mocks.props?.accessibilityValue).toEqual({ text: "18:30:00 UTC" });
  });
});
