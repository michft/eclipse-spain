# Handoff

Updated: 2026-08-05

## Start here

- Read [AGENTS.md](AGENTS.md) before changing code. Web, iOS, and Android are supported targets and require equivalent product behavior.
- Use [README.md](README.md) for setup and current product behavior.
- Use [PLAN.md](PLAN.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/DATA-SOURCES.md](docs/DATA-SOURCES.md), and [docs/MANUAL-TESTING.md](docs/MANUAL-TESTING.md) instead of recreating the specification here.
- Inspect the current work with `jj status` and `jj diff` before editing. Do not revert unfamiliar changes.

## Current objective

Continue the current UI decluttering and map-scrolling work while bringing the Expo application into genuine web, iOS, and Android parity. The latest user request before this handoff was to hide less-important display details behind toggles and make all map-screen content reachable by scrolling.

## Current workspace

- Working-copy change: `szrkxyps`
- Description: `feat: declutter displays, improve map scrolling, and guard native sharing`
- Parent: `vprmqnuk 5931180a main@origin`
- Bookmark: `declutter-scrollable-displays`

The bookmark currently points to the working-copy commit, but needs
reconciliation before any push:

- The local and Git bookmarks followed working-copy change `szrkxyps`.
- Its tracked remote bookmark last pointed to `f605c338`.
- JJ reported the bookmark one commit ahead and one commit behind its remote.

Do not push, deploy, or rewrite that history without checking the current graph and getting any required user direction.

## Implemented in the current change

See `jj diff` for exact code.

- Map page uses vertical scrolling so controls and results remain reachable.
- Less-important Map and Horizon information is behind visible disclosure controls.
- The web map no longer captures ordinary wheel scrolling for map zoom.
- Native `MapPanel` now uses `react-native-maps` rather than a text-only fallback, including eclipse overlays, path markers, candidates, selected location, tap selection, and region/full-path controls.
- Native geolocation uses Expo location permissions and current-position lookup.
- Sharing has native clipboard and no-`window` handling.
- Native map, geolocation, share, and clock tests were added or extended.
- Expo/native dependencies and iOS/Android scripts were added.

## Validation completed

- `pnpm test`: passed, 23 files and 109 tests.
- `pnpm typecheck`: passed.
- `git diff --check`: passed.

Not run:

- No development server.
- No production build.
- No browser visual/manual test.
- No iOS simulator or device test.
- No Android emulator or device test.
- No Vercel deployment.

The public deployment at <https://eclipse-spain-ten.vercel.app> is therefore not evidence of the current working copy.

## Remaining risks and work

Cross-platform parity is incomplete:

- [src/services/audio.ts](src/services/audio.ts) still depends on browser Web Audio and speech synthesis.
- [src/services/audioStorage.ts](src/services/audioStorage.ts) still depends on browser `localStorage`.
- [src/services/pageVisibility.ts](src/services/pageVisibility.ts) still depends on `document.visibilityState`.
- [src/features/audio/useAudioTimeline.ts](src/features/audio/useAudioTimeline.ts) still uses `window` timers.
- Audio UI and data-source documentation still describe browser-only behavior.
- Native clock verification currently has no trusted browser origin and returns a warning.
- Native map, geolocation, clipboard, QR, and clock behavior have automated coverage but have not been manually exercised on iOS or Android.
- The lockfile contains a large dependency update from the native additions; inspect it before accepting the change.

## Recommended next steps

1. Inspect `jj log`, `jj status`, and `jj diff`; reconcile the local and remote bookmark without discarding either side.
2. With user approval to run the app, manually test the map and disclosure/scroll behavior on a narrow web viewport, iOS, and Android using [docs/MANUAL-TESTING.md](docs/MANUAL-TESTING.md).
3. Replace or abstract the browser-only audio, storage, visibility, and timer services so native behavior matches web.
4. Run focused tests and type checking after each slice.
5. Run builds or deploy only when explicitly requested.

## Useful skills for the next session

- Use `diagnose` for any browser, simulator, map, audio, or timing failure.
- Use `review` against `main@origin` before declaring the branch complete.
- Use `browser:control-in-app-browser` for web visual checks after the user authorizes starting the local app.
