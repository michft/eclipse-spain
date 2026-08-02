# Eclipse Observer — MVP Plan

## Goal

Build a responsive Expo TypeScript web app for choosing and using an eclipse observation location. It must be usable in phone browsers and deploy as a static single-page app on Vercel. There are no native iOS or Android deliverables.

The app combines:

- location selection on an OpenStreetMap map;
- eclipse circumstances for the exact point;
- distance to the eclipse centre line;
- nearby transport infrastructure;
- site elevation and a visual terrain-horizon profile;
- cloud forecast when the event enters forecast range;
- a user-editable spoken audio timeline;
- source/comparison links and QR sharing.

Time pressure is not a product constraint. Accuracy, isolation of implementation concerns, and a complete usable MVP matter more.

## Supported eclipses

The MVP ships with three event definitions using the same calculation pipeline:

| Event | Region label | Type |
| --- | --- | --- |
| 12 August 2026 | Spain | Total solar eclipse |
| 2 August 2027 | North Africa and the Middle East | Total solar eclipse |
| 22 July 2028 | Sydney and Australia | Total solar eclipse |

Event-specific values live in data files. UI and calculation code must not contain region-specific branches.

## Settled product decisions

- Expo + TypeScript.
- Web only, responsive on phones.
- Static Vercel deployment target.
- OpenStreetMap map data and attribution.
- No public product version number before the first production deployment.
- Show the terrain horizon; do not implement a 2° pass/fail rule.
- Do not implement a C3 + 60 seconds horizon warning.
- Audio timeline markers are freely addable and removable.
- Audio offsets accept seconds or `minutes:seconds` and are stored as integer seconds.
- Default C1/C2/maximum/C3/C4 markers are conveniences, not undeletable system events.

## User journey

1. Choose an eclipse.
2. Use current location, search coordinates, or tap the map.
3. Review a location summary:
   - local eclipse type;
   - C1, C2, maximum, C3, C4 in UTC and local time;
   - magnitude, obscuration, and totality duration;
   - Sun altitude and azimuth;
   - distance to centre line;
   - ground elevation;
   - terrain profile in the direction of the eclipse;
   - nearby transport infrastructure;
   - cloud forecast or an explicit not-yet-available state.
4. Open source links to compare results.
5. Configure audio markers, test audio, and arm the timeline.
6. Share the app using a canonical link or client-generated QR code.

## MVP screens

The MVP is one scrollable mobile-first workspace with five sections:

1. **Event and location** — event picker, coordinates, location button, OSM map.
2. **Eclipse** — contacts, duration, obscuration, centre-line distance.
3. **Site** — elevation, horizon profile, transport proximity, cloud.
4. **Audio timeline** — countdown state, add/remove/edit markers, test/arm controls.
5. **Sources and sharing** — provenance links, canonical URL, QR.

Desktop layout may place map and analysis side by side. Phone layout remains a single readable column.

## Domain contracts

### Eclipse event

Each event definition contains:

- stable identifier;
- display name and region label;
- search start time;
- NASA path-table and Besselian-element source URLs;
- regional map centre and bounds;
- centre-line polyline derived from the NASA path table.

### Location analysis

A location analysis contains independent states for:

- eclipse circumstances;
- centre-line distance;
- elevation;
- horizon profile;
- transport proximity;
- cloud forecast;
- provenance and warnings.

One failed external adapter must not erase successful results from other adapters.

### Horizon display

The horizon feature is explanatory, not a verdict.

- Sample elevations outward from the observer along the Sun azimuth for the selected eclipse phase.
- Show distance, terrain elevation, and apparent terrain angle.
- Overlay the Sun altitude as a reference line.
- Show observer elevation, sample distance, elevation source, and limitations.
- Do not show clear/blocked based on a fixed 2° threshold.
- Do not create a special C3 + 60 seconds rule.
- State that terrain data does not include reliable trees, buildings, temporary structures, haze, or cloud.

### Cloud display

- Request hourly total/low/middle/high cloud cover for the location.
- Match the nearest forecast hour to eclipse maximum.
- Show provider, forecast issue/retrieval time, valid time, and source link.
- If the eclipse is outside forecast range, show **Forecast not available yet**.
- Never replace missing current forecast with historical climatology without labelling it as a different product.

### Transport display

Query OpenStreetMap-derived infrastructure near the point and keep modes separate:

- railway stations;
- bus stops and public-transport platforms;
- airports/aerodromes;
- ferry terminals;
- parking.

Show nearest straight-line distance, object name, OSM link, query radius, and retrieval state. It is proximity, not journey planning or proof of current service.

### Audio timeline

Every marker contains:

