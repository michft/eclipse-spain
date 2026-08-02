# Architecture

## Shape

```text
App and components
  analysis controller             audio controller
    eclipse domain                  audio timeline domain
    Open-Meteo adapters             audio/storage/visibility adapters
    transport adapter
  event definitions
Vercel transport function
  fixed Overpass query
```

The UI is a static browser client. A single same-origin Vercel Function validates
coordinates, creates the fixed transport query, and forwards it to Overpass. It
was added after the partial production deployment proved direct browser requests
could fail CORS. There is no account system, database, or secret API key.

## Boundaries

### Event data

`src/data/eclipseEvents.ts` is the only event catalogue. Adding another eclipse
means adding dates, map bounds, sources, and a regional centre-line polyline.
Presentation and calculation code must not branch on a country or event ID.

### Pure domain

`src/domain/` contains deterministic TypeScript:

- local eclipse circumstances and live disc obscuration;
- geodesic distance and destination calculations;
- terrain-angle calculation from elevation samples;
- audio offset parsing, contact resolution, ordering, and due-marker selection.

These modules do not import React, network clients, storage, speech, or browser
page state. Their core behavior is unit tested.

### External services

`src/services/` contains narrow adapters for:

- Open-Meteo elevation and cloud JSON;
- same-origin transport results and Overpass/OpenStreetMap transport objects;
- browser geolocation, clipboard, storage, QR, page visibility, speech, and tone.

Network adapters accept an injected fetch function. They parse `unknown` input
and return typed `success`, `unavailable`, or `error` results.

### Controllers

`useLocationAnalysis` runs eclipse calculation immediately, then elevation,
cloud, and transport concurrently. A later request invalidates an older one.
Each provider keeps its own UI state, so one failure does not discard other
results. Changing only the selected horizon phase reloads only elevation; it does
not repeat cloud or transport requests. A successful observer elevation triggers
one refined eclipse calculation.

`useAudioTimeline` persists marker edits, resolves enabled markers to UTC, checks
due markers against wall time, and tracks cues already fired. Cues more than three
seconds late are skipped after browser suspension rather than replayed unexpectedly.

### Presentation

`App.tsx` owns selected event and location. Components render explicit loading,
unavailable, failure, and success states. The Leaflet map has a `.web.tsx`
implementation and a non-web fallback even though only web deployment is supported.

## Sharing

The canonical state is encoded as `event`, `lat`, and `lon` query parameters.
No saved audio markers or personal data are included in the URL. QR generation
happens locally in the browser.

## Deployment

Expo Metro exports a single-page application into `dist/`. Vercel serves those
static files, deploys `api/transport.ts`, and rewrites unknown non-function paths
to the SPA root. Deployment and provider monitoring are operational actions
outside the source implementation.
