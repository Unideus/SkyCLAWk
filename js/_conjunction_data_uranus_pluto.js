// RAW_UR_PL
// Uranus ☌ Pluto — conjunction timestamps (geocentric tropical)
//
// Standard: Saturn–Jupiter baseline style
// - Keep meaningful retrograde multi-pass hits (usually up to 3 per conjunction window)
// - Remove micro-duplicates (days apart “same pass” spam)
// - Records are { t, sign } where sign is tropical zodiac sign at exact conjunction

(function () {
  const RAW_UR_PL = [
    // -0436 (Capricorn) — triple pass
    { t: "-0436-03-11T19:09:00Z", sign: "Cap" },
    { t: "-0436-06-21T21:22:00Z", sign: "Cap" },
    { t: "-0436-12-09T17:56:00Z", sign: "Cap" },

    // -0322 (Taurus) — single pass
    { t: "-0322-05-25T05:13:00Z", sign: "Tau" },

    // -0181 (Aquarius) — triple pass
    { t: "-0181-03-11T05:09:00Z", sign: "Aqu" },
    { t: "-0181-07-28T15:40:00Z", sign: "Aqu" },
    { t: "-0181-12-12T03:29:00Z", sign: "Aqu" },

    // -0069 to -0068 (Gemini) — triple pass
    { t: "-0069-08-18T08:59:00Z", sign: "Gem" },
    { t: "-0069-10-08T11:51:00Z", sign: "Gem" },
    { t: "-0068-05-02T03:38:00Z", sign: "Gem" },

    // 0074 (Aquarius) — single pass
    { t: "0074-02-06T00:56:00Z", sign: "Aqu" },

    // 0185 to 0186 (Gemini) — triple pass
    { t: "0185-07-16T09:20:00Z", sign: "Gem" },
    { t: "0185-12-08T05:15:00Z", sign: "Gem" },
    { t: "0186-04-12T14:19:00Z", sign: "Gem" },

    // 0328 (Aquarius) — triple pass
    { t: "0328-03-16T07:00:00Z", sign: "Aqu" },
    { t: "0328-09-24T06:36:00Z", sign: "Aqu" },
    { t: "0328-12-11T09:57:00Z", sign: "Aqu" },

    // 0439 (Gemini) — single pass
    { t: "0439-07-02T07:08:00Z", sign: "Gem" },

    // 0582 to 0583 (Pisces) — triple pass
    { t: "0582-04-03T10:06:00Z", sign: "Pis" },
    { t: "0582-09-21T15:14:00Z", sign: "Pis" },
    { t: "0583-01-02T13:55:00Z", sign: "Pis" },

    // 0693 (Cancer) — single pass
    { t: "0693-07-01T10:22:00Z", sign: "Can" },

    // 0836 to 0837 (Pisces) — triple pass
    { t: "0836-04-07T09:03:00Z", sign: "Pis" },
    { t: "0836-10-13T21:48:00Z", sign: "Pis" },
    { t: "0837-01-02T21:51:00Z", sign: "Pis" },

    // 0947 (Cancer) — single pass
    { t: "0947-07-12T04:49:00Z", sign: "Can" },

    // 1090 (Aries) — single pass
    { t: "1090-03-29T02:24:00Z", sign: "Ari" },

    // 1201 (Cancer) — single pass
    { t: "1201-08-04T23:21:00Z", sign: "Can" },

    // 1343 to 1344 (Aries) — triple pass
    { t: "1343-06-18T22:16:00Z", sign: "Ari" },
    { t: "1343-08-25T07:23:00Z", sign: "Ari" },
    { t: "1344-03-10T11:33:00Z", sign: "Ari" },

    // 1455 to 1456 (Leo) — triple pass
    { t: "1455-09-30T23:37:00Z", sign: "Leo" },
    { t: "1456-01-23T01:48:00Z", sign: "Leo" },
    { t: "1456-06-24T01:49:00Z", sign: "Leo" },

    // 1597 to 1598 (Aries) — triple pass
    { t: "1597-05-01T22:44:00Z", sign: "Ari" },
    { t: "1597-11-24T20:37:00Z", sign: "Ari" },
    { t: "1598-01-21T15:09:00Z", sign: "Ari" },

    // 1710 (Leo) — single pass
    { t: "1710-09-07T06:54:00Z", sign: "Leo" },

    // 1850 to 1851 (Aries) — triple pass
    { t: "1850-06-26T00:55:00Z", sign: "Ari" },
    { t: "1850-09-25T14:00:00Z", sign: "Ari" },
    { t: "1851-03-23T19:33:00Z", sign: "Ari" },

    // 1965 to 1966 (Virgo) — triple pass
    { t: "1965-10-09T20:06:00Z", sign: "Vir" },
    { t: "1966-04-04T20:50:00Z", sign: "Vir" },
    { t: "1966-06-30T09:40:00Z", sign: "Vir" },

    // 2104 (Taurus) — single pass
    { t: "2104-04-24T15:18:00Z", sign: "Tau" },

    // 2221 (Libra) — single pass
    { t: "2221-09-27T15:56:00Z", sign: "Lib" },

    // 2357 (Taurus) — single pass
    { t: "2357-05-20T16:33:00Z", sign: "Tau" },
  ];

  window.CONJUNCTION_DATASETS = window.CONJUNCTION_DATASETS || {};
  window.CONJUNCTION_DATASETS["Uranus|Pluto"] = { p1: "Uranus", p2: "Pluto", events: RAW_UR_PL };
  window.CONJUNCTION_DATASETS["Pluto|Uranus"] = window.CONJUNCTION_DATASETS["Uranus|Pluto"];
})();