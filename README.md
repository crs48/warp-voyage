# Warp Voyage

Minimal browser tunnel-dodging game built with Vite, TypeScript, Three.js, Vitest, and ESLint.

## Controls

- `ArrowLeft` / `A`: rotate left
- `ArrowRight` / `D`: rotate right
- `Gyro`: request mobile tilt controls from a user gesture
- Any key: restart after game over

## Game Loop

- Fly through a 12-panel procedural tube that undulates as you go.
- Dodge black cubes that occupy exact lane/depth grid cells; each cube
  telegraphs its arrival by darkening the tube panel it sits on.
- Pick up cyan boost patches to increase speed and gain one crash shield.
- A crash with boost/shield clears boost and continues the run.
- A crash without protection ends the run.
- Restart from the game-over overlay.
- High score is saved in `localStorage`.
- Press `h` for a tube-space debug overlay (the exact grid collision tests).

## Architecture: tube space

`src/tube/` is the single source of truth for all spatial constants and
transforms — lane count, cell size, cube size, the bend-parameterized
centerline, and the `(cell, lane) → world transform` mapping. **No module
outside `src/tube/` may define a spatial constant or transform.**

Gameplay (collision, generation) works purely in tube-space coordinates
`(s, θ)` — distance along the tube and angle around it — as 2D interval
overlap against `cellRect`s. Rendering realizes the same cell definitions
into world space via `cellTransform`/`tubePoint`. Because both sides read
one definition, the rendered cube and its hitbox cannot drift apart, and
tube undulation has zero effect on collision correctness.

See `docs/explorations/0001_*_MVP_REBUILD_TUBE_SPACE_CORE.md` for the full
design rationale.

## Development

```bash
npm ci
npm run dev
npm run test
npm run test:unit
npm run test:integration
npm run lint
npm run build
```

The built site is emitted to `dist/`. Vite is configured with `base: "./"` so the app can be served from GitHub Pages project paths.

Playwright integration tests require Chromium:

```bash
npx playwright install chromium
```
