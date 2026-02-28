/* render-river-3d.js — MINIMAL RIVER ONLY (no mist / no label river / no waterfall)
   Requires: window.THREE (Three.js already loaded)

   Exposes:
     River3D.init(containerId)
     River3D.resize()
     River3D.update({ dt, yearsPerSec, dateUTC, scrollX })
     River3D.setBand(topPx, bottomPx)                 // SCREEN px from TOP
     River3D.setXEdge(screenXPx)                      // SCREEN px from LEFT (NOW boundary)
     River3D.setXClip(leftScreenPx, rightScreenPx)    // SCREEN px from LEFT
     River3D._config

   Notes:
   - River always flows a little even at yearsPerSec = 0 (baseFlowPxPerSec).
   - If your caller sometimes passes px/sec instead of years/sec, values > pxPerYear*20
     are treated as px/sec (keeps it compatible with older controllers).
*/
(function () {
  if (!window.THREE) {
    console.warn("[River3D] THREE not found.");
    return;
  }

  // ╔══════════════════════════════════════════════════════════════╗
  // ║ CONFIG — tuneables                                             ║
  // ╚══════════════════════════════════════════════════════════════╝
  const CONFIG = {
    // particle look
    riverCount: 520,
    riverSize: 0.9,
    riverOpacity: 0.55,
    riverYSpread: 0.92,          // fraction of band height used (0..1)

    // speed mapping
    pxPerYear: 5,                // timeline pixels per year (your scale)
    baseFlowPxPerSec: 1.2,       // always-on flow even when paused/0.00
    flowRatio: 1.10,             // multiplier on screw-derived speed
    logK: 120,                   // log knee (px/sec)
    logGain: 0.35,               // how much extra log boost
    maxFlowPxPerSec: 320,        // safety cap

    // small shimmer so it doesn't look rigid
    yJitterAmp: 0.20,            // px
    yJitterHz: 1.7,

    // dt safety
    maxDt: 0.05,
  };

  // ╔══════════════════════════════════════════════════════════════╗
  // ║ STATE                                                         ║
  // ╚══════════════════════════════════════════════════════════════╝
  let container = null;
  let renderer = null;
  let scene = null;
  let camera = null;

  let riverPoints = null;
  let riverPos = null;

  let _t = 0;

  // Band in SCREEN px from TOP: { topPx, heightPx }
  let _band = null;

  // NOW boundary in SCREEN px from LEFT
  let _xEdgePx = null;

  // X clip in SCREEN px from LEFT: { leftPx, rightPx }
  let _xClip = null;

  function getContainerRect() {
    return container ? container.getBoundingClientRect() : null;
  }

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  // ╔══════════════════════════════════════════════════════════════╗
  // ║ RENDERER / CAMERA                                              ║
  // ╚══════════════════════════════════════════════════════════════╝
  function makeRenderer() {
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    r.setPixelRatio(window.devicePixelRatio || 1);
    r.setClearColor(0x000000, 0);
    r.autoClear = true;
    return r;
  }

  function makeCamera(w, bandH) {
    const halfW = w / 2;
    const halfH = bandH / 2;
    const cam = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, -1000, 1000);
    cam.position.set(0, 0, 10);
    cam.lookAt(0, 0, 0);
    return cam;
  }

  // ╔══════════════════════════════════════════════════════════════╗
  // ║ RIVER GEOMETRY                                                 ║
  // ╚══════════════════════════════════════════════════════════════╝
  function makeRiver(count) {
    const geom = new THREE.BufferGeometry();
    riverPos = new Float32Array(count * 3);
    geom.setAttribute("position", new THREE.BufferAttribute(riverPos, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: CONFIG.riverSize,
      transparent: true,
      opacity: CONFIG.riverOpacity,
      depthWrite: false,
      depthTest: false, // keep it reliably visible behind SVG layers
      blending: THREE.AdditiveBlending,
    });

    riverPoints = new THREE.Points(geom, mat);
    scene.add(riverPoints);
  }

  function seedRiver() {
    if (!container || !riverPos) return;
    const cr = getContainerRect();
    if (!cr) return;

    const w = Math.max(1, Math.floor(cr.width));
    const bandH = (_band && _band.heightPx > 5) ? _band.heightPx : 220;
    const halfW = w / 2;

    // convert clip bounds to centered coords (camera space)
    let leftBound = -halfW;
    let rightBound = halfW;
    if (_xClip) {
      leftBound = ((_xClip.leftPx - cr.left) - halfW);
      rightBound = ((_xClip.rightPx - cr.left) - halfW);
    }

    for (let i = 0; i < CONFIG.riverCount; i++) {
      const idx = i * 3;
      const x = leftBound + Math.random() * (rightBound - leftBound);
      const y = (Math.random() - 0.5) * bandH * CONFIG.riverYSpread;

      riverPos[idx + 0] = x;
      riverPos[idx + 1] = y;
      riverPos[idx + 2] = 0;
    }

    riverPoints.geometry.attributes.position.needsUpdate = true;
  }

  // ╔══════════════════════════════════════════════════════════════╗
  // ║ SIZE / LAYOUT                                                  ║
  // ╚══════════════════════════════════════════════════════════════╝
  function resize() {
    if (!renderer || !container) return;

    const cr = getContainerRect();
    if (!cr) return;

    const w = Math.max(1, Math.floor(cr.width));
    const bandH = (_band && _band.heightPx > 5) ? _band.heightPx : Math.max(1, Math.floor(cr.height));

    renderer.setSize(w, Math.max(1, Math.floor(cr.height)), false);
    camera = makeCamera(w, bandH);
  }

  // ╔══════════════════════════════════════════════════════════════╗
  // ║ SPEED                                                          ║
  // ╚══════════════════════════════════════════════════════════════╝
  function computeFlowPxPerSec(yearsPerSec) {
    const ypsAbs = Math.abs(Number(yearsPerSec) || 0);

    const pxPerYear = (CONFIG.pxPerYear != null) ? CONFIG.pxPerYear : 5;

    // Compatibility:
    // - If caller passes px/sec (big numbers), treat as px/sec.
    // - Else treat as years/sec.
    const screwPxPerSec = (ypsAbs > pxPerYear * 20) ? ypsAbs : (ypsAbs * pxPerYear);

    const logK = (CONFIG.logK != null) ? CONFIG.logK : 120;
    const logGain = (CONFIG.logGain != null) ? CONFIG.logGain : 0.35;

    const logBoost = (logK > 0)
      ? (Math.log1p(screwPxPerSec / logK) * logK)
      : screwPxPerSec;

    let flow = (CONFIG.baseFlowPxPerSec || 0)
      + (CONFIG.flowRatio || 1) * screwPxPerSec
      + logGain * logBoost;

    if (CONFIG.maxFlowPxPerSec != null) flow = Math.min(flow, CONFIG.maxFlowPxPerSec);
    return flow;
  }

  // ╔══════════════════════════════════════════════════════════════╗
  // ║ UPDATE / RENDER                                                ║
  // ╚══════════════════════════════════════════════════════════════╝
  function update({ dt = 0, yearsPerSec = 0 } = {}) {
    if (!renderer || !scene || !camera || !container || !riverPoints || !riverPos) return;

    const maxDt = (CONFIG.maxDt != null) ? CONFIG.maxDt : 0.05;

    dt = Number(dt);
    if (!Number.isFinite(dt) || dt <= 0) dt = 1 / 60;
    dt = Math.min(dt, maxDt);

    _t += dt;

    const cr = container.getBoundingClientRect();
    const w = Math.max(1, Math.floor(cr.width));
    const bandH = (_band && _band.heightPx > 5) ? _band.heightPx : 220;
    const halfBand = bandH / 2;

    // NOW boundary in centered coords (camera space)
    const xEdgeCentered = (() => {
      if (_xEdgePx == null) return (w / 2); // fallback
      const xRel = _xEdgePx - cr.left;      // screen -> container-local
      return xRel - (w / 2);                // local -> centered
    })();

    // clip bounds in centered coords
    const leftBound = (() => {
      if (!_xClip) return -w / 2;
      const xRel = _xClip.leftPx - cr.left;
      return xRel - (w / 2);
    })();
    const rightBound = (() => {
      if (!_xClip) return w / 2;
      const xRel = _xClip.rightPx - cr.left;
      return xRel - (w / 2);
    })();

    // flow right -> left
    const flowPxPerSec = computeFlowPxPerSec(yearsPerSec);
    const dx = flowPxPerSec * dt;

    const yAmp = (CONFIG.yJitterAmp != null) ? CONFIG.yJitterAmp : 0.2;
    const yHz = (CONFIG.yJitterHz != null) ? CONFIG.yJitterHz : 1.7;

    for (let i = 0; i < CONFIG.riverCount; i++) {
      const idx = i * 3;

      let x = riverPos[idx + 0];
      let y = riverPos[idx + 1];

      x -= dx;
      y += Math.sin(_t * yHz + i * 0.23) * yAmp * dt;

      // wrap: off left -> respawn near NOW boundary inside clip
      if (x < leftBound) {
        x = clamp(xEdgeCentered - Math.random() * 18, leftBound, rightBound);
        y = (Math.random() - 0.5) * bandH * CONFIG.riverYSpread;
      }

      x = clamp(x, leftBound, rightBound);
      y = clamp(y, -halfBand, halfBand);

      riverPos[idx + 0] = x;
      riverPos[idx + 1] = y;
      riverPos[idx + 2] = 0;
    }
    riverPoints.geometry.attributes.position.needsUpdate = true;

    // scissor render into the band (so it doesn't cover the whole page)
    if (_band && _band.heightPx > 5) {
      const pr = (renderer && typeof renderer.getPixelRatio === "function")
        ? renderer.getPixelRatio()
        : (window.devicePixelRatio || 1);

      const wPx = Math.max(1, Math.floor(window.innerWidth * pr));
      const hPx = Math.max(1, Math.floor(window.innerHeight * pr));

      const topPx = Math.max(0, Math.floor(_band.topPx * pr));
      const bandHp = Math.max(1, Math.floor(_band.heightPx * pr));

      const yFromBottom = Math.max(0, Math.floor(hPx - (topPx + bandHp)));

      renderer.setScissorTest(true);
      renderer.setScissor(0, yFromBottom, wPx, bandHp);
      renderer.setViewport(0, yFromBottom, wPx, bandHp);

      renderer.render(scene, camera);

      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, wPx, hPx);
    } else {
      renderer.render(scene, camera);
    }
  }

  // ╔══════════════════════════════════════════════════════════════╗
  // ║ PUBLIC API                                                     ║
  // ╚══════════════════════════════════════════════════════════════╝
  function init(containerId) {
    container = document.getElementById(containerId);
    if (!container) {
      console.warn("[River3D] container not found:", containerId);
      return;
    }

    renderer = makeRenderer();
    scene = new THREE.Scene();

    container.appendChild(renderer.domElement);

    makeRiver(CONFIG.riverCount);

    resize();
    seedRiver();

    window.addEventListener("resize", () => {
      resize();
      seedRiver();
    });
  }

  // Band in SCREEN px from TOP
  function setBand(topPx, bottomPx) {
    const t = Number(topPx);
    const b = Number(bottomPx);
    if (!Number.isFinite(t) || !Number.isFinite(b) || b <= t + 5) {
      _band = null;
      return;
    }
    const nt = Math.floor(t);
    const nh = Math.floor(b - t);

    if (_band && Math.abs(_band.topPx - nt) <= 1 && Math.abs(_band.heightPx - nh) <= 1) return;

    _band = { topPx: nt, heightPx: nh };
    resize();
    seedRiver();
  }

  // X edge in SCREEN px from LEFT
  function setXEdge(screenXPx) {
    const v = Number(screenXPx);
    if (!Number.isFinite(v)) return;

    const nv = Math.floor(v);
    if (_xEdgePx != null && Math.abs(_xEdgePx - nv) <= 1) return;

    _xEdgePx = nv;
    seedRiver();
  }

  // X clip in SCREEN px from LEFT
  function setXClip(leftScreenPx, rightScreenPx) {
    const l = Number(leftScreenPx);
    const r = Number(rightScreenPx);
    if (!Number.isFinite(l) || !Number.isFinite(r) || r <= l + 5) {
      _xClip = null;
      return;
    }

    const nl = Math.floor(l);
    const nr = Math.floor(r);

    if (_xClip && Math.abs(_xClip.leftPx - nl) <= 1 && Math.abs(_xClip.rightPx - nr) <= 1) return;

    _xClip = { leftPx: nl, rightPx: nr };
    seedRiver();
  }

  window.River3D = {
    init,
    resize,
    update,
    setBand,
    setXEdge,
    setXClip,
    _config: CONFIG,
  };
})();
