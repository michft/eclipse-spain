import { writeFile } from "node:fs/promises";

import { Observer, SearchLocalSolarEclipse } from "astronomy-engine";

const GRID_STEP_DEGREES = 2.5;
const LATITUDES = Array.from(
  { length: 71 },
  (_, index) => -87.5 + index * GRID_STEP_DEGREES,
);
const LONGITUDES = Array.from(
  { length: 145 },
  (_, index) => -180 + index * GRID_STEP_DEGREES,
);
const EVENTS = [
  { id: "spain-2026", date: "2026-08-12" },
  { id: "middle-east-2027", date: "2027-08-02" },
  { id: "australia-2028", date: "2028-07-22" },
];
const OBSCURATION_LEVELS = [0.001, 0.2, 0.4, 0.6, 0.8];

const pointKey = ([latitude, longitude]) =>
  `${latitude.toFixed(5)}:${longitude.toFixed(5)}`;

const interpolate = (first, second, threshold) => {
  const span = second.value - first.value;
  const fraction = span === 0 ? 0.5 : (threshold - first.value) / span;
  return [
    Number(
      (first.latitude + (second.latitude - first.latitude) * fraction).toFixed(5),
    ),
    Number(
      (first.longitude + (second.longitude - first.longitude) * fraction).toFixed(
        5,
      ),
    ),
  ];
};

const connectSegments = (segments) => {
  const paths = [];
  for (const segment of segments) {
    const firstKey = pointKey(segment[0]);
    const secondKey = pointKey(segment[1]);
    let attached = false;
    for (const path of paths) {
      const startKey = pointKey(path[0]);
      const endKey = pointKey(path[path.length - 1]);
      if (endKey === firstKey) {
        path.push(segment[1]);
        attached = true;
        break;
      }
      if (endKey === secondKey) {
        path.push(segment[0]);
        attached = true;
        break;
      }
      if (startKey === secondKey) {
        path.unshift(segment[0]);
        attached = true;
        break;
      }
      if (startKey === firstKey) {
        path.unshift(segment[1]);
        attached = true;
        break;
      }
    }
    if (!attached) {
      paths.push([...segment]);
    }
  }

  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let firstIndex = 0; firstIndex < paths.length; firstIndex += 1) {
      for (
        let secondIndex = firstIndex + 1;
        secondIndex < paths.length;
        secondIndex += 1
      ) {
        const first = paths[firstIndex];
        const second = paths[secondIndex];
        const firstStart = pointKey(first[0]);
        const firstEnd = pointKey(first[first.length - 1]);
        const secondStart = pointKey(second[0]);
        const secondEnd = pointKey(second[second.length - 1]);
        let joined = null;
        if (firstEnd === secondStart) joined = [...first, ...second.slice(1)];
        if (firstEnd === secondEnd) joined = [...first, ...second.toReversed().slice(1)];
        if (firstStart === secondEnd) joined = [...second, ...first.slice(1)];
        if (firstStart === secondStart)
          joined = [...second.toReversed(), ...first.slice(1)];
        if (joined) {
          paths[firstIndex] = joined;
          paths.splice(secondIndex, 1);
          merged = true;
          break outer;
        }
      }
    }
  }

  return paths.filter((path) => path.length >= 3).sort((a, b) => b.length - a.length);
};

const contour = (grid, threshold) => {
  const segments = [];
  for (let latitudeIndex = 0; latitudeIndex < LATITUDES.length - 1; latitudeIndex += 1) {
    for (
      let longitudeIndex = 0;
      longitudeIndex < LONGITUDES.length - 1;
      longitudeIndex += 1
    ) {
      const south = LATITUDES[latitudeIndex];
      const north = LATITUDES[latitudeIndex + 1];
      const west = LONGITUDES[longitudeIndex];
      const east = LONGITUDES[longitudeIndex + 1];
      const corners = [
        { latitude: south, longitude: west, value: grid[latitudeIndex][longitudeIndex] },
        { latitude: south, longitude: east, value: grid[latitudeIndex][longitudeIndex + 1] },
        { latitude: north, longitude: east, value: grid[latitudeIndex + 1][longitudeIndex + 1] },
        { latitude: north, longitude: west, value: grid[latitudeIndex + 1][longitudeIndex] },
      ];
      if (corners.some((corner) => !Number.isFinite(corner.value))) continue;
      const crossings = [];
      for (let edgeIndex = 0; edgeIndex < 4; edgeIndex += 1) {
        const first = corners[edgeIndex];
        const second = corners[(edgeIndex + 1) % 4];
        if ((first.value < threshold) !== (second.value < threshold)) {
          crossings.push(interpolate(first, second, threshold));
        }
      }
      if (crossings.length === 2) segments.push(crossings);
      if (crossings.length === 4) {
        segments.push([crossings[0], crossings[1]], [crossings[2], crossings[3]]);
      }
    }
  }
  return connectSegments(segments);
};

const eventGrid = ({ date }) => {
  const obscuration = [];
  const maximumTime = [];
  const start = new Date(`${date}T00:00:00.000Z`);
  const expectedDate = date;
  for (const latitude of LATITUDES) {
    const obscurationRow = [];
    const maximumTimeRow = [];
    for (const longitude of LONGITUDES) {
      const eclipse = SearchLocalSolarEclipse(
        start,
        new Observer(latitude, longitude, 0),
      );
      const sameEvent = eclipse.peak.time.date.toISOString().startsWith(expectedDate);
      const visible =
        sameEvent &&
        Math.max(
          eclipse.partial_begin.altitude,
          eclipse.peak.altitude,
          eclipse.partial_end.altitude,
        ) >= 0;
      obscurationRow.push(visible ? eclipse.obscuration : 0);
      maximumTimeRow.push(visible ? eclipse.peak.time.date.getTime() : Number.NaN);
    }
    obscuration.push(obscurationRow);
    maximumTime.push(maximumTimeRow);
  }
  return { maximumTime, obscuration };
};

const generated = {};
for (const event of EVENTS) {
  process.stdout.write(`Generating ${event.id}...\n`);
  const grid = eventGrid(event);
  const finiteTimes = grid.maximumTime.flat().filter(Number.isFinite);
  const firstHour = Math.ceil(Math.min(...finiteTimes) / 3_600_000) * 3_600_000;
  const lastHour = Math.floor(Math.max(...finiteTimes) / 3_600_000) * 3_600_000;
  generated[event.id] = {
    obscurationContours: OBSCURATION_LEVELS.map((fraction) => ({
      percent: fraction * 100,
      paths: contour(grid.obscuration, fraction),
    })),
    timeContours: Array.from(
      { length: (lastHour - firstHour) / 3_600_000 + 1 },
      (_, index) => firstHour + index * 3_600_000,
    )
      .map((milliseconds) => ({
        label: `${new Date(milliseconds).toISOString().slice(11, 16)}Z`,
        paths: contour(grid.maximumTime, milliseconds),
      }))
      .filter(({ paths }) => paths.length > 0),
  };
}

const output = `// Generated by scripts/generateEclipseContours.mjs. Do not edit.\n` +
  `// Astronomy Engine local-eclipse calculations on a ${GRID_STEP_DEGREES} degree grid.\n` +
  `export const ECLIPSE_CONTOURS = ${JSON.stringify(generated)} as const;\n`;
await writeFile(new URL("../src/data/eclipseContours.generated.ts", import.meta.url), output);
