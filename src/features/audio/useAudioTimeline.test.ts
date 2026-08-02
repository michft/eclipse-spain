import { createElement } from "react";
import {
  act,
  create,
  type ReactTestRenderer,
} from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ContactRecord } from "../../domain/audioTimeline";
import type { ClockTrustResult } from "../../services/clock";

const mocks = vi.hoisted(() => ({
  checkDeviceClock: vi.fn<() => Promise<ClockTrustResult>>(),
  primeAudio: vi.fn<() => Promise<void>>(),
}));

vi.mock("../../services/audio", () => ({
  isSpeechSynthesisAvailable: () => false,
  playAudioCue: vi.fn(async () => "tone"),
  primeAudio: mocks.primeAudio,
}));

vi.mock("../../services/audioStorage", () => ({
  loadAudioMarkers: () => [],
  makeAudioMarkerId: () => "custom-marker",
  saveAudioMarkers: vi.fn(),
}));

vi.mock("../../services/clock", () => ({
  checkDeviceClock: mocks.checkDeviceClock,
}));

vi.mock("../../services/pageVisibility", () => ({
  isPageHidden: () => false,
  subscribeToPageVisibility: () => () => undefined,
}));

import { useAudioTimeline } from "./useAudioTimeline";

const CONTACTS: ContactRecord = {
  c1: null,
  c2: null,
  maximum: null,
  c3: null,
  c4: null,
};

type Timeline = ReturnType<typeof useAudioTimeline>;

describe("useAudioTimeline", () => {
  let renderer: ReactTestRenderer | null = null;
  let timeline: Timeline | null = null;

  const current = (): Timeline => {
    if (timeline === null) {
      throw new Error("Timeline hook has not rendered.");
    }
    return timeline;
  };

  const Harness = () => {
    timeline = useAudioTimeline(CONTACTS);
    return null;
  };

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-02T14:00:00.000Z"));
    vi.stubGlobal("window", {
      setInterval: (...args: Parameters<typeof setInterval>) =>
        setInterval(...args),
      clearInterval: (timer: ReturnType<typeof setInterval>) =>
        clearInterval(timer),
    });
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    mocks.checkDeviceClock.mockResolvedValue({
      status: "trusted",
      differenceMilliseconds: 0,
    });
    mocks.primeAudio.mockResolvedValue(undefined);

    await act(async () => {
      renderer = create(createElement(Harness));
      await Promise.resolve();
    });
  });

  afterEach(async () => {
    if (renderer !== null) {
      await act(async () => renderer?.unmount());
    }
    renderer = null;
    timeline = null;
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("rebases and disarms after a device-time jump", async () => {
    await act(async () => current().arm());
    expect(current().armed).toBe(true);

    vi.setSystemTime(new Date("2026-08-02T14:00:10.000Z"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(current().now).toBe(Date.now());
    expect(current().clockWarning).toBe(
      "Device time changed while the timeline was running. Check the clock and arm again.",
    );
    expect(current().armed).toBe(false);
    expect(current().message).toBe(
      "Timeline disarmed after a device-time change.",
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(current().now).toBe(Date.now());
  });

  it("stays disarmed when a pending arm clock check resolves", async () => {
    let resolveClockCheck: (result: ClockTrustResult) => void = () => undefined;
    const pendingClockCheck = new Promise<ClockTrustResult>((resolve) => {
      resolveClockCheck = resolve;
    });
    mocks.checkDeviceClock.mockImplementationOnce(() => pendingClockCheck);

    let armResult: Promise<void> = Promise.resolve();
    await act(async () => {
      armResult = current().arm();
      await Promise.resolve();
    });
    await act(async () => current().disarm());
    resolveClockCheck({ status: "trusted", differenceMilliseconds: 0 });
    await act(async () => armResult);

    expect(current().armed).toBe(false);
    expect(current().message).toBe("Timeline disarmed.");
  });
});
