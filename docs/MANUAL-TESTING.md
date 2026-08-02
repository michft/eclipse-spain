# Manual browser testing

Run these checks against a production export or Vercel preview on both a phone
browser and a desktop browser.

The existing `eclipse-spain-ten.vercel.app` deployment is a pre-completion
baseline and has a confirmed direct-Overpass CORS failure. Do not accept it as
the result of `mvp-plan-complete`. Redeploy that bookmark, then run every check
below against the new deployment.

## Event and location

- Select each of the 2026, 2027, and 2028 events.
- Confirm the map moves to the event region and shows the gold centre line.
- Tap a point on the map and confirm coordinates, QR, and all results update.
- Enter valid negative/positive coordinates and reject out-of-range values.
- Allow browser geolocation once; deny it once and confirm a readable error.
- Open a copied share URL in a private tab and confirm event and point restore.

## Eclipse and site

- At a centre-line default, confirm total C1–C4 contacts and totality duration.
- Select a partial-eclipse point and confirm C2/C3 are omitted without breaking
  the audio editor.
- Compare contact times and centre line with the linked NASA source.
- Select every available C1/C2/maximum/C3/C4 horizon phase and confirm the graph,
  Sun reference, azimuth text, and distance/elevation/apparent-angle rows update.
- Confirm no 2° pass/fail or C3+60 warning appears.
- Block one provider in browser tools and confirm other result cards survive.
- For a far-future event, confirm cloud says the forecast is not available yet.
- Confirm transport succeeds without a browser CORS error, always shows the 25 km
  query radius and retrieval time, then open every object and source link.

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
