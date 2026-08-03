# Data sources and derived results

Every user-facing data source is linked in the app. This document records how
each displayed result is produced and what should be used for comparison.

## Eclipse circumstances

- Calculation library: [Astronomy Engine](https://github.com/cosinekitty/astronomy)
- Comparison source: [NASA GSFC Five Millennium Canon of Solar Eclipses](https://eclipse.gsfc.nasa.gov/SEcat5/SEcatalog.html)

Astronomy Engine calculates topocentric local contacts, eclipse kind,
obscuration, and solar position. The app derives magnitude and live obscuration
from the apparent Sun/Moon angular radii and disc separation. UTC is shown to the
second, but this does not claim the precision of a surveyed professional
ephemeris. Observer coordinates, elevation model error, Earth rotation models,
and library assumptions all affect results.

Compare the selected point with the NASA event pages and other reputable local
circumstance calculators before field use.

## Eclipse path map and centre-line distance

Complete northern-limit, southern-limit, and centre-line coordinates are
transcribed from NASA WGS84 path tables at their published two-minute spacing:

- [12 August 2026 path table](https://eclipse.gsfc.nasa.gov/SEpath/SEpath2001/SE2026Aug12Tpath.html)
- [2 August 2027 path table](https://eclipse.gsfc.nasa.gov/SEpath/SEpath2001/SE2027Aug02Tpath.html)
- [22 July 2028 path table](https://eclipse.gsfc.nasa.gov/SEpath/SEpath2001/SE2028Jul22Tpath.html)

Each event's Sources page also links the original NASA orthographic visibility
map for direct comparison with the app's flat OpenStreetMap overlays.

The filled 100% totality corridor joins the published northern and southern
limits. Whole-hour centre-line samples use the table's UTC values. The app
measures the shortest spherical distance to this complete stored centre line.

Partial-obscuration bands and hourly UTC curves of local maximum are derived
offline with Astronomy Engine on a 2.5° global latitude/longitude grid by
`scripts/generateEclipseContours.mjs`. They are explanatory contours, not survey
boundaries. The 0.1% contour supplies the lightly filled partial-observable area;
20%, 40%, 60%, and 80% lines show maximum obscured Sun area. Only real calculated
hour curves are shown—for example 2026 contains 17:00Z, 18:00Z, and 19:00Z.

## Elevation and terrain horizon

- API: [Open-Meteo Elevation](https://open-meteo.com/en/docs/elevation-api)
- Underlying terrain: Copernicus DEM, with acknowledgement and citation guidance
  on the Open-Meteo page.

For a selected location, the app requests observer elevation plus seven outward
distance samples for each of 25 azimuths across a 180° view centred on the Sun at
maximum. The 176 coordinates use two requests within Open-Meteo's 100-coordinate
batch limit. It converts terrain height relative to the observer into apparent angle,
includes geometric Earth-curvature drop, and uses the highest angle on each ray
as the terrain silhouette.

Astronomy Engine calculates topocentric Sun and Moon azimuth/altitude throughout
C1–C4. The observer-sky display starts at 75°, adjusts from 30° to 180°, labels
cardinal bearings, and provides time scrubbing, contact jumps, and accelerated
playback. Body discs are enlarged for legibility; their displayed size is not an
angular scale reference.

The skyline does not model atmospheric refraction, local survey detail, trees,
buildings, temporary structures, or haze. It intentionally has no fixed 2°
pass/fail rule and no C3+60 rule. The live Sun-to-sampled-terrain clearance
is explanatory, not a guarantee of visibility.

## Cloud

- API and model documentation: [Open-Meteo Forecast](https://open-meteo.com/en/docs)

The nearest UTC forecast hour to eclipse maximum supplies total, low, middle,
and high cloud cover. The app records retrieval time and valid time. Open-Meteo's
general forecast API currently offers up to 16 days; outside that range the app
shows “Forecast not available yet”. No historical climate substitute is used.

Cloud forecasts can change materially and model cloud layers are not direct proof
of whether the Sun will be visible. Recheck several models close to the event.

## Map and candidate location discovery

- Map/data licence and attribution: [OpenStreetMap](https://www.openstreetmap.org/copyright)
- Query service: [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API)
- Standard map tiles: `tile.openstreetmap.org`

The app visibly attributes OpenStreetMap on the map and links
`OPENSTREETMAP_SOURCE_URL` from the source-comparison card. It queries a 25 km
radius around a rough search point and uses the closest
separately classified rail, bus, airport, ferry, and parking objects as candidate
anchors. It evaluates eclipse kind, terrain clearance, centre-line distance, and
distance from the rough search point, then exposes those score components. There
is no standalone post-selection transport card. Deployed browsers call the same-origin
`/api/transport` Vercel Function; it validates coordinates, creates this fixed
query, and forwards it to the FOSSGIS-operated `overpass-api.de` public instance
with an identifying User-Agent and repository issue URL for operator contact.
The query requests only tags and object centres, using quick output ordering.
An HTTP 5xx response body is discarded before the identical query and coordinates
are retried once against the OpenStreetMap Wiki's listed private.coffee instance.
Each provider attempt has its own 30-second timeout. The fallback's listed policy
has no request limit and asks users to notify its operator before large-scale use.

The gateway admits at most 10 request starts per second and 10 simultaneous
requests per warm Function instance. Excess requests receive HTTP 429 with a
one-second retry notice. These controls cannot coordinate separate serverless
instances, so the provider's own limits remain authoritative. Fair-use guidance
for the primary is below 10,000 queries and 1 GB downloaded per day. This app
must move to an operated or derived dataset before traffic could exceed that
budget. Distance is straight-line. OpenStreetMap can be incomplete or stale;
candidates are not verified observing sites, and the query does not
verify timetables, legal access, capacity, road conditions, or operation on
eclipse day.

Server limits stay fixed. Client adapters always back off before retrying HTTP
429 responses. The one-, two-, and four-second base waits gain positive random
jitter, never fall below `Retry-After`, and each new base is at least twice the
previous wait. Retries stop after three retries and remain inside each adapter's
overall timeout; a final 429 is then shown through the normal section error state.

The MVP uses the public standard tile and Overpass services. Before high-traffic
public promotion, review their current usage policies and move to an appropriate
hosted or derived dataset if expected load requires it.

## Sharing and audio

QR codes are generated locally from the current app URL. Marker settings are
stored in browser local storage and are not included in shared URLs.

Speech uses the browser's speech synthesis; tone cues use Web Audio. Browser and
device power-management policies can suspend both timers and audio. The app skips
stale cues after a suspension instead of replaying them late. It warns when speech
is unavailable, compares the device clock with the same-origin HTTP `Date` header,
and disarms if wall time jumps relative to its monotonic scheduling baseline.
