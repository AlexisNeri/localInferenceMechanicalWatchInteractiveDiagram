// The 3D mechanical watch: every part is built procedurally, and the movement
// is animated with honest watch ratios running in slow motion, so it behaves
// like a real mechanical watch — tick, tick, tick — the whole time.
import * as THREE from "three";

const TAU = Math.PI * 2;

/* ------------------------------------------------------------------ timing
   "watch time" runs at half the real speed (slow motion), but all the ratios
   are the real ones:
   - mainspring barrel:  1 turn per 24 hours
   - center wheel:       1 turn per hour  (it carries the minute hand)
   - fourth wheel:       1 turn per minute (drives the second hand)
   - escape wheel:       30 beats per turn (one tooth-step per beat)
   - second hand:        75 little ticks per turn
   - balance wheel:      one full swing per 2 beats (the ticking heartbeat) */
const BEAT = 1.25; // escapement beats per second of watch time
const ESCAPE_TEETH = 15;
const BEATS_PER_REV = ESCAPE_TEETH * 2; // 30
const BAL_AMP = (270 * Math.PI) / 180; // balance swing amplitude, in radians

const PERIOD = { barrel: 86400, center: 3600, second: 90, third: 45, fourth: 60 };
const HAND = { hour: 86400, minute: 3600 };

// movement scale: the movement is built around the dial center at 72% size
// so it fits inside the case like a real watch
const S = 0.72;
const DC = { x: 0, y: 0.45 }; // dial center (movement center)

/* Movement layout, seen from the front of the dial (the X-Y plane). */
const P = {
  barrel: { x: DC.x + S * 0.62, y: DC.y + S * 1.17 },
  center: { x: DC.x, y: DC.y },
  second: { x: DC.x - S * 0.61, y: DC.y - S * 0.35 },
  third: { x: DC.x - S * 0.92, y: DC.y - S * 0.79 },
  fourth: { x: DC.x - S * 1.04, y: DC.y - S * 1.48 },
  escape: { x: -0.7, y: -0.98 },
  balance: { x: -1.32, y: -1.06 },
  pallet: { x: -1.34, y: -0.69 },
  crown: { x: 3.45, y: DC.y },
  dial: { x: DC.x, y: DC.y },
  crystal: { x: 1.35, y: 1.9 },
  hands: { x: DC.x, y: DC.y },
};
const R = {
  center: 0.85 * S,
  second: 0.45 * S,
  third: 0.62 * S,
  fourth: 0.78 * S,
  escape: 0.42 * S,
  balance: 0.54 * S,
};
const BARREL_R = 0.88; // mainspring barrel drum radius

const COL = {
  gold: 0xd9b45f,
  brass: 0xcfa85f,
  steel: 0xc9ced6,
  dark: 0x7d838c,
  blued: 0x2e5fc9,
  ruby: 0xd8363c,
  ivory: 0xf6f0e2,
  red: 0xd8433c,
  caseGold: 0xdcc48f,
};

/* ------------------------------------------------------------- materials */

const metal = (color, { metalness = 0.9, roughness = 0.3, env = 0.9 } = {}) =>
  new THREE.MeshStandardMaterial({ color, metalness, roughness, envMapIntensity: env });

