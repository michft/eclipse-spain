# Eclipse Observer

Mobile-first Expo TypeScript web app for finding an eclipse observation point,
comparing transport-anchored candidates, simulating the live terrain horizon,
and running an editable spoken countdown.

The browser app exports as a static single-page app for Vercel, with one Vercel
Function for same-origin candidate queries. The current
[deployment](https://eclipse-spain-ten.vercel.app) is the pre-location-finder,
pre-live-horizon baseline until this branch is deployed and rechecked. It
intentionally has no public product version yet.

## Supported eclipses

- 12 August 2026 — Spain.
- 2 August 2027 — North Africa and the Middle East.
- 22 July 2028 — Sydney and Australia.

All three use one calculation and UI pipeline. Event configuration lives in
`src/data/eclipseEvents.ts`; complete NASA path rows live in
`src/data/eclipsePaths.ts`; derived partial/time contours are generated into
`src/data/eclipseContours.generated.ts`.

## MVP features

- Persistent mobile-first navigation between Map, Horizon, Contact times,
  Weather, Sources, and QR pages while retaining the selected event and point.
- Tappable OpenStreetMap map, coordinate entry, and browser geolocation for a
  rough search area.
- Complete NASA-derived totality limits and filled 100% corridor for every
  event, plus derived partial-obscuration bands and hourly UTC time curves.
- Ranked observing-location candidates anchored to nearby rail, bus, airport,
  ferry, or parking infrastructure. Ranking exposes eclipse, terrain,
  centre-line, and search-proximity components.
- C1, C2, maximum, C3, and C4 in UTC and the device's local time.
- Local eclipse type, magnitude, obscuration, totality duration, Sun altitude,
  Sun azimuth, and distance to a NASA-derived centre line.
- Observer elevation and an animated observer-sky view with a sampled terrain
  silhouette, real Sun/Moon positions, cardinal bearings, adjustable 30°–180°
  field of view (45° default), whole-hour UTC path labels, time scrubbing from
  30 minutes before C1 until 30 minutes after C4, a to-scale contact overlay,
  white before/after and orange eclipse path/playback periods, contact jumps,
  and 60×/300×/600× playback.
- Cloud forecast with explicit out-of-range and failure states.
- Editable, removable, persistent audio markers anchored to eclipse contacts.
- Marker offsets in seconds or signed `m:ss`, with speech or tone flags.
- Live display of time to the next marker or current Sun obscuration.
- Separate speech and tone tests, with hidden-tab, unavailable-speech, and
  untrusted-device-clock warnings.
- Canonical query-string sharing and a client-generated QR code.
- Direct source links for independent comparison.

## Local use

Requirements: a current Node.js installation and `pnpm`.

```sh
pnpm install
pnpm web
```

The app is web-only. There are no iOS or Android build targets.

Candidate finding calls Overpass directly in local development. Vercel
deployments use `/api/transport` to avoid browser CORS failures.
To exercise the same-origin Function locally, use
`EXPO_PUBLIC_TRANSPORT_PROXY=1 pnpm dlx vercel dev`; the runtime signal makes the
localhost browser call `/api/transport` while Vercel serves the Function.

## Validation

Run the complete local validation sequence:

```sh
pnpm validate
```

This performs strict TypeScript checking, unit tests, an Expo production export,
and whitespace validation. The production site is written to `dist/`.

Individual commands:

```sh
pnpm typecheck
pnpm test
pnpm build:web
```

See [manual browser checks](docs/MANUAL-TESTING.md) before a public deployment.

## Vercel

`vercel.json` follows Expo's SPA deployment shape:

- frozen `pnpm` install;
- `pnpm build:web` build command;
- `dist` output directory;
- an `/api/transport` function that supplies candidate transport anchors;
- history fallback to the SPA root.

Connect the repository in Vercel, or deploy from a machine with Vercel access.
No API secrets are required. A public deployment must be checked for provider
errors, rate limits, mobile audio, map tile usage, and the full checklist before
being treated as operational.

## Important field limitations

- Candidate anchors are not verified observing sites. Check access, land
  permission, safety, and local conditions.
- The horizon is a terrain simulation, not a visibility guarantee. Trees,
  buildings, haze, cloud, temporary structures, and fine terrain may be absent.
- There is no fixed 2° visibility verdict and no special C3+60 rule.
- Browser speech and timers are not reliable after a tab is hidden, suspended,
  the device is locked, or the browser is closed. Keep the page open and awake.
- Cloud is only shown inside the weather provider's forecast range. It is not
  silently replaced by climatology.
- Candidate search distances are straight-line, not journey planning or proof
  that a service or access route exists.
- Eclipse safety remains the observer's responsibility. Use certified eclipse
  viewing equipment outside totality.

Detailed methodology and links are in [data sources](docs/DATA-SOURCES.md).
Implementation boundaries are in [architecture](docs/ARCHITECTURE.md).

## Repository layout

```text
App.tsx                         mobile-first multi-page SPA shell
api/transport.ts                fixed candidate-anchor query proxy
src/components/                presentation and charts
src/data/                      supported eclipse definitions
src/domain/                    pure eclipse, geodesy, horizon, audio logic
src/features/                  analysis and audio controllers
src/services/                  browser and public-data adapters
docs/                          architecture, provenance, manual checks
vercel.json                    static SPA deployment configuration
```
