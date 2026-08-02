# Manual browser testing

Run these checks against a production export or Vercel preview on both a phone
browser and a desktop browser.

The existing `eclipse-spain-ten.vercel.app` deployment is the baseline without
the location finder and live observer-sky horizon. Deploy the `live-horizon`
branch, then run every check below against that exact deployment.

## Event and location

- Select each of the 2026, 2027, and 2028 events.
- Confirm the map moves to the event region and shows the gold centre line.
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
