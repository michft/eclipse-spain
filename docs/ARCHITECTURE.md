# Architecture

## Shape

```text
App and components
  location finder      selected-location analysis      audio controller
    eclipse domain       Open-Meteo adapters              audio timeline domain
    transport adapter                                      audio/storage adapters
  event definitions
Vercel transport function
  fixed Overpass query
```

The UI runs on web, iOS, and Android. The web build is a static client. A single
same-origin Vercel Function validates rough-search coordinates, creates the
fixed transport-anchor query, and forwards it to Overpass for deployed web
clients. There is no account system or database.

## Boundaries

### Event data

`src/data/eclipseEvents.ts` is the event catalogue. Adding another eclipse means
adding dates, map bounds, sources, complete NASA path rows, and generated
partial/time contours.
Presentation and calculation code must not branch on a country or event ID.

### Pure domain

`src/domain/` contains deterministic TypeScript:

- NASA Besselian local eclipse circumstances and live topocentric Sun/Moon
  positions;
  sky positions;
- geodesic distance and destination calculations;
- terrain-angle and azimuth-skyline calculation from elevation samples;
- audio offset parsing, contact resolution, ordering, and due-marker selection.

These modules do not import React, network clients, storage, speech, or browser
page state. Their core behavior is unit tested.

### External services

`src/services/` contains narrow adapters for:

- Open-Meteo elevation and cloud JSON;
- same-origin transport results and Overpass/OpenStreetMap transport objects;
- platform geolocation, clipboard, storage, QR, app visibility, speech, and tone.

Network adapters accept an injected fetch function. They parse `unknown` input
and return typed `success`, `unavailable`, or `error` results.

### Controllers

`useLocationFinder` queries transport anchors around the rough search point and
evaluates their eclipse, centre-line, and terrain components. `useLocationAnalysis`
runs eclipse calculation immediately for the selected point, followed by
elevation/skyline and cloud. Later requests invalidate older ones. A successful
observer elevation triggers one refined eclipse calculation.

`useAudioTimeline` persists marker edits, resolves enabled markers to UTC, checks
due markers against wall time, and tracks cues already fired. Cues more than three
seconds late are skipped after browser suspension rather than replayed unexpectedly.

### Presentation

`App.tsx` owns selected event, rough search point, candidates, and selected
location. Its page state selects exactly one of Map, Horizon, Contact times,
Weather, Sources, or QR without resetting that shared state. Contact times owns
the editable audio timeline. `HorizonSimulator` animates calculated Sun/Moon
positions against the sampled terrain skyline and owns its visible line key,
altitude/cardinal labels, whole-hour UTC path labels, 45° default field-of-view
menu, single phase-backed pin scrubber with contact marker lines, and grouped
playback/contact controls.
`EclipseContactOverlay` magnifies true angular disc geometry in the chart corner
and follows the simulator's time state;
`eclipseOverlay.ts` classifies contact phases and derives calculated disc
separation without display snapping. The horizon path and playback rail span
C1−30 minutes through C4+30 minutes, using labelled white/orange/white periods.
`eclipsePaths.ts` stores NASA path-table rows;
`eclipseContours.generated.ts` stores reproducible Astronomy Engine
partial-obscuration and hourly UTC curves. Components render explicit loading,
unavailable, failure, and success states. The Leaflet `.web.tsx` map and the
`react-native-maps` iOS/Android map share one product contract: eclipse
overlays, path/region extents, UTC markers, candidates, selected point, and
tap-to-select behavior. Platform-specific files may use different primitives,
but must not remove user-visible capability.

## Platform parity

Web, iOS, and Android are supported targets. Every user-visible change must be
checked against all three. Shared React Native components are preferred;
platform-specific implementations require paired tests and equivalent controls.
An unverified target is reported as unverified rather than assumed equivalent.

## Sharing

The canonical state is encoded as `event`, `lat`, and `lon` query parameters.
No saved audio markers or personal data are included in the URL. QR generation
happens locally in the browser.

## Deployment

Expo Metro exports a single-page application into `dist/`. Vercel serves those
static files, deploys `api/transport.ts`, and rewrites unknown non-function paths
to the SPA root. Deployment and provider monitoring are operational actions
outside the source implementation.
