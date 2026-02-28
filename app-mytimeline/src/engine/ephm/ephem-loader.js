// src/engine/ephm/ephem-loader.js
// Loads precomputed DE440 longitude chunks from /public/ephm/de440/<year>/<body>.bin

const BASE = "/ephm/de440";

const STARS_URL = "/ephm/stars.json";

let starsCache = null; // object map { name: deg }

const BODIES = ["sun","moon","mercury","venus","mars","jupiter","saturn","uranus","neptune","pluto","mean_node","chiron","ceres","pallas","juno","vesta","eros"];


const binCache = new Map();   // key: `${year}:${body}` -> Float32Array
const metaCache = new Map();  // year -> meta.json

function wrap360(x) {
  x = x % 360;
  if (x < 0) x += 360;
  return x;
}

// unwrap angle b near a (avoid 359 -> 0 jumps during interpolation)
function unwrapNear(a, b) {
  let d = b - a;
  if (d > 180) b -= 360;
  else if (d < -180) b += 360;
  return b;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

async function loadMeta(year) {
  if (metaCache.has(year)) return metaCache.get(year);

  const res = await fetch(`${BASE}/${year}/meta.json`, { cache: "force-cache" });
  if (!res.ok) throw new Error(`Missing meta.json for year ${year} at ${BASE}/${year}/meta.json`);
  const meta = await res.json();
  metaCache.set(year, meta);
  return meta;
}

async function loadBin(year, body) {
  const key = `${year}:${body}`;
  if (binCache.has(key)) return binCache.get(key);

  const res = await fetch(`${BASE}/${year}/${body}.bin`, { cache: "force-cache" });
  if (!res.ok) throw new Error(`Missing ${body}.bin for year ${year} at ${BASE}/${year}/${body}.bin`);
  const buf = await res.arrayBuffer();
  const arr = new Float32Array(buf);
  binCache.set(key, arr);
  return arr;
}

async function loadStars() {
  if (starsCache) return starsCache;

  const res = await fetch(STARS_URL, { cache: "force-cache" });
  if (!res.ok) throw new Error(`Missing stars.json at ${STARS_URL}`);
  const stars = await res.json();

  starsCache = stars;
  return starsCache;
}

// Public API: returns fixed-star longitudes (degrees 0..360)
export async function getFixedStars() {
  return await loadStars();
}


function secondsIntoYearUTC(dt) {
  const y = dt.getUTCFullYear();
  const startMs = Date.UTC(y, 0, 1, 0, 0, 0);
  return Math.floor((dt.getTime() - startMs) / 1000);
}

function sample(arr, sec, stepSec) {
  const i = Math.floor(sec / stepSec);
  const t = (sec - i * stepSec) / stepSec;

  const a = arr[Math.min(i, arr.length - 1)];
  const b = arr[Math.min(i + 1, arr.length - 1)];
  const b2 = unwrapNear(a, b);

  return wrap360(lerp(a, b2, t));
}

// Public API: returns longitudes in degrees [0..360) for the given UTC time
export async function getTransitLongitudesUTC(dateUTC) {
  const year = dateUTC.getUTCFullYear();
  const meta = await loadMeta(year);

  const sec = secondsIntoYearUTC(dateUTC);

  const out = {};

  // Moon uses tighter step
  {
    const step = meta.step_sec.moon;
    const arr = await loadBin(year, "moon");
    out.moon = sample(arr, sec, step);
    // Mean node uses moon cadence (same step as moon)
    {
      const step = meta.step_sec.moon;
      const arr = await loadBin(year, "mean_node");
      out.mean_node = sample(arr, sec, step);
    }
  }

  // Planets use hourly step
  {
    const step = meta.step_sec.planets;
    for (const body of BODIES) {
      if (body === "moon" || body === "mean_node") continue;
      const arr = await loadBin(year, body);
      out[body] = sample(arr, sec, step);
    }
  }

  return out;
}
