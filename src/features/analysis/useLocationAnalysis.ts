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
        setAnalysis({
          eclipse: initialEclipse,
          elevation: { state: "idle" },
          cloud: { state: "idle" },
          transport: { state: "idle" },
        });
        return;
      }

      const elevationRequest = fetchElevationProfile(
        location,
        maximum.sunAzimuthDegrees,
      ).then((elevation) => {
        if (requestNumber.current !== currentRequest) {
          return;
        }
        setAnalysis((current) => ({
          ...current,
          eclipse:
            elevation.status === "success"
              ? calculateLocalEclipse(
                  event,
                  location,
                  elevation.value.observerElevationMeters,
                )
              : current.eclipse,
          elevation: { state: "result", result: elevation },
        }));
      });
      const cloudRequest = fetchCloudForecast(location, maximum.utc).then((cloud) => {
        if (requestNumber.current !== currentRequest) {
          return;
        }
        setAnalysis((current) => ({
          ...current,
          cloud: { state: "result", result: cloud },
        }));
      });
      const transportRequest = fetchTransportProximity(location).then((transport) => {
        if (requestNumber.current !== currentRequest) {
          return;
        }
        setAnalysis((current) => ({
          ...current,
          transport: { state: "result", result: transport },
        }));
      });

      await elevationRequest;
      await cloudRequest;
      await transportRequest;
    },
    [],
  );

  return { analysis, analyze, reset };
};
