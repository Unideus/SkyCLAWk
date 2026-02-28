// RAW_UR_NE
// Uranus ☌ Neptune — conjunction timestamps (geocentric tropical)
//
// Standard: Saturn–Jupiter baseline style
// - Keep meaningful retrograde multi-pass hits (usually up to 3 per conjunction window)
// - Remove micro-duplicates (days apart “same pass” spam)
// - Records are { t, sign } where sign is tropical zodiac sign at exact conjunction

(function () {
  const RAW_UR_NE = [
  { t: "0110-08-18T16:20:00Z", sign: "Can" },
  { t: "0111-02-03T22:19:00Z", sign: "Can" },
  { t: "0111-05-08T01:04:00Z", sign: "Can" },

  { t: "0281-09-07T06:09:00Z", sign: "Leo" },
  { t: "0282-02-13T20:25:00Z", sign: "Leo" },
  { t: "0282-05-28T14:11:00Z", sign: "Leo" },

  { t: "0452-09-12T21:31:00Z", sign: "Leo" },
  { t: "0453-03-22T01:16:00Z", sign: "Leo" },
  { t: "0453-05-26T14:03:00Z", sign: "Leo" },

  { t: "0623-09-21T10:29:00Z", sign: "Vir" },

  { t: "0794-10-04T12:32:00Z", sign: "Vir" },

  { t: "0965-10-13T19:57:00Z", sign: "Lib" },

  { t: "1136-10-24T04:16:00Z", sign: "Lib" },

  { t: "1307-11-14T19:54:00Z", sign: "Sco" },

  { t: "1478-12-15T04:13:00Z", sign: "Sco" },
  { t: "1479-07-04T23:06:00Z", sign: "Sco" },
  { t: "1479-08-29T17:10:00Z", sign: "Sco" },

  { t: "1650-01-18T04:19:00Z", sign: "Sag" },
  { t: "1650-06-13T10:34:00Z", sign: "Sag" },
  { t: "1650-10-16T04:01:00Z", sign: "Sag" },

  { t: "1821-03-22T04:48:00Z", sign: "Cap" },
  { t: "1821-05-03T08:37:00Z", sign: "Cap" },
  { t: "1821-12-03T16:36:00Z", sign: "Cap" },

  { t: "1993-02-02T08:06:00Z", sign: "Cap" },
  { t: "1993-08-20T07:54:00Z", sign: "Cap" },
  { t: "1993-10-24T20:07:00Z", sign: "Cap" },

  { t: "2165-01-17T04:18:00Z", sign: "Aqu" },

  { t: "2336-04-11T12:15:00Z", sign: "Aqu" },
  { t: "2336-07-31T02:12:00Z", sign: "Aqu" },
  { t: "2337-01-11T03:26:00Z", sign: "Aqu" },
];

  window.CONJUNCTION_DATASETS = window.CONJUNCTION_DATASETS || {};
  window.CONJUNCTION_DATASETS["Uranus|Neptune"] = { p1: "Uranus", p2: "Neptune", events: RAW_UR_NE };
  window.CONJUNCTION_DATASETS["Neptune|Uranus"] = window.CONJUNCTION_DATASETS["Uranus|Neptune"];
})();
