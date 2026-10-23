/* Final verification: boots the app, checks every part focus, the reset,
   language toggle and proves the movement is animating. */
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { existsSync } from "node:fs";
import puppeteer from "puppeteer-core";

const home = process.env.HOME;
const exe = [
  `${home}/.cache/puppeteer/chrome/linux-155.0.8059.79/chrome-linux64/chrome`,
  `${home}/.cache/puppeteer/chrome-headless-shell/linux-155.0.8059.79/chrome-headless-shell-linux64/chrome-headless-shell`,
].find((p) => existsSync(p));

const dev = spawn("npx", ["vite", "--port", "5199", "--strictPort", "--host", "127.0.0.1"], {
  cwd: process.cwd(),
  stdio: "ignore",
});

await sleep(3500);

const browser = await puppeteer.launch({
  executablePath: exe,
  headless: true,
  args: [
    "--no-sandbox",
    "--enable-unsafe-swiftshader",
    "--use-gl=angle",
    "--angle-implementation=gl",
  ],
  defaultViewport: { width: 1440, height: 900 },
});

const errors = [];
const page = await browser.newPage();
page.on("console", (m) => {
  if (m.type() === "error") errors.push("[console] " + m.text());
});
page.on("pageerror", (e) => errors.push("[page] " + e.message));
page.on("requestfailed", (r) => errors.push("[req] " + r.url()));

await page.goto("http://127.0.0.1:5199/", { waitUntil: "networkidle0" });
await sleep(3200); // intro drift finishes

const shot = (name) => page.screenshot({ path: `test/shots/${name}.png` });

// ---- prove the watch is ticking: rotations must change over time ----
const rots = await page.evaluate(async () => {
  const grab = () => ({
    bal: window.__WATCH__.spin.balance.rotation.z,
    sec: window.__WATCH__.hands.second.rotation.z,
    esc: window.__WATCH__.spin.escapeWheel.rotation.z,
    barrel: window.__WATCH__.spin.barrel.rotation.z,
    center: window.__WATCH__.spin.centerWheel.rotation.z,
    fourth: window.__WATCH__.spin.fourthWheel.rotation.z,
    pallet: window.__WATCH__.spin.palletFork.rotation.z,
  });
  const a = grab();
  // Sample over 6s (3s of watch time at half speed). The second hand steps
  // TAU/75 per beat, so 3+ guaranteed beats clear 0.2 rad. The balance and the
  // pallet oscillate, so judge them by their swing RANGE (max - min) instead
  // of two endpoint samples, which can land on the same phase by luck.
  const bal = { min: Infinity, max: -Infinity };
  const pal = { min: Infinity, max: -Infinity };
  let b = a;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 200));
    b = grab();
    bal.min = Math.min(bal.min, b.bal);
    bal.max = Math.max(bal.max, b.bal);
    pal.min = Math.min(pal.min, b.pallet);
    pal.max = Math.max(pal.max, b.pallet);
  }
  const moved = (x, y, eps) => Math.abs(x - y) > eps;
  return {
    balance: bal.max - bal.min > 0.2,
    secondHand: moved(a.sec, b.sec, 0.2),
    escapeWheel: moved(a.esc, b.esc, 0.03),
    pallet: pal.max - pal.min > 0.05,
  };
});
console.log("animation check:", rots);
if (!rots.balance || !rots.secondHand || !rots.escapeWheel || !rots.pallet) process.exitCode = 2;

// ---- home view ----
await shot("01-home");

// ---- every part through real click points would be long; use helper per part ----
const ALL = ["barrel", "centerWheel", "trainWheel", "thirdWheel", "fourthWheel", "escapeWheel", "palletFork", "balance", "balanceSpring", "crown", "casebody", "crystal", "dial", "hands"];
const focusable = await page.evaluate(() => Object.keys(window.__WATCH__.parts));
console.log("parts:", focusable.join(", "));
const order = [...ALL].filter((id) => focusable.includes(id));
for (const id of order) {
  await page.evaluate((p) => window.__WATCH__.focus(p), id);
  await sleep(1500);
  await shot(`02-focus-${id}`);
  const name = await page.$eval("#panel-name", (e) => e.textContent);
  console.log(`focus ${id.padEnd(12)} -> "${name}"`);
}

// ---- empty click resets (probe first, pick an empty pixel) ----
const grid = [];
for (const x of [50, 1200]) for (const y of [300, 600, 850]) grid.push([x, y]);
const pts = await page.evaluate((g) => g.map(([x, y]) => [x, y, window.__WATCH__.probe(x, y)]), grid);
const empty = pts.find(([, , p]) => p === null);
if (!empty) {
  console.error("no empty pixel found for reset test");
  process.exitCode = 3;
} else {
  await page.mouse.click(empty[0], empty[1]);
  await sleep(1700);
  const hidden = await page.$eval("#panel", (e) => e.classList.contains("hidden"));
  const mode = await page.evaluate(() => window.__WATCH__.state());
  console.log(`reset via click at ${empty[0]},${empty[1]} -> panel hidden: ${hidden}, cam: ${mode}`);
  if (!hidden || mode === "focus") process.exitCode = 3;
  await shot("03-reset");
}

