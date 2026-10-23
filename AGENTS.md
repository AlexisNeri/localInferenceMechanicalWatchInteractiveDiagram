# AGENTS.md

## Commands

- Dev server: `npm run dev` → **http://localhost:5199** (port pinned with `strictPort` in `vite.config.js`; it is NOT Vite's default 5173).
- Build: `npm run build` → static `dist/`. Preview: `npm run preview`.
- Verify: `node test/shot.mjs` — one end-to-end suite, no test runner. No lint/typecheck/format tools exist; don't go hunting for them.
- The test script **spawns its own vite** — don't start `npm run dev` manually first.
- Exit codes: `2` = animation check, `3` = focus/reset failure, `4` = view-mode failure, `1` = console/page errors. "CHECKS FAILED" ≠ 0 covers all.

## Test gotchas (learned the hard way)

- Vite binds **IPv6 `::1` only** by default; the suite connects over `127.0.0.1`, so the spawn flags `--host 127.0.0.1 --strictPort` in `test/shot.mjs` are mandatory — don't drop them.
- Stale vite on 5199 breaks the run. Kill by PID first:
  `for pid in $(ss -ltnp | grep ':5199' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill $pid; done`
  **Never `pkill -f vite`** — the pattern matches the wrapping shell and kills your own process.
- Puppeteer is `puppeteer-core` + the cached Chrome binary (path hardcoded at the top of the script). **Do not run `puppeteer install`** — it fails with this toolchain. WebGL comes from the `--enable-unsafe-swiftshader` launch flags.
- The movement runs at **half speed** (`watchTime += dt * 0.5` in `main.js`): 1 s wall = 0.5 s of watch time. The second hand steps TAU/75 per beat — animation checks for slow/oscillating parts must use long sampling windows and max–min range (phase-dependent endpoint diffs will flake).

## Architecture (not obvious from filenames)

- `src/watch.js` builds the 100% procedural watch; `createWatch()` returns `{ parts, targets, update, setXRay, setView, ghosted, spin, hands }`. `src/main.js` owns camera state machine, raycast picking, panel, language. `src/content.js` is the only place text lives.
- **The `ghosted` Set in `watch.js` is the single source of truth** that a ghost is transparent *and* untouchable — the raycast skips ids in it. Don't re-derive "hidden parts" in `main.js`.
- Ghosting **mutates materials** (opacity/transparent/depthWrite, saved in `ghostState`). Materials may be shared within one part but **never across different parts** — cross-part sharing silently breaks ghost/restore.
- View modes are two explicit lists in `watch.js`: `INTERNAL` (9 movement pieces) and `EXTERNAL` (dial, crystal, casebody, crown). **Hands are in neither, deliberately** (ghosted face with no hands looks broken).
- The top-center buttons are **toggles** (`setViewMode` in `main.js`): clicking the active one returns to the full watch — there is no separate "Full" button. Don't add one back.
- Per-part focus X-ray: `OCCLUDES` map + `GHOST_OPACITY` in `watch.js`.
- Crystal: flat glass is tagged `userData.glass` and not directly clickable; it passes clicks to the hands (only if hands aren't ghosted), else selects the crystal. The rim ring is the only directly clickable crystal mesh.
- **`watchRoot.matrixWorldInverse` does not exist** on a plain `Group` (three.js only keeps it on `Scene`/`Camera`). `main.js` computes a per-probe `matrixWorld.invert()` into a scratch matrix — don't regress that.
- three.js **0.186**: `PCFSoftShadowMap` was removed (use `PCFShadowMap`); use `performance.now()` deltas, not the old `THREE.Clock.getDelta()` pattern.
- Tests control the app through `window.__WATCH__` (in `main.js`): `parts, focus, home, state, part, probe, screenXY, setView, view, isGhosts, ghosted`. Add new app behavior here if a test needs to drive it.

## Adding a new clickable part

All of these, or the test suite and UI will be half-wired:
1. `watch.js`: build meshes, `register(id, group, [x,y,z], size)` (size ≈ part's framing size in world units), set `spin.*` if it animates, add `OCCLUDES[id]` entry.
2. Move meshes out of other parts' `meshes` arrays if they were previously registered under another part (see how `balanceSpring` was split from `balance`).
3. Add id to `INTERNAL` or (movement only) nothing; shell parts go in `EXTERNAL` — hands stay in neither.
4. `content.js`: EN+ES name and plain-language text.
5. `test/shot.mjs`: add id to the `ALL` array.

## Content & UI invariants (user requirements)

- Explanations must stay **simple and non-technical** (didactic for everyone) in both EN and ES — no watchmaking jargon.
- The explanation panel fades in **below the 3D model** with the piece **name at the top** (`#panel` in `index.html`).
- Language choice persists in `localStorage["watch-lang"]`; UI text lives in `content.js` (`UI` + `CONTENT`), switch renders it via `applyLang()` in `main.js`.
- `test/shots/` (suite screenshots) and `dist/` are gitignored; keep `package-lock.json` tracked.
