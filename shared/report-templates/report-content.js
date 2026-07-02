/*
 * report-content.js — Saeculum report prose library
 *
 * Pure Strauss-Howe, anchored to the Saturn-Jupiter conjunction cycle.
 * 4 conjunctions = 1 full saeculum (~80 years).
 * Each conjunction starts the next turning:
 *   CRISIS → HIGH → AWAKENING → UNRAVELING → CRISIS (repeat)
 *
 * Crisis anchor: 2020 (Great Conjunction in Aquarius).
 * Every 4th conjunction back also marks crisis:
 *   1940 (WWII), 1861 (Civil War), 1782 (American Rev), ...
 *
 * Generations align to which turning they were born into.
 */

const REPORT_CONTENT = {

  // ── TURNING PROFILES ──
  // Each turning spans one Saturn-Jupiter conjunction interval (~20 years)
  turnings: {

    crisis: {
      label: 'The 4th Turning — Crisis',
      summary: `A society-wide existential threat demands collective action. The old order disintegrates; a new one is forged in emergency. Institutions either transform or collapse. Generational memory is seared by shared sacrifice.`,
      character: 'necessity, emergency, collective action, transformation through pressure',
      known: [
        '1782–1802: American Revolution & Constitutional founding',
        '1861–1881: Civil War & Reconstruction',
        '1940–1961: Great Depression recovery, WWII, Cold War onset',
        '2020–2040: The current Crisis'
      ]
    },

    high: {
      label: 'The 1st Turning — High',
      summary: `Society rebuilds with strong institutions, shared purpose, and optimistic consensus. The postwar boom. Trust in systems peaks. Economic expansion and social cohesion define the era. The Hero generation that fought the crisis now builds the new order.`,
      character: 'rebuilding, consensus, institutional strength, optimism',
      known: [
        '1802–1821: Jeffersonian democracy, westward expansion',
        '1881–1901: Gilded Age, industrialization, Robber Barons',
        '1961–1980: Postwar boom, space program, civil rights legislation'
      ]
    },

    awakening: {
      label: 'The 2nd Turning — Awakening',
      summary: `The spiritual and cultural revolt against the very institutions the previous generation built. Individual authenticity becomes the highest value. Social movements, artistic explosion, and the questioning of all authority define the era.`,
      character: 'rebellion, authenticity, cultural transformation, inner truth',
      known: [
        '1821–1842: Transcendentalist & Abolitionist movements',
        '1901–1921: Progressive Era, women\'s suffrage, labor movements',
        '1980–2000: Consciousness Revolution, digital frontier, culture wars'
      ]
    },

    unraveling: {
      label: 'The 3rd Turning — Unraveling',
      summary: `The institutions built after the Crisis grow brittle. Trust erodes. Individualism becomes atomization. Society fragments. The center cannot hold. The unraveling sets the stage for the next Crisis — which resets the cycle.`,
      character: 'fragmentation, distrust, decline of institutions, preparation for crisis',
      known: [
        '1842–1861: Antebellum sectionalism, pre-Civil War fracture',
        '1921–1940: Roaring 20s, dust bowl, Great Depression lead-up',
        '2000–2020: Digital fragmentation, culture wars, pre-2020 decay'
      ]
    }

  },

  // ── GENERATION PROFILES ──
  // Defined by which turning their birth years fall into
  generations: {

    'Boomers': {
      years: '1946–1964',
      bornInto: 'high',
      archetype: 'Prophet',
      summary: `Born into the postwar HIGH, raised in optimism and institutional trust. Came of age during AWAKENING — and led the rebellion against the very world their parents built. The Prophet generation defined by their crusade for authenticity.`,
      comeOfAge: 'Awakening (1960s–70s cultural revolution)',
      elderYears: 'Crisis (2020 onward)',
      atTwenty: function(birthYear) { return `At 20, you came of age during the AWAKENING — the cultural revolution of the 1960s and 70s. The world was questioning everything, and you were at the center of it.`; }
    },

    'Gen X': {
      years: '1965–1980',
      bornInto: 'awakening',
      archetype: 'Nomad',
      summary: `Born during AWAKENING, raised in the UNRAVELING. The latchkey generation — first to navigate a world where both parents worked, divorce was normal, and institutions were visibly failing. The Nomad archetype: self-reliant, skeptical, adaptive.`,
      comeOfAge: 'Unraveling (1980s–90s)',
      elderYears: 'Crisis (2020 onward)',
      atTwenty: function(birthYear) { return `At 20, you came of age during the UNRAVELING — the 80s and 90s. Cold War ended, culture fragmented, and you learned that the only person you could count on was yourself.`; }
    },

    'Millennials': {
      years: '1981–1996',
      bornInto: 'unraveling',
      archetype: 'Hero',
      summary: `Born into UNRAVELING, protected in childhood, then thrown into a world of 9/11, two wars, financial collapse, and pandemic as young adults. The new Hero generation — carries the burden of fixing systems they didn't break. The most educated and most financially precarious generation.`,
      comeOfAge: 'Crisis onset (2008 crash, 2020 pandemic)',
      elderYears: 'High (2040s–60s rebuilding)',
      atTwenty: function(birthYear) { return `At 20, the world you inherited was already unraveling. You came of age through 9/11, war, economic collapse, and pandemic — the opening shocks of a new CRISIS. Your generation was forged in instability.`; }
    },

    'Gen Z': {
      years: '1997–2012',
      bornInto: 'crisis',
      archetype: 'Artist',
      summary: `Born at the 2020 CRISIS conjunction. The first generation to never know a world before digital ubiquity, climate awareness, and perpetual crisis. As Artists, they curate meaning in a fragmented world. They value authenticity above all and have zero patience for institutions that pretend to have answers.`,
      comeOfAge: 'Crisis (2020s)',
      elderYears: 'Awakening (2060s)',
      atTwenty: function(birthYear) { return `At 20, the CRISIS is your normal. You never knew the world before. Your formative years were masks, remote school, economic uncertainty, and the sense that the ground is always shifting. This is not a weakness — it's what makes you fluent in change.`; }
    },

    'Gen Alpha': {
      years: '2013–2028',
      bornInto: 'crisis',
      archetype: 'Prophet',
      summary: `Born into the CRISIS, will come of age as it resolves into a new HIGH. The Prophet generation of the next cycle — they will articulate what the post-crisis world should look like. Their earliest memories will be of a world in emergency. Their life's work will be building what comes after.`,
      comeOfAge: 'High (2040s–60s)',
      elderYears: 'Unraveling (2080s)',
      atTwenty: function(birthYear) { return `You will come of age during the HIGH — the post-crisis rebuilding. Your childhood in the CRISIS will give you a perspective the builders of that new world will need: you remember why the old one fell.`; }
    },

    'Lost Generation': {
      years: '1883–1900',
      bornInto: 'awakening',
      archetype: 'Nomad',
      summary: `Came of age during the UNRAVELING of the 1910s–20s. The generation that fought WWI and lived through the Great Depression. Lost in the sense that their pre-war world was permanently destroyed.`
    },

    'GI Generation': {
      years: '1901–1927',
      bornInto: 'unraveling',
      archetype: 'Hero',
      summary: `The archetypal Hero generation. Fought WWII, built the postwar order. They didn't just survive the Crisis — they won it and built the institutions that defined American power for 80 years.`
    },

    'Silent Generation': {
      years: '1928–1945',
      bornInto: 'crisis',
      archetype: 'Artist',
      summary: `Born during the CRISIS (WWII era), too young to fight, too old for the 60s. The Silent generation adapted to a world built by their Hero parents. Their gift: diplomacy, patience, and the understated wisdom that held the center.`
    }

  },

  // ── REPORT GENERATOR ──
  generateReport: function(birthYear) {
    const year = parseInt(birthYear, 10);
    if (isNaN(year) || year < 1880 || year > 2050) {
      return { error: 'Year out of range (1880–2050)' };
    }

    // Determine which turning the person was born into
    // Conjunction years mark turning boundaries
    const conjunctions = [
      { year: 1782, turning: 'crisis' },
      { year: 1802, turning: 'high' },
      { year: 1821, turning: 'awakening' },
      { year: 1842, turning: 'unraveling' },
      { year: 1861, turning: 'crisis' },
      { year: 1881, turning: 'high' },
      { year: 1901, turning: 'awakening' },
      { year: 1921, turning: 'unraveling' },
      { year: 1940, turning: 'crisis' },
      { year: 1961, turning: 'high' },
      { year: 1980, turning: 'awakening' },
      { year: 2000, turning: 'unraveling' },
      { year: 2020, turning: 'crisis' },
      { year: 2040, turning: 'high' },
      { year: 2060, turning: 'awakening' },
      { year: 2080, turning: 'unraveling' },
    ];

    // Find which turning the birth year falls into
    let bornTurning = conjunctions[0].turning;
    for (let i = 1; i < conjunctions.length; i++) {
      if (year >= conjunctions[i].year) {
        bornTurning = conjunctions[i].turning;
      } else break;
    }

    // Current turning (based on 2026)
    let currentTurning = 'crisis';
    for (let i = 1; i < conjunctions.length; i++) {
      if (2026 >= conjunctions[i].year) {
        currentTurning = conjunctions[i].turning;
      } else break;
    }

    // Find the generation
    const genMap = {
      'Lost Generation': { start: 1883, end: 1900 },
      'GI Generation': { start: 1901, end: 1927 },
      'Silent Generation': { start: 1928, end: 1945 },
      'Boomers': { start: 1946, end: 1964 },
      'Gen X': { start: 1965, end: 1980 },
      'Millennials': { start: 1981, end: 1996 },
      'Gen Z': { start: 1997, end: 2012 },
      'Gen Alpha': { start: 2013, end: 2028 },
    };

    let generation = null;
    for (const [name, range] of Object.entries(genMap)) {
      if (year >= range.start && year <= range.end) {
        generation = this.generations[name];
        generation.name = name;
        break;
      }
    }

    const turningProfile = this.turnings[bornTurning];
    const currentProfile = this.turnings[currentTurning];
    const bornConj = conjunctions.find(c => c.turning === bornTurning);
    const currentConj = conjunctions.find(c => c.turning === currentTurning);

    // Life phases across the saeculum
    const lifePhases = [];
    for (let age = 0; age <= 80; age += 20) {
      const phaseYear = year + age;
      let phaseTurning = conjunctions[0].turning;
      for (let i = 1; i < conjunctions.length; i++) {
        if (phaseYear >= conjunctions[i].year) phaseTurning = conjunctions[i].turning;
      }
      lifePhases.push({
        age, year: phaseYear,
        turning: phaseTurning,
        label: this.turnings[phaseTurning].label
      });
    }

    const age = 2026 - year;

    // Saturn-Jupiter conjunctions near birth (±30 years)
    const nearbyConj = conjunctions.filter(c => Math.abs(c.year - year) <= 35);

    return {
      birthYear: year,
      currentYear: 2026,
      age,
      bornTurning,
      bornTurningLabel: turningProfile.label,
      bornTurningSummary: turningProfile.summary,
      bornTurningCharacter: turningProfile.character,
      bornTurningKnown: turningProfile.known,
      currentTurning,
      currentTurningLabel: currentProfile.label,
      currentTurningSummary: currentProfile.summary,
      generation: generation ? {
        name: generation.name,
        years: generation.years,
        archetype: generation.archetype,
        summary: generation.summary,
        comeOfAge: generation.comeOfAge,
        elderYears: generation.elderYears,
        atTwenty: generation.atTwenty ? generation.atTwenty(year) : ''
      } : null,
      lifePhases,
      nearbyConjunctions: nearbyConj,
      saeculumCycleNumber: Math.floor((2020 - bornConj.year) / 80) + 1,
    };
  }
};

if (typeof module !== 'undefined' && module.exports) module.exports = REPORT_CONTENT;
if (typeof window !== 'undefined') window.REPORT_CONTENT = REPORT_CONTENT;