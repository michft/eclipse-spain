import { useCallback, useRef, useState } from "react";

import type { EclipseEventDefinition } from "../../data/eclipseEvents";
import type { GeoPoint } from "../../domain/geo";
import {
  findObservingLocationCandidates,
  type LocationCandidateSearch,
} from "../../services/locationFinder";
import type { ServiceResult } from "../../services/result";

export type LocationFinderState =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "result"; result: ServiceResult<LocationCandidateSearch> };

export const useLocationFinder = () => {
  const [finder, setFinder] = useState<LocationFinderState>({ state: "idle" });
  const requestNumber = useRef(0);

  const reset = useCallback(() => {
    requestNumber.current += 1;
    setFinder({ state: "idle" });
  }, []);

  const find = useCallback(
    async (event: EclipseEventDefinition, searchCenter: GeoPoint) => {
      const currentRequest = requestNumber.current + 1;
      requestNumber.current = currentRequest;
      setFinder({ state: "loading" });
      let result: ServiceResult<LocationCandidateSearch>;
      try {
        result = await findObservingLocationCandidates(event, searchCenter);
      } catch (error: unknown) {
        result = {
          status: "error",
          reason:
            error instanceof Error && error.message
              ? error.message
              : "Location search failed.",
        };
      }
      if (requestNumber.current === currentRequest) {
        setFinder({ state: "result", result });
      }
    },
    [],
  );

  return { finder, find, reset };
};