- stable local identifier;
- anchor: C1, C2, maximum, C3, or C4;
- signed integer offset in seconds;
- label;
- spoken flag;
- enabled flag.

Input rules:

- `45` means 45 seconds;
- `1:30` means 1 minute 30 seconds;
- optional leading `-` means after the anchor;
- positive values mean before the anchor;
- normalize display to `m:ss` when at least 60 seconds, otherwise seconds;
- reject malformed values visibly;
- allow adding, editing, enabling, disabling, and removing every marker.

Seed a useful editable set for C1, C2, maximum, C3, and C4. Persist markers in browser storage.

Audio behavior:

- Require a user gesture to test or arm audio.
- Use browser speech synthesis when available and a tone fallback.
- Schedule against a monotonic clock while reconciling with UTC wall time.
- Recompute due markers after tab suspension; never replay an old marker unexpectedly.
- Show warnings when the tab is hidden, speech is unavailable, or device time cannot be trusted.
- The app does not promise background execution after the browser suspends or closes the page.

## Architecture

```text
App.tsx
  presentation components
  feature hooks/controllers
    eclipse core (pure TypeScript)
    centre-line geodesy (pure TypeScript)
    audio timeline (pure TypeScript + web adapter)
    location storage/share state (pure TypeScript + web adapter)
  external adapters
    Open-Meteo elevation
    Open-Meteo cloud forecast
    Overpass/OSM transport
  event data
    2026 Spain
    2027 Middle East
    2028 Sydney/Australia
```

Implementation rules:

- Pure calculation modules do not import React, browser APIs, or network clients.
- Network adapters return typed success/error results and accept injected `fetch` in tests.
- Web-only APIs live behind small adapters.
- Components render explicit loading, success, unavailable, and failure states.
- Avoid `any`.
- Do not add a backend until public API limits or browser restrictions prove one necessary.

## Data and source policy

| Need | MVP source |
| --- | --- |
| Eclipse calculation | Astronomy Engine, checked against NASA GSFC event data |
| Centre line | NASA GSFC eclipse path tables |
| Elevation profile | Open-Meteo elevation API |
| Cloud forecast | Open-Meteo forecast API |
| Map | OpenStreetMap-compatible tiles with visible attribution |
| Transport | OpenStreetMap via Overpass API |

Card 07 is the intentional source and comparison hub for the results in Cards 01–06. Derived results identify their method inline where useful. Store source URLs with event or service configuration instead of scattering them through components.

## Repository shape

```text
App.tsx
src/
  components/
  data/
  domain/
  features/
  services/
  styles/
  test/
public/
docs/
```

## Isolated implementation pieces and JJ bookmarks

Each piece gets focused validation, a meaningful JJ description, and its own bookmark before starting the next piece.

1. `eclipse-app-plan` — settled plan and product semantics.
2. `expo-web-scaffold` — Expo TypeScript web foundation and shared styling.
3. `eclipse-core` — events, local circumstances, centre-line geodesy, unit tests.
4. `location-services` — elevation/horizon, cloud, transport adapters and tests.
5. `mobile-ui` — OSM map, analysis workspace, source links, QR sharing.
6. `audio-timeline` — editable markers, persistence, speech/tone scheduling, tests.
7. `vercel-ready` — production export, Vercel config, documentation, final checks.

Bookmarks are local organization points. Do not push or deploy unless explicitly requested.

## Validation

### Automated

- TypeScript strict check.
- Unit tests for event selection, contact ordering, centre-line distance, horizon math, offset parsing/formatting, audio due-marker logic, and adapter response parsing.
- Expo production web export.
- Repository whitespace check.

### Manual browser checks

- Phone and desktop responsive layouts.
- Map click and geolocation-denied flow.
- All three eclipse selections.
- Loading and failure isolation for every external adapter.
- Cloud unavailable state for future events.
- Add/edit/remove/persist audio markers.
- Spoken and tone test.
- QR scanning and canonical URL sharing.
- Visible OSM attribution and source links.

## Vercel completion

The repository is deployment-ready when:

- `pnpm build:web` creates `dist/` successfully;
- `vercel.json` builds and serves the Expo SPA with history fallback;
- no secret keys are required by the browser bundle;
- README documents local setup, validation, data limitations, and Vercel deployment;
- public product version remains absent until the first successful deployment.

Deployment itself requires explicit user instruction and Vercel authorization.

## Implementation status

The MVP described above is implemented through the `audio-timeline` bookmark.
The final `vercel-ready` bookmark contains deployment configuration, complete
operator documentation, and the final validation record. No deployment, public
version, remote push, or release is part of this implementation run.
