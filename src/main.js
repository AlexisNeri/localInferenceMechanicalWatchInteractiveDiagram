import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { createWatch } from "./watch.js";
import { CONTENT, UI, LANGS } from "./content.js";
import "./style.css";

/* ------------------------------------------------------------------ boot */

const container = document.getElementById("scene-container");
const $ = (id) => document.getElementById(id);

let lang = "en";
try {
  const saved = localStorage.getItem("watch-lang");
  if (saved === "es" || saved === "en") lang = saved;
} catch (e) {}

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
} catch (e) {
  container.textContent = UI.fallback[lang];
  throw e;
}

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111317);
scene.fog = new THREE.Fog(0x111317, 26, 62);

const PMREM = new THREE.PMREMGenerator(renderer);
scene.environment = PMREM.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.65; // keep the metals from blowing out to white

const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 200);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 1.05;
controls.maxDistance = 28;

/* ------------------------------------------------------------ stage: lights */

const keyLight = new THREE.DirectionalLight(0xfff1de, 1.8);
keyLight.position.set(6, 8, 12);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.left = keyLight.shadow.camera.bottom = -6;
keyLight.shadow.camera.right = keyLight.shadow.camera.top = 6;
keyLight.shadow.bias = -0.0004;
keyLight.shadow.normalBias = 0.012;

const rimLight = new THREE.DirectionalLight(0x9fc0ff, 0.9);
rimLight.position.set(-10, 4, -9);

const warmFill = new THREE.PointLight(0xffe6b8, 3, 30, 2);
warmFill.position.set(-1, 4, 8);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(38, 72).rotateX(-Math.PI / 2),
  new THREE.MeshStandardMaterial({ color: 0x171a20, metalness: 0.35, roughness: 0.55 })
);
ground.position.y = -2.55;
ground.receiveShadow = true;
scene.add(ground);

const pedestal = new THREE.Mesh(
  new THREE.CylinderGeometry(3.35, 3.6, 0.22, 96),
  new THREE.MeshStandardMaterial({ color: 0x101216, metalness: 0.5, roughness: 0.4 })
);
pedestal.position.set(-0.4, -2.45, 0);
pedestal.receiveShadow = true;
pedestal.castShadow = true;
scene.add(pedestal);

scene.add(keyLight, rimLight, warmFill);

/* the watch tilts slightly so its face points a little toward the camera */
const watchRoot = new THREE.Group();
watchRoot.position.set(-0.4, -0.1, 0);
watchRoot.rotation.x = -0.24;
scene.add(watchRoot);

const { parts, targets, update: updateWatch, setXRay, ghosted: watchGhosted, setView: applyViewMode, spin, hands: watchHands } = createWatch(watchRoot);

/* -------------------------------------------------------------- cameras */

const HOME = { pos: new THREE.Vector3(6.4, 3.7, 8.2), target: new THREE.Vector3(0, -0.15, 0) };

function focusDistance(size) {
  const fov = (camera.fov * Math.PI) / 180;
  const halfH = Math.tan(fov / 2);
  const halfW = halfH * camera.aspect;
  const d = Math.max(size / 2 / halfH, size / 2 / halfW);
  return THREE.MathUtils.clamp(d * 1.3, 1.25, 14);
}

function frameFocus(part) {
  watchRoot.updateMatrixWorld();
  const focus = part.focus.clone().applyMatrix4(watchRoot.matrixWorld);
  const dir = new THREE.Vector3(0.16, 0.5, 1).normalize();
  const pos = focus.clone().add(dir.multiplyScalar(focusDistance(part.size)));
  return { pos, target: focus };
}

/* ------------------------------------------------ camera state:
   idle  — free orbit anywhere
   fly   — animating between viewpoints (controls disabled)
   focus — parked on a part (controls disabled until the user goes home) */
const cam = {
  mode: "idle",
  partId: null,
  fromP: new THREE.Vector3(),
  fromT: new THREE.Vector3(),
  toP: new THREE.Vector3(),
  toT: new THREE.Vector3(),
  t0: 0,
  dur: 0,
  ease: (x) => x,
};

function easeInOutCubic(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}
function easeInOutSine(x) {
  return -(Math.cos(Math.PI * x) - 1) / 2;
}

