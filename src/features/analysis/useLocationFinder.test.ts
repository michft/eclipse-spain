import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findCandidates: vi.fn(),
}));

vi.mock("../../services/locationFinder", () => ({
  findObservingLocationCandidates: mocks.findCandidates,
}));

import { getEclipseEvent } from "../../data/eclipseEvents";
import { useLocationFinder } from "./useLocationFinder";

type FinderHook = ReturnType<typeof useLocationFinder>;

describe("useLocationFinder", () => {
  let renderer: ReactTestRenderer | null = null;
  let hook: FinderHook | null = null;

  const current = (): FinderHook => {
    if (!hook) {
      throw new Error("Location finder hook has not rendered.");
    }
    return hook;
  };

  const Harness = () => {
    hook = useLocationFinder();
    return null;
  };

  afterEach(async () => {
    if (renderer) {
      await act(async () => renderer?.unmount());
    }
    renderer = null;
    hook = null;
    vi.clearAllMocks();
  });

  it("exits loading after a rejection and allows retry", async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    mocks.findCandidates
      .mockRejectedValueOnce(new Error("Candidate provider failed."))
      .mockResolvedValueOnce({ status: "unavailable", reason: "No candidates." });
    await act(async () => {
      renderer = create(createElement(Harness));
    });

    await act(async () => {
      await current().find(getEclipseEvent("spain-2026"), {
        latitude: 43.4,
        longitude: -6.2,
      });
    });
    expect(current().finder).toEqual({
      state: "result",
      result: { status: "error", reason: "Candidate provider failed." },
    });

    await act(async () => {
      await current().find(getEclipseEvent("spain-2026"), {
        latitude: 43.4,
        longitude: -6.2,
      });
    });
    expect(current().finder).toEqual({
      state: "result",
      result: { status: "unavailable", reason: "No candidates." },
    });
  });
});
