	// _conjunction_data_saturn_jupiter.js
// Saturn ☌ Jupiter — master baseline dataset (single source of truth)
//
// This file stays “special” because the *entire generational screw* is mapped to the
// Saturn–Jupiter baseline cycle. That means we keep:
//
// - RAW_SA_JU: canonical timestamps + signs (you can include multi-pass conjunctions here)
// - SA_JU: enriched records (adds element + elementShift + crisis)
// - window.CONJUNCTION_DATA: legacy global used by existing renderer paths
// - window.CONJUNCTION_DATASETS registration for the cycle swapper
//
// IMPORTANT:
// You were advised correctly: restore ALL Saturn–Jupiter conjunctions (including multiples)
// and let the code filter downstream. Do NOT delete entries to force button behavior.

(function () {
  // -----------------------------
  // 1) Raw canonical dataset
  // -----------------------------
  // NOTE: This list is currently the one you had in _conjunction_data.js.
  // If you have “extra” Saturn–Jupiter conjunction passes (retrograde triples),
  // add them here as additional {t, sign} entries — DO NOT remove the singles.
  const RAW_SA_JU = [
    { t: "0014-12-24T20:01:00Z", sign: "Sag" },
    { t: "0034-10-03T05:27:00Z", sign: "Leo" },
    { t: "0054-03-24T03:37:00Z", sign: "Pis" },
    { t: "0074-10-27T07:27:00Z", sign: "Sag" },
    { t: "0094-08-19T09:23:00Z", sign: "Leo" },
    { t: "0114-01-28T10:36:00Z", sign: "Ari" },
    { t: "0134-01-19T00:13:00Z", sign: "Sag" },
    { t: "0154-07-07T00:39:00Z", sign: "Vir" },
    { t: "0173-05-07T07:30:00Z", sign: "Ari" },
    { t: "0193-11-21T03:26:00Z", sign: "Sag" },
    { t: "0213-10-11T08:39:00Z", sign: "Vir" },
    { t: "0233-03-20T14:54:00Z", sign: "Ari" },
    { t: "0253-02-13T13:47:00Z", sign: "Cap" },
    { t: "0273-08-27T04:13:00Z", sign: "Vir" },
    { t: "0292-06-27T09:03:00Z", sign: "Tau" },
    { t: "0312-12-14T15:17:00Z", sign: "Cap" },
    { t: "0332-11-29T02:45:00Z", sign: "Lib" },
    { t: "0352-05-07T20:18:00Z", sign: "Tau" },
    { t: "0372-03-07T13:04:00Z", sign: "Cap" },
    { t: "0392-10-03T23:45:00Z", sign: "Lib" },
    { t: "0411-08-29T20:42:00Z", sign: "Gem" },
    { t: "0432-01-01T16:43:00Z", sign: "Cap" },
    { t: "0452-01-15T06:56:00Z", sign: "Lib" },
    { t: "0471-06-21T00:53:00Z", sign: "Gem" },
    { t: "0491-03-24T07:19:00Z", sign: "Aqu" },
    { t: "0511-11-01T07:54:00Z", sign: "Lib" },
    { t: "0531-05-02T04:25:00Z", sign: "Gem" },
    { t: "0551-01-16T03:43:00Z", sign: "Aqu" },
    { t: "0571-08-31T21:36:00Z", sign: "Sco" },
    { t: "0590-08-01T20:41:00Z", sign: "Can" },
    { t: "0610-04-08T09:21:00Z", sign: "Aqu" },
    { t: "0630-11-21T20:53:00Z", sign: "Sco" },
    { t: "0650-06-13T20:03:00Z", sign: "Can" },
    { t: "0670-01-30T16:10:00Z", sign: "Aqu" },
    { t: "0690-09-20T11:30:00Z", sign: "Sco" },
    { t: "0709-09-17T19:40:00Z", sign: "Can" },
    { t: "0729-04-24T23:27:00Z", sign: "Pis" },
    { t: "0749-12-10T02:45:00Z", sign: "Sco" },
    { t: "0769-07-27T01:42:00Z", sign: "Leo" },
    { t: "0789-02-18T22:02:00Z", sign: "Pis" },
    { t: "0809-10-09T10:50:00Z", sign: "Sag" },
    { t: "0829-06-08T14:37:00Z", sign: "Leo" },
    { t: "0848-05-19T04:52:00Z", sign: "Pis" },
    { t: "0868-12-28T18:56:00Z", sign: "Sag" },
    { t: "0888-09-12T17:21:00Z", sign: "Leo" },
    { t: "0908-03-18T16:31:00Z", sign: "Ari" },
    { t: "0928-10-30T23:03:00Z", sign: "Sag" },
    { t: "0948-08-02T12:24:00Z", sign: "Leo" },
    { t: "0967-06-30T12:35:00Z", sign: "Ari" },
    { t: "0988-01-21T17:11:00Z", sign: "Sag" },
    { t: "1007-11-14T00:38:00Z", sign: "Vir" },
    { t: "1027-04-26T07:41:00Z", sign: "Ari" },
    { t: "1047-11-24T21:37:00Z", sign: "Cap" },
    { t: "1067-09-25T14:20:00Z", sign: "Vir" },
    { t: "1087-03-04T08:21:00Z", sign: "Tau" },
    { t: "1107-02-16T21:51:00Z", sign: "Cap" },
    { t: "1127-08-14T07:10:00Z", sign: "Vir" },
    { t: "1146-06-11T04:38:00Z", sign: "Tau" },
    { t: "1166-12-18T20:29:00Z", sign: "Cap" },
    { t: "1186-11-15T08:30:00Z", sign: "Lib" },
    { t: "1206-04-23T19:17:00Z", sign: "Tau" },
    { t: "1226-03-12T04:18:00Z", sign: "Aqu" },
    { t: "1246-09-28T21:06:00Z", sign: "Lib" },
    { t: "1265-08-01T10:35:00Z", sign: "Gem" },
    { t: "1286-01-07T21:25:00Z", sign: "Aqu" },
    { t: "1306-01-02T11:48:00Z", sign: "Sco" },
    { t: "1325-06-09T18:01:00Z", sign: "Gem" },
    { t: "1345-04-01T12:01:00Z", sign: "Aqu" },
    { t: "1365-11-02T11:42:00Z", sign: "Sco" },
    { t: "1385-04-17T04:08:00Z", sign: "Gem" },
    { t: "1405-01-25T20:01:00Z", sign: "Aqu" },
    { t: "1425-02-23T14:31:00Z", sign: "Sco" },
    { t: "1444-07-23T03:28:00Z", sign: "Can" },
    { t: "1464-04-17T08:01:00Z", sign: "Pis" },
    { t: "1484-11-27T17:20:00Z", sign: "Sco" },
    { t: "1504-06-04T05:35:00Z", sign: "Can" },
    { t: "1524-02-10T06:13:00Z", sign: "Pis" },
    { t: "1544-09-28T02:39:00Z", sign: "Sco" },
    { t: "1563-09-04T17:53:00Z", sign: "Can" },
    { t: "1583-05-03T00:32:00Z", sign: "Pis" },
    { t: "1603-12-18T06:52:00Z", sign: "Sag" },
    { t: "1623-07-16T22:40:00Z", sign: "Leo" },
    { t: "1643-02-24T23:12:00Z", sign: "Pis" },
    { t: "1663-10-16T23:47:00Z", sign: "Sag" },
    { t: "1682-10-24T07:38:00Z", sign: "Leo" },
    { t: "1702-05-21T20:55:00Z", sign: "Ari" },
    { t: "1723-01-05T15:14:00Z", sign: "Sag" },
    { t: "1742-08-30T20:51:00Z", sign: "Leo" },
    { t: "1762-03-18T16:40:00Z", sign: "Ari" },
    { t: "1782-11-05T09:25:00Z", sign: "Sag" },
    { t: "1802-07-17T22:47:00Z", sign: "Vir" },
    { t: "1821-06-19T17:12:00Z", sign: "Ari" },
    { t: "1842-01-26T06:11:00Z", sign: "Cap" },
    { t: "1861-10-21T12:25:00Z", sign: "Vir" },
    { t: "1881-04-18T13:37:00Z", sign: "Tau" },
    { t: "1901-11-28T16:28:00Z", sign: "Cap" },
    { t: "1921-09-10T04:13:00Z", sign: "Vir" },
    { t: "1940-08-08T01:23:00Z", sign: "Tau" },
    { t: "1961-02-19T00:01:00Z", sign: "Cap" },
    { t: "1980-12-31T21:24:00Z", sign: "Lib" },
    { t: "2000-05-28T16:03:00Z", sign: "Tau" },
    { t: "2020-12-21T18:20:00Z", sign: "Aqu" },
    { t: "2040-10-31T11:47:00Z", sign: "Lib" },
    { t: "2060-04-07T22:30:00Z", sign: "Gem" },
    { t: "2080-03-15T01:31:00Z", sign: "Aqu" },
    { t: "2100-09-18T22:32:00Z", sign: "Lib" },
    { t: "2119-07-15T23:25:00Z", sign: "Gem" },
    { t: "2140-01-14T16:03:00Z", sign: "Aqu" },
    { t: "2159-12-21T03:06:00Z", sign: "Sco" },
    { t: "2179-05-28T03:15:00Z", sign: "Gem" },
    { t: "2199-04-07T22:35:00Z", sign: "Aqu" },
    { t: "2219-10-31T23:04:00Z", sign: "Sco" },
    { t: "2238-09-07T16:40:00Z", sign: "Can" },
    { t: "2259-02-03T02:53:00Z", sign: "Pis" },
    { t: "2279-02-06T17:30:00Z", sign: "Sco" },
    { t: "2298-07-12T18:58:00Z", sign: "Can" },
    { t: "2318-04-27T06:34:00Z", sign: "Pis" },
    { t: "2338-12-02T06:18:00Z", sign: "Sag" },
    { t: "2358-05-23T04:39:00Z", sign: "Can" },
    { t: "2378-02-18T22:56:00Z", sign: "Pis" },
    { t: "2398-10-02T21:35:00Z", sign: "Sag" }
  ];

  // -----------------------------
  // 2) Authoritative element map
  // -----------------------------
  const SIGN_TO_ELEMENT = {
    Ari: "Fire", Leo: "Fire", Sag: "Fire",
    Tau: "Earth", Vir: "Earth", Cap: "Earth",
    Gem: "Air",  Lib: "Air",  Aqu: "Air",
    Can: "Water", Sco: "Water", Pis: "Water"
  };

  // -----------------------------
  // 3) Element shift anchors (your chosen “starts here” years)
  // -----------------------------
  const ELEMENT_SHIFT_YEARS = new Set([
    74,   // 0074 Fire
    253,  // 0253 Earth
    452,  // 0452 Air
    630,  // 0630 Water
    868,  // 0868 Fire
    1047, // 1047 Earth
    1226, // 1226 Air
    1425, // 1425 Water
    1663, // 1663 Fire
    1842, // 1842 Earth
    2020, // 2020 Air
    2219, // 2219 Water
    2398  // 2398 Fire
  ]);

  // -----------------------------
  // 4) Crisis auto-marking
  // -----------------------------
  const CRISIS_ANCHOR_YEAR = 2020;

  function yearFromISO(t) {
    return Number(String(t).slice(0, 4));
  }

  const crisisAnchorIndex = RAW_SA_JU.findIndex((e) => yearFromISO(e.t) === CRISIS_ANCHOR_YEAR);

  // -----------------------------
  // 5) Enrich
  // -----------------------------
  const SA_JU = RAW_SA_JU.map((e, i) => {
    const year = yearFromISO(e.t);
    const element = SIGN_TO_ELEMENT[e.sign];

    const forcedElementShift = ELEMENT_SHIFT_YEARS.has(year);
    const autoCrisis = (crisisAnchorIndex >= 0) ? (((i - crisisAnchorIndex) % 4) === 0) : false;

    return {
      ...e,
      element,
      elementShift: (typeof e.elementShift === "boolean") ? e.elementShift : forcedElementShift,
      crisis: (typeof e.crisis === "boolean") ? e.crisis : autoCrisis
    };
  });

  // -----------------------------
  // 6) Publish (legacy + new registry)
  // -----------------------------
  // Legacy consumers
  window.RAW_CONJUNCTION_DATA = RAW_SA_JU;
  window.CONJUNCTION_DATA = SA_JU;

  // New registry for cycle swapping
  window.CONJUNCTION_DATASETS = window.CONJUNCTION_DATASETS || {};
  window.CONJUNCTION_DATASETS["Saturn|Jupiter"] = { p1: "Saturn", p2: "Jupiter", events: SA_JU };
  window.CONJUNCTION_DATASETS["Jupiter|Saturn"] = window.CONJUNCTION_DATASETS["Saturn|Jupiter"];
})();