const glass = () =>
  new THREE.MeshPhysicalMaterial({
    color: 0xf4fbff,
    metalness: 0,
    roughness: 0.05,
    transparent: true,
    opacity: 0.16,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    envMapIntensity: 1.4,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

/* ------------------------------------------------------------ geometry */

function gearShape(teeth, pitchR, { sawtooth = false, toothAmp = 0.13 } = {}) {
  const rT = pitchR * (1 + toothAmp);
  const rR = pitchR * (1 - toothAmp);
  const step = TAU / teeth;
  const pts = [];
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    if (sawtooth) pts.push([a, rT], [a + step * 0.42, pitchR * (1 - toothAmp * 0.65)], [a + step * 0.96, rR]);
    else pts.push([a, rR], [a + step * 0.3, rT], [a + step * 0.54, rT], [a + step * 0.82, rR]);
  }
  const shape = new THREE.Shape();
  pts.forEach(([a, r], i) => (i === 0 ? shape.moveTo(Math.cos(a) * r, Math.sin(a) * r) : shape.lineTo(Math.cos(a) * r, Math.sin(a) * r)));
  shape.closePath();
  return shape;
}

function hole(r, x = 0, y = 0) {
  const p = new THREE.Path();
  p.absarc(x, y, r, 0, TAU, true);
  return p;
}

function gearMesh({ teeth, pitchR, mat, depth = 0.085, sawtooth = false, toothAmp = 0.13, windows = 0, bore = 0.055 }) {
  const shape = gearShape(teeth, pitchR, { sawtooth, toothAmp });
  if (bore) shape.holes.push(hole(bore));
  for (let i = 0; i < windows; i++) {
    const a = (i / windows) * TAU + TAU / (windows * 2);
    shape.holes.push(hole(pitchR * 0.31, Math.cos(a) * pitchR * 0.56, Math.sin(a) * pitchR * 0.56));
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geo.translate(0, 0, -depth / 2);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = m.receiveShadow = true;
  return m;
}

function cylZ(r, h, mat, seg = 32) {
  const g = new THREE.CylinderGeometry(r, r, h, seg);
  g.rotateX(Math.PI / 2);
  const m = new THREE.Mesh(g, mat);
  m.castShadow = m.receiveShadow = true;
  return m;
}

function ringZ(rIn, rOut, h, mat, seg = 80) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, rOut, 0, TAU, false);
  shape.holes.push(hole(rIn));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: seg });
  geo.translate(0, 0, -h / 2);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = m.receiveShadow = true;
  return m;
}

function tubeZ(rIn, rOut, h, mat, seg = 96) {
  const g = new THREE.Group();
  const outer = new THREE.CylinderGeometry(rOut, rOut, h, seg, 1, true);
  outer.rotateX(Math.PI / 2);
  const inner = new THREE.CylinderGeometry(rIn, rIn, h, seg, 1, true);
  inner.rotateX(Math.PI / 2);
  const a = new THREE.Mesh(outer, mat);
  const b = new THREE.Mesh(inner, mat);
  a.castShadow = a.receiveShadow = b.castShadow = b.receiveShadow = true;
  g.add(a, b);
  return g;
}

function spiralCurve(turns, r0, r1) {
  const pts = [];
  const N = 240;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const a = t * turns * TAU;
    const r = r0 + (r1 - r0) * t;
    pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0));
  }
  return new THREE.CatmullRomCurve3(pts);
}

function handShape() {
  const s = new THREE.Shape();
  s.moveTo(-0.14, -0.28);
  s.lineTo(0.14, -0.28);
  s.lineTo(0.075, 0.2);
  s.lineTo(0.06, 1.02);
  s.lineTo(0, 1.12);
  s.lineTo(-0.06, 1.02);
  s.lineTo(-0.075, 0.2);
  s.closePath();
  return s;
}

/* ------------------------------------------------------------ the watch */

