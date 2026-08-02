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

## Centre-line distance

Regional centre-line coordinates are transcribed and simplified from NASA path
tables:

- [12 August 2026 path table](https://eclipse.gsfc.nasa.gov/SEpath/SEpath2001/SE2026Aug12Tpath.html)
- [2 August 2027 path table](https://eclipse.gsfc.nasa.gov/SEpath/SEpath2001/SE2027Aug02Tpath.html)
- [22 July 2028 path table](https://eclipse.gsfc.nasa.gov/SEpath/SEpath2001/SE2028Jul22Tpath.html)

The app measures the shortest spherical cross-track distance to the simplified
regional polyline. It is not a fresh Besselian centre-line solution and becomes
less precise between widely spaced path-table points or outside the stored region.

## Elevation and terrain horizon

- API: [Open-Meteo Elevation](https://open-meteo.com/en/docs/elevation-api)
- Underlying terrain: Copernicus DEM, with acknowledgement and citation guidance
  on the Open-Meteo page.

The app requests observer elevation plus 15 samples along the Sun azimuth at the
user-selected available contact phase, from 250 m to 50 km. It converts terrain
height relative to the observer into an apparent angle and includes geometric
Earth-curvature drop. The display lists each sample's distance, terrain elevation,
and apparent angle.

The profile does not model atmospheric refraction, local survey detail, trees,
buildings, temporary structures, or haze. It intentionally has no fixed 2°
pass/fail rule and no C3+60 rule. The displayed Sun-to-sampled-terrain clearance
is explanatory, not a guarantee of visibility.

## Cloud

- API and model documentation: [Open-Meteo Forecast](https://open-meteo.com/en/docs)

The nearest UTC forecast hour to eclipse maximum supplies total, low, middle,
and high cloud cover. The app records retrieval time and valid time. Open-Meteo's
general forecast API currently offers up to 16 days; outside that range the app
shows “Forecast not available yet”. No historical climate substitute is used.

Cloud forecasts can change materially and model cloud layers are not direct proof
of whether the Sun will be visible. Recheck several models close to the event.

## Map and transport

- Map/data licence and attribution: [OpenStreetMap](https://www.openstreetmap.org/copyright)
- Query service: [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API)
- Standard map tiles: `tile.openstreetmap.org`

The app queries a 25 km radius and shows the closest separately classified rail,
bus, airport, ferry, and parking object. Deployed browsers call the same-origin
`/api/transport` Vercel Function; it validates coordinates, creates this fixed
query, and forwards it to Overpass to avoid direct-browser CORS failure. Distance
is straight-line. OpenStreetMap can be incomplete or stale; the query does not
verify timetables, legal access, capacity, road conditions, or operation on
eclipse day.

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
