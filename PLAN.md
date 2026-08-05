# Eclipse Observer — MVP Plan

## Goal

Build a responsive Expo TypeScript app for choosing and using an eclipse observation location on web, iOS, and Android. It must be usable in phone browsers, run in Expo Go, and deploy on Vercel. The browser app is a static single-page app; one narrow same-origin Vercel Function proxies fixed transport queries because the public Overpass endpoint failed CORS in the deployed browser. User-visible features and controls must remain functionally equivalent across all three targets.

The app combines:

- observing-location discovery from a rough search area;
- candidate ranking by transport access, centre-line distance, and terrain
  horizon;
- candidate selection on an OpenStreetMap map;
- eclipse circumstances for the exact point;
- distance to the eclipse centre line;
- site elevation and an animated observer-sky terrain-horizon simulation;
- cloud forecast when the event enters forecast range;
- a user-editable spoken audio timeline;
- source/comparison links and QR sharing.

Time pressure is not a product constraint. Accuracy, isolation of implementation concerns, and a complete usable MVP matter more.

## Supported eclipses

The MVP ships with three event definitions using the same calculation pipeline:

| Event | Region label | Type |
| --- | --- | --- |
| 12 August 2026 | Iceland-Spain | Total solar eclipse |
| 2 August 2027 | North Africa and the Middle East | Total solar eclipse |
| 22 July 2028 | Sydney and Australia | Total solar eclipse |

Event-specific values live in data files. UI and calculation code must not contain region-specific branches.

## Settled product decisions

- Expo + TypeScript.
- Web only, responsive on phones.
- Static browser bundle on Vercel with one fixed-query transport Function.
- OpenStreetMap map data and attribution.
- No public product version number before the first accepted production deployment.
- Show the terrain horizon; do not implement a 2° pass/fail rule.
- Do not implement a C3 + 60 seconds horizon warning.
- Audio timeline markers are freely addable and removable.
- Audio offsets accept seconds or `minutes:seconds` and are stored as integer seconds.
- Default C1/C2/maximum/C3/C4 markers are conveniences, not undeletable system events.

## User journey

1. Choose an eclipse.
2. Use current location, coordinates, or the map to choose a rough search area.
3. Find and compare candidate observing locations. Each candidate combines:
   - proximity to rail, bus, airport, ferry, or parking infrastructure;
   - distance to the eclipse centre line;
   - eclipse type and duration;
   - terrain clearance along the eclipse path through the sky.
4. Select a candidate and review its location summary:
   - local eclipse type;
   - C1, C2, maximum, C3, C4 in UTC and local time;
   - magnitude, obscuration, and totality duration;
   - Sun altitude and azimuth;
   - distance to centre line;
   - ground elevation;
   - animated Sun and Moon path over the terrain horizon;
   - cloud forecast or an explicit not-yet-available state.
5. Open source links to compare results.
6. Configure audio markers, test audio, and arm the timeline.
7. Share the app using a canonical link or client-generated QR code.

## MVP screens

The mobile-first SPA keeps event and location state shared while displaying one
navigable page at a time:

1. **Map** — event picker, rough search point, OSM map, candidate search and
   ranked candidate markers, with the selected marker and point summary above
   map layers. The page scrolls vertically on short screens and keeps its map
   key behind an explicit disclosure control.
2. **Horizon** — elevation and animated terrain horizon with the Sun/Moon path;
   secondary guide and technical details use explicit disclosure controls.
3. **Contact times** — eclipse summary, C1/C2/maximum/C3/C4, and the editable
   audio timeline.
4. **Weather** — cloud forecast or an explicit unavailable/error state.
5. **Sources** — provenance and comparison links.
6. **QR** — canonical URL, QR image, and copy control.

Navigation remains visible on phone and desktop layouts. Pages do not duplicate
or reset the selected event, location, analysis, audio markers, or share state.
Event choices are grouped under one visible Event menu rather than permanently
occupying a row of buttons.

## Domain contracts

### Eclipse event

Each event definition contains:

- stable identifier;
- display name and region label;
- search start time;
- NASA path-table and Besselian-element source URLs;
- regional map centre and bounds;
- complete northern limit, southern limit, centre line, two-minute UTC samples,
  and 100% totality polygon derived from the NASA path table;
- precomputed partial-obscuration and hourly maximum-time contours derived with
  Astronomy Engine on a 2.5° grid.

### Location analysis

A location search contains independent candidate states for:

- transport access;
- centre-line distance and eclipse circumstances;
- terrain horizon clearance.

A selected-location analysis contains independent states for:

- eclipse circumstances;
- centre-line distance;
- elevation;
- azimuth terrain-horizon envelope;
- cloud forecast;
- provenance and warnings.

One failed external adapter must not erase successful results from other adapters.

### Horizon simulation

The horizon feature is explanatory, not a verdict.

- Sample elevations across the azimuth range traversed by the eclipse and derive
  the highest terrain angle for each sampled direction.
- Render an observer-facing sky view with the terrain silhouette, true Sun and
  Moon positions, and their path from 30 minutes before C1 until 30 minutes
  after C4.
