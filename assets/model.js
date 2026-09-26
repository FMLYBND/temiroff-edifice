/* Temiroff Edifice — «3D-стройка» (model.html).
   Сцена Three.js r147 (assets/vendor/three), данные — assets/model-data.js (window.EDIFICE_MODEL),
   статусы — из data.js / status.js через window.EDIFICE_STAGE (assets/app.js).
   Эталон: temiroff-edifice-3d.html; правки геометрии — docs/model-changelog.md. */
(function () {
  "use strict";

  const MD = window.EDIFICE_MODEL;
  const rootEl = document.getElementById("m-root");
  if (!rootEl || !MD) return;
  if (!window.THREE || !THREE.OrbitControls) {
    rootEl.insertAdjacentHTML("beforeend", '<div class="m-err">Не загрузился Three.js из assets/vendor/three. Проверь, что папка на месте.</div>');
    return;
  }

  const PI = Math.PI, V3 = THREE.Vector3;
  const { W, D, RC, TOP } = MD.dims;
  const LV = MD.levels;
  const LB = LV.basement, L1 = LV.f2, L2 = LV.f3, L3 = LV.roof, LT = LV.terrace, LR = LV.superRoof;
  const CX = RC, CZ = -RC;             // угол 1 этажа = центр скругления R1300
  const SE = D - RC;                   // длина фасада 2 до угла
  const zr = yr => -D + yr;            // план: yr — от тыльной стены
  const STAGES = MD.stages;
  const N = STAGES.length - 1;
  const FONT = 'Manrope, "Segoe UI", Roboto, Arial, sans-serif';

  /* ================= РЕНДЕРЕР ================= */
  const canvas = document.getElementById("m-scene");
  const mobile = matchMedia("(max-width:760px)").matches;
  const reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.82;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xdde5ec, 90, 230);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.3, 700);
  const controls = new THREE.OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.maxPolarAngle = PI * 0.495; controls.minDistance = 5; controls.maxDistance = 140;

  let envTex = null;
  if (THREE.RoomEnvironment) {
    const pm = new THREE.PMREMGenerator(renderer);
    envTex = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pm.dispose();
  }
  scene.add(new THREE.HemisphereLight(0xdce9f6, 0x8d8272, 0.3));
  const sun = new THREE.DirectionalLight(0xfff0da, 1.25);
  sun.position.set(-26, 38, 30); sun.target.position.set(6, 4, -8);
  scene.add(sun, sun.target);
  sun.castShadow = true;
  const shadowSize = mobile ? 1024 : 2048;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 5, far: 130 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;

  /* ================= ТЕКСТУРЫ ================= */
  function cv(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return [c, c.getContext("2d")]; }
  function tex(c, rx = 1, ry = 1) {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
    t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; return t;
  }
  function rnd(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

  const cageCanvas = (() => {
    const [c, g] = cv(128, 128);
    g.strokeStyle = "rgba(150,160,166,.95)"; g.lineWidth = 2;
    for (let i = 0; i < 128; i += 16) { g.beginPath(); g.moveTo(i + 1, 0); g.lineTo(i + 1, 128); g.moveTo(0, i + 1); g.lineTo(128, i + 1); g.stroke(); }
    g.strokeStyle = "#b4532c"; g.lineWidth = 7;
    [4, 68].forEach(p => { g.beginPath(); g.moveTo(p, 0); g.lineTo(p, 128); g.moveTo(0, p); g.lineTo(128, p); g.stroke(); });
    return c;
  })();
  const stoneCanvas = (() => {
    const [c, g] = cv(256, 128); const r = rnd(7);
    g.fillStyle = "#4a4845"; g.fillRect(0, 0, 256, 128);
    let y = 0;
    while (y < 128) {
      const h = 5 + Math.floor(r() * 9); let x = -Math.floor(r() * 40);
      while (x < 256) {
        const w = 24 + Math.floor(r() * 70); const v = 100 + Math.floor(r() * 70);
        g.fillStyle = `rgb(${v},${v - 3},${v - 8})`; g.fillRect(x + 1, y + 1, w - 2, h - 1.5); x += w;
      }
      y += h;
    }
    return c;
  })();
  const paveCanvas = (() => {
    const [c, g] = cv(256, 256); const r = rnd(3);
    g.fillStyle = "#9d9d9a"; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      const v = 196 + Math.floor(r() * 18); g.fillStyle = `rgb(${v},${v},${v - 3})`; g.fillRect(i * 128 + 2, j * 128 + 2, 124, 124);
    }
    return c;
  })();
  const profCanvas = (() => {
    const [c, g] = cv(64, 64); g.fillStyle = "#7d8c86"; g.fillRect(0, 0, 64, 64);
    for (let x = 0; x < 64; x += 16) { g.fillStyle = "#93a19b"; g.fillRect(x, 0, 6, 64); g.fillStyle = "#6a7872"; g.fillRect(x + 10, 0, 3, 64); }
    return c;
  })();
  function winCanvas(bg, win) {
    const [c, g] = cv(128, 128); g.fillStyle = bg; g.fillRect(0, 0, 128, 128);
    g.fillStyle = win; g.fillRect(34, 30, 60, 64); g.fillStyle = "rgba(255,255,255,.18)"; g.fillRect(34, 30, 60, 4); return c;
  }
  function logoCanvas() {
    const [c, g] = cv(512, 380);
    g.clearRect(0, 0, 512, 380);
    g.fillStyle = "#2a2c2e";
    const pts = [[0, 0], [148, 0], [192, 64], [192, 148], [188, 204], [131, 150], [131, 67], [90, 67], [74, 76]];
    const axis = 197, s = 440 / 394, ox = 256, oy = 10;
    function wing(sign) {
      g.beginPath();
      pts.forEach((p, i) => {
        const X = ox + sign * (p[0] - axis) * s, Y = oy + p[1] * s;
        if (i) g.lineTo(X, Y); else g.moveTo(X, Y);
      });
      g.closePath(); g.fill();
    }
    wing(1); wing(-1);
    function spaced(text, y, size, tracking) {
      g.font = "700 " + size + "px " + FONT;
      g.textBaseline = "alphabetic";
      const widths = Array.prototype.map.call(text, ch => g.measureText(ch).width);
      let total = tracking * (text.length - 1);
      widths.forEach(w => { total += w; });
      let x = ox - total / 2;
      for (let i = 0; i < text.length; i++) { g.fillText(text[i], x, y); x += widths[i] + tracking; }
    }
    const base = oy + 204 * s;
    spaced("TEMIROFF", base + 44, 36, 8);
    spaced("EDIFICE", base + 80, 22, 9);
    return c;
  }
  function signCanvas(txt) {
    const [c, g] = cv(512, 128); g.clearRect(0, 0, 512, 128); g.fillStyle = "#f4f4f2";
    g.font = "500 92px " + FONT; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(txt, 256, 68); return c;
  }

  /* ================= МАТЕРИАЛЫ ================= */
  const M = o => new THREE.MeshStandardMaterial(Object.assign({ envMapIntensity: 0.42 }, o));
  const mat = {
    concrete: M({ color: 0x9d9b95, roughness: 0.93 }),
    wall: M({ color: 0xd6d2ca, roughness: 0.95 }),
    wallBC: M({ color: 0xd9d5cd, roughness: 0.95 }),
    basement: M({ color: 0x8f8d88, roughness: 0.95 }),
    alu: M({ color: 0x9aa4ab, metalness: 0.55, roughness: 0.32 }),
    oldGlass: M({ color: 0x24343f, metalness: 0.6, roughness: 0.14 }),
    fibro: M({ color: 0xefebe4, roughness: 0.82, envMapIntensity: 0.4 }),
    fibro2: M({ color: 0xefebe4, roughness: 0.82, envMapIntensity: 0.4, side: THREE.DoubleSide }),
    plaster: M({ color: 0xe4e0d8, roughness: 0.92, envMapIntensity: 0.4 }),
    glass: M({ color: 0x3b4750, metalness: 0.95, roughness: 0.05, transparent: true, opacity: 0.6, envMapIntensity: 1.4, depthWrite: false, side: THREE.DoubleSide }),
    railing: M({ color: 0xa7bac3, metalness: 0.8, roughness: 0.05, transparent: true, opacity: 0.3, envMapIntensity: 1.2, depthWrite: false, side: THREE.DoubleSide }),
    frame: M({ color: 0x1f2225, metalness: 0.5, roughness: 0.45 }),
    slabEdge: M({ color: 0xc9c5bd, roughness: 0.8, side: THREE.DoubleSide }),
    steel: M({ color: 0x8e3f2a, metalness: 0.35, roughness: 0.55 }),
    liftSteel: M({ color: 0x2f6f8f, metalness: 0.4, roughness: 0.45 }),
    liftDoor: M({ color: 0xb08a4a, metalness: 0.8, roughness: 0.3 }),
    sandwich: M({ color: 0xe7eaeb, metalness: 0.15, roughness: 0.5 }),
    roofPanel: M({ color: 0xb6bcc0, metalness: 0.35, roughness: 0.45 }),
    screed: M({ color: 0xb5b0a8, roughness: 0.95 }),
    oldScreed: M({ color: 0x9f978a, roughness: 1 }),
    wood: M({ color: 0x5c4b3f, roughness: 0.85 }),
    deckWood: M({ color: 0x7a6554, roughness: 0.85 }),
    green: M({ color: 0x46743a, roughness: 0.9, flatShading: true }),
    greenDark: M({ color: 0x2d5130, roughness: 0.9, flatShading: true }),
    grass: M({ color: 0x7f9d57, roughness: 1 }),
    pot: M({ color: 0xcdc8bf, roughness: 0.9 }),
    orange: M({ color: 0xd6722f, roughness: 0.6 }),
    white: M({ color: 0xf2f2f0, roughness: 0.5 }),
    beige: M({ color: 0xe7ddd0, roughness: 0.8 }),
    asphalt: M({ color: 0x5d6064, roughness: 0.97 }),
    dirt: M({ color: 0xa99579, roughness: 1 }),
    redPave: M({ color: 0xb86b5d, roughness: 0.95 }),
    lineW: M({ color: 0xf0f0ea, roughness: 0.8 }),
    lineY: M({ color: 0xe0b53a, roughness: 0.8 }),
    brick: M({ color: 0x93594b, roughness: 0.95 }),
    garage: M({ color: 0x2c2f32, roughness: 0.8 }),
    stoneLight: M({ color: 0xb9b6b0, roughness: 0.9 }),
    crane: M({ color: 0xe0a020, roughness: 0.5, metalness: 0.3 }),
    craneDark: M({ color: 0x33373b, roughness: 0.6 }),
    conflict: new THREE.MeshBasicMaterial({ color: 0xc8452a, transparent: true, opacity: 0.55, depthWrite: false }),
    fence: M({ map: tex(profCanvas, 1, 1), metalness: 0.45, roughness: 0.45, side: THREE.DoubleSide }),
    cage: M({ map: tex(cageCanvas, 2, 2), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.3 }),
    logo: new THREE.MeshBasicMaterial({ map: tex(logoCanvas()), transparent: true, alphaTest: 0.3, toneMapped: false }),
    cafe: new THREE.MeshBasicMaterial({ map: tex(signCanvas("CAFE")), transparent: true, alphaTest: 0.3, toneMapped: false })
  };
  [mat.logo.map, mat.cafe.map].forEach(t => { t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; });
  // рентген: стекло почти прозрачно, армосетка скрыта (userData копируется в клоны материалов)
  mat.glass.userData.xr = 0.08; mat.railing.userData.xr = 0.08; mat.cage.userData.xr = 0.1;
  const stoneMat = (rx, ry) => M({ map: tex(stoneCanvas, rx, ry), roughness: 0.95 });
  const paveMat = (rx, ry) => M({ map: tex(paveCanvas, rx, ry), roughness: 0.95 });
  function cageMat(rx, ry) {
    const t = mat.cage.map.clone(); t.needsUpdate = true; t.repeat.set(rx, ry);
    const m = M({ map: t, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.6 }); m.userData.xr = 0.1; return m;
  }

  /* ================= ГЕОМЕТРИЯ: ПРИМИТИВЫ ================= */
  // коробка по двум углам; вырожденные (нулевой толщины) не создаются
  function bx(x0, y0, z0, x1, y1, z1, m, parent = scene, shadow = true) {
    const o = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)), m);
    o.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); o.castShadow = shadow; o.receiveShadow = true;
    if (Math.abs(x1 - x0) > 1e-4 && Math.abs(y1 - y0) > 1e-4 && Math.abs(z1 - z0) > 1e-4) parent.add(o);
    return o;
  }
  function pivotBox(x0, y0, z0, x1, y1, z1, m, axis, parent = scene) {
    const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
    const p = new V3(axis === "x" ? x0 : (x0 + x1) / 2, axis === "y" ? y0 : (y0 + y1) / 2, axis === "z" ? z1 : (z0 + z1) / 2);
    g.translate((x0 + x1) / 2 - p.x, (y0 + y1) / 2 - p.y, (z0 + z1) / 2 - p.z);
    const o = new THREE.Mesh(g, m); o.position.copy(p); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o;
  }
  function surf(x0, z0, x1, z1, y, m, parent = scene) {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0); g.rotateX(-PI / 2);
    const o = new THREE.Mesh(g, m); o.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); o.receiveShadow = true; parent.add(o); return o;
  }
  function group(parent = scene) { const g = new THREE.Group(); parent.add(g); return g; }
  function shell(o) { o.traverse(m => { if (m.isMesh) m.userData.shell = true; }); return o; }
  function xr(o, v) { o.traverse(m => { if (m.isMesh) m.userData.xr = v; }); return o; }
  function arcAt(cx, cz, r, y0, y1, t0, tl, m, parent = scene, seg = 28) {
    const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, y1 - y0, seg, 1, true, t0, tl), m);
    o.position.set(cx, (y0 + y1) / 2, cz); parent.add(o); return o;
  }
  const arcCyl = (r, y0, y1, m, parent = scene, seg = 28) => arcAt(CX, CZ, r, y0, y1, -PI / 2, PI / 2, m, parent, seg);
  function pane(G, x0, y0, x1, y1, lz = -0.12, m = mat.glass) {
    const o = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0), m); o.position.set((x0 + x1) / 2, (y0 + y1) / 2, lz); G.add(o); return o;
  }
  function mul(G, x0, y0, x1, y1, lz = -0.1, d = 0.07) { return bx(x0, y0, lz - d / 2, x1, y1, lz + d / 2, mat.frame, G, false); }

  // прямоугольник со скруглёнными углами [bl, br, tr, tl]; радиус — число или [rx, ry]
  function rr(x0, y0, x1, y1, c = [0, 0, 0, 0], p = new THREE.Path()) {
    const R = c.map(v => Array.isArray(v) ? v : [v, v]); const [bl, br, tr, tl] = R;
    p.moveTo(x0 + bl[0], y0); p.lineTo(x1 - br[0], y0);
    if (br[0]) p.absellipse(x1 - br[0], y0 + br[1], br[0], br[1], -PI / 2, 0, false);
    p.lineTo(x1, y1 - tr[1]);
    if (tr[0]) p.absellipse(x1 - tr[0], y1 - tr[1], tr[0], tr[1], 0, PI / 2, false);
    p.lineTo(x0 + tl[0], y1);
    if (tl[0]) p.absellipse(x0 + tl[0], y1 - tl[1], tl[0], tl[1], PI / 2, PI, false);
    p.lineTo(x0, y0 + bl[1]);
    if (bl[0]) p.absellipse(x0 + bl[0], y0 + bl[1], bl[0], bl[1], PI, 1.5 * PI, false);
    return p;
  }
  // проём 1 этажа с арочным верхом R400
  function notch(s, a, b, h = MD.facade.groundH, r = MD.facade.archR) {
    s.lineTo(a, 0); s.lineTo(a, h - r); s.absellipse(a + r, h - r, r, r, PI, PI / 2, true);
    s.lineTo(b - r, h); s.absellipse(b - r, h - r, r, r, PI / 2, 0, true); s.lineTo(b, 0);
  }
  const EXT = { depth: 0.15, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 3, curveSegments: 28 };
  // форма в плане (x, sy = −z)
  const planShape = (x0, sy0, x1, sy1, rFL, rFR) => rr(x0, sy0, x1, sy1, [rFL, rFR, 0, 0], new THREE.Shape());
  function belt(shape, y0, h, out, m, parent = scene) {
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.01, bevelEnabled: true, bevelThickness: h / 2, bevelSize: out, bevelSegments: 8, curveSegments: 32 });
    const o = new THREE.Mesh(g, m); o.rotation.x = -PI / 2; o.position.y = y0 + h / 2; o.castShadow = true; o.receiveShadow = true; parent.add(o); return o;
  }
  function slab(shape, y0, y1, m, parent = scene) {
    const g = new THREE.ExtrudeGeometry(shape, { depth: y1 - y0, bevelEnabled: false, curveSegments: 20 });
    const o = new THREE.Mesh(g, m); o.rotation.x = -PI / 2; o.position.y = y0; o.castShadow = true; o.receiveShadow = true; parent.add(o); return o;
  }

  /* ================= ФАСАДНЫЕ ФОРМЫ ================= */
  // фасад 1, 2–3 этажи: глухая панель под логотип слева (штукатурка)
  function hU1(x0) {
    const p = new THREE.Shape(); p.moveTo(x0, 3.6); p.lineTo(3.12, 3.6); p.absellipse(3.12, 4.08, 0.48, 0.48, -PI / 2, 0, false);
    p.lineTo(3.6, 7.2); p.quadraticCurveTo(3.64, 9.0, 3.9, 9.72); p.quadraticCurveTo(4.0, 10.1, 3.3, 10.1); p.lineTo(x0, 10.1); p.lineTo(x0, 3.6); return p;
  }
  // фасад 1, 2–3 этажи в плоскости консоли, x RC…W
  function frontUpper() {
    const s = new THREE.Shape(); s.moveTo(RC, 2.9); s.lineTo(W, 2.9); s.lineTo(W, TOP); s.lineTo(RC, TOP); s.lineTo(RC, 10.1); s.lineTo(3.3, 10.1);
    s.quadraticCurveTo(4.0, 10.1, 3.9, 9.72); s.quadraticCurveTo(3.64, 9.0, 3.6, 7.2); s.lineTo(3.6, 4.08);
    s.absellipse(3.12, 4.08, 0.48, 0.48, 0, -PI / 2, true); s.lineTo(RC, 3.6); s.lineTo(RC, 2.9);
    const u2 = new THREE.Path(); u2.moveTo(4.35, 3.6); u2.lineTo(11.82, 3.6); u2.lineTo(11.82, 10.1); u2.lineTo(4.9, 10.1);
    u2.bezierCurveTo(4.25, 10.1, 3.9, 8.6, 3.9, 7.2); u2.lineTo(3.9, 4.05); u2.absellipse(4.35, 4.05, 0.45, 0.45, PI, 1.5 * PI, false);
    s.holes.push(u2, rr(12.22, 3.6, 13.6, 6.5), rr(12.22, 7.2, 13.6, 10.1));
    return s;
  }
  // фасад 1, 1 этаж — опоры с арками в плоскости 1 этажа (утоплена на RC)
  function frontGround() {
    const s = new THREE.Shape(); s.moveTo(RC, 0);
    MD.facade.groundOpenings1.forEach(([a, b]) => notch(s, a, b));
    s.lineTo(W, 0); s.lineTo(W, 3.0); s.lineTo(RC, 3.0); s.lineTo(RC, 0); return s;
  }
  // фасад 2: s 0 (тыл) … SE (угол); пояс 6.500–7.200 между окнами
  function sideUpper() {
    const s = new THREE.Shape(); s.moveTo(0, 2.9); s.lineTo(SE, 2.9); s.lineTo(SE, 3.6); s.lineTo(13.1, 3.6); s.lineTo(13.1, 10.1); s.lineTo(SE, 10.1); s.lineTo(SE, TOP); s.lineTo(0, TOP); s.lineTo(0, 2.9);
    s.holes.push(
      rr(0.1, 3.6, 1.9, 6.5), rr(0.1, 7.2, 1.9, 10.1),
      rr(2.97, 3.6, 3.95, 6.5), rr(2.97, 7.2, 3.95, 10.1),
      rr(4.97, 3.6, 5.96, 6.5, [0, [0.95, 0.8], 0, 0]), rr(4.97, 7.2, 5.96, 10.1, [0, 0, [0.95, 2.0], 0]),
      rr(9.06, 3.6, 10.05, 6.5, [[0.95, 0.8], 0, 0, 0]), rr(9.06, 7.2, 10.05, 10.1, [0, 0, 0, [0.95, 2.0]]),
      rr(11.04, 3.6, 12.03, 6.5), rr(11.04, 7.2, 12.03, 10.1)
    );
    return s;
  }
  function sideGround() {
    const s = new THREE.Shape(); s.moveTo(0, 0);
    MD.facade.groundOpenings2.forEach(([a, b]) => notch(s, a, b));
    s.lineTo(SE, 0); s.lineTo(SE, 3.0); s.lineTo(0, 3.0); s.lineTo(0, 0); return s;
  }
  // лента-арка фасада 2 по осевой: кромки R2400/R2000 → осевая R2200; кромка R1700 → осевая R1500
  function ribbonCurve(mirror) {
    const rb = MD.facade.ribbons, rTop = (rb.outerTop + rb.innerTop) / 2, rBot = rb.outerBottom - rb.width / 2;
    const x0 = 4.0, yTop = 10.28, yBot = 3.7, xs = x0 + rTop;
    const p = new THREE.Path(); p.moveTo(3.4, yTop); p.lineTo(x0, yTop);
    p.absarc(x0, yTop - rTop, rTop, PI / 2, 0, true); p.lineTo(xs, yBot + rBot);
    p.absarc(xs - rBot, yBot + rBot, rBot, 0, -PI / 2, true); p.lineTo(x0, yBot);
    const pts = p.getSpacedPoints(180).map(v => new V3(mirror ? 15.02 - v.x : v.x, v.y, 0));
    return new THREE.CatmullRomCurve3(pts, false, "centripetal");
  }
  // капитель опоры в разрезе: от грани опоры на +1.600 до кромки консоли на +2.900 (R1300)
  function flareShape() { const s = new THREE.Shape(); s.moveTo(0, 1.6); s.absarc(RC, 1.6, RC, PI, PI / 2, true); s.lineTo(RC, 3.0); s.lineTo(0, 3.0); s.lineTo(0, 1.6); return s; }

  /* ================= АНИМАЦИЯ ПО ЭТАПАМ ================= */
  // режимы: drop — падает на место; grow/ungrow — масштаб по осям; rise — клиппинг снизу вверх;
  // remove — улетает и исчезает; temp — виден только на отрезке [a, b] таймлайна
  const items = [];
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const easeIO = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  function reg(obj, stage, o = {}) {
    const it = Object.assign({ obj, stage, mode: "drop", delay: 0, dur: 0.35, off: new V3(0, 4, 0), axis: "xyz", tilt: 0 }, o);
    it.p0 = obj.position.clone(); it.s0 = obj.scale.clone(); it.r0 = obj.rotation.clone();
    if (it.mode === "rise") {
      obj.updateWorldMatrix(true, true);
      const bb = new THREE.Box3().setFromObject(obj);
      it.y0 = bb.min.y - 0.05; it.y1 = bb.max.y + 0.05;
      it.plane = new THREE.Plane(new V3(0, -1, 0), it.y0);
      const cache = new Map();
      obj.traverse(m => {
        if (!m.material) return;
        let c = cache.get(m.material);
        if (!c) { c = m.material.clone(); c.clippingPlanes = [it.plane]; c.clipShadows = true; cache.set(m.material, c); }
        m.material = c;
      });
    }
    items.push(it); return obj;
  }
  function applyT(t) {
    const clamp = THREE.MathUtils.clamp;
    for (const it of items) {
      const o = it.obj;
      if (it.mode === "temp") {
        const k = Math.min(clamp((t - it.a) / 0.12, 0, 1), clamp((it.b - t) / 0.12, 0, 1));
        o.visible = k > 0; o.scale.set(it.s0.x, it.s0.y * Math.max(easeOut(k), 1e-3), it.s0.z); continue;
      }
      const q = clamp((t - (it.stage - 1) - it.delay) / it.dur, 0, 1);
      if (it.mode === "drop") { o.visible = q > 0; const e = easeOut(q); o.position.copy(it.p0).addScaledVector(it.off, 1 - e); }
      else if (it.mode === "grow" || it.mode === "ungrow") {
        const e = it.mode === "grow" ? Math.max(easeOut(q), 1e-3) : Math.max(1 - easeIO(q), 1e-3), a = it.axis;
        o.visible = it.mode === "grow" ? q > 0 : q < 1;
        o.scale.set(a.includes("x") ? it.s0.x * e : it.s0.x, a.includes("y") ? it.s0.y * e : it.s0.y, a.includes("z") ? it.s0.z * e : it.s0.z);
      }
      else if (it.mode === "rise") { o.visible = q > 0; it.plane.constant = it.y0 + (it.y1 - it.y0) * easeIO(q); }
      else if (it.mode === "remove") { o.visible = q < 1; const e = q * q; o.position.copy(it.p0).addScaledVector(it.off, e); o.rotation.x = it.r0.x + it.tilt * q; }
    }
  }

  /* фасадные системы координат: x — вдоль фасада, y — отметка, z — наружу (0 — плоскость консоли) */
  const frontG = group();
  const sideG = group(); sideG.rotation.y = -PI / 2; sideG.position.set(0, 0, -D);

  /* ================= ПЛОЩАДКА И СОСЕДИ ================= */
  const grounds = [];
  grounds.push(surf(-200, -200, 200, 200, LV.ground, mat.asphalt));
  grounds.push(surf(-9, -18, 24, 6.4, LV.ground + 0.002, mat.dirt));
  const ctx = group();
  (function () {
    const g0 = LV.ground;
    bx(-3, g0, -31, 17, 7.2, -16.35, mat.brick, ctx);
    bx(13.75, g0, -16.3, 32, 6.4, -1.2, mat.wall, ctx);
    bx(15.2, g0, -1.25, 18.6, 2.6, -1.18, mat.garage, ctx, false);
    bx(19.6, g0, -1.25, 23.0, 2.6, -1.18, mat.garage, ctx, false);
    const wt = (w, h) => M({ map: tex(winCanvas("#bdb6aa", "#5b636b"), w / 3.2, h / 3.2), roughness: 0.95 });
    const res = (x0, z0, x1, z1, h) => {
      const w = x1 - x0, d = z1 - z0, top = M({ color: 0xa9a398, roughness: 1 });
      const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [wt(d, h), wt(d, h), top, top, wt(w, h), wt(w, h)]);
      o.position.set((x0 + x1) / 2, g0 + h / 2, (z0 + z1) / 2); o.castShadow = true; o.receiveShadow = true; ctx.add(o);
    };
    res(-27, -36, -12, -12, 18.6); res(22, -44, 42, -24, 12.4); res(-30, -8, -18, 4, 15.5);
  })();

  /* ================= 00 · СУЩЕСТВУЮЩЕЕ ЗДАНИЕ ================= */
  // подвал 12,4 × 15,0, пол −3.200 (виден в «Рентгене»)
  (function () {
    const g = group(), x0 = RC, x1 = W, z0 = -D, z1 = -RC, t = 0.3;
    bx(x0, LB - 0.2, z0, x1, LB, z1, mat.basement, g);
    bx(x0, LB, z0, x0 + t, -0.3, z1, mat.basement, g); bx(x1 - t, LB, z0, x1, -0.3, z1, mat.basement, g);
    bx(x0, LB, z0, x1, -0.3, z0 + t, mat.basement, g); bx(x0, LB, z1 - t, x1, -0.3, z1, mat.basement, g);
    shell(g);
  })();
  xr(bx(RC, -0.3, -D, W, 0, -RC, mat.concrete), 0.4);               // перекрытие над подвалом = пол 1 этажа
  const slabPlan = planShape(0.25, 0.25, W - 0.3, D - 0.3, 1.05, 0);
  xr(slab(slabPlan, L1 - 0.3, L1, mat.concrete), 0.4);
  xr(slab(slabPlan, L2 - 0.3, L2, mat.concrete), 0.4);
  // колонны на пересечениях осей + промежуточные; ряд yr=0 сидит в тыльной стене
  (function () {
    const h = MD.dims.column / 2, pts = [];
    MD.axes.yr.forEach(yr => MD.axes.x.forEach(x => pts.push([x, yr])));
    MD.axes.extra.forEach(p => pts.push(p));
    pts.forEach(([x, yr]) => {
      const z = Math.max(zr(yr), -D + h), xx = Math.min(x, W - 0.35);
      xr(bx(xx - h, LB, z - h, xx + h, L3 - 0.3, z + h, mat.concrete), 0.4);
    });
  })();
  shell(bx(W - 0.3, -0.3, -D, W, LT, 0, mat.wallBC));
  shell(bx(0, -0.3, -D, W - 0.3, LT, -D + 0.3, mat.wallBC));

  // старая ж/б шахта t=300; проёмы 2200 × 2000 пробиваются на этапе 02
  const SH = (function () {
    const o = MD.oldShaft;
    return { x0: o.x0, x1: o.x1, z0: zr(o.yr0), z1: zr(o.yr1), ix0: o.x0 + o.t, ix1: o.x1 - o.t, iz0: zr(o.yr0 + o.t), iz1: zr(o.yr1 - o.t) };
  })();
  (function () {
    const y0 = 0, y1 = L3, g = group(), op = MD.oldShaft.openings;
    bx(SH.x0, y0, SH.z0, SH.x1, y1, SH.iz0, mat.concrete, g);        // стена к тылу
    bx(SH.x0, y0, SH.iz1, SH.x1, y1, SH.z1, mat.concrete, g);        // стена к фасаду 1
    const zc = (SH.iz0 + SH.iz1) / 2;
    const o0 = Math.max(SH.iz0, zc - op.w / 2), o1 = Math.min(SH.iz1, zc + op.w / 2);
    const pieces = [];
    function wallWithOpenings(xa, xb, floors) {
      bx(xa, y0, SH.iz0, xb, y1, o0, mat.concrete, g); bx(xa, y0, o1, xb, y1, SH.iz1, mat.concrete, g);
      let prev = y0;
      floors.slice().sort((a, b) => a - b).forEach(f => {
        if (f > prev) bx(xa, prev, o0, xb, f, o1, mat.concrete, g);
        pieces.push(bx(xa + 0.01, f, o0 + 0.01, xb - 0.01, f + op.h, o1 - 0.01, mat.concrete, g)); prev = f + op.h;
      });
      if (prev < y1) bx(xa, prev, o0, xb, y1, o1, mat.concrete, g);
    }
    wallWithOpenings(SH.ix1, SH.x1, [0]);              // сторона А (к холлу) — 1 этаж
    wallWithOpenings(SH.x0, SH.ix0, [0, L1, L2]);      // сторона Б — 2 и 3 этажи (+ проём на 1 этаже)
    xr(g, 0.2);
    pieces.forEach((p, i) => reg(p, 2, { mode: "remove", off: new V3(0, -0.2, 0), delay: 0.12 + i * 0.05, dur: 0.2 }));
  })();

  // покрытие из плит ПК; над шахтой снимаются плиты 6,0 × 1,0 (количество — допущение)
  (function () {
    const y0 = L3 - 0.3, y1 = L3, rs = MD.roofSlabs;
    const ys = rs.yr.slice().sort((a, b) => a - b);
    const roof = planShape(0.25, 0.25, W - 0.3, D - 0.3, 1.05, 0);
    roof.holes.push(rr(rs.x0, -zr(ys[ys.length - 1] + rs.w), rs.x1, -zr(ys[0])));
    xr(slab(roof, y0, y1, mat.concrete), 0.4);
    rs.yr.forEach((a, i) => {                         // первой уходит плита из акта
      const p = bx(rs.x0 + 0.01, y0, zr(a) + 0.01, rs.x1 - 0.01, y1, zr(a + rs.w) - 0.01, mat.concrete);
      reg(p, 2, { mode: "remove", off: new V3(0, 4.2, 0), delay: 0.45 + i * 0.12, dur: 0.28 });
    });
    reg(pivotBox(0.25, L3, -D + 0.3, W - 0.3, L3 + 0.15, -0.25, mat.oldScreed, "x"), 2, { mode: "ungrow", axis: "x", delay: 0, dur: 0.3 });
    reg(bx(0.25, L3, -0.45, W - 0.3, L3 + 0.8, -0.25, mat.concrete), 2, { mode: "remove", off: new V3(0, 5, 0), delay: 0.02, dur: 0.22 });
    reg(bx(0.25, L3, -D + 0.3, 0.45, L3 + 0.8, -0.45, mat.concrete), 2, { mode: "remove", off: new V3(0, 5, 0), delay: 0.05, dur: 0.22 });
  })();

  // витражи 1 этажа — существующие, утоплены на RC, не демонтируются
  (function () {
    const f = group(frontG), lz = -RC - 0.12;
    pane(f, RC, 0, W, 2.9, lz); mul(f, 1.72, 2.08, 13.28, 2.14, lz + 0.02);
    [2.22, 3.01, 3.8, 5.2, 6.0, 6.82, 9.67, 10.49, 11.3].forEach(x => mul(f, x - 0.03, 0, x + 0.03, 2.1, lz + 0.02));
    const s = group(sideG);
    pane(s, 0, 0, SE, 2.9, lz); mul(s, 0.42, 2.08, 5.16, 2.14, lz + 0.02);
    [2.37, 3.2, 4.03].forEach(x => mul(s, x - 0.03, 0, x + 0.03, 2.1, lz + 0.02)); mul(s, 11.8 - 0.03, 0, 11.8 + 0.03, 2.9, lz + 0.02);
  })();

  // старый фасад 2–3 этажей: алюкобонд + ленточные окна (снимается на этапе 01 сверху вниз)
  (function () {
    const rows = [[2.7, 4.3, "a"], [4.3, 6.4, "g"], [6.4, 7.9, "a"], [7.9, 9.8, "g"], [9.8, 10.9, "a"]];
    function clad(G, L, nCols) {
      const cw = L / nCols; const r = rnd(L * 100 | 0);
      rows.forEach(([y0, y1, k]) => {
        for (let i = 0; i < nCols; i++) {
          const x0 = i * cw, x1 = (i + 1) * cw;
          const o = shell(bx(x0 + 0.02, y0 + 0.02, 0.02, x1 - 0.02, y1 - 0.02, 0.06, k === "a" ? mat.alu : mat.oldGlass, G));
          const rank = 1 - (y0 - 2.7) / 8.2;
          reg(o, 1, { mode: "remove", off: new V3(0, -3.2, 1.8), tilt: 0.9, delay: 0.1 + rank * 0.52 + r() * 0.06, dur: 0.3 });
        }
      });
    }
    clad(frontG, W, 9); clad(sideG, D, 11);
  })();

  /* ================= 01 · ОГРАЖДЕНИЕ 17,301 + 2,471 + 14,870 м ================= */
  (function () {
    const g = group(); g.position.y = LV.ground;
    const run = (x0, z0, x1, z1) => {
      const L = Math.hypot(x1 - x0, z1 - z0);
      const m = mat.fence.clone(); m.map = mat.fence.map.clone(); m.map.needsUpdate = true; m.map.repeat.set(L / 0.9, 1);
      const p = new THREE.Mesh(new THREE.PlaneGeometry(L, 2.5), m); p.position.set((x0 + x1) / 2, 1.25, (z0 + z1) / 2);
      p.rotation.y = Math.atan2(-(z1 - z0), x1 - x0); p.castShadow = true; g.add(p);
      const n = Math.ceil(L / 2.5);
      for (let i = 0; i <= n; i++) { const k = i / n, x = x0 + (x1 - x0) * k, z = z0 + (z1 - z0) * k; bx(x - 0.03, 0, z - 0.03, x + 0.03, 2.55, z + 0.03, mat.craneDark, g, false); }
    };
    run(-1.5, 3.2, 15.8, 3.2); run(-1.5, 0.73, -1.5, 3.2); run(-1.5, -14.14, -1.5, 0.73);
    reg(g, 1, { mode: "temp", a: 0.02, b: 8.02 });
  })();

  /* ================= 02 · АВТОКРАН ================= */
  (function () {
    const g = group(); g.position.set(-8.2, LV.ground, -9.6);
    bx(-1.3, 0.5, -4.2, 1.3, 1.6, 4.2, mat.crane, g); bx(-1.25, 0.5, 3.0, 1.25, 3.0, 4.3, mat.crane, g);
    bx(-1.1, 2.0, 4.25, 1.1, 2.8, 4.31, mat.oldGlass, g, false);
    [-3, -1, 1.5, 3].forEach(z => [-1, 1].forEach(x => {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.4, 16), mat.craneDark); w.rotation.z = PI / 2; w.position.set(x * 1.2, 0.5, z); g.add(w);
    }));
    [[-2.4, -3.5], [2.4, -3.5], [-2.4, 2.2], [2.4, 2.2]].forEach(([x, z]) => bx(x - 0.15, 0, z - 0.15, x + 0.15, 0.9, z + 0.15, mat.craneDark, g, false));
    bx(-1, 1.6, -2.4, 1, 2.6, -0.4, mat.crane, g);
    const pivot = new V3(-8.2, 2.2, -11.0), tip = new V3(4.5, 15.4, -8.8), L = pivot.distanceTo(tip);
    const bg = new THREE.BoxGeometry(0.5, 0.55, L); bg.translate(0, 0, L / 2);
    const holder = new THREE.Group(); holder.position.copy(pivot).sub(g.position); g.add(holder);
    const boom = new THREE.Mesh(bg, mat.crane); boom.castShadow = true; holder.add(boom);
    holder.lookAt(tip);
    const ropeLen = 15.4 - 10.4;
    const rope = bx(0, 0, 0, 0.03, ropeLen, 0.03, mat.craneDark, g, false);
    rope.position.set(tip.x - g.position.x, 10.4 + ropeLen / 2 - g.position.y, tip.z - g.position.z);
    reg(g, 2, { mode: "temp", a: 1.03, b: 1.98 });
  })();

  /* ================= 03 · ШАХТА ASERA (КЖ: 2340 × 2090, −3.200 … +14.900) ================= */
  const LF = (function () {
    const l = MD.lift, zc = zr(l.cyr);
    return { x0: l.cx - l.lx / 2, x1: l.cx + l.lx / 2, z0: zc - l.ly / 2, z1: zc + l.ly / 2, zc: zc };
  })();
  (function () {
    const l = MD.lift, X0 = LF.x0, X1 = LF.x1, Z0 = LF.z0, Z1 = LF.z1, p = l.pipe;
    // ограждение шахты в подвале (кирпич 400 + металл 150 по плану −1 этажа)
    const enc = group(); bx(SH.x0, LB, SH.z0, SH.x1, -0.3, SH.z0 + 0.4, mat.wall, enc); bx(SH.x1 - 0.15, LB, SH.z0, SH.x1, -0.3, SH.z1, mat.wall, enc);
    reg(shell(enc), 3, { mode: "rise", delay: 0, dur: 0.15 });
    reg(bx(X0, l.pit - 0.12, Z0, X1, l.pit, Z1, mat.concrete), 3, { off: new V3(0, -1, 0), delay: 0.1, dur: 0.15 });   // приямок
    [[X0, Z0], [X1, Z0], [X0, Z1], [X1, Z1]].forEach(([x, z], i) => {
      const sx = x === X0 ? x + p / 2 : x - p / 2, sz = z === Z0 ? z + p / 2 : z - p / 2;
      reg(pivotBox(sx - p / 2, l.bottom, sz - p / 2, sx + p / 2, l.top, sz + p / 2, mat.liftSteel, "y"), 3, { mode: "grow", axis: "y", delay: 0.15 + i * 0.04, dur: 0.35 });
    });
    l.rings.forEach((y, i) => {
      const r = group();
      bx(X0, y - 0.06, Z0, X1, y + 0.06, Z0 + p, mat.liftSteel, r, false); bx(X0, y - 0.06, Z1 - p, X1, y + 0.06, Z1, mat.liftSteel, r, false);
      bx(X0, y - 0.06, Z0, X0 + p, y + 0.06, Z1, mat.liftSteel, r, false); bx(X1 - p, y - 0.06, Z0, X1, y + 0.06, Z1, mat.liftSteel, r, false);
      reg(r, 3, { off: new V3(0, 2, 0), delay: 0.4 + i * 0.04, dur: 0.18 });
    });
    // двери: сторона А — +x, сторона Б — −x (допущение, см. model-data.js)
    const hw = l.doorW / 2;
    l.doors.forEach((dr, i) => {
      const dir = dr.side === "A" ? 1 : -1, x = dir > 0 ? X1 : X0, zc = LF.zc, h = dr.h;
      const d = group(); d.position.y = dr.y;
      bx(x - 0.06, 0, zc - hw - 0.12, x + 0.06, h, zc - hw, mat.frame, d, false); bx(x - 0.06, 0, zc + hw, x + 0.06, h, zc + hw + 0.12, mat.frame, d, false);
      bx(x - 0.06, h - 0.1, zc - hw - 0.12, x + 0.06, h, zc + hw + 0.12, mat.frame, d, false);
      bx(x - 0.03 + dir * 0.04, 0, zc - hw, x + 0.03 + dir * 0.04, h - 0.1, zc + hw, mat.liftDoor, d, false);
      reg(d, 3, { mode: "grow", axis: "y", delay: 0.72 + i * 0.05, dur: 0.15 });
    });
  })();

  /* ================= НАДСТРОЙКА: два варианта ================= */
  const TV = { ai: group(), facade: group() };
  let variant = MD.superstructure["default"] === "ai" ? "ai" : "facade";

  function headroom(G, y) {   // оголовок шахты до +15.000 — на АС его нет (конфликт, не прятать)
    const hd = group(G);
    bx(LF.x0 - 0.1, y, LF.z0 - 0.1, LF.x1 + 0.1, 15.0, LF.z1 + 0.1, mat.sandwich, hd);
    bx(LF.x0 - 0.2, 15.0, LF.z0 - 0.2, LF.x1 + 0.2, 15.12, LF.z1 + 0.2, mat.roofPanel, hd);
    reg(shell(hd), 5, { mode: "rise", delay: 0.86, dur: 0.14 });
  }

  /* --- АИ Insidroom: холл у фасада 1, гнутый угол R≈1900 справа, санузел у тыла справа --- */
  const AI = MD.superstructure.ai;
  function aiOutline() {
    const s = new THREE.Shape(), Y = yr => D - yr;
    s.moveTo(AI.xl, Y(AI.yrF)); s.lineTo(AI.cxA, Y(AI.yrF)); s.absarc(AI.cxA, Y(AI.cyA), AI.rA, -PI / 2, 0, false);
    s.lineTo(AI.xN, Y(AI.yrN)); s.lineTo(AI.xR, Y(AI.yrN)); s.lineTo(AI.xR, Y(AI.yrWC)); s.lineTo(AI.xWC, Y(AI.yrWC));
    s.lineTo(AI.xWC, Y(AI.yrT)); s.lineTo(AI.xl, Y(AI.yrT)); s.lineTo(AI.xl, Y(AI.yrF));
    return s;
  }
  (function () {
    const G = TV.ai, y0 = LT, y1 = LR;
    // 04 — металлокаркас
    const cols = [[AI.xl, AI.yrT], [5.0, AI.yrT], [8.2, AI.yrT], [AI.xWC, AI.yrT], [AI.xWC, AI.yrWC], [AI.xR, AI.yrWC], [AI.xR, AI.yrT], [AI.xR, 5.4], [AI.xR, AI.yrN], [AI.xN, AI.yrN], [AI.xN, AI.cyA], [AI.cxA, AI.yrF], [7.77, AI.yrF], [5.05, AI.yrF], [AI.xl, AI.yrF], [AI.xl, AI.yrN], [AI.xl, 5.4], [7.77, AI.yrN]];
    cols.forEach(([x, yr], k) => reg(bx(x - 0.08, L3, zr(yr) - 0.08, x + 0.08, y1, zr(yr) + 0.08, mat.steel, G), 4, { off: new V3(0, 6, 0), delay: 0.05 + k * 0.022, dur: 0.25 }));
    const ring = [[AI.xl, AI.yrF], [AI.cxA, AI.yrF], [AI.xN + 0.55, AI.yrF - 0.55], [AI.xN, AI.cyA], [AI.xN, AI.yrN], [AI.xR, AI.yrN], [AI.xR, AI.yrWC], [AI.xWC, AI.yrWC], [AI.xWC, AI.yrT], [AI.xl, AI.yrT], [AI.xl, AI.yrF]];
    for (let i = 0; i < ring.length - 1; i++) {
      const a = ring[i], b = ring[i + 1], A = new V3(a[0], y1 - 0.1, zr(a[1])), B = new V3(b[0], y1 - 0.1, zr(b[1]));
      const L = A.distanceTo(B); const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, L + 0.14), mat.steel);
      m.position.copy(A).add(B).multiplyScalar(0.5); m.lookAt(B); m.castShadow = true; G.add(m);
      reg(m, 4, { off: new V3(0, 4, 0), delay: 0.48 + i * 0.03, dur: 0.2 });
    }
    [4.4, 7.77].forEach((x, i) => reg(bx(x - 0.07, y1 - 0.18, zr(AI.yrT), x + 0.07, y1, zr(AI.yrF), mat.steel, G), 4, { off: new V3(0, 4, 0), delay: 0.8 + i * 0.04, dur: 0.15 }));
    // 05 — глухие стены (сэндвич) и кровля
    const sw = group(G);
    bx(AI.xl, y0, zr(AI.yrT), AI.xl + 0.15, y1, zr(AI.yrF), mat.sandwich, sw);
    bx(AI.xl, y0, zr(AI.yrT), AI.xWC, y1, zr(AI.yrT) + 0.15, mat.sandwich, sw);
    bx(AI.xWC, y0, zr(AI.yrWC), AI.xWC + 0.15, y1, zr(AI.yrT), mat.sandwich, sw);
    bx(AI.xWC, y0, zr(AI.yrWC), AI.xR, y1, zr(AI.yrWC) + 0.15, mat.sandwich, sw);
    bx(AI.xR - 0.15, y0, zr(AI.yrWC), AI.xR, y1, zr(AI.yrT), mat.sandwich, sw);
    reg(shell(sw), 5, { mode: "rise", delay: 0.25, dur: 0.35 });
    const roof = slab(aiOutline(), y1, y1 + 0.12, mat.roofPanel, G); shell(roof); reg(roof, 5, { off: new V3(0, 3, 0), delay: 0.62, dur: 0.2 });
    headroom(G, y1 + 0.12);
    // 06–07 — карниз по контуру (фибробетон)
    reg(belt(aiOutline(), y1 + 0.03, 0.24, 0.24, mat.cage, G), 6, { mode: "rise", delay: 0.7, dur: 0.25 });
    reg(shell(belt(aiOutline(), y1, 0.3, 0.3, mat.fibro, G)), 7, { mode: "rise", delay: 0.7, dur: 0.25 });
    // 08 — витражи h 3000: правый край, выступ, гнутый угол, фасад 1
    const gl = group(G);
    const vp = (x0, z0, x1, z1) => {
      const L = Math.hypot(x1 - x0, z1 - z0);
      const p = new THREE.Mesh(new THREE.PlaneGeometry(L, y1 - y0), mat.glass); p.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      p.rotation.y = Math.atan2(-(z1 - z0), x1 - x0); gl.add(p);
      const n = Math.max(1, Math.round(L / 1.45));
      for (let i = 0; i <= n; i++) { const k = i / n; bx(x0 + (x1 - x0) * k - 0.035, y0, z0 + (z1 - z0) * k - 0.035, x0 + (x1 - x0) * k + 0.035, y1, z0 + (z1 - z0) * k + 0.035, mat.frame, gl, false); }
    };
    vp(AI.xR, zr(AI.yrT), AI.xR, zr(AI.yrN)); vp(AI.xR, zr(AI.yrN), AI.xN, zr(AI.yrN)); vp(AI.xN, zr(AI.yrN), AI.xN, zr(AI.cyA)); vp(AI.cxA, zr(AI.yrF), AI.xl + 0.15, zr(AI.yrF));
    arcAt(AI.cxA, zr(AI.cyA), AI.rA, y0, y1, 0, PI / 2, mat.glass, gl, 24);
    [PI / 6, PI / 3].forEach(a => { const m = bx(-0.035, y0, -0.035, 0.035, y1, 0.035, mat.frame, gl, false); m.position.set(AI.cxA + AI.rA * Math.sin(a), (y0 + y1) / 2, zr(AI.cyA) + AI.rA * Math.cos(a)); });
    reg(gl, 8, { mode: "rise", delay: 0.35, dur: 0.4 });
    // ограждение открытой террасы
    const rl = group(G);
    bx(RC, LT, 0.08, W, 11.9, 0.1, mat.railing, rl, false); arcCyl(RC + 0.09, LT, 11.9, mat.railing, rl, 32);
    bx(-0.1, LT, -D + 0.3, -0.08, 11.9, -RC, mat.railing, rl, false); bx(0, LT, -D + 0.3, AI.xWC, 11.9, -D + 0.32, mat.railing, rl, false);
    bx(W - 0.12, LT, zr(AI.yrN), W - 0.1, 11.9, 0.1, mat.railing, rl, false);
    reg(rl, 8, { mode: "rise", delay: 0.6, dur: 0.35 });
    // 09 — лежаки у тыла, растения вдоль фасада 2, пол и потолок (дерево)
    const fu = group(G);
    [[0.8, 2.5], [3.2, 4.9], [5.7, 7.4], [8.2, 9.9]].forEach(([a, b]) => bx(a, LT, zr(0.43), b, LT + 0.35, zr(1.47), mat.beige, fu));
    [-12, -9, -6, -3].forEach(z => {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.24, 0.55, 14), mat.pot); p.position.set(0.9, LT + 0.28, z); fu.add(p);
      const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), mat.green); f.position.set(0.9, LT + 1.0, z); f.castShadow = true; fu.add(f);
    });
    reg(fu, 9, { mode: "grow", delay: 0.7, dur: 0.25 });
    const F = MD.finishes.terrace, tg = group(G);
    slab(aiOutline(), LT + 0.005, LT + 0.02, M({ color: F.floor, roughness: 0.85 }), tg);
    slab(aiOutline(), y1 - 0.28, y1 - 0.26, M({ color: F.ceil, roughness: 0.85 }), tg);
    reg(tg, 9, { mode: "rise", delay: 0.62, dur: 0.2 });
  })();

  /* --- фасады Bino: коробка у тыла и фасада 2 --- */
  (function () {
    const G = TV.facade, B = MD.superstructure.facade;
    const xs = B.colX, zs = B.colYr.map(zr), BX0 = xs[0], BX1 = xs[xs.length - 1], BZ0 = zs[0], BZ1 = zs[zs.length - 1];
    const bxX = B.x1, bzF = zr(B.yr1);        // коробка x 0…8,97; yr 0…11,03
    let k = 0; const cols = [];
    xs.forEach(x => { cols.push([x, BZ0]); cols.push([x, BZ1]); });
    zs.slice(1, -1).forEach(z => { cols.push([BX0, z]); cols.push([BX1, z]); });
    cols.forEach(([x, z]) => reg(bx(x - 0.08, L3, z - 0.08, x + 0.08, LR, z + 0.08, mat.steel, G), 4, { off: new V3(0, 6, 0), delay: 0.05 + (k++) * 0.025, dur: 0.25 }));
    const beam = (a, b, y) => bx(a[0] - 0.07, y, a[1] - 0.07, b[0] + 0.07, y + 0.18, b[1] + 0.07, mat.steel, G);
    const yb = LR - 0.18;
    [[[BX0, BZ1], [BX1, BZ1]], [[BX0, BZ0], [BX1, BZ0]], [[BX0, BZ0], [BX0, BZ1]], [[BX1, BZ0], [BX1, BZ1]]].forEach((r, i) => reg(beam(r[0], r[1], yb), 4, { off: new V3(0, 4, 0), delay: 0.45 + i * 0.04, dur: 0.22 }));
    [1.2, 5.5, 7.3].forEach((x, i) => reg(beam([x, BZ0], [x, BZ1], yb), 4, { off: new V3(0, 4, 0), delay: 0.6 + i * 0.04, dur: 0.2 }));
    xs.forEach((x, i) => reg(bx(x - 0.06, LR + 0.03, BZ1, x + 0.06, LR + 0.17, -4.35, mat.steel, G), 4, { off: new V3(0, 3, 0), delay: 0.74 + i * 0.03, dur: 0.2 }));
    zs.forEach((z, i) => reg(bx(BX1, LR + 0.03, z - 0.06, 10.4, LR + 0.17, z + 0.06, mat.steel, G), 4, { off: new V3(0, 3, 0), delay: 0.76 + i * 0.03, dur: 0.2 }));
    // 05 — сэндвич-панели вдоль фасада 2 и тыла, кровля
    const sw = 1.1; k = 0;
    for (let z = -D; z < bzF - 0.01; z += sw) {
      const z1 = Math.min(z + sw, bzF);
      reg(shell(bx(-0.05, LT, z + 0.01, 0.1, LR, z1 - 0.01, mat.sandwich, G)), 5, { off: new V3(0, 4, 0), delay: 0.25 + (k++) * 0.03, dur: 0.2 });
    }
    for (let x = 0; x < bxX - 0.01; x += sw) {
      const x1 = Math.min(x + sw, bxX);
      reg(shell(bx(x + 0.01, LT, -D, x1 - 0.01, LR, -D + 0.15, mat.sandwich, G)), 5, { off: new V3(0, 4, 0), delay: 0.3 + (k++) * 0.025, dur: 0.2 });
    }
    reg(shell(bx(0, LT, bzF - 0.15, 0.31, LR, bzF + 0.05, mat.sandwich, G)), 5, { off: new V3(0, 4, 0), delay: 0.52, dur: 0.2 });
    for (let i = 0; i < 9; i++) {
      const x0 = i * 1.0, x1 = Math.min(x0 + 1.0, bxX);
      const o = shell(bx(x0 + 0.01, LR, -D, x1 - 0.01, LR + 0.12, bzF + 0.07, mat.roofPanel, G)); o.rotation.x = 0.012;
      reg(o, 5, { off: new V3(0, 3, 0), delay: 0.58 + i * 0.03, dur: 0.2 });
    }
    headroom(G, LR + 0.12);
    // 06–07 — карниз и фриз (фибробетон)
    const cornice = planShape(0, 4.42, 10.32, D, 0, 0.5);
    reg(belt(cornice, LR + 0.03, 0.24, 0.09, mat.cage, G), 6, { mode: "rise", delay: 0.7, dur: 0.25 });
    reg(shell(belt(cornice, LR, 0.3, 0.15, mat.fibro, G)), 7, { mode: "rise", delay: 0.7, dur: 0.25 });
    const fz = group(G); bx(0, LR - 0.5, bzF - 0.03, bxX + 0.03, LR, bzF + 0.15, mat.fibro, fz); bx(bxX - 0.02, LR - 0.5, -D, bxX + 0.16, LR, bzF + 0.15, mat.fibro, fz);
    reg(shell(fz), 7, { mode: "rise", delay: 0.62, dur: 0.25 });
    // 08 — витражи коробки h 3000 и ограждение
    const g = group(G), gw = bxX - 0.31, gd = B.yr1;
    const pf = new THREE.Mesh(new THREE.PlaneGeometry(gw, 3.0), mat.glass); pf.position.set(0.31 + gw / 2, LT + 1.5, bzF - 0.03); g.add(pf);
    const pr = new THREE.Mesh(new THREE.PlaneGeometry(gd, 3.0), mat.glass); pr.rotation.y = PI / 2; pr.position.set(bxX, LT + 1.5, -D + gd / 2); g.add(pr);
    for (let i = 0; i <= 6; i++) { const x = 0.31 + i * gw / 6; bx(x - 0.035, LT, bzF - 0.07, x + 0.035, LR - 0.5, bzF + 0.01, mat.frame, g, false); }
    for (let i = 0; i <= 7; i++) { const z = bzF - i * gd / 7; bx(bxX - 0.04, LT, z - 0.035, bxX + 0.04, LR - 0.5, z + 0.035, mat.frame, g, false); }
    reg(g, 8, { mode: "rise", delay: 0.35, dur: 0.4 });
    const rl = group(G);
    bx(RC, LT, 0.08, W, 11.9, 0.1, mat.railing, rl, false); bx(-0.1, LT, bzF, -0.08, 11.9, -RC, mat.railing, rl, false);
    bx(W - 0.1, LT, -D, W - 0.08, 11.9, 0.1, mat.railing, rl, false); arcCyl(RC + 0.09, LT, 11.9, mat.railing, rl, 32);
    reg(rl, 8, { mode: "rise", delay: 0.6, dur: 0.35 });
    // 09 — растения по парапету, пол (дерево)
    const pot = (x, z, big) => {
      const q = group(G); q.position.set(x, LT, z);
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.27, 0.62, 16), mat.pot); p.position.y = 0.31; p.castShadow = true; q.add(p);
      if (big) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.8, 8), mat.greenDark); c.position.y = 1.5; c.castShadow = true; q.add(c); }
      else { const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), mat.green); f.scale.set(1, 1.15, 1); f.position.y = 1.1; f.castShadow = true; q.add(f); }
      return q;
    };
    k = 0;
    [[2.4, -0.8, 0], [4.2, -0.8, 0], [10.4, -0.8, 0], [12.9, -0.8, 0], [12.9, -3.6, 1], [12.9, -6.8, 1], [12.9, -10, 1], [10.4, -4.4, 0]]
      .forEach(([x, z, b]) => reg(pot(x, z, b), 9, { mode: "grow", delay: 0.7 + (k++) * 0.02, dur: 0.25 }));
    const tg = group(G); bx(0.31, LT + 0.005, -D + 0.15, bxX, LT + 0.02, bzF - 0.05, M({ color: MD.finishes.terrace.floor, roughness: 0.85 }), tg, false);
    reg(tg, 9, { mode: "rise", delay: 0.62, dur: 0.2 });
  })();

  function setVariant() {
    variant = "ai";
    TV.ai.visible = true;
    TV.facade.visible = false;
    invalidate();
  }

  /* ================= 05 · СТЯЖКА С УКЛОНОМ (общая, с проёмом под шахту) ================= */
  (function () {
    const sh = planShape(0.25, 0.25, W - 0.3, D - 0.3, 0, 0);
    sh.holes.push(rr(LF.x0 - 0.05, -LF.z1 - 0.05, LF.x1 + 0.05, -LF.z0 + 0.05));
    const g = group(); g.position.x = 0.25;
    const m = slab(sh, L3, LT, mat.screed, g); m.position.x = -0.25;
    reg(g, 5, { mode: "grow", axis: "x", delay: 0, dur: 0.3 });
  })();

  /* ================= 06–07 · АРМОКАРКАС И ФИБРОБЕТОН ================= */
  function skin(G, shape, lz, d1, d2) {
    const cage = new THREE.Mesh(new THREE.ShapeGeometry(shape, 28), mat.cage); cage.position.z = lz + 0.13; G.add(cage);
    reg(cage, 6, { mode: "rise", delay: d1, dur: 0.45 });
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, EXT), mat.fibro); m.position.z = lz + 0.06; m.castShadow = true; m.receiveShadow = true; G.add(m); shell(m);
    reg(m, 7, { mode: "rise", delay: d2, dur: 0.5 });
  }
  skin(frontG, frontGround(), -RC, 0, 0);
  skin(sideG, sideGround(), -RC, 0.05, 0.05);
  skin(frontG, frontUpper(), 0, 0.1, 0.12);
  skin(sideG, sideUpper(), 0, 0.15, 0.18);
  (function () {
    const o = new THREE.Mesh(new THREE.ExtrudeGeometry(hU1(RC), { depth: 0.05, bevelEnabled: false, curveSegments: 24 }), mat.plaster);
    o.position.z = -0.02; o.receiveShadow = true; frontG.add(o); shell(o); reg(o, 7, { mode: "rise", delay: 0.15, dur: 0.45 });
  })();
  // капители опор R1300: выносят пояс с плоскости 1 этажа на плоскость консоли
  (function () {
    const fs = flareShape(), g = group(), op = MD.facade.groundOpenings1;
    const front = [[op[0][0] - 0.42, op[0][0]]];
    for (let i = 0; i < op.length - 1; i++) front.push([op[i][1], op[i + 1][0]]);
    front.push([op[op.length - 1][1], W]);
    front.forEach(([a, b]) => {
      const m = new THREE.Mesh(new THREE.ExtrudeGeometry(fs, { depth: b - a, bevelEnabled: false, curveSegments: 20 }), mat.fibro);
      m.rotation.y = -PI / 2; m.position.set(b, 0, -RC + 0.27); m.castShadow = true; m.receiveShadow = true; g.add(m);
    });
    const op2 = MD.facade.groundOpenings2, a2 = op2[op2.length - 1][1];
    const m2 = new THREE.Mesh(new THREE.ExtrudeGeometry(fs, { depth: SE - a2, bevelEnabled: false, curveSegments: 20 }), mat.fibro);
    m2.rotation.y = PI; m2.position.set(RC - 0.27, 0, zr(SE)); m2.castShadow = true; m2.receiveShadow = true; g.add(m2);
    reg(shell(g), 7, { mode: "rise", delay: 0.02, dur: 0.35 });
  })();
  // угловая опора-«гриб»: ствол ⌀420, капитель R1300
  (function () {
    const pts = [new THREE.Vector2(0, -0.3), new THREE.Vector2(0.21, -0.3), new THREE.Vector2(0.21, 1.6)];
    for (let i = 1; i <= 16; i++) { const a = i / 16 * PI / 2; pts.push(new THREE.Vector2(0.21 + 1.44 * (1 - Math.cos(a)), 1.6 + RC * Math.sin(a))); }
    pts.push(new THREE.Vector2(0, 2.9));
    const lg = new THREE.LatheGeometry(pts, 28, -PI / 2 - 0.06, PI / 2 + 0.12);
    const o = new THREE.Mesh(lg, mat.fibro2); o.position.set(CX, 0, CZ); o.castShadow = true; o.receiveShadow = true; scene.add(o); shell(o);
    const cg = new THREE.Mesh(lg, cageMat(8, 6)); cg.scale.set(0.97, 1, 0.97); cg.position.set(CX, 0, CZ); scene.add(cg);
    reg(cg, 6, { mode: "rise", delay: 0.05, dur: 0.35 });
    reg(o, 7, { mode: "rise", delay: 0.02, dur: 0.35 });
  })();
  // ленты-арки фасада 2
  [false, true].forEach((mir, i) => {
    const c = ribbonCurve(mir), rw = MD.facade.ribbons.width / 2;
    const cageT = new THREE.Mesh(new THREE.TubeGeometry(c, 200, rw - 0.05, 10, false), cageMat(70, 2));
    cageT.position.z = 0.22; sideG.add(cageT); reg(cageT, 6, { mode: "rise", delay: 0.3 + i * 0.05, dur: 0.4 });
    const tg = group(sideG);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(c, 200, rw, 14, false), mat.fibro); tube.castShadow = true; tube.receiveShadow = true; tube.position.z = 0.22; tg.add(tube);
    [c.getPoint(0), c.getPoint(1)].forEach(p => { const s = new THREE.Mesh(new THREE.SphereGeometry(rw, 16, 12), mat.fibro); s.position.set(p.x, p.y, 0.22); tg.add(s); });
    reg(shell(tg), 7, { mode: "rise", delay: 0.35 + i * 0.05, dur: 0.45 });
  });
  // пояса по периметру
  (function () {
    const base = planShape(0, 0, W, D, RC, 0.9);
    MD.facade.belts.forEach(([y, h, out], i) => {
      const d = [0.3, 0.45, 0.55][i] || 0.5;
      reg(belt(base, y + 0.03, h - 0.06, out - 0.06, mat.cage), 6, { mode: "rise", delay: 0.4 + d * 0.3, dur: 0.3 });
      reg(shell(belt(base, y, h, out, mat.fibro)), 7, { mode: "rise", delay: d, dur: 0.3 });
    });
  })();

  /* ================= 08 · ВИТРАЖИ 2–3 ЭТАЖЕЙ ================= */
  (function () {
    const g = group(frontG);
    pane(g, RC, 3.6, W - 0.05, 10.1);
    bx(RC, 6.55, -0.16, 12.0, 7.15, -0.1, mat.slabEdge, g, false); mul(g, RC, 3.6, W - 0.05, 3.66); mul(g, RC, 10.04, W - 0.05, 10.1);
    [4.63, 6.07, 7.51, 8.95, 10.4, 11.82, 12.91].forEach(x => mul(g, x - 0.03, 3.6, x + 0.03, 10.1));
    reg(g, 8, { mode: "rise", delay: 0.05, dur: 0.5 });
  })();
  (function () {
    const g = group(sideG);
    pane(g, 0.05, 3.6, SE, 10.1);
    bx(0.05, 6.55, -0.16, SE, 7.15, -0.1, mat.slabEdge, g, false); mul(g, 0.05, 3.6, SE, 3.66); mul(g, 0.05, 10.04, SE, 10.1);
    [0.49, 1.27, 14.05].forEach(x => mul(g, x - 0.03, 3.6, x + 0.03, 10.1));
    reg(g, 8, { mode: "rise", delay: 0.12, dur: 0.5 });
  })();
  (function () {   // гнутый угол R1300
    const g = group();
    arcCyl(RC - 0.12, 3.6, 10.1, mat.glass, g, 36);
    arcCyl(RC - 0.1, 6.55, 7.15, mat.slabEdge, g, 36);
    arcCyl(RC - 0.1, 3.6, 3.66, mat.frame, g, 36); arcCyl(RC - 0.1, 10.04, 10.1, mat.frame, g, 36);
    [1, 2].forEach(k => {
      const a = -PI / 2 + k * PI / 6, r = RC - 0.1;
      const m = bx(-0.03, 3.6, -0.035, 0.03, 10.1, 0.035, mat.frame, g, false); m.position.set(CX + r * Math.sin(a), 6.85, CZ + r * Math.cos(a)); m.rotation.y = a;
    });
    reg(g, 8, { mode: "rise", delay: 0, dur: 0.5 });
  })();

  /* ================= 09 · БЛАГОУСТРОЙСТВО И ОТДЕЛКА ================= */
  (function () {
    const g0 = LV.ground;
    const pv = (x0, z0, x1, z1, d) => {
      const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0); g.rotateX(-PI / 2); g.translate((x1 - x0) / 2, 0, 0);
      const o = new THREE.Mesh(g, paveMat((x1 - x0) / 1.2, (z1 - z0) / 1.2)); o.position.set(x0, g0 + 0.015, (z0 + z1) / 2); o.receiveShadow = true; scene.add(o); grounds.push(o);
      reg(o, 9, { mode: "grow", axis: "x", delay: d, dur: 0.3 });
    };
    pv(-9, 0, 24, 5.6, 0); pv(-9, -18, -0.35, 0, 0.04); pv(W, -1.2, 24, 0, 0.06);
    const rp = pivotBox(-9, g0, 5.6, 24, g0 + 0.025, 6.4, mat.redPave, "x"); grounds.push(rp); reg(rp, 9, { mode: "grow", axis: "x", delay: 0.08, dur: 0.3 });
    // площадка ±0.000 под консолью и ступени к входам
    const plat = group();
    bx(0, g0, -RC, W, 0, 2.0, stoneMat(14, 1.2), plat);
    bx(-0.35, g0, -D, RC, 0, -RC, stoneMat(15, 1.2), plat);
    surf(0, -RC, W, 2.0, 0.002, paveMat(11, 2.7), plat); surf(-0.35, -D, RC, -RC, 0.002, paveMat(1.4, 12.5), plat);
    [3.0, 6.0].forEach(c => { for (let i = 0; i < 3; i++) bx(c - 1.0, g0, 2.0 + i * 0.32, c + 1.0, -0.15 * (i + 1), 2.0 + (i + 1) * 0.32, mat.stoneLight, plat); });
    for (let i = 0; i < 3; i++) bx(-0.35 - (i + 1) * 0.32, g0, -0.9, -0.35 - i * 0.32, -0.15 * (i + 1), 1.4, mat.stoneLight, plat);
    for (let i = 0; i < 3; i++) bx(-0.35 - (i + 1) * 0.32, g0, -13.9, -0.35 - i * 0.32, -0.15 * (i + 1), -12.3, mat.stoneLight, plat);
    reg(plat, 9, { mode: "rise", delay: 0.1, dur: 0.25 });
  })();
  (function () {   // летняя терраса кафе Socials
    const cafe = group(), g0 = LV.ground;
    bx(7.9, g0, 2.0, 13.7, g0 + 0.1, 5.5, mat.deckWood, cafe);
    [[8.3, 5.05], [9.8, 5.05], [11.3, 5.05], [12.8, 5.05], [13.25, 3.5], [8.3, 3.4]].forEach(([x, z]) => {
      bx(x - 0.45, g0 + 0.1, z - 0.4, x + 0.45, 0.35, z + 0.4, mat.wood, cafe);
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), mat.green); b.scale.set(1.05, 0.55, 0.95); b.position.set(x, 0.5, z); b.castShadow = true; cafe.add(b);
    });
    [[9.4, 3.0], [11.0, 3.0], [12.4, 3.0], [9.8, 4.2], [11.6, 4.2]].forEach(([x, z]) => {
      const tp = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.04, 20), mat.white); tp.position.set(x, 0.23, z); tp.castShadow = true; cafe.add(tp);
      const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.72, 8), mat.frame); lg.position.set(x, -0.14, z); cafe.add(lg);
      [[-0.6, 0], [0.6, 0]].forEach(([dx, dz]) => { const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.5, 16), mat.beige); ch.position.set(x + dx, -0.25, z + dz); ch.castShadow = true; cafe.add(ch); });
    });
    reg(cafe, 9, { mode: "drop", off: new V3(0, 2.5, 0), delay: 0.3, dur: 0.3 });
  })();
  (function () {   // логотип и вывеска
    const lg = new THREE.Mesh(new THREE.PlaneGeometry(2.55, 1.89), mat.logo); lg.position.set(2.42, 8.2, 0.04); frontG.add(lg);
    reg(lg, 9, { mode: "grow", axis: "xy", delay: 0.55, dur: 0.25 });
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), mat.cafe); sg.position.set(6.0, 2.45, -RC - 0.06); frontG.add(sg);
    reg(sg, 9, { mode: "grow", axis: "xy", delay: 0.6, dur: 0.25 });
  })();
  (function () {   // разметка, газоны, деревья
    const g0 = LV.ground, mk = group();
    for (let x = -5; x <= 21; x += 2.8) bx(x - 0.05, g0 + 0.002, 6.8, x + 0.05, g0 + 0.012, 11.6, mat.lineW, mk, false);
    for (let x = -8; x <= 26; x += 4) bx(x, g0 + 0.002, 15.2, x + 2, g0 + 0.012, 15.35, mat.lineW, mk, false);
    bx(2.2, g0 + 0.002, 6.8, 4.8, g0 + 0.012, 6.9, mat.lineY, mk, false);
    reg(mk, 9, { mode: "rise", delay: 0.2, dur: 0.2 });
    const gr = group();
    surf(-8.5, 6.6, -5.6, 11.6, g0 + 0.02, mat.grass, gr); surf(21.8, 6.6, 24.5, 11.6, g0 + 0.02, mat.grass, gr);
    surf(-6.8, 1.2, -1.8, 4.6, g0 + 0.03, mat.grass, gr); surf(14.6, 1.0, 20, 4.8, g0 + 0.03, mat.grass, gr);
    reg(gr, 9, { mode: "rise", delay: 0.25, dur: 0.15 });
    const cypress = (x, z, h = 3.4) => {
      const g = group(); g.position.set(x, g0, z);
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.5, h, 9), mat.greenDark); c.position.y = h / 2 + 0.25; c.castShadow = true; g.add(c);
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.3, 6), mat.wood); t.position.y = 0.15; g.add(t); return g;
    };
    const bush = (x, z, r = 0.45) => {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), mat.green); b.scale.y = 0.8;
      const g = group(); g.position.set(x, g0, z); b.position.y = r * 0.7; b.castShadow = true; g.add(b); return g;
    };
    let k = 0;
    [[-4.4, 2.5], [-3.0, 3.8], [16, 2.4], [18.6, 3.4], [-7, 9], [23, 8.8]].forEach(([x, z]) => reg(cypress(x, z), 9, { mode: "grow", delay: 0.4 + (k++) * 0.03, dur: 0.3 }));
    [[-6, 2], [-5.2, 3.9], [-2.3, 1.8], [15.2, 1.8], [17.2, 4.3], [19.4, 2.0], [-7.6, 7.4], [-6.4, 10.8], [22.6, 10.6], [23.6, 7.2]]
      .forEach(([x, z]) => reg(bush(x, z), 9, { mode: "grow", delay: 0.45 + (k++) * 0.02, dur: 0.3 }));
  })();
  // цвета отделки по дизайн-проектам: пол / потолок / акцентная стена каждого этажа
  (function () {
    const fin = col => M({ color: col, roughness: 0.85 }), F = MD.finishes;
    const floors = [
      { y: LB, h: -0.35, x0: RC + 0.3, z1: -RC - 0.3, c: F.fitness },
      { y: 0, h: 2.85, x0: RC + 0.15, z1: -RC - 0.15, c: F.cafe },
      { y: L1, h: L2 - 0.35, x0: 0.3, z1: -0.3, c: F.salon },
      { y: L2, h: L3 - 0.35, x0: 0.3, z1: -0.3, c: F.office }
    ];
    floors.forEach((fl, i) => {
      const g = group();
      bx(fl.x0, fl.y + 0.005, -D + 0.35, W - 0.35, fl.y + 0.02, fl.z1, fin(fl.c.floor), g, false);
      bx(fl.x0, fl.h - 0.02, -D + 0.35, W - 0.35, fl.h, fl.z1, fin(fl.c.ceil), g, false);
      bx(W - 0.36, fl.y, -D + 0.6, W - 0.33, fl.h, fl.z1 - 0.2, fin(fl.c.accent), g, false);
      reg(g, 9, { mode: "rise", delay: 0.3 + i * 0.08, dur: 0.25 });
    });
    const off = group();
    [5.2, 7.0, 8.8, 10.6].forEach(x => {
      bx(x - 0.7, L2 + 0.72, -1.55, x + 0.7, L2 + 0.76, -0.85, mat.white, off, false);
      bx(x - 0.66, L2, -1.5, x - 0.62, L2 + 0.72, -0.9, mat.white, off, false); bx(x + 0.62, L2, -1.5, x + 0.66, L2 + 0.72, -0.9, mat.white, off, false);
      bx(x - 0.25, L2, -2.1, x + 0.25, L2 + 0.5, -1.7, mat.orange, off, false);
    });
    [6.0, 8.0, 10.0].forEach(x => { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.5, 16), mat.white); c.position.set(x, L1 + 0.25, -1.6); off.add(c); });
    reg(off, 9, { mode: "drop", off: new V3(0, 0.8, 0), delay: 0.5, dur: 0.25 });
  })();

  /* ================= ОТМЕТКИ, ЭТАЖИ, КОНФЛИКТЫ ================= */
  const RX = -1.3, RZ = -D + 1.0;
  const LEVELS = [[LB, 0], [LV.ground, 0], [0, 0], [L1, 0], [L2, 0], [L3, 0], [LT, 5], [LR, 4], [LV.shaftTop, 3]];
  const ruler = group();
  (function () {
    const pts = [new V3(RX, LB, RZ), new V3(RX, LV.shaftTop, RZ)];
    LEVELS.forEach(([y]) => { pts.push(new V3(RX - 0.25, y, RZ), new V3(RX + 0.25, y, RZ)); });
    ruler.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x2a2f33 })));
  })();
  const labelsEl = document.getElementById("m-labels");
  const fmtLv = v => (Math.abs(v) < 1e-9 ? "±" : v > 0 ? "+" : "−") + Math.abs(v).toFixed(3);
  const fmtArea = v => String(Math.round(v * 100) / 100).replace(".", ",");
  const labels = [];
  let showElev = true;
  function addLabel(cls, html, v, s, dx, kind) {
    const el = document.createElement("div"); el.className = cls; el.innerHTML = html; labelsEl.appendChild(el);
    labels.push({ el, s, v, dx: dx || 0, kind: kind || "elev" });
  }
  LEVELS.forEach(([y, s]) => addLabel("m-elev", `<b>${fmtLv(y)}</b><i></i>`, new V3(RX - 0.3, y, RZ), s, 0));
  (function () {
    const floorsData = (window.EDIFICE_DATA && window.EDIFICE_DATA.floors) || {};
    MD.floorLabels.forEach(f => {
      const d = floorsData[f.slug], area = d && d.area ? ` · ${fmtArea(d.area)} м²` : "";
      addLabel("m-fl", `<b>${f.n}</b> · ${f.name}${area}${f.note ? " · " + f.note : ""}`, new V3(RX - 0.3, f.y, RZ), f.from || 0, -86);
    });
  })();
  const conflictPos = {
    head: new V3((LF.x0 + LF.x1) / 2, 15.2, LF.zc),
    step: new V3(LF.x1 + 0.5, (L3 + LT) / 2, LF.zc)
  };
  MD.conflicts.forEach(c => { if (conflictPos[c.id]) addLabel("m-flag", `<i></i><span>${c.text}</span>`, conflictPos[c.id], c.from, 0, "flag"); });

  function placeLabels(t) {
    const w = canvas.clientWidth, h = canvas.clientHeight, tmp = new V3();
    labels.forEach(L => {
      tmp.copy(L.v).project(camera);
      const vis = L.kind === "flag" ? t >= L.s - 0.5 : (showElev && t >= L.s - 0.5 && (L.v.y > -0.7 || xray));
      const x = (tmp.x + 1) / 2 * w + L.dx, y = (1 - tmp.y) / 2 * h;
      const fits = L.kind === "flag" ? x > -10 && x < w - 40 : x > 72;   // подпись влезает в кадр целиком
      const on = vis && tmp.z < 1 && fits && y > 0 && y < h;
      L.el.classList.toggle("m-hide", !on);
      if (tmp.z < 1) {
        // флаг конфликта не прячем под панель видов — прижимаем ниже неё
        const top = mobile ? 150 : 128;
        L.el.style.transform = L.kind === "flag" ? `translate(${x}px,${Math.max(y, top)}px) translate(-12px,-100%)` : `translate(${x}px,${y}px) translate(-100%,-50%)`;
      }
    });
  }

  /* ================= КАМЕРА ================= */
  let camTween = null;
  function viewPos(name) {
    const v = MD.views[name], p = new V3(...v.p), c = new V3(...v.c);
    const a = camera.aspect; if (a < 1.2) p.sub(c).multiplyScalar(a < 0.6 ? 2.0 : a < 0.8 ? 1.75 : 1.3).add(c);
    if (a < 0.8) { p.y -= 3; c.y -= 3; }   // телефон: здание выше карточки этапа
    return [p, c];
  }
  function goView(name, instant) {
    const [p, c] = viewPos(name);
    document.querySelectorAll("[data-view]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.view === name)));
    if (MD.views[name].xray && !xray) setXray(true);
    if (instant || reduce) { camera.position.copy(p); controls.target.copy(c); camTween = null; }
    else camTween = { t: 0, p0: camera.position.clone(), p1: p, c0: controls.target.clone(), c1: c };
    invalidate();
  }

  /* ================= СТАТУСЫ ИЗ data.js ================= */
  const ORDER = MD.statusOrder, SL = MD.statusLabels;
  const rank = s => { const i = ORDER.indexOf(s); return i < 0 ? 0 : i; };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  let stageStatus = [];
  function itemStage(it) {
    const S = window.EDIFICE_STAGE;
    return S && S.stageOf ? S.stageOf(it) : (it.stageHint || it.stage || "counting");
  }
  function computeStatuses() {
    const DATA = window.EDIFICE_DATA || {};
    const contracts = {}; (DATA.contracts || []).forEach(c => { contracts[c.id] = c; });
    const floors = DATA.floors || {};
    stageStatus = STAGES.map(st => {
      const cfg = st.status || {}, src = [];
      if (cfg.fixed) return { stage: cfg.fixed, src: [], fixed: true };
      (cfg.contracts || []).forEach(id => {
        const c = contracts[id];
        if (c && c.stage) src.push({ kind: "contract", stage: c.stage, label: c.name || id, href: c.href });
      });
      if (cfg.lift && DATA.lift && DATA.lift.items) {
        const hits = DATA.lift.items.filter(it => cfg.lift.indexOf(itemStage(it)) >= 0);
        hits.forEach(it => src.push({ kind: "lift", stage: itemStage(it), label: it.name }));
      }
      (cfg.floors || []).forEach(slug => {
        const f = floors[slug]; if (!f || !f.items || !f.items.length) return;
        const cnt = {}; let worst = "done";
        f.items.forEach(it => { const s = itemStage(it); cnt[s] = (cnt[s] || 0) + 1; if (rank(s) < rank(worst)) worst = s; });
        src.push({ kind: "floor", stage: worst, label: f.name || slug, count: f.items.length, cnt });
      });
      if (!src.length) return { stage: "nodata", src };
      const stage = src.reduce((a, s) => rank(s.stage) < rank(a) ? s.stage : a, "done");
      return { stage, src };
    });
  }
  function nowStage() {
    for (let k = 0; k < stageStatus.length; k++) if (stageStatus[k].stage !== "done") return k;
    return N;
  }
  function nowT() {
    const k = nowStage(); if (k <= 0) return 0;
    if (stageStatus[k].stage === "done") return N;
    return k - 1 + (stageStatus[k].stage === "progress" ? 0.5 : 0.06);
  }

  /* ================= ВНУТРЕННИЕ ЗАМЕТКИ (только admin / manager) ================= */
  let priv = null;
  function canPrivate() {
    const A = window.EdificeAuth; if (!A || !A.current) return false;
    const s = A.current();
    return !!(s && !s.open && (s.role === "admin" || s.role === "manager"));
  }
  function loadPrivate() {
    if (!canPrivate()) return;
    const sc = document.createElement("script");
    sc.src = (document.body.getAttribute("data-root") || "") + "assets/model-private.js";
    sc.onload = () => { priv = window.EDIFICE_MODEL_PRIVATE || null; renderPrivate(); };
    sc.onerror = () => { priv = null; };
    document.head.appendChild(sc);
  }
  function renderPrivate() {
    const halt = document.getElementById("m-halt");
    if (priv && priv.halt && halt) { halt.innerHTML = `<b>${esc(priv.halt.tag)}</b>${esc(priv.halt.text)}`; halt.hidden = false; }
    shownK = -1; updUI();
  }

  /* ================= UI ================= */
  const $ = id => document.getElementById(id);
  const cardEl = $("m-card"), scrub = $("m-scrub"), playBtn = $("m-play"), ticksEl = $("m-ticks"), clockEl = $("m-clock"), nowBtn = $("m-now");
  const ICON_PLAY = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z"/></svg>';
  const ICON_PAUSE = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 2.5h3v11h-3zM9.5 2.5h3v11h-3z"/></svg>';
  const SPS = 3.2;   // секунд на этап при воспроизведении
  const pad = k => String(k).padStart(2, "0");
  let t = N, playing = false, tTarget = null, shownK = -1, lastApplied = -1, xray = false, T_NOW = 0, cardOpen = false;

  // кнопки видов — из model-data.js
  (function () {
    const vs = $("m-view-seg");
    Object.keys(MD.views).forEach(k => {
      const b = document.createElement("button"); b.type = "button"; b.dataset.view = k; b.textContent = MD.views[k].label;
      b.setAttribute("aria-pressed", "false"); b.addEventListener("click", () => goView(k)); vs.appendChild(b);
    });
  })();

  STAGES.forEach((s, k) => {
    const b = document.createElement("button"); b.type = "button"; b.className = "m-tick"; b.style.left = (k / N * 100) + "%";
    b.innerHTML = `<b>${pad(k)}</b><span>${esc(s.short)}</span><i class="m-dot"></i>`;
    b.setAttribute("aria-label", `Этап ${k}: ${s.name}`);
    b.addEventListener("click", () => { playing = false; tTarget = k; updPlay(); invalidate(); });
    ticksEl.appendChild(b);
  });
  const tickEls = Array.prototype.slice.call(ticksEl.children);
  nowBtn.addEventListener("click", () => { playing = false; tTarget = T_NOW; updPlay(); invalidate(); });

  function refreshStatuses() {
    computeStatuses();
    T_NOW = nowT();
    const k = nowStage();
    nowBtn.style.left = `calc(8px + (100% - 16px) * ${T_NOW / N})`;
    nowBtn.setAttribute("aria-label", `Сейчас: этап ${pad(k)} — ${STAGES[k].name}`);
    tickEls.forEach((el, i) => {
      const st = stageStatus[i].stage;
      el.dataset.st = st; el.classList.toggle("m-tick-now", i === k);
      el.title = `${STAGES[i].name} — ${SL[st] || st}`;
    });
    const rev = $("m-rev"), DATA = window.EDIFICE_DATA;
    if (rev && DATA && DATA.meta) rev.textContent = "data.js · " + (DATA.meta.revision || DATA.meta.collected || "");
    shownK = -1;
  }

  const stageOf = tt => tt <= 1e-4 ? 0 : Math.min(N, Math.ceil(tt - 1e-6));
  function statusHtml(k) {
    const ss = stageStatus[k]; if (!ss) return "";
    const pill = `<span class="m-pill" data-st="${ss.stage}">${SL[ss.stage] || ss.stage}</span>`;
    let src = "";
    if (ss.fixed) src = "существующее состояние";
    else if (!ss.src.length) src = "в data.js нет позиций для этого этапа";
    else {
      const parts = [];
      ss.src.filter(s => s.kind === "contract").forEach(s => parts.push(`${esc(s.label)} — ${SL[s.stage] || esc(s.stage)}`));
      const lift = ss.src.filter(s => s.kind === "lift");
      if (lift.length) parts.push(`ждут: ${lift.map(s => esc(s.label)).join(", ")}`);
      const fl = ss.src.filter(s => s.kind === "floor");
      if (fl.length) {
        const cnt = {}; let total = 0;
        fl.forEach(s => { total += s.count; Object.keys(s.cnt).forEach(x => { cnt[x] = (cnt[x] || 0) + s.cnt[x]; }); });
        const c = Object.keys(cnt).sort((a, b) => rank(a) - rank(b)).map(x => `${cnt[x]} ${SL[x] || x}`).join(", ");
        parts.push(`${fl.map(s => esc(s.label)).join(", ")}: ${total} поз. — ${c}`);
      }
      src = parts.join(" · ");
    }
    return `<div class="m-status">${pill}<span>${src}</span></div>`;
  }
  function renderCard(k) {
    const s = STAGES[k], P = priv && priv.stages ? priv.stages[k] : null;
    const isNow = k === nowStage();
    let h = `<div class="m-eyebrow"><b>${pad(k)}</b><span>этап из ${pad(N)}</span>${isNow ? '<em class="m-now-tag">сейчас</em>' : ""}<button type="button" class="m-more" aria-expanded="${cardOpen}">${cardOpen ? "свернуть" : "подробнее"}</button></div>
      <h2>${esc(s.name)}</h2><div class="m-bar"><i id="m-bar"></i></div><p>${esc(s.text)}</p>${statusHtml(k)}`;
    if (s.facts && s.facts.length) h += `<dl class="m-facts">${s.facts.map(f => `<dt>${esc(f[0])}</dt><dd>${esc(f[1])}</dd><span class="m-src${f[2] === "допущение" ? " m-src-a" : ""}">${esc(f[2])}</span>`).join("")}</dl>`;
    if (P) {
      if (P.comment) h += `<div class="m-note"><span>комментарий</span>${esc(P.comment)}</div>`;
      const A = P.check || [];
      if (A.length) h += `<div class="m-check"><span>проверить</span>${A.length > 1 ? `<ol>${A.map(a => `<li>${esc(a)}</li>`).join("")}</ol>` : esc(A[0])}</div>`;
    }
    cardEl.innerHTML = h;
    cardEl.classList.toggle("m-open", cardOpen);
    const more = cardEl.querySelector(".m-more");
    if (more) more.addEventListener("click", () => { cardOpen = !cardOpen; shownK = -1; updUI(); });
    tickEls.forEach((el, i) => el.classList.toggle("m-on", i === k));
  }
  function updUI() {
    const k = stageOf(t);
    if (k !== shownK) { shownK = k; renderCard(k); }
    const pr = k === 0 ? 1 : THREE.MathUtils.clamp(t - (k - 1), 0, 1);
    const bar = $("m-bar"); if (bar) bar.style.width = (pr * 100) + "%";
    scrub.value = t; scrub.style.setProperty("--p", (t / N * 100) + "%");
    clockEl.innerHTML = `<b>${pad(k)} / ${pad(N)}</b>${Math.round(pr * 100)}%`;
  }
  function updPlay() {
    playBtn.innerHTML = playing ? ICON_PAUSE : ICON_PLAY;
    playBtn.setAttribute("aria-label", playing ? "Пауза" : (t >= N ? "Смотреть стройку с начала" : "Продолжить"));
  }
  playBtn.addEventListener("click", () => { if (playing) playing = false; else { if (t >= N - 1e-3) t = 0; playing = true; tTarget = null; } updPlay(); invalidate(); });
  scrub.addEventListener("input", () => { playing = false; tTarget = null; t = +scrub.value; updPlay(); invalidate(); });

  const tElev = $("m-elev"), tCtx = $("m-ctx"), tX = $("m-xray");
  tElev.addEventListener("click", () => { showElev = !showElev; ruler.visible = showElev; tElev.setAttribute("aria-pressed", String(showElev)); invalidate(); });
  tCtx.addEventListener("click", () => { ctx.visible = !ctx.visible; tCtx.setAttribute("aria-pressed", String(ctx.visible)); invalidate(); });
  function setXray(on) {
    xray = on; tX.setAttribute("aria-pressed", String(xray));
    const seen = new Set();
    const apply = (m, op) => {
      (Array.isArray(m.material) ? m.material : [m.material]).forEach(x => {
        if (seen.has(x)) return; seen.add(x);
        const o = x.userData.xr !== undefined ? x.userData.xr : op;
        if (x.userData.op === undefined) { x.userData.op = x.opacity; x.userData.tr = x.transparent; x.userData.dw = x.depthWrite; }
        x.transparent = xray ? true : x.userData.tr; x.opacity = xray ? o : x.userData.op; x.depthWrite = xray ? false : x.userData.dw; x.needsUpdate = true;
      });
    };
    const matXr = m => [].concat(m.material).some(x => x && x.userData && x.userData.xr !== undefined);
    scene.traverse(m => {
      if (!m.isMesh) return;
      if (m.userData.shell) { apply(m, 0.14); m.castShadow = !xray; }
      else if (m.userData.xr) apply(m, m.userData.xr);
      else if (matXr(m)) apply(m, 0.1);
    });
    grounds.forEach(g => g.traverse(m => { if (m.isMesh) apply(m, 0.28); }));
    invalidate();
  }
  tX.addEventListener("click", () => setXray(!xray));
  addEventListener("keydown", e => {
    const tag = e.target && e.target.tagName;
    if (tag === "BUTTON" || tag === "A" || tag === "SELECT" || tag === "TEXTAREA" || (tag === "INPUT" && e.target.type !== "range")) return;
    if (e.code === "Space") { e.preventDefault(); playBtn.click(); }
    else if (e.code === "ArrowRight" && tag !== "INPUT") { playing = false; tTarget = Math.min(N, Math.floor(t + 1e-3) + 1); updPlay(); invalidate(); }
    else if (e.code === "ArrowLeft" && tag !== "INPUT") { playing = false; tTarget = Math.max(0, Math.ceil(t - 1e-3) - 1); updPlay(); invalidate(); }
  });
  controls.addEventListener("start", () => {
    camTween = null; document.querySelectorAll("[data-view]").forEach(b => b.setAttribute("aria-pressed", "false"));
    const hint = $("m-hint"); if (hint) hint.hidden = true;
  });
  controls.addEventListener("change", () => invalidate());

  /* ================= РАЗМЕР И ЦИКЛ (рендер только при изменениях) ================= */
  function syncHead() {
    const head = document.querySelector("header.top");
    document.documentElement.style.setProperty("--m-head", (head ? head.offsetHeight : 0) + "px");
  }
  function resize() {
    syncHead();
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix(); invalidate();
  }
  if (window.ResizeObserver) new ResizeObserver(resize).observe(rootEl); else addEventListener("resize", resize);

  let raf = 0, last = 0, probe = mobile ? 40 : 0, probeStart = 0;
  function invalidate() { if (!raf) raf = requestAnimationFrame(frame); }
  function frame(now) {
    raf = 0;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60; last = now;
    let busy = false;
    if (playing) { t = Math.min(N, t + dt / SPS); busy = true; if (t >= N) { playing = false; updPlay(); } }
    if (tTarget !== null) {
      const d = tTarget - t, step = dt * (reduce ? 99 : 2.2); busy = true;
      if (Math.abs(d) <= step) { t = tTarget; tTarget = null; updPlay(); } else t += Math.sign(d) * step;
    }
    if (t !== lastApplied) { applyT(t); lastApplied = t; }
    updUI();
    if (camTween) {
      camTween.t = Math.min(1, camTween.t + dt / 0.9); const e = easeIO(camTween.t);
      camera.position.lerpVectors(camTween.p0, camTween.p1, e); controls.target.lerpVectors(camTween.c0, camTween.c1, e);
      if (camTween.t >= 1) camTween = null; busy = true;
    }
    if (controls.update()) busy = true;
    renderer.render(scene, camera);
    placeLabels(t);
    // мобильный: замер FPS первых кадров; при < 30 кадр/с — без RoomEnvironment
    if (probe > 0) {
      if (!probeStart) probeStart = now;
      if (--probe === 0) {
        const fps = 39 / Math.max(1e-3, (now - probeStart) / 1000);
        if (fps < 30 && scene.environment) { scene.environment = null; scene.traverse(m => { if (m.material) [].concat(m.material).forEach(x => { x.needsUpdate = true; }); }); }
      } else busy = true;
    }
    if (!busy) last = 0;
    else invalidate();
  }

  /* ================= СТАРТ ================= */
  refreshStatuses();
  setVariant(variant);
  syncHead(); resize();
  goView("corner", true);
  t = N; updPlay(); applyT(t); lastApplied = t;
  loadPrivate();
  document.addEventListener("edifice:route", () => { refreshStatuses(); invalidate(); });
  invalidate();

  // крючки для проверок (Playwright): состояние без анимации
  window.__model = {
    setT(v) { t = v; tTarget = null; playing = false; updPlay(); invalidate(); },
    view(v, x) { goView(v, true); if (x !== undefined && x !== xray) setXray(x); },
    variant: setVariant,
    now: () => ({ stage: nowStage(), t: T_NOW }),
    statuses: () => stageStatus.map((s, i) => ({ k: i, stage: s.stage })),
    busy: () => !!raf
  };
})();