function startFly(toPos, toTarget, dur, ease, endMode) {
  cam.fromP.copy(camera.position);
  cam.fromT.copy(controls.target);
  cam.toP.copy(toPos);
  cam.toT.copy(toTarget);
  cam.t0 = performance.now();
  cam.dur = dur * 1000;
  cam.ease = ease;
  cam.mode = "fly";
  cam.endMode = endMode;
  controls.enabled = false;
}

function focusPart(id) {
  const part = parts[id];
  if (!part) return;
  if (cam.mode === "fly") return; // let the current flight finish
  cam.partId = id;
  showPanel(id);
  setXRay(id); // hiding pieces turn into ghosts so the part is clearly visible
  const { pos, target } = frameFocus(part);
  startFly(pos, target, 0.95, easeInOutCubic, "focus");
  setHint(UI.reset[lang]);
}

function goHome() {
  if (cam.mode !== "fly" && cam.mode !== "focus") return;
  hidePanel();
  setXRay(null); // back to a solid watch
  cam.partId = null;
  startFly(HOME.pos, HOME.target, 1.0, easeInOutSine, "idle");
  setHint(UI.hint[lang]);
}

/* -------------------------------------------------------------- UI: panel */

function showPanel(id) {
  const entry = CONTENT[id];
  $("panel-name").textContent = entry.name[lang];
  $("panel-text").textContent = entry.text[lang];
  const panel = $("panel");
  panel.classList.remove("hidden");
  panel.classList.add("open"); // triggers the fade/rise animation
}

function hidePanel() {
  const panel = $("panel");
  panel.classList.remove("open");
  panel.classList.add("hidden");
}

function setHint(text) {
  $("hint").textContent = text;
}

$("panel-close").addEventListener("click", goHome);
$("panel-close").addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    goHome();
  }
});

/* -------------------------------------------------------------- language */

function applyLang() {
  document.documentElement.lang = lang;
  $("ui-title-text").textContent = UI.title[lang];
  $("ui-subtitle").textContent = UI.subtitle[lang];
  $("lang-btn").textContent = `🌐 ${LANGS[lang]}`;
  $("lang-btn").setAttribute("aria-label", UI.langLabel);
  document.querySelector('[data-i18n="internals"]').textContent = UI.viewInternals[lang];
  document.querySelector('[data-i18n="exterior"]').textContent = UI.viewExterior[lang];
  setHint(cam.mode === "focus" ? UI.reset[lang] : UI.hint[lang]);
  if (cam.mode === "focus" && cam.partId) showPanel(cam.partId);
}

$("lang-btn").addEventListener("click", () => {
  lang = lang === "en" ? "es" : "en";
  try {
    localStorage.setItem("watch-lang", lang);
  } catch (e) {}
  applyLang();
});

/* ------------------------------------------------ view mode selector
   top center: Internals · Exterior. Each button is a toggle: the active one
   returns to the full watch, the other one activates. In an exclusive mode
   the unchosen side becomes transparent and untouchable (see setView). */

function setViewMode(mode) {
  const next = viewMode === mode ? "all" : mode; // clicking the active one returns to the full watch
  viewMode = next;
  applyViewMode(next);
  for (const btn of document.querySelectorAll(".ui-view-opt")) btn.classList.toggle("active", next !== "all" && btn.dataset.mode === next);
  // hovering a ghost must not linger, and a focused part on the hidden side is meaningless
  if (hoveredId && watchGhosted.has(hoveredId)) {
    setHighlight(hoveredId, false);
    hoveredId = null;
    renderer.domElement.style.cursor = "grab";
  }
  if (cam.partId && watchGhosted.has(cam.partId)) goHome();
}

document.querySelectorAll(".ui-view-opt").forEach((btn) => {
  btn.addEventListener("click", () => setViewMode(btn.dataset.mode));
});

/* ---------------------------------------------------------------- picking */

const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const invM = new THREE.Matrix4(); // watchRoot -> local, computed per probe
let hoveredId = null;
const highlighted = new Set(); // part ids currently highlighted
let viewMode = "all"; // "all" | "internals" | "exterior"

