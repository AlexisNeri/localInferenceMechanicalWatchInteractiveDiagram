# The Mechanical Watch — Interactive 3D Guide

An educational, interactive 3D diagram of a mechanical watch built with
**Three.js**. Click any part of the watch and the camera flies in to focus on
it while a short, plain-language explanation (in English or Spanish) fades in
below the model. The watch is fully **procedural** — every gear, hand and
screw is generated in code, and the movement **actually ticks**: the whole
train runs with real mechanical ratios in slow motion, like peeping inside a
real pocket watch.

## Proof of Concept

This project is a **POC (Proof of Concept)** demonstrating the single-shot
capabilities of open-source local inference tools — the entire watch, including
its geometry, animation, UI copy and test suite, was produced end-to-end by
locally-run open-source models with no cloud services involved. It was built
using:

1. **Ollama** — https://ollama.com/ (local model serving)
2. **Qwen3.8-27B Unsloth UD-IQ4_XS quant** — https://huggingface.co/unsloth/Qwen3.8-27B-GGUF
3. **OpenCode** — https://opencode.ai/ (agent harness)

## Features

- **Click-to-focus**: clicking a piece flies the camera to it; a fading panel
  below the model shows the piece's name and a simple, non-technical
  explanation. Click empty space (or the ✕) to fly back to the full watch.
- **14 clickable parts**: mainspring barrel, center wheel, train wheel,
  third wheel, fourth wheel, escape wheel, pallet fork, balance wheel,
  balance spring (hairspring), crown, case, crystal, dial, hands.
- **View modes** (top-center toggle):
  - **Internals** — the external shell (case, dial, crystal, crown) turns
    transparent and non-interactive so the movement is on display.
  - **Exterior** — the movement turns transparent and non-interactive so the
    case, dial, crystal and hands are on display.
  - Each button toggles: clicking the active one returns to the complete
    watch.
- **X-ray focus**: when you focus on an inner piece, whatever stands in front
  of it (dial, crystal, case, hands) becomes a transparent ghost so nothing
  hides it.
- **Living movement**: honest watch ratios (barrel 1 rev/24 h, center wheel
  1 rev/h, fourth wheel 1 rev/min, escape wheel 30 beats/rev, second hand 75
  ticks/turn, balance wheel swinging ±150°), all running at half speed.
- **English / Spanish** toggle (top-right, top-center labels included),
  with the choice remembered in `localStorage`.
- **Orbit & zoom**: drag to spin, scroll to zoom — always, even while
  focused.

## Project structure

```
index.html          The page: title, 🌐 language button, the view-mode toggle
                    (Internals / Exterior), the hint bar and the
                    fading explanation panel, plus the module entry point.
package.json        Dependencies (three, vite) and npm scripts.
package-lock.json   Lockfile — pin exact dependency versions for reproducible
                    installs (keep it under version control).
vite.config.js      Vite config: the dev server is pinned to port 5199
                    (strictPort).
src/
  main.js           The application: renderer, lights and stage, the camera
                    state machine (idle → fly → focus), picking (raycasting
                    with glass pass-through and ghost skipping), the panel,
                    the language switch, and the view-mode selector wiring.
  watch.js          The watch itself: 100% procedural geometry for all 14
                    parts, the ticking movement (real ratios in slow motion),
                    the X-ray ghost system and the view-mode ghosting
                    (setView / ghosted).
  content.js        All copy: part names and plain-language explanations in
                    English and Spanish, plus the UI strings.
  style.css         Styling: the dark gold-luxury look, the panel
                    fade/rise animation, the language button and the
                    view-mode selector.
test/
  shot.mjs          End-to-end verification with headless Chrome
                    (Puppeteer): proves the movement animates, focuses
                    every part, checks the reset, the view modes, the
                    language switch and its persistence, and screenshots
                    everything into test/shots/.
  shots/            Screenshots produced by test/shot.mjs (gitignored).
```

### How the pieces fit together

`main.js` imports `watch.js` (which *builds* the watch into the scene and
*animates* it) and gets back its 14 parts, the raycast targets and helpers
(`setXRay`, `setView`, `spin`, `hands`). Picking in `main.js` raycasts against
those targets; the ghost system in `watch.js` (the `ghosted` set) is the
single source of truth for "ghosts are transparent *and* untouchable", so a
part can never be clicked while it is a ghost. `content.js` is the only place
text lives, so adding a language means adding two fields per string.

The test helper `window.__WATCH__` (parts, focus, home, state, part, probe,
screenXY, setView, view, isGhosts, ghosted) is deliberately small — it exists
for the automated test and for curious console users.

## Requirements

- **Node.js 18+** (Node 20/22/24 are all fine) — anything modern that runs Vite 5.
- No browser build step is needed for development (Vite compiles on the fly).

## Getting started (development)

```bash
# 1. Install dependencies (three + vite)
npm install

# 2. Start the dev server
npm run dev
```

Vite then serves the app at **http://localhost:5199** (the port is pinned in
`vite.config.js`). Open it in a browser, click around, and edit files under
`src/` — the page hot-reloads on save.

## Building for production

```bash
# 3. Build an optimized bundle into dist/
npm run build

# 4. (Optional) preview the production build locally
npm run preview
```

The result in `dist/` is static (an `index.html` plus JS/CSS assets) and can
be hosted anywhere: Netlify, Vercel, GitHub Pages, a plain nginx folder…
`npm run preview` serves `dist/` locally so you can verify the exact production
bundle before deploying.

## Running the verification

The project ships with a headless end-to-end check (Puppeteer + Chrome, WebGL
via SwiftShader):

```bash
node test/shot.mjs
```

It boots its own dev server, then verifies:

- the movement is genuinely animating (balance wheel, second hand, escape
  wheel, pallet fork);
- all 14 parts focus and show the correct name;
- clicking empty space and the ✕ button both reset to the full watch;
- the view modes ghost the correct side, keep the visible side clickable,
  make the ghosted side untouchable, and the active button toggles back to
  the full watch;
- English ⇄ Spanish works, and the choice survives a page reload.

It writes screenshots to `test/shots/` and ends with `ALL CHECKS PASSED`.

## Notes & design decisions

- **Half-speed motion on purpose.** The movement runs at 50 % of real speed
  so the ticking is comfortable to watch while every ratio stays real.
- **Ghosts are non-interactive by construction.** Ghosted parts are skipped in
  the raycast loop, so "transparent and non-interactive" is guaranteed the
  same way the glass pass-through is.
- **The hands show in every view.** They are the visible result of the
  movement, so they are part of neither ghost set; the case (dial, crystal,
  casebody, crown) and the nine movement pieces form the two exclusive
  groups.
- **No external assets.** Geometry, textures, fonts and sounds are all inline
  or system-provided; the only runtime dependencies are `three` and the Vite
  dev server.
- **three.js 0.186** — `PCFShadowMap` (not the removed `PCFSoftShadowMap`),
  `performance.now()` for the clock delta.
