// RAW_SA_PL
// Saturn ☌ Pluto — conjunction timestamps (geocentric tropical)
//
// Standard: Saturn–Jupiter baseline style
// - Keep meaningful retrograde multi-pass hits (usually up to 3 per conjunction window)
// - Remove micro-duplicates (days apart “same pass” spam)
// - Records are { t, sign } where sign is tropical zodiac sign at exact conjunction

(function () {
  const RAW_SA_PL = [
    // -0493 to -0492 (Virgo) — triple pass
    { t: "-0493-12-05T05:11:00Z", sign: "Vir" },
    { t: "-0492-02-08T08:00:00Z", sign: "Vir" },
    { t: "-0492-08-09T05:54:00Z", sign: "Vir" },

    // -0455 (Sagittarius) — single pass
    { t: "-0455-11-16T02:07:00Z", sign: "Sag" },

    // -0421 (Aquarius) — triple pass
    { t: "-0421-03-23T07:54:00Z", sign: "Aqu" },
    { t: "-0421-08-11T03:03:00Z", sign: "Aqu" },
    { t: "-0421-11-30T22:39:00Z", sign: "Aqu" },

    // -0389 to -0388 (Pisces) — triple pass
    { t: "-0389-06-11T12:58:00Z", sign: "Pis" },
    { t: "-0389-07-25T05:37:00Z", sign: "Pis" },
    { t: "-0388-02-01T00:41:00Z", sign: "Pis" },

    // -0357 to -0356 (Aries) — triple pass
    { t: "-0357-05-16T10:00:00Z", sign: "Ari" },
    { t: "-0357-11-20T22:45:00Z", sign: "Ari" },
    { t: "-0356-01-06T22:24:00Z", sign: "Ari" },

    // -0325 (Taurus) — single pass
    { t: "-0325-04-27T22:01:00Z", sign: "Tau" },

    // -0293 (Gemini) — single pass
    { t: "-0293-06-03T09:32:00Z", sign: "Gem" },

    // -0260 to -0259 (Leo) — triple pass
    { t: "-0260-10-28T19:15:00Z", sign: "Leo" },
    { t: "-0259-01-15T14:07:00Z", sign: "Leo" },
    { t: "-0259-07-02T01:58:00Z", sign: "Leo" },

    // -0222 (Scorpio) — single pass
    { t: "-0222-11-16T01:03:00Z", sign: "Sco" },

    // -0187 (Capricorn) — single pass
    { t: "-0187-12-31T02:00:00Z", sign: "Cap" },

    // -0154 (Pisces) — triple pass
    { t: "-0154-04-21T02:14:00Z", sign: "Pis" },
    { t: "-0154-09-05T17:49:00Z", sign: "Pis" },
    { t: "-0154-12-28T02:04:00Z", sign: "Pis" },

    // -0122 (Aries) — single pass
    { t: "-0122-04-30T11:27:00Z", sign: "Ari" },

    // -0090 (Taurus) — single pass
    { t: "-0090-04-13T21:14:00Z", sign: "Tau" },

    // -0059 to -0058 (Gemini) — triple pass
    { t: "-0059-08-11T22:14:00Z", sign: "Gem" },
    { t: "-0059-11-21T00:12:00Z", sign: "Gem" },
    { t: "-0058-04-13T18:39:00Z", sign: "Gem" },

    // -0026 (Cancer) — single pass
    { t: "-0026-08-23T15:14:00Z", sign: "Can" },

    // 0010 to 0011 (Libra) — triple pass
    { t: "0010-12-15T03:08:00Z", sign: "Lib" },
    { t: "0011-04-03T02:04:00Z", sign: "Lib" },
    { t: "0011-08-28T02:28:00Z", sign: "Lib" },

    // 0047 (Capricorn) — single pass
    { t: "0047-12-06T21:05:00Z", sign: "Cap" },

    // 0081 (Aquarius) — single pass
    { t: "0081-02-12T10:01:00Z", sign: "Aqu" },

    // 0113 (Aries) — single pass
    { t: "0113-03-20T15:08:00Z", sign: "Ari" },

    // 0144 to 0145 (Aries/Taurus cusp) — triple pass
    { t: "0144-07-05T22:21:00Z", sign: "Tau" },
    { t: "0144-10-01T19:21:00Z", sign: "Tau" },
    { t: "0145-03-07T02:26:00Z", sign: "Ari" },

    // 0176 (Gemini) — single pass
    { t: "0176-06-08T23:41:00Z", sign: "Gem" },

    // 0208 to 0209 (Cancer) — triple pass
    { t: "0208-08-08T09:19:00Z", sign: "Can" },
    { t: "0209-02-19T01:07:00Z", sign: "Can" },
    { t: "0209-03-25T04:19:00Z", sign: "Can" },

    // 0243 (Virgo) — single pass
    { t: "0243-08-25T04:28:00Z", sign: "Vir" },

    // 0280 (Sagittarius) — single pass
    { t: "0280-12-22T12:12:00Z", sign: "Sag" },

    // 0315 (Aquarius) — single pass
    { t: "0315-03-03T03:09:00Z", sign: "Aqu" },

    // 0347 to 0348 (Pisces) — triple pass
    { t: "0347-06-02T07:15:00Z", sign: "Pis" },
    { t: "0347-08-15T09:32:00Z", sign: "Pis" },
    { t: "0348-02-01T04:56:00Z", sign: "Pis" },

    // 0379 to 0380 (Aries) — triple pass
    { t: "0379-05-23T23:15:00Z", sign: "Ari" },
    { t: "0379-11-20T01:39:00Z", sign: "Ari" },
    { t: "0380-01-18T23:34:00Z", sign: "Ari" },

    // 0411 (Taurus) — single pass
    { t: "0411-05-03T02:54:00Z", sign: "Tau" },

    // 0443 (Gemini) — single pass
    { t: "0443-05-22T22:23:00Z", sign: "Gem" },

    // 0476 (Leo) — single pass
    { t: "0476-08-05T06:54:00Z", sign: "Leo" },

    // 0513 (Scorpio) — single pass
    { t: "0513-11-04T17:21:00Z", sign: "Sco" },

    // 0549 (Capricorn) — triple pass
    { t: "0549-03-02T10:20:00Z", sign: "Cap" },
    { t: "0549-08-09T07:12:00Z", sign: "Cap" },
    { t: "0549-11-10T21:30:00Z", sign: "Cap" },

    // 0582 (Pisces) — triple pass
    { t: "0582-04-04T14:22:00Z", sign: "Pis" },
    { t: "0582-10-21T16:53:00Z", sign: "Pis" },
    { t: "0582-11-27T05:12:00Z", sign: "Pis" },

    // 0614 (Aries) — single pass
    { t: "0614-05-02T12:42:00Z", sign: "Ari" },

    // 0646 (Taurus) — single pass
    { t: "0646-04-18T10:56:00Z", sign: "Tau" },

    // 0677 to 0678 (Gemini) — triple pass
    { t: "0677-08-07T23:40:00Z", sign: "Gem" },
    { t: "0677-12-03T19:46:00Z", sign: "Gem" },
    { t: "0678-04-10T22:59:00Z", sign: "Gem" },

    // 0710 (Cancer) — single pass
    { t: "0710-07-16T06:45:00Z", sign: "Can" },

    // 0745 to 0746 (Libra) — triple pass
    { t: "0745-11-12T14:55:00Z", sign: "Lib" },
    { t: "0746-05-09T03:46:00Z", sign: "Lib" },
    { t: "0746-07-16T23:29:00Z", sign: "Lib" },

    // 0783 (Capricorn) — single pass
    { t: "0783-01-17T04:55:00Z", sign: "Cap" },

    // 0817 (Aquarius) — single pass
    { t: "0817-02-01T22:45:00Z", sign: "Aqu" },

    // 0849 (Aries) — single pass
    { t: "0849-03-30T15:39:00Z", sign: "Ari" },

    // 0881 (Taurus) — single pass
    { t: "0881-03-27T10:19:00Z", sign: "Tau" },

    // 0912 (Gemini) — single pass
    { t: "0912-06-28T12:23:00Z", sign: "Gem" },

    // 0944 (Cancer) — single pass
    { t: "0944-08-03T15:54:00Z", sign: "Can" },

    // 0978 (Virgo) — single pass
    { t: "0978-09-09T20:42:00Z", sign: "Vir" },

    // 1015 (Sagittarius) — single pass
    { t: "1015-12-31T21:08:00Z", sign: "Sag" },

    // 1051 (Aquarius) — single pass
    { t: "1051-02-03T07:27:00Z", sign: "Aqu" },

    // 1083 to 1084 (Pisces) — triple pass
    { t: "1083-05-25T19:21:00Z", sign: "Pis" },
    { t: "1083-08-30T09:12:00Z", sign: "Pis" },
    { t: "1084-01-29T22:59:00Z", sign: "Pis" },

    // 1115 to 1116 (Aries) — triple pass
    { t: "1115-06-04T00:18:00Z", sign: "Ari" },
    { t: "1115-11-09T17:00:00Z", sign: "Ari" },
    { t: "1116-02-05T18:30:00Z", sign: "Ari" },

    // 1147 (Taurus) — single pass
    { t: "1147-05-13T19:31:00Z", sign: "Tau" },

    // 1179 (Gemini) — single pass
    { t: "1179-05-19T03:02:00Z", sign: "Gem" },

    // 1211 to 1212 (Leo) — triple pass
    { t: "1211-09-25T14:11:00Z", sign: "Leo" },
    { t: "1212-02-21T23:17:00Z", sign: "Leo" },
    { t: "1212-05-27T14:18:00Z", sign: "Leo" },

    // 1248 (Scorpio) — triple pass
    { t: "1248-01-12T06:10:00Z", sign: "Sco" },
    { t: "1248-04-05T20:30:00Z", sign: "Sco" },
    { t: "1248-09-20T18:52:00Z", sign: "Sco" },

    // 1284 (Capricorn) — single pass
    { t: "1284-12-27T01:47:00Z", sign: "Cap" },

    // 1318 (Pisces) — single pass
    { t: "1318-03-08T12:47:00Z", sign: "Pis" },

    // 1350 (Aries) — single pass
    { t: "1350-04-21T01:55:00Z", sign: "Ari" },

    // 1382 (Taurus) — single pass
    { t: "1382-04-10T14:22:00Z", sign: "Tau" },

    // 1413 to 1414 (Gemini) — triple pass
    { t: "1413-07-21T20:47:00Z", sign: "Gem" },
    { t: "1414-01-12T04:22:00Z", sign: "Gem" },
    { t: "1414-03-18T03:19:00Z", sign: "Gem" },

    // 1445 to 1446 (Cancer) — triple pass
    { t: "1445-09-21T17:28:00Z", sign: "Can" },
    { t: "1446-01-11T13:14:00Z", sign: "Can" },
    { t: "1446-05-25T11:06:00Z", sign: "Can" },

    // 1480 (Libra) — single pass
    { t: "1480-09-25T02:55:00Z", sign: "Lib" },

    // 1518 (Capricorn) — single pass
    { t: "1518-01-13T14:43:00Z", sign: "Cap" },

    // 1552 (Aquarius/Pisces cusp) — triple pass
    { t: "1552-04-04T18:56:00Z", sign: "Pis" },
    { t: "1552-09-09T15:27:00Z", sign: "Aqu" },
    { t: "1552-12-13T17:04:00Z", sign: "Aqu" },

    // 1585 (Aries) — single pass
    { t: "1585-03-16T02:21:00Z", sign: "Ari" },

    // 1616 to 1617 (Taurus) — triple pass
    { t: "1616-07-26T05:25:00Z", sign: "Tau" },
    { t: "1616-09-24T20:10:00Z", sign: "Tau" },
    { t: "1617-03-22T17:02:00Z", sign: "Tau" },

    // 1648 (Gemini) — single pass
    { t: "1648-06-24T20:44:00Z", sign: "Gem" },

    // 1680 (Cancer) — single pass
    { t: "1680-07-12T23:52:00Z", sign: "Can" },

    // 1713 (Virgo) — single pass
    { t: "1713-09-23T04:20:00Z", sign: "Vir" },

    // 1750 (Sagittarius) — single pass
    { t: "1750-11-21T16:01:00Z", sign: "Sag" },

    // 1786 (Aquarius) — triple pass
    { t: "1786-03-27T07:07:00Z", sign: "Aqu" },
    { t: "1786-08-09T08:15:00Z", sign: "Aqu" },
    { t: "1786-12-08T03:40:00Z", sign: "Aqu" },

    // 1819 to 1820 (Pisces) — triple pass
    { t: "1819-05-05T01:18:00Z", sign: "Pis" },
    { t: "1819-10-05T08:34:00Z", sign: "Pis" },
    { t: "1820-01-11T15:41:00Z", sign: "Pis" },

    // 1851 to 1852 (Aries/Taurus cusp) — triple pass
    { t: "1851-06-06T21:08:00Z", sign: "Tau" },
    { t: "1851-11-11T06:44:00Z", sign: "Ari" },
    { t: "1852-02-10T03:34:00Z", sign: "Ari" },

    // 1883 (Taurus) — single pass
    { t: "1883-05-22T18:28:00Z", sign: "Tau" },

    // 1914 to 1915 (Cancer) — triple pass
    { t: "1914-10-04T18:26:00Z", sign: "Can" },
    { t: "1914-11-01T09:00:00Z", sign: "Can" },
    { t: "1915-05-19T19:52:00Z", sign: "Can" },

    // 1947 (Leo) — single pass
    { t: "1947-08-11T01:18:00Z", sign: "Leo" },

    // 1982 (Libra) — single pass
    { t: "1982-11-08T00:42:00Z", sign: "Lib" },

    // 2020 (Capricorn) — single pass
    { t: "2020-01-12T16:57:00Z", sign: "Cap" },

    // 2053 to 2054 (Pisces) — triple pass
    { t: "2053-06-15T12:46:00Z", sign: "Pis" },
    { t: "2053-07-10T10:37:00Z", sign: "Pis" },
    { t: "2054-02-02T06:55:00Z", sign: "Pis" },

    // 2086 (Aries) — single pass
    { t: "2086-04-08T23:01:00Z", sign: "Ari" },

    // 2117 to 2118 (Taurus) — triple pass
    { t: "2117-08-12T17:46:00Z", sign: "Tau" },
    { t: "2117-10-01T11:30:00Z", sign: "Tau" },
    { t: "2118-04-05T22:42:00Z", sign: "Tau" },

    // 2149 (Gemini) — single pass
    { t: "2149-07-10T19:24:00Z", sign: "Gem" },

    // 2181 (Cancer) — single pass
    { t: "2181-08-08T22:25:00Z", sign: "Can" },

    // 2215 (Virgo) — single pass
    { t: "2215-08-26T18:24:00Z", sign: "Vir" },

    // 2252 (Sagittarius) — single pass
    { t: "2252-12-01T14:57:00Z", sign: "Sag" },

    // 2288 (Aquarius) — single pass
    { t: "2288-01-28T09:57:00Z", sign: "Aqu" },

    // 2320 to 2321 (Aries) — triple pass
    { t: "2320-06-02T12:17:00Z", sign: "Ari" },
    { t: "2320-09-23T02:09:00Z", sign: "Ari" },
    { t: "2321-02-09T08:15:00Z", sign: "Ari" },

    // 2352 to 2353 (Taurus) — triple pass
    { t: "2352-06-19T13:48:00Z", sign: "Tau" },
    { t: "2352-11-20T08:45:00Z", sign: "Tau" },
    { t: "2353-02-22T21:25:00Z", sign: "Tau" },

    // 2384 (Gemini) — single pass
    { t: "2384-06-06T20:22:00Z", sign: "Gem" },
  ];

  window.CONJUNCTION_DATASETS = window.CONJUNCTION_DATASETS || {};
  window.CONJUNCTION_DATASETS["Saturn|Pluto"] = { p1: "Saturn", p2: "Pluto", events: RAW_SA_PL };
  window.CONJUNCTION_DATASETS["Pluto|Saturn"] = window.CONJUNCTION_DATASETS["Saturn|Pluto"];
})();