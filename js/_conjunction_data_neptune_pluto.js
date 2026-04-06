// RAW_NE_PL
// Neptune ☌ Pluto — conjunction timestamps (geocentric tropical)
//
// Standard: Saturn–Jupiter baseline style
// - Keep meaningful retrograde multi-pass hits (usually up to 3 per conjunction window)
// - Remove micro-duplicates (days apart “same pass” spam)
// - Records are { t, sign } where sign is tropical zodiac sign at exact conjunction

(function () {
  const RAW_NE_PL = [
    // -0083 to -0082 (Taurus) — triple pass (cycle containing year 0)
    { t: "-000083-07-02T22:10:00Z", sign: "Tau" },
    { t: "-000083-10-27T08:01:00Z", sign: "Tau" },
    { t: "-000082-04-03T04:51:00Z", sign: "Tau" },

    // 0411–0412 (Taurus) — triple pass
    { t: "0411-07-01T01:59:00Z", sign: "Tau" },
    { t: "0411-11-12T21:57:00Z", sign: "Tau" },
    { t: "0412-04-01T04:05:00Z", sign: "Tau" },

    // 0905 (Taurus) — single pass
    { t: "0905-05-26T18:58:00Z", sign: "Tau" },

    // 1398–1399 (Gemini) — triple pass
    { t: "1398-06-30T23:17:00Z", sign: "Gem" },
    { t: "1398-12-06T21:32:00Z", sign: "Gem" },
    { t: "1399-04-01T17:26:00Z", sign: "Gem" },

    // 1891–1892 (Gemini) — triple pass (kept the first of the two same-day times)
    { t: "1891-08-02T16:36:00Z", sign: "Gem" },
    { t: "1891-11-05T21:06:00Z", sign: "Gem" },
    { t: "1892-04-30T15:41:00Z", sign: "Gem" },

    // 2385 (Gemini) — single pass (kept the first of the two same-day times)
    { t: "2385-05-20T16:15:00Z", sign: "Gem" },
  ];

  window.CONJUNCTION_DATASETS = window.CONJUNCTION_DATASETS || {};
  window.CONJUNCTION_DATASETS["Neptune|Pluto"] = { p1: "Neptune", p2: "Pluto", events: RAW_NE_PL };
  window.CONJUNCTION_DATASETS["Pluto|Neptune"] = window.CONJUNCTION_DATASETS["Neptune|Pluto"];
})();