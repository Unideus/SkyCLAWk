/* js/skyclock-engine.js
   Skyclock Ephemeris + Engine (independent of Timeline)
   Uses Astronomy Engine for geocentric apparent ecliptic longitudes (retrograde-correct).
*/
(() => {
  "use strict";

  function requireAstronomy() {
    if (!window.Astronomy || !Astronomy.Body || !Astronomy.GeoVector || !Astronomy.Ecliptic) {
      throw new Error(
        "Astronomy Engine not found. Load js/vendor/astronomy.browser.min.js BEFORE skyclock-engine.js"
      );
    }
  }

  function norm360(deg) {
    let x = deg % 360;
    if (x < 0) x += 360;
    return x;
  }

  function shortestDeltaDeg(a, b) {
    // returns b-a in range [-180, +180]
    let d = (b - a) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
  }

  // Map keys you’ll use in Skyclock -> Astronomy.Body enum names
  const BODY_ENUM_NAME = {
    sun: "Sun",
    moon: "Moon",
    mercury: "Mercury",
    venus: "Venus",
    mars: "Mars",
    jupiter: "Jupiter",
    saturn: "Saturn",
	uranus: "Uranus",
	neptune: "Neptune",
	pluto: "Pluto",
  };

  function getEclipticLongitudeDeg(bodyEnum, date) {
    // Geocentric vector with aberration correction enabled => "apparent" sky position.
    // Then convert to true ecliptic of date (ECT) and read longitude.
    const vec = Astronomy.GeoVector(bodyEnum, date, true);
    const ecl = Astronomy.Ecliptic(vec);

    // Different builds expose different property names; support the common ones.
    const lon =
      (typeof ecl.elon === "number" ? ecl.elon :
      (typeof ecl.lon === "number" ? ecl.lon :
      (typeof ecl.longitude === "number" ? ecl.longitude :
      NaN)));

    if (!Number.isFinite(lon)) {
      throw new Error("Could not read ecliptic longitude from Astronomy.Ecliptic(...) result.");
    }
    return norm360(lon);
  }

  function motionDegPerDay(bodyEnum, date) {
    const t0 = new Date(date);
    const t1 = new Date(date.getTime() + 86400000); // +1 day
    const lon0 = getEclipticLongitudeDeg(bodyEnum, t0);
    const lon1 = getEclipticLongitudeDeg(bodyEnum, t1);
    return shortestDeltaDeg(lon0, lon1);
  }

  class SkyclockEngine {
    constructor(opts = {}) {
      requireAstronomy();

      this._time = opts.startDate ? new Date(opts.startDate) : new Date();
      this.speed = Number.isFinite(opts.speed) ? opts.speed : 1; // ms/ms
      this.paused = !!opts.paused;

      this._lastRealMs = (typeof performance !== "undefined" ? performance.now() : Date.now());
      this._cacheSec = null;
      this._cache = null;
    }

    setDate(date) {
      this._time = new Date(date);
      this._cacheSec = null;
      this._cache = null;
    }

    getDate() {
      return new Date(this._time);
    }

    setSpeed(speed) {
      this.speed = Number.isFinite(speed) ? speed : 1;
    }

    setPaused(paused) {
      this.paused = !!paused;
    }

    togglePaused() {
      this.paused = !this.paused;
    }

    step(realNowMs) {
      const now = (realNowMs ?? (typeof performance !== "undefined" ? performance.now() : Date.now()));
      const dt = now - this._lastRealMs;
      this._lastRealMs = now;

      if (!this.paused) {
        this._time = new Date(this._time.getTime() + dt * this.speed);
        this._cacheSec = null;
        this._cache = null;
      }
      return this.getDate();
    }

    getLongitudes(date = this._time) {
      requireAstronomy();

      const d = new Date(date);
      const sec = Math.floor(d.getTime() / 1000);

      if (sec === this._cacheSec && this._cache) return this._cache;

      const out = {};
      for (const [key, enumName] of Object.entries(BODY_ENUM_NAME)) {
        const bodyEnum = Astronomy.Body[enumName];
        out[key] = getEclipticLongitudeDeg(bodyEnum, d);
      }

      this._cacheSec = sec;
      this._cache = out;
      return out;
    }

    getLongitudesWithMotion(date = this._time) {
      requireAstronomy();

      const d = new Date(date);
      const lons = this.getLongitudes(d);

      const out = {};
      for (const [key, enumName] of Object.entries(BODY_ENUM_NAME)) {
        const bodyEnum = Astronomy.Body[enumName];
        const dlonPerDay = motionDegPerDay(bodyEnum, d);
        out[key] = { lon: lons[key], dlonPerDay, retrograde: dlonPerDay < 0 };
      }
      return out;
    }
  }

  // Export both a class + a tiny singleton helper (no Timeline coupling).
  window.SkyclockEngine = SkyclockEngine;
  window.SkyclockEphemeris = {
    getEclipticLongitudes(date = new Date()) {
      requireAstronomy();
      // “stateless” helper if you don’t want to instantiate yet
      const out = {};
      for (const [key, enumName] of Object.entries(BODY_ENUM_NAME)) {
        out[key] = getEclipticLongitudeDeg(Astronomy.Body[enumName], date);
      }
      return out;
    },
  };
})();
