import { useCallback, useRef, useState } from "react";

import type { EclipseEventDefinition } from "../../data/eclipseEvents";
import {
  calculateLocalEclipse,
  type EclipseCalculationResult,
} from "../../domain/eclipse";
import type { GeoPoint } from "../../domain/geo";
import {
  fetchCloudForecast,
  fetchElevationProfile,
  type CloudForecast,
  type ElevationProfileResult,
} from "../../services/openMeteo";
import {
  fetchTransportProximity,
  type TransportProximity,
} from "../../services/overpass";
import type { ServiceResult } from "../../services/result";

export type RemoteData<T> =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "result"; result: ServiceResult<T> };

export interface LocationAnalysisState {
  eclipse: EclipseCalculationResult;
  elevation: RemoteData<ElevationProfileResult>;
  cloud: RemoteData<CloudForecast>;
  transport: RemoteData<TransportProximity>;
}

const idleState = (
  event: EclipseEventDefinition,
  location: GeoPoint,
): LocationAnalysisState => ({
  eclipse: calculateLocalEclipse(event, location),
  elevation: { state: "idle" },
  cloud: { state: "idle" },
  transport: { state: "idle" },
});

export const useLocationAnalysis = (
  initialEvent: EclipseEventDefinition,
  initialLocation: GeoPoint,
) => {
  const [analysis, setAnalysis] = useState<LocationAnalysisState>(() =>
    idleState(initialEvent, initialLocation),
  );
  const requestNumber = useRef(0);

  const reset = useCallback(
    (event: EclipseEventDefinition, location: GeoPoint) => {
      requestNumber.current += 1;
      setAnalysis(idleState(event, location));
    },
    [],
  );

  const analyze = useCallback(
    async (event: EclipseEventDefinition, location: GeoPoint) => {
      const currentRequest = requestNumber.current + 1;
      requestNumber.current = currentRequest;
      const initialEclipse = calculateLocalEclipse(event, location);
      setAnalysis({
        eclipse: initialEclipse,
        elevation: { state: "loading" },
        cloud: { state: "loading" },
        transport: { state: "loading" },
      });

      if (initialEclipse.status !== "success") {
        setAnalysis({
          eclipse: initialEclipse,
          elevation: { state: "idle" },
          cloud: { state: "idle" },
          transport: { state: "idle" },
        });
        return;
      }

      const maximum = initialEclipse.value.contacts.maximum;
      if (!maximum) {
        return;
      }
      const [elevation, cloud, transport] = await Promise.all([
        fetchElevationProfile(location, maximum.sunAzimuthDegrees),
        fetchCloudForecast(location, maximum.utc),
        fetchTransportProximity(location),
      ]);
      if (requestNumber.current !== currentRequest) {
        return;
      }

      const eclipse =
        elevation.status === "success"
          ? calculateLocalEclipse(
              event,
              location,
              elevation.value.observerElevationMeters,
            )
          : initialEclipse;
      setAnalysis({
        eclipse,
        elevation: { state: "result", result: elevation },
        cloud: { state: "result", result: cloud },
        transport: { state: "result", result: transport },
      });
    },
    [],
  );

  return { analysis, analyze, reset };
};
