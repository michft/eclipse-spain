# Eclipse Observer

Mobile-first Expo TypeScript web app for choosing an eclipse observation point,
checking the terrain horizon and nearby infrastructure, and running an editable
spoken countdown.

The browser app exports as a static single-page app for Vercel, with one Vercel
Function for same-origin transport queries. The current
[partial deployment](https://eclipse-spain-ten.vercel.app) predates the
`mvp-plan-complete` work and must be redeployed and rechecked. It intentionally
has no public product version yet.

## Supported eclipses

- 12 August 2026 — Spain.
- 2 August 2027 — North Africa and the Middle East.
- 22 July 2028 — Sydney and Australia.

All three use one calculation and UI pipeline. Event dates, regional map bounds,
NASA sources, and centre-line points live in `src/data/eclipseEvents.ts`.

## MVP features

- Tappable OpenStreetMap map, coordinate entry, and browser geolocation.
- C1, C2, maximum, C3, and C4 in UTC and the device's local time.
- Local eclipse type, magnitude, obscuration, totality duration, Sun altitude,
  Sun azimuth, and distance to a NASA-derived centre line.
- Observer elevation and a selectable C1/C2/maximum/C3/C4 terrain-horizon
  profile, with distance, elevation, and apparent-angle samples out to 50 km.
- Cloud forecast with explicit out-of-range and failure states.
- Nearest rail, bus, airport, ferry, and parking objects from OpenStreetMap,
  queried through a same-origin Vercel Function in deployments.
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

`pnpm web` calls Overpass directly for local development. Vercel deployments use
`/api/transport` to avoid the CORS failure observed on the partial deployment.
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
- an `/api/transport` function that creates the fixed Overpass query;
- history fallback to the SPA root.

Connect the repository in Vercel, or deploy from a machine with Vercel access.
No API secrets are required. A public deployment must be checked for provider
errors, rate limits, mobile audio, map tile usage, and the full checklist before
being treated as operational.

## Important field limitations

- The horizon is a terrain display, not a visibility guarantee. Trees,
  buildings, haze, cloud, temporary structures, and fine terrain may be absent.
- There is no fixed 2° visibility verdict and no special C3+60 rule.
- Browser speech and timers are not reliable after a tab is hidden, suspended,
  the device is locked, or the browser is closed. Keep the page open and awake.
- Cloud is only shown inside the weather provider's forecast range. It is not
  silently replaced by climatology.
- Transport distances are straight-line proximity, not journey planning or
  proof that a service or access route exists.
- Eclipse safety remains the observer's responsibility. Use certified eclipse
  viewing equipment outside totality.

Detailed methodology and links are in [data sources](docs/DATA-SOURCES.md).
Implementation boundaries are in [architecture](docs/ARCHITECTURE.md).

## Repository layout

```text
App.tsx                         mobile-first workspace
api/transport.ts                fixed-query Vercel transport proxy
src/components/                presentation and charts
src/data/                      supported eclipse definitions
src/domain/                    pure eclipse, geodesy, horizon, audio logic
src/features/                  analysis and audio controllers
src/services/                  browser and public-data adapters
docs/                          architecture, provenance, manual checks
vercel.json                    static SPA deployment configuration
```
