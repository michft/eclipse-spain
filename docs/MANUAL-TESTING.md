# Manual browser testing

Run these checks against a production export or Vercel preview on both a phone
browser and a desktop browser.

The existing `eclipse-spain-ten.vercel.app` deployment is the single-map plus
long-horizon-panel baseline. Deploy the `complete-eclipse-map-horizon` bookmark,
then run every check below against that exact deployment.

## Page navigation

- Confirm Map, Horizon, Contact times, Weather, Sources, and QR are separate
  selectable pages and only the selected page content is visible.
- On a narrow phone, horizontally scroll the page navigation and reach every page.
- Change event and location, visit every page, then return to Map; confirm the
  event, point, analysis results, audio markers, and share URL remain aligned.
- Confirm Contact times contains the editable audio timeline, Sources contains
  comparison links, and QR contains only sharing controls.

## Event and location

- Select each of the 2026, 2027, and 2028 events.
- Confirm the map moves to the event region and shows the gold centre line.
- For all three events, zoom out and follow the complete gold centre line and
  white north/south limits from start to end; confirm the 100% corridor is filled.
- Switch between **Full eclipse path** and **Selected region** and confirm both
  extents remain available on narrow and desktop layouts.
- Confirm blue partial-obscuration areas/bands and green hourly maximum-time
  curves appear. Check labels use `HH:00Z` and 2026 includes `19:00Z`.
- Tap the map to choose a rough search point and confirm coordinates, QR, and
  current-point results update.
- Run **Find candidates**. Confirm ranked transport anchors appear in the list
  and on the map, with separate score components and an access disclaimer.
- Select a candidate and confirm eclipse, horizon, cloud, audio, and share state
  switch to its coordinates. Confirm there is no standalone transport card.
- Enter valid negative/positive coordinates and reject out-of-range values.
- Allow browser geolocation once; deny it once and confirm a readable error.
- Open a copied share URL in a private tab and confirm event and point restore.

## Eclipse and site

- At a centre-line default, confirm total C1–C4 contacts and totality duration.
- Select a partial-eclipse point and confirm C2/C3 are omitted without breaking
  the audio editor.
- Compare contact times and centre line with the linked NASA source.
- Scrub the observer-sky timeline from C1 to C4; jump to every available contact;
  play at 60×, 300×, and 600×; confirm Sun, Moon, UTC, obscuration, azimuth,
  altitude, and terrain clearance update over the terrain silhouette.
- Confirm the time scrubber, playback controls, speed controls, and contact jumps
  are fully visible below the chart on phone and desktop layouts.
- Confirm every altitude guide has a degree label and the visible key names the
  Sun path, Moon path, terrain skyline, and astronomical horizon.
- Confirm the horizon opens at 75°, shows N/E/S/W bearings, and adjusts from 30°
  through 180° using the slider. On web, scroll over the chart and use keyboard
  arrows; confirm the field of view changes without changing simulation time.
- Confirm no 2° pass/fail or C3+60 warning appears.
- Block one provider in browser tools and confirm other result cards survive.
- For a far-future event, confirm cloud says the forecast is not available yet.
- Confirm candidate finding succeeds without a browser CORS error and each OSM
  anchor link opens.

## Audio

- Use the separate Test speech and Test tone controls.
- Add a marker; edit label, anchor, `45`, `1:30`, and `-0:30` offsets.
- Reject malformed offsets such as `1:60`.
- Toggle enabled and spoken flags; remove every marker, including defaults.
- Reload and confirm marker persistence.
- Restore defaults.
- Arm and disarm from a user gesture.
- Hide the tab and confirm the suspension warning appears on return.
- Confirm an unavailable speech API shows the tone-fallback warning.
- Confirm a failed network-time check shows a clock warning; changing device time
  while armed must disarm the timeline and show a warning.
- Confirm an overdue marker is not unexpectedly replayed after a long suspension.
- Switch between time-to-next-marker and current-obscuration displays.

## Mobile and deployment

- Use narrow portrait and landscape layouts; check no control requires hover.
- Verify touch targets, keyboard entry, headings, links, and QR readability.
- Confirm OpenStreetMap attribution remains visible.
- Scan the QR code using another phone.
- Confirm Vercel serves root/query URLs and generated JS/CSS assets.
- Re-run `pnpm validate` on the exact deployment change.
