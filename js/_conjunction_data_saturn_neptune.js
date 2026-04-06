// _conjunction_data_saturn_neptune.js
// Saturn ☌ Neptune — exact conjunctions (geocentric tropical)
// Source: Astropro / Richard Nolle table (600 BCE–2400 CE). See citations in chat.
//
// Notes:
// - We only need {t, sign}. The renderer derives element from sign.
// - Timestamps are stored as ISO Z for consistency with existing datasets.

(function () {
	// abbrev style matches your Saturn–Jupiter dataset: Ari, Tau, Gem, Can, Leo, Vir, Lib, Sco, Sag, Cap, Aqu, Pis
	const RAW_SA_NE = [
		{ t: "0016-12-08T14:52:00Z", sign: "Sag" },
		{ t: "0053-02-20T06:12:00Z", sign: "Pis" },
		{ t: "0088-05-17T23:18:00Z", sign: "Gem" },
		{ t: "0123-08-12T11:17:00Z", sign: "Leo" },
		{ t: "0159-10-27T03:19:00Z", sign: "Sco" },

		{ t: "0196-02-26T02:31:00Z", sign: "Cap" },
		{ t: "0196-08-25T16:57:00Z", sign: "Cap" },
		{ t: "0196-10-28T02:03:00Z", sign: "Cap" },

		{ t: "0232-03-24T18:14:00Z", sign: "Ari" },
		{ t: "0267-06-06T09:29:00Z", sign: "Can" },
		{ t: "0302-10-01T11:34:00Z", sign: "Vir" },

		{ t: "0339-01-26T06:18:00Z", sign: "Sag" },
		{ t: "0339-06-05T13:55:00Z", sign: "Sag" },
		{ t: "0339-10-09T09:53:00Z", sign: "Sag" },

		{ t: "0375-05-28T09:10:00Z", sign: "Pis" },
		{ t: "0375-07-10T09:40:00Z", sign: "Pis" },
		{ t: "0376-01-17T01:35:00Z", sign: "Pis" },

		{ t: "0411-04-24T15:55:00Z", sign: "Tau" },
		{ t: "0446-07-13T20:16:00Z", sign: "Leo" },

		{ t: "0481-12-28T10:28:00Z", sign: "Lib" },
		{ t: "0482-03-25T16:15:00Z", sign: "Lib" },
		{ t: "0482-09-06T09:24:00Z", sign: "Lib" },

		{ t: "0519-01-17T01:36:00Z", sign: "Cap" },
		{ t: "0555-03-18T10:46:00Z", sign: "Ari" },
		{ t: "0590-06-02T23:18:00Z", sign: "Gem" },
		{ t: "0625-09-14T01:46:00Z", sign: "Vir" },
		{ t: "0661-12-17T03:57:00Z", sign: "Sag" },

		{ t: "0698-05-06T00:29:00Z", sign: "Aqu" },
		{ t: "0698-07-06T22:50:00Z", sign: "Aqu" },
		{ t: "0699-01-02T18:18:00Z", sign: "Aqu" },

		{ t: "0734-05-06T12:38:00Z", sign: "Tau" },
		{ t: "0769-07-18T05:44:00Z", sign: "Leo" },

		{ t: "0804-12-07T15:02:00Z", sign: "Lib" },
		{ t: "0805-03-25T11:30:00Z", sign: "Lib" },
		{ t: "0805-08-17T01:52:00Z", sign: "Lib" },

		{ t: "0841-12-16T19:47:00Z", sign: "Cap" },
		{ t: "0878-03-09T17:57:00Z", sign: "Pis" },
		{ t: "0913-06-07T17:45:00Z", sign: "Gem" },
		{ t: "0948-09-02T01:09:00Z", sign: "Vir" },
		{ t: "0984-11-12T03:15:00Z", sign: "Sco" },

		{ t: "1021-03-10T15:03:00Z", sign: "Aqu" },
		{ t: "1021-08-23T10:15:00Z", sign: "Aqu" },
		{ t: "1021-11-14T21:28:00Z", sign: "Aqu" },

		{ t: "1057-04-16T14:59:00Z", sign: "Tau" },
		{ t: "1092-06-28T07:26:00Z", sign: "Can" },
		{ t: "1127-10-24T07:00:00Z", sign: "Lib" },

		{ t: "1164-02-11T19:43:00Z", sign: "Sag" },
		{ t: "1164-06-02T02:41:00Z", sign: "Sag" },
		{ t: "1164-10-23T23:30:00Z", sign: "Sag" },

		{ t: "1200-06-10T02:43:00Z", sign: "Pis" },
		{ t: "1200-07-12T14:09:00Z", sign: "Pis" },
		{ t: "1201-01-26T03:09:00Z", sign: "Pis" },

		{ t: "1236-05-11T22:28:00Z", sign: "Gem" },
		{ t: "1271-07-27T22:05:00Z", sign: "Leo" },

		{ t: "1307-01-16T10:35:00Z", sign: "Sco" },
		{ t: "1307-03-21T23:12:00Z", sign: "Sco" },
		{ t: "1307-09-20T07:43:00Z", sign: "Sco" },

		{ t: "1344-01-22T14:50:00Z", sign: "Aqu" },
		{ t: "1380-03-21T16:43:00Z", sign: "Ari" },
		{ t: "1415-06-13T21:51:00Z", sign: "Can" },
		{ t: "1450-09-19T06:51:00Z", sign: "Vir" },
		{ t: "1486-12-22T21:13:00Z", sign: "Sag" },

		{ t: "1523-04-30T05:43:00Z", sign: "Pis" },
		{ t: "1523-08-01T15:38:00Z", sign: "Pis" },
		{ t: "1524-01-03T15:35:00Z", sign: "Pis" },

		{ t: "1559-05-11T15:05:00Z", sign: "Tau" },
		{ t: "1594-08-07T05:02:00Z", sign: "Leo" },

		{ t: "1629-12-19T15:47:00Z", sign: "Sco" },
		{ t: "1630-04-22T01:20:00Z", sign: "Sco" },
		{ t: "1630-08-29T09:45:00Z", sign: "Sco" },

		{ t: "1667-01-02T10:23:00Z", sign: "Cap" },
		{ t: "1703-03-27T23:32:00Z", sign: "Ari" },
		{ t: "1738-07-02T05:53:00Z", sign: "Can" },
		{ t: "1773-09-27T08:31:00Z", sign: "Vir" },

		{ t: "1809-12-01T15:20:00Z", sign: "Sag" },

		{ t: "1846-04-04T01:44:00Z", sign: "Aqu" },
		{ t: "1846-09-05T01:35:00Z", sign: "Aqu" },
		{ t: "1846-12-11T09:26:00Z", sign: "Aqu" },

		{ t: "1882-05-12T17:07:00Z", sign: "Tau" },
		{ t: "1917-08-01T05:22:00Z", sign: "Leo" },

		{ t: "1952-11-21T13:26:00Z", sign: "Lib" },
		{ t: "1953-05-17T17:10:00Z", sign: "Lib" },
		{ t: "1953-07-22T01:44:00Z", sign: "Lib" },

		{ t: "1989-03-03T12:08:00Z", sign: "Cap" },
		{ t: "1989-06-24T01:24:00Z", sign: "Cap" },
		{ t: "1989-11-13T12:50:00Z", sign: "Cap" },

		{ t: "2026-02-20T19:04:00Z", sign: "Ari" },
		{ t: "2061-06-07T06:42:00Z", sign: "Gem" },
		{ t: "2096-08-27T09:29:00Z", sign: "Vir" }
	];

	// Register in the global dataset map used by the cycle swapper
	window.CONJUNCTION_DATASETS = window.CONJUNCTION_DATASETS || {};
	window.CONJUNCTION_DATASETS["Saturn|Neptune"] = { p1: "Saturn", p2: "Neptune", events: RAW_SA_NE };
	window.CONJUNCTION_DATASETS["Neptune|Saturn"] = window.CONJUNCTION_DATASETS["Saturn|Neptune"];
})();