// ---- view mode selector: internals / exterior ----------------------------
// In the overview shot, project each side's representative part to a screen
// point, then confirm the ghost set, the active button and the pick behavior.
async function viewChecks() {
  const rep = {
    internals: ["centerWheel", "balance", "barrel"], // movement pieces
    exterior: ["crown", "crystal"], // shell pieces (the crown is the solid, easy-to-hit one)
  };
  const results = [];
  for (const mode of ["internals", "exterior"]) {
    await page.evaluate((m) => window.__WATCH__.setView(m), mode);
    await sleep(400);
    const active = await page.evaluate(() => document.querySelector(".ui-view-opt.active")?.dataset.mode);
    const ghosted = await page.evaluate(() => window.__WATCH__.ghosted());
    const probes = [];
    for (const partId of rep[mode]) {
      const p = await page.evaluate((id) => window.__WATCH__.screenXY(id), partId);
      probes.push([partId, await page.evaluate(([x, y]) => window.__WATCH__.probe(x, y), [p.x, p.y])]);
    }
    // each ghosted part's own center must be untouchable (click passes through / empty)
    const hiddenOk = await page.evaluate((ids) => {
      for (const id of ids) {
        const p = window.__WATCH__.screenXY(id);
        const hit = window.__WATCH__.probe(p.x, p.y);
        if (hit === id) return false; // still claims the click: not ghosted properly
      }
      return true;
    }, ghosted);
    const okProbe = probes.every(([, id]) => id !== null); // visible side stays clickable
    await shot(`05-view-${mode}`);
    results.push({ on: mode, active, okProbe, hiddenOk, ghosted, probes });
    // the active button is a toggle: clicking it again returns to the full watch
    await page.click(`.ui-view-opt[data-mode="${mode}"]`);
    await sleep(400);
    const off = await page.evaluate(() => ({
      anyActive: document.querySelector(".ui-view-opt.active") !== null,
      ghosts: window.__WATCH__.ghosted().length,
      view: window.__WATCH__.view(),
    }));
    results.push({ on: `${mode}→off`, active: off.anyActive ? "?" : null, okProbe: !off.anyActive && off.ghosts === 0 && off.view === "all", hiddenOk: true, ghosted: [], probes: [] });
  }
  return results;
}

const views = await viewChecks();
for (const v of views) {
  if (v.active === "?") {
    console.log(`view ${v.on.padEnd(10)} STILL ACTIVE — toggle-back failed`);
    process.exitCode = 4;
    continue;
  }
  console.log(
    `view ${v.on.padEnd(10)} active="${v.active}" clickable=${v.okProbe} ghostsUntouchable=${v.hiddenOk} ghosts=[${v.ghosted.join(",")}] probes=${JSON.stringify(v.probes)}`
  );
  const expected = v.on.includes("→") ? null : v.on; // toggle-back entries expect no active button
  if (v.active !== expected || !v.okProbe || !v.hiddenOk) process.exitCode = 4;
}

// ---- close button resets too ----
await page.evaluate(() => window.__WATCH__.focus("dial"));
await sleep(1200);
await page.click("#panel-close");
await sleep(1300);
console.log("reset via close button ->", await page.$eval("#panel", (e) => e.classList.contains("hidden")));

// ---- language toggle ----
await page.click("#lang-btn");
await sleep(400);
const es = await page.evaluate(() => ({
  title: document.getElementById("ui-title-text").textContent,
  btn: document.getElementById("lang-btn").textContent,
}));
console.log("spanish ->", es.title, "|", es.btn);
await page.evaluate(() => window.__WATCH__.focus("balance"));
await sleep(1300);
const esPart = await page.evaluate(() => ({
  name: document.getElementById("panel-name").textContent,
  text: document.getElementById("panel-text").textContent.slice(0, 80),
}));
console.log("spanish part ->", esPart.name, "/", esPart.text + "…");
await shot("04-spanish-balance");

// ---- persistence of language ----
await page.reload({ waitUntil: "networkidle0" });
await sleep(2500);
const persisted = await page.$eval("#lang-btn", (e) => e.textContent);
console.log("after reload, lang button:", persisted);

await browser.close();
dev.kill();

if (errors.length) {
  console.error("\nCONSOLE PAGE ERRORS:");
  for (const e of errors) console.error("  " + e);
  process.exitCode = process.exitCode || 1;
} else {
  console.log("\nNo console/page errors.");
}
console.log(process.exitCode ? "CHECKS FAILED" : "ALL CHECKS PASSED");
