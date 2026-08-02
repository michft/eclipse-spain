import { useCallback, useRef, useState } from "react";

import type { EclipseEventDefinition } from "../../data/eclipseEvents";
import {
  calculateLocalEclipse,
  type ContactId,
  type EclipseCalculationResult,
} from "../../domain/eclipse";
import type { GeoPoint } from "../../domain/geo";
import {
  fetchCloudForecast,
  fetchElevationProfile,
  type CloudForecast,
  type ElevationProfileResult,
} from "../../services/openMeteo";
import type { ServiceResult } from "../../services/result";

export type RemoteData<T> =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "result"; result: ServiceResult<T> };

export interface LocationAnalysisState {
  eclipse: EclipseCalculationResult;
  elevation: RemoteData<ElevationProfileResult>;
  cloud: RemoteData<CloudForecast>;
}

const idleState = (
  event: EclipseEventDefinition,
  location: GeoPoint,
): LocationAnalysisState => ({
  eclipse: calculateLocalEclipse(event, location),
  elevation: { state: "idle" },
  cloud: { state: "idle" },
});

export const useLocationAnalysis = (
  initialEvent: EclipseEventDefinition,
  initialLocation: GeoPoint,
) => {
  const [analysis, setAnalysis] = useState<LocationAnalysisState>(() =>
    idleState(initialEvent, initialLocation),
  );
  const requestNumber = useRef(0);
  const elevationRequestNumber = useRef(0);

  const requestElevation = useCallback(
    async (
      event: EclipseEventDefinition,
      location: GeoPoint,
      horizonAzimuthDegrees: number,
      currentRequest: number,
      currentElevationRequest: number,
    ) => {
      const elevation = await fetchElevationProfile(
        location,
        horizonAzimuthDegrees,
      );
      if (
        requestNumber.current !== currentRequest ||
        elevationRequestNumber.current !== currentElevationRequest
      ) {
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
    },
    [],
  );

  const reset = useCallback(
    (event: EclipseEventDefinition, location: GeoPoint) => {
      requestNumber.current += 1;
      setAnalysis(idleState(event, location));
    },
    [],
  );

  const analyze = useCallback(
    async (
      event: EclipseEventDefinition,
      location: GeoPoint,
      horizonPhaseId: ContactId,
    ) => {
      const currentRequest = requestNumber.current + 1;
      requestNumber.current = currentRequest;
      const currentElevationRequest = elevationRequestNumber.current + 1;
      elevationRequestNumber.current = currentElevationRequest;
      const initialEclipse = calculateLocalEclipse(event, location);
      setAnalysis({
        eclipse: initialEclipse,
        elevation: { state: "loading" },
        cloud: { state: "loading" },
      });

      if (initialEclipse.status !== "success") {
        setAnalysis({
          eclipse: initialEclipse,
          elevation: { state: "idle" },
          cloud: { state: "idle" },
        });
        return;
      }

      const maximum = initialEclipse.value.contacts.maximum;
      if (!maximum) {
        setAnalysis({
          eclipse: initialEclipse,
          elevation: { state: "idle" },
          cloud: { state: "idle" },
        });
        return;
      }
      const horizonContact =
        initialEclipse.value.contacts[horizonPhaseId] ?? maximum;

      const elevationRequest = requestElevation(
        event,
        location,
        horizonContact.sunAzimuthDegrees,
        currentRequest,
        currentElevationRequest,
      );
      const cloudRequest = fetchCloudForecast(location, maximum.utc).then((cloud) => {
        if (requestNumber.current !== currentRequest) {
          return;
        }
        setAnalysis((current) => ({
          ...current,
          cloud: { state: "result", result: cloud },
        }));
      });
      await elevationRequest;
      await cloudRequest;
    },
    [requestElevation],
  );

  const analyzeHorizon = useCallback(
    async (
      event: EclipseEventDefinition,
      location: GeoPoint,
      horizonPhaseId: ContactId,
    ) => {
      const eclipse = calculateLocalEclipse(event, location);
      if (eclipse.status !== "success") {
        return;
      }
      const maximum = eclipse.value.contacts.maximum;
      if (!maximum) {
        return;
      }
      const horizonContact = eclipse.value.contacts[horizonPhaseId] ?? maximum;
      const currentRequest = requestNumber.current;
      const currentElevationRequest = elevationRequestNumber.current + 1;
      elevationRequestNumber.current = currentElevationRequest;
      setAnalysis((current) => ({
        ...current,
        elevation: { state: "loading" },
      }));
      await requestElevation(
        event,
        location,
        horizonContact.sunAzimuthDegrees,
        currentRequest,
        currentElevationRequest,
      );
    },
    [requestElevation],
  );

  return { analysis, analyze, analyzeHorizon, reset };
};
