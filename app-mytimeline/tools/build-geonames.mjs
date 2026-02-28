import fs from "fs";
import path from "path";
import readline from "readline";

const ROOT = process.cwd();
const INFILE = path.join(ROOT, "public", "places_src", "cities5000.txt");
const OUTDIR = path.join(ROOT, "public", "places");

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .trim()
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// shard by first 2 chars of normalized city name (aa..zz, 0_ for anything else)
function shardKey(cityNorm) {
  const a = cityNorm[0] || "0";
  const b = cityNorm[1] || "_";
  const ok = (ch) => (ch >= "a" && ch <= "z") || (ch >= "0" && ch <= "9");
  return `${ok(a) ? a : "0"}${ok(b) ? b : "_"}`;
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

async function main() {
  if (!fs.existsSync(INFILE)) {
    console.error("Missing:", INFILE);
    console.error("Put cities5000.txt in /public/places_src/ first.");
    process.exit(1);
  }

  ensureDir(OUTDIR);

  const shards = new Map(); // shard -> object
  let count = 0;

  const rl = readline.createInterface({
    input: fs.createReadStream(INFILE, "utf8"),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line || !line.includes("\t")) continue;

    // GeoNames geoname columns (we only use a few):
    // 0 geonameid
    // 1 name
    // 2 asciiname
    // 4 latitude
    // 5 longitude
    // 8 country code
    // 10 admin1 code
    // 17 timezone
    const cols = line.split("\t");
    if (cols.length < 18) continue;

    const name = cols[1];
    const asciiname = cols[2];
    const lat = Number(cols[4]);
    const lon = Number(cols[5]);
    const cc = cols[8];        // countryCode
    const admin1 = cols[10];   // admin1 code
    const tz = cols[17];       // IANA timezone id

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (!cc || !admin1 || !tz) continue;

    // We'll index using both name + asciiname
    const city1 = norm(name);
    const city2 = norm(asciiname);

    // Key format:
    // cityNorm|ADMIN1|CC
    // Example: "kailua kona|HI|US"
    const key1 = `${city1}|${admin1}|${cc}`;
    const key2 = `${city2}|${admin1}|${cc}`;

    const sk = shardKey(city2 || city1);
    if (!shards.has(sk)) shards.set(sk, {});

    const rec = { lat, lon, tz, cc, admin1 };

    // keep first record; avoid overwriting with duplicates
    const bucket = shards.get(sk);
    if (!bucket[key1]) bucket[key1] = rec;
    if (!bucket[key2]) bucket[key2] = rec;

    count++;
  }

  // write shards
  const index = {};
  for (const [sk, obj] of shards.entries()) {
    const fname = `geonames-${sk}.json`;
    fs.writeFileSync(path.join(OUTDIR, fname), JSON.stringify(obj));
    index[sk] = fname;
  }

  fs.writeFileSync(path.join(OUTDIR, "geonames-index.json"), JSON.stringify(index, null, 2));

  console.log("Wrote", Object.keys(index).length, "shards to", OUTDIR);
  console.log("Indexed", count, "rows (with name/asciiname keys).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