function partIdAt(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(targets, false);
  const tmp = new THREE.Vector3();
  invM.copy(watchRoot.matrixWorld).invert(); // matrixWorldInverse is only kept on Scene/Camera
  for (let i = 0; i < hits.length; i++) {
    const m = hits[i].object;
    const hitId = m.userData.partId || (m.userData.glass ? "crystal" : null);
    if (hitId && watchGhosted.has(hitId)) continue; // ghosts pass clicks through
    if (m.userData.glass) {
      // flat glass: pass the click to the hands if they lie under it and are
      // not ghosted, otherwise it is the crystal itself
      if (!watchGhosted.has("hands")) {
        for (let j = i + 1; j < hits.length; j++) {
          const h2 = hits[j];
          if (h2.object.userData.partId !== "hands") continue;
          tmp.copy(h2.point).applyMatrix4(invM);
          if (Math.hypot(tmp.x - 0, tmp.y - 0.45) < 2.15) return "hands";
        }
      }
      return "crystal";
    }
    if (m.userData.clickable === false) continue;
    if (m.userData.partId) return m.userData.partId;
  }
  return null;
}

function setHighlight(id, on) {
  const part = parts[id];
  if (!part) return;
  for (const m of part.meshes) {
    if (!m.material.emissive) continue;
    if (on && !highlighted.has(id)) m.material.emissive.setRGB(0.35, 0.29, 0.16);
    if (!on) m.material.emissive.setRGB(0, 0, 0);
  }
  on ? highlighted.add(id) : highlighted.delete(id);
}

renderer.domElement.addEventListener("pointermove", (e) => {
  if (e.pointerType === "touch") return;
  const id = partIdAt(e.clientX, e.clientY);
  if (id !== hoveredId) {
    if (hoveredId && hoveredId !== cam.partId) setHighlight(hoveredId, false);
    hoveredId = id;
    if (id && id !== cam.partId) setHighlight(id, true);
    renderer.domElement.style.cursor = id ? "pointer" : "grab";
  }
});

/* ------------------------------------------------------------ click logic */

let down = null;
renderer.domElement.style.cursor = "grab";

renderer.domElement.addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return;
  down = { x: e.clientX, y: e.clientY, t: performance.now() };
});

renderer.domElement.addEventListener("pointerup", (e) => {
  if (!down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  const dt = performance.now() - down.t;
  down = null;
  if (moved > 7 || dt > 600) return; // it was a drag (or a long press): not a click

  const id = partIdAt(e.clientX, e.clientY);
  if (id) focusPart(id);
  else goHome(); // empty space (or the open glass over the face): back to the full watch
});

/* ---------------------------------------------------------------- resize */

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ------------------------------------------------------------------ intro */

function intro() {
  camera.position.set(10.5, 6.2, 13.5);
  camera.lookAt(HOME.target);
  controls.target.copy(HOME.target);
  startFly(HOME.pos, HOME.target, 2.3, easeInOutCubic, "idle");
}

/* --------------------------------------------------------------- loop */

let last = performance.now();
let watchTime = 0;

function tick() {
  requestAnimationFrame(tick);
  const now = performance.now();
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;

  // the movement runs in slow motion (half speed), like a peep inside
  watchTime += dt * 0.5;
  updateWatch(watchTime);

  if (cam.mode === "fly") {
    const u = cam.dur > 0 ? Math.min((performance.now() - cam.t0) / cam.dur, 1) : 1;
    const k = cam.ease(u);
    camera.position.lerpVectors(cam.fromP, cam.toP, k);
    controls.target.lerpVectors(cam.fromT, cam.toT, k);
    if (u >= 1) {
      cam.mode = cam.endMode || "idle";
      controls.enabled = true; // free to orbit in both the overview and the focus
    }
  }

  controls.update();
  renderer.render(scene, camera);
}

applyLang();
intro();
tick();

/* a tiny helper surface (used by automated tests and curious console users) */
const _screenV = new THREE.Vector3();
function screenXY(id) {
  const part = parts[id];
  if (!part) return null;
  watchRoot.updateMatrixWorld();
  _screenV.copy(part.focus).applyMatrix4(watchRoot.matrixWorld);
  _screenV.project(camera);
  return { x: (_screenV.x + 1) / 2 * window.innerWidth, y: (1 - _screenV.y) / 2 * window.innerHeight };
}
window.__WATCH__ = {
  parts,
  scene,
  spin,
  hands: watchHands,
  focus: focusPart,
  home: goHome,
  state: () => cam.mode,
  part: () => cam.partId,
  probe: partIdAt,
  screenXY,
  setView: (m) => setViewMode(m),
  view: () => viewMode,
  isGhosts: (id) => watchGhosted.has(id),
  ghosted: () => [...watchGhosted],
};