export function createWatch(scene) {
  const parts = {};
  const targets = [];
  const spin = {};
  const hands = {};

  function register(id, group, focus, size) {
    const meshes = [];
    group.traverse((o) => {
      if (o.isMesh) {
        o.userData.partId = id;
        targets.push(o);
        meshes.push(o);
      }
    });
    scene.add(group);
    parts[id] = { id, group, meshes, focus: new THREE.Vector3(focus[0], focus[1], focus[2]), size };
    return group;
  }

  /* ---- mainspring barrel: the drum full of stored strength ---- */
  {
    const g = new THREE.Group();
    const x = P.barrel.x;
    const y = P.barrel.y;
    const wallMat = metal(COL.brass, { roughness: 0.4 });
    const goldMat = metal(COL.gold, { roughness: 0.28, env: 1.05 });
    const bluedMat = metal(COL.blued, { metalness: 0.7, roughness: 0.3, env: 1.15 });

    const body = new THREE.Group(); // this slowly unwinds
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(BARREL_R, BARREL_R, 0.3, 72, 1, true).rotateX(Math.PI / 2), wallMat);
    drum.castShadow = drum.receiveShadow = true;
    const rim = gearMesh({ teeth: 60, pitchR: BARREL_R, mat: goldMat, depth: 0.07, toothAmp: 0.035, bore: BARREL_R - 0.06 });
    rim.position.z = -0.16;
    const spring = new THREE.Mesh(new THREE.TubeGeometry(spiralCurve(9, BARREL_R * 0.22, BARREL_R * 0.88), 320, 0.02, 6, false), bluedMat);
    spring.castShadow = true;
    body.add(drum, rim, spring);
    body.position.set(x, y, 0);

    const cap = cylZ(0.24, 0.07, metal(COL.gold, { roughness: 0.3 }));
    const axle = cylZ(0.05, 0.55, metal(COL.dark));
    cap.position.set(x, y, 0.19);
    axle.position.set(x, y, 0);
    g.add(body, cap, axle);
    register("barrel", g, [x, y, 0.02], 2.45);
    spin.barrel = body;
  }

  /* ---- the gear train: center wheel + three little helper wheels ---- */
  const brassM = metal(COL.brass, { metalness: 0.88, roughness: 0.36 });
  const goldM = metal(COL.gold, { metalness: 0.92, roughness: 0.28, env: 1.05 });
  const rubyM = metal(COL.ruby, { metalness: 0.15, roughness: 0.25, env: 1.2 });
  const darkM = metal(COL.dark);

  function trainWheel(id, pos, key, teeth, z, windows, mat) {
    const holder = new THREE.Group();
    const wheel = new THREE.Group();
    wheel.add(gearMesh({ teeth, pitchR: R[key], mat, depth: 0.08, windows, bore: 0.05 }));
    wheel.add(cylZ(0.04, 0.5, darkM));
    const jewel = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.022, 10, 28), rubyM.clone());
    jewel.position.z = 0.19;
    wheel.add(jewel);
    holder.position.set(pos.x, pos.y, z);
    holder.add(wheel);
    register(id, holder, [pos.x, pos.y, z], R[key] * 2.4);
    spin[id] = wheel;
  }
  trainWheel("centerWheel", P.center, "center", 38, -0.02, 4, brassM);
  trainWheel("trainWheel", P.second, "second", 24, -0.12, 4, goldM);
  trainWheel("thirdWheel", P.third, "third", 26, -0.22, 3, brassM);
  trainWheel("fourthWheel", P.fourth, "fourth", 32, -0.32, 0, goldM);

  /* ---- escape wheel: sharp, asymmetric teeth ---- */
  {
    const holder = new THREE.Group();
    const wheel = new THREE.Group();
    wheel.add(gearMesh({ teeth: ESCAPE_TEETH, pitchR: R.escape, mat: goldM, depth: 0.07, sawtooth: true, bore: 0.05 }));
    wheel.add(cylZ(0.035, 0.46, darkM));
    const jewel = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.02, 10, 28), rubyM.clone());
    jewel.position.z = 0.17;
    wheel.add(jewel);
    holder.position.set(P.escape.x, P.escape.y, -0.4);
    holder.add(wheel);
    register("escapeWheel", holder, [holder.position.x, holder.position.y, holder.position.z], R.escape * 2.8);
    spin.escapeWheel = wheel;
  }

  /* ---- pallet fork: the little anchor that holds the escape wheel ----
       The fork rests with its arms facing the escape wheel; it oscillates
       around its own Z axis, one tick per beat. */
  {
    const holder = new THREE.Group();
    const g = new THREE.Group();
    const s = new THREE.Shape();
    s.moveTo(-0.1, -0.05);
    s.lineTo(0.3, -0.08);
    s.lineTo(0.47, -0.34);
    s.lineTo(0.6, -0.27);
    s.lineTo(0.5, -0.1);
    s.lineTo(0.38, -0.03);
    s.lineTo(0.38, 0.03);
    s.lineTo(0.5, 0.1);
    s.lineTo(0.6, 0.27);
    s.lineTo(0.47, 0.34);
    s.lineTo(0.3, 0.08);
    s.lineTo(-0.1, 0.05);
    s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: false });
    geo.translate(0, 0, -0.03);
    const fork = new THREE.Mesh(geo, metal(COL.steel, { metalness: 1, roughness: 0.28, env: 1.1 }));
    fork.castShadow = true;
    g.add(fork);
    const gemMat = rubyM.clone();
    for (const sy of [-1, 1]) {
      const gem = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.045, 0.045), gemMat);
      gem.position.set(0.55, sy * 0.28, 0);
      g.add(gem);
    }
    // the fork is small (real forks are tiny), but keep its own thickness
    g.scale.set(0.55, 0.55, 1);
    const arbor = cylZ(0.03, 0.4, darkM);
    holder.position.set(P.pallet.x, P.pallet.y, -0.38);
    const base = Math.atan2(P.escape.y - P.pallet.y, P.escape.x - P.pallet.x);
    g.rotation.z = base;
    g.userData.baseAngle = base;
    holder.add(g, arbor);
    register("palletFork", holder, [holder.position.x, holder.position.y, holder.position.z], 1.0);
    spin.palletFork = g;
  }

  /* ---- balance wheel + hairspring: the metronome heart ---- */
  {
    const holder = new THREE.Group();
    const g = new THREE.Group();
    const steelM = metal(COL.steel, { metalness: 1, roughness: 0.26, env: 1.1 });
    const bluedM = metal(COL.blued, { metalness: 0.7, roughness: 0.25, env: 1.2 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.036, 12, 56), steelM);
    ring.castShadow = true;
    const a1 = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.058, 0.04), steelM);
    const a2 = a1.clone();
    a2.rotation.z = Math.PI / 2;
    const hub = cylZ(0.058, 0.12, darkM);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.048, 0.08, 20).rotateX(Math.PI / 2), metal(COL.gold, { roughness: 0.3 }));
    cap.position.z = 0.09;
    const spiral = new THREE.Mesh(new THREE.TubeGeometry(spiralCurve(6.5, 0.043, 0.23), 260, 0.008, 5, false), bluedM);
    spiral.position.z = 0.045;
    spiral.castShadow = true;
    g.add(ring, a1, a2, hub, cap, spiral);
    holder.position.set(P.balance.x, P.balance.y, -0.34);
    holder.add(g);
    register("balance", holder, [holder.position.x, holder.position.y, holder.position.z], 1.5);
    spin.balance = g;

    // the hairspring lives inside the balance (it co-swings with it), but it is
    // clickable as its own piece: re-tag the spiral and pull it out of the
    // balance's mesh list so hovering one never lights up the other
    spiral.userData.partId = "balanceSpring";
    parts.balance.meshes = parts.balance.meshes.filter((m) => m !== spiral);
    parts.balanceSpring = {
      id: "balanceSpring",
      group: g,
      meshes: [spiral],
      focus: new THREE.Vector3(holder.position.x, holder.position.y, holder.position.z),
      size: 0.7,
    };
  }

  /* ---- hands: on the dial, around the same axis as the center wheel ---- */
  {
    const g = new THREE.Group();
    g.position.set(P.dial.x, P.dial.y, 0);
    const bluedM = metal(COL.blued, { metalness: 0.75, roughness: 0.22, env: 1.2 });
    const redM = metal(COL.red, { metalness: 0.35, roughness: 0.35, env: 1.1 });

    const hourG = new THREE.Group();
    const hourM = new THREE.Mesh(new THREE.ExtrudeGeometry(handShape(), { depth: 0.016, bevelEnabled: false }), bluedM);
    hourM.scale.set(0.6, 0.8, 1);
    hourM.position.z = 0.42;
    hourM.castShadow = true;
    hourG.add(hourM);

    const minG = new THREE.Group();
    const minM = new THREE.Mesh(new THREE.ExtrudeGeometry(handShape(), { depth: 0.014, bevelEnabled: false }), bluedM);
    minM.scale.set(0.48, 1.0, 1);
    minM.position.z = 0.48;
    minM.castShadow = true;
    minG.add(minM);

    const secG = new THREE.Group();
    const secM = new THREE.Mesh(new THREE.ExtrudeGeometry(handShape(), { depth: 0.012, bevelEnabled: false }), redM);
    secM.scale.set(0.3, 1.26, 1);
    secM.position.z = 0.55;
    secM.castShadow = true;
    const counter = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.024, 10, 28), redM);
    counter.position.set(0, -0.24, 0.55);
    secG.add(secM, counter);

    const capBall = new THREE.Mesh(new THREE.SphereGeometry(0.06, 20, 14), metal(COL.gold, { roughness: 0.25, env: 1.1 }));
    capBall.scale.z = 0.55;
    capBall.position.set(0, 0, 0.58);
    g.add(hourG, minG, secG, capBall);
    register("hands", g, [P.dial.x, P.dial.y, 0.6], 2.2);
    hands.hour = hourG;
    hands.minute = minG;
    hands.second = secG;
  }

  /* ---- dial: the face with its marks ---- */
  {
    const g = new THREE.Group();
    g.position.set(P.dial.x, P.dial.y, 0);
    const faceM = metal(COL.ivory, { metalness: 0.05, roughness: 0.85, env: 0.5 });
    const face = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 0.06, 96).rotateX(Math.PI / 2), faceM);
    face.position.z = 0.32;
    face.castShadow = face.receiveShadow = true;
    g.add(face);
    const rim = ringZ(1.7, 1.76, 0.05, metal(COL.gold, { metalness: 0.9, roughness: 0.3 }));
    rim.position.z = 0.355;
    g.add(rim);
    const ticksM = metal(COL.blued, { metalness: 0.7, roughness: 0.3, env: 1 });
    for (let i = 0; i < 60; i++) {
      const main = i % 5 === 0;
      const t = new THREE.Mesh(new THREE.BoxGeometry(main ? 0.05 : 0.024, main ? 0.2 : 0.11, 0.02), ticksM);
      const a = (i / 60) * TAU;
      const rr = 1.79 + (main ? 0.07 : 0.09);
      t.position.set(Math.cos(a) * rr, Math.sin(a) * rr, 0.36);
      t.rotation.z = a - Math.PI / 2;
      g.add(t);
    }
    register("dial", g, [0, P.dial.y, 0.42], 3.3);
  }

  /* ---- case: plate, side band, bezel, back and lugs ---- */
  {
    const g = new THREE.Group();
    const caseM = metal(COL.caseGold, { metalness: 1.0, roughness: 0.5, env: 0.8 });
    const darkBodyM = metal(0x4b5058, { metalness: 0.85, roughness: 0.45 });

    const plate = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 0.05, 96).rotateX(Math.PI / 2), darkBodyM);
    plate.position.set(0, DC.y, -0.52);
    plate.receiveShadow = true;
    g.add(plate);

    const band = tubeZ(2.3, 2.34, 0.86, caseM); // the band sits just inside the bezel edge
    band.position.set(0, DC.y, 0);
    g.add(band);

    const bezel = ringZ(2.02, 2.36, 0.2, caseM);
    bezel.position.set(0, DC.y, 0.34);
    g.add(bezel);

    const bottom = tubeZ(2.28, 2.34, 0.14, caseM); // a small step under the band
    bottom.position.set(0, DC.y, -0.5);
    g.add(bottom);

    const back = ringZ(1.5, 2.34, 0.16, caseM);
    back.position.set(0, DC.y, -0.52);
    g.add(back);

    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const lug = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.7, 0.5), caseM);
        lug.position.set(sx * 1.15, sy > 0 ? DC.y + 2.25 : DC.y - 2.25, -0.05);
        lug.rotation.x = sy * -0.12;
        lug.castShadow = true;
        g.add(lug);
      }
    }
    register("casebody", g, [2.3, DC.y - 0.85, 0], 2.9);
  }

  /* ---- crown: the little knob on the side ---- */
  {
    const g = new THREE.Group();
    const caseM = metal(COL.caseGold, { metalness: 1.0, roughness: 0.5, env: 0.8 });
    const ribM = metal(COL.gold, { metalness: 0.88, roughness: 0.5, env: 0.9 });

    const stemG = new THREE.CylinderGeometry(0.09, 0.09, 1.15, 20);
    stemG.rotateZ(Math.PI / 2);
    const stem = new THREE.Mesh(stemG, caseM);
    stem.position.set(2.73, P.crown.y, 0);
    stem.castShadow = true;
    g.add(stem);
    const knobG = new THREE.CylinderGeometry(0.26, 0.26, 0.42, 24);
    knobG.rotateZ(Math.PI / 2);
    const knob = new THREE.Mesh(knobG, caseM);
    knob.position.set(3.42, P.crown.y, 0);
    knob.castShadow = true;
    g.add(knob);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.05), ribM);
      rib.position.set(3.42, P.crown.y + Math.sin(a) * 0.26, Math.cos(a) * 0.26);
      g.add(rib);
    }
    register("crown", g, [3.3, P.crown.y, 0], 1.15);
  }

  /* ---- crystal: the see-through glass top (the rim ring is clickable,
       the flat glass is not — it passes clicks through to the hands) ---- */
  {
    const g = new THREE.Group();
    const gm = glass();
    const discG = new THREE.CylinderGeometry(2.02, 2.04, 0.26, 96, 1, true);
    discG.rotateX(Math.PI / 2);
    const disc = new THREE.Mesh(discG, gm);
    disc.position.set(0, DC.y, 0.46);
    disc.renderOrder = 10;
    g.add(disc);
    const top = new THREE.Mesh(new THREE.CircleGeometry(2.02, 96), glass());
    top.position.set(0, DC.y, 0.592);
    top.renderOrder = 11;
    g.add(top);
    const rim = ringZ(2.0, 2.16, 0.3, glass(), 96);
    rim.position.set(0, DC.y, 0.46);
    rim.renderOrder = 12;
    g.add(rim);
    disc.userData.clickable = false;
    disc.userData.glass = true;
    top.userData.clickable = false;
    top.userData.glass = true;
    register("crystal", g, [1.25, 1.75, 0.5], 3.0);
    for (const m of g.children) if (m.isMesh) m.userData.clickable = m === rim;
  }

  /* ----------------------------- x-ray reveal: when you focus on a part,
       the pieces standing between you and it become "ghosts". */
  const OCCLUDES = {
    barrel: ["dial", "casebody", "crystal", "hands"],
    centerWheel: ["dial", "casebody", "crystal", "hands"],
    trainWheel: ["dial", "casebody", "crystal", "hands"],
    thirdWheel: ["dial", "casebody", "crystal", "hands"],
    fourthWheel: ["dial", "casebody", "crystal", "hands"],
    escapeWheel: ["dial", "casebody", "crystal", "hands"],
    palletFork: ["dial", "casebody", "crystal", "hands"],
    balance: ["dial", "casebody", "crystal", "hands"],
    balanceSpring: ["dial", "casebody", "crystal", "hands"],
    dial: ["crystal", "hands"],
    crystal: ["hands"],
    hands: ["crystal"],
    casebody: ["crystal", "dial"],
    crown: ["crystal"],
  };
  const GHOST_OPACITY = { casebody: 0.1, dial: 0.1, crystal: 0.05, hands: 0.12 };
  const ghosted = new Set(); // part ids currently ghosted (for click pass-through)
  const ghostState = new Map(); // material -> saved original values

  function setXRay(id) {
    focusId = id; // remembered so setView can re-apply it later
    // restore everything first
    for (const [mat, orig] of ghostState) {
      mat.transparent = orig.transparent;
      mat.opacity = orig.opacity;
      mat.depthWrite = orig.depthWrite;
      mat.renderOrder = orig.renderOrder;
      needsUpdate(mat);
    }
    ghostState.clear();
    ghosted.clear();
    if (!id && !currentView) return;
    // group views ghost the whole group you did NOT choose
    const groupHidden = currentView === "internals" ? EXTERNAL : currentView === "exterior" ? INTERNAL : null;
    const ghostIds = new Set([...(groupHidden || []), ...(id && OCCLUDES[id] ? OCCLUDES[id] : [])]);
    for (const occId of ghostIds) {
      const occ = parts[occId];
      if (!occ) continue;
      ghosted.add(occId);
      for (const m of occ.meshes) {
        const mat = m.material;
        if (!mat || ghostState.has(mat)) continue;
        ghostState.set(mat, {
          transparent: mat.transparent,
          opacity: mat.opacity,
          depthWrite: mat.depthWrite,
          renderOrder: m.renderOrder,
        });
        mat.transparent = true;
        mat.opacity = GHOST_OPACITY[occId] ?? 0.12;
        mat.depthWrite = false;
        m.renderOrder = occId === "crystal" ? m.renderOrder : m.renderOrder; // keep glass above
        needsUpdate(mat);
      }
    }
  }

  /* ------------------------------------------------------------ view modes:
     "all"       — the whole watch, as it is
     "internals" — the movement on display (the case shell fades away)
     "exterior"  — the case shell on display (the movement fades away)

     The watch splits into two groups. The hands sit in neither, on purpose:
     they are the visible output of the movement, so a ghosted watch would
     otherwise look broken with an empty face. */
  const INTERNAL = [
    "barrel",
    "centerWheel",
    "trainWheel",
    "thirdWheel",
    "fourthWheel",
    "escapeWheel",
    "palletFork",
    "balance",
    "balanceSpring",
  ];
  const EXTERNAL = ["dial", "crystal", "casebody", "crown"];
  let currentView = null; // null === "all"
  let focusId = null; // last per-part focus request (re-applied when the view changes)

  function setView(mode) {
    currentView = mode === "internals" || mode === "exterior" ? mode : null;
    setXRay(focusId); // re-apply: ghosts = hidden side + per-part occluders (if any)
  }

  function needsUpdate(mat) {
    mat.needsUpdate = true;
  }

  /* ------------------------------------------------------------ updating */

  const easeOutQuad = (u) => 1 - (1 - u) * (1 - u);

  /* t is watch time (seconds). All ratios below are the real ones. */
  function update(t) {
    spin.barrel.rotation.z = (-TAU * t) / PERIOD.barrel;
    spin.centerWheel.rotation.z = (-TAU * t) / PERIOD.center; // = the minute hand
    spin.trainWheel.rotation.z = (-TAU * t) / PERIOD.second;
    spin.thirdWheel.rotation.z = (-TAU * t) / PERIOD.third;
    spin.fourthWheel.rotation.z = (-TAU * t) / PERIOD.fourth; // 1 turn per minute

    // escape wheel: snaps exactly one tooth per beat
    const beats = t * BEAT;
    const n = Math.floor(beats);
    const frac = beats - n;
    spin.escapeWheel.rotation.z = -(TAU / BEATS_PER_REV) * (n + easeOutQuad(frac));

    // pallet fork: one tick per beat
    spin.palletFork.rotation.z = spin.palletFork.userData.baseAngle + 0.28 * Math.cos(beats * TAU);

    // balance wheel: a smooth metronome
    spin.balance.rotation.z = BAL_AMP * Math.sin(beats * Math.PI);

    // hands
    hands.hour.rotation.z = (-TAU * t) / HAND.hour;
    hands.minute.rotation.z = (-TAU * t) / HAND.minute;
    hands.second.rotation.z = (-(TAU / 75) * (n + easeOutQuad(frac))) % TAU;
  }

  return { parts, targets, update, setXRay, setView, ghosted, spin, hands };
}