- Render a magnified, to-scale Sun/Moon contact view: separate before C1;
  externally tangent at C1; increasing partial overlap from C1 to C2; full
  obscuration from C2 to C3; decreasing partial overlap from C3 to C4;
  externally tangent at C4; and separate after C4.
- Place the contact view in a corner of the horizon chart, so both views form one
  panel and follow the same simulation time.
- Use calculated Sun/Moon separation directly without rounding or forcing disc
  tangency at contact times.
- Give the simulation 30 minutes of context before C1 and after C4. Draw the
  before/after path and playback periods in white and C1–C4 in orange, with
  text and line styles so meaning does not depend on colour alone.
- Label the Sun path, Moon path, terrain skyline, astronomical horizon, and
  altitude guides without relying on colour alone.
- Sample terrain through 180°, show N/E/S/W bearings, and default the visible
  field of view to 45°.
- Label exact whole-hour positions along the eclipse path in UTC as `HH:00Z`.
- Allow a 30°–180° field of view using the visible View menu, mouse wheel while
  the chart has focus, or keyboard controls. Unfocused wheel input scrolls the page.
- Extend the horizon chart to both window edges while keeping its controls and
  explanatory text padded.
- Keep one phase-coloured time scrubber below the chart. Use a non-round pin
  whose stem touches the track, and label vertical C1, C2, Maximum, C3, and C4
  lines on the track whenever those contacts exist. Preserve the same contacts
  in the Jump menu. Group field-of-view, stepping, playback speed, and contact
  jumps into compact menus while keeping play/pause immediately visible.
- Update UTC, obscuration, azimuth, altitude, and terrain clearance as simulated
  time changes.
- Show observer elevation, sampling source, and limitations.
- Do not show clear/blocked based on a fixed 2° threshold.
- Do not create a special C3 + 60 seconds rule.
- State that terrain data does not include reliable trees, buildings, temporary structures, haze, or cloud.

### Cloud display

- Request hourly total/low/middle/high cloud cover for the location.
- Match the nearest forecast hour to eclipse maximum.
- Show provider, forecast issue/retrieval time, valid time, and source link.
- If the eclipse is outside forecast range, show **Forecast not available yet**.
- Never replace missing current forecast with historical climatology without labelling it as a different product.

### Candidate location discovery

Query OpenStreetMap-derived infrastructure around the rough search point and
use it to generate candidate observing locations. Keep modes separate:

- railway stations;
- bus stops and public-transport platforms;
- airports/aerodromes;
- ferry terminals;
- parking.

Rank candidates using explicit components for infrastructure proximity,
centre-line distance, and sampled terrain clearance. Show the component values;
do not hide them behind one unexplained score. Infrastructure proximity is not
journey planning or proof of current service. There is no standalone transport
results card after a location has been selected.

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
    same-origin candidate-discovery client
  Vercel Function
    fixed Overpass/OSM candidate query proxy
  event data
    2026 Iceland-Spain
    2027 Middle East
    2028 Sydney/Australia
```

Implementation rules:

- Pure calculation modules do not import React, browser APIs, or network clients.
- Network adapters return typed success/error results and accept injected `fetch` in tests.
- Web-only APIs live behind small adapters.
- Components render explicit loading, success, unavailable, and failure states.
- Avoid `any`.
- Keep the backend limited to the transport proxy proven necessary by production
  Overpass CORS failure. It accepts coordinates, creates the fixed query, and has
  no secrets, accounts, or database.

## Data and source policy

| Need | MVP source |
| --- | --- |
| Eclipse calculation | Astronomy Engine, checked against NASA GSFC event data |
| Totality limits, area, centre line, and two-minute UTC samples | NASA GSFC eclipse path tables |
| Partial-obscuration and hourly UTC maximum-time contours | Astronomy Engine, precomputed on a 2.5° grid |
| Terrain horizon | Open-Meteo elevation API |
| Cloud forecast | Open-Meteo forecast API |
| Map | OpenStreetMap-compatible tiles with visible attribution |
| Candidate transport access | OpenStreetMap via Overpass API through a same-origin Vercel Function |

Card 06 is the intentional source and comparison hub for the results in Cards 01–05. Derived results identify their method inline where useful. Store source URLs with event or service configuration instead of scattering them through components.

## Repository shape

```text
App.tsx
api/
  transport.ts
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
8. `mvp-plan-complete` — the superseded phase-profile implementation, warnings,
   sources, and first production transport proxy.
9. `location-finder` — ranked transport/horizon/centre-line candidate discovery.
10. `live-horizon` — animated observer-sky terrain and eclipse simulation.

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
- `/api/transport` validates coordinates and proxies only the fixed candidate query;
- no secret keys are required by the browser bundle;
- README documents local setup, validation, data limitations, and Vercel deployment;
- public product version remains absent until the first accepted deployment of
  the completed MVP.

Deployment itself requires explicit user instruction and Vercel authorization.

## Implementation status

The deployed app does not yet satisfy this plan. It analyses a user-selected
coordinate, exposes transport as an after-the-fact card, and shows a static
terrain cross-section. Candidate discovery and the live observer-sky horizon are
required before the MVP can be called complete. No public product version is
assigned yet.
