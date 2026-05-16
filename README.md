# Warp Voyage

Minimal browser tunnel-dodging game built with Vite, TypeScript, Three.js, Vitest, and ESLint.

## Controls

- `ArrowLeft` / `A`: rotate left
- `ArrowRight` / `D`: rotate right
- Touch left/right side of the screen on mobile
- `Gyro`: request mobile tilt controls from a user gesture

## Game Loop

- Fly through a 12-panel procedural tube.
- Dodge colored cubes that occupy exact lane/depth grid cells.
- Pick up boost patches to increase speed and gain one crash shield.
- A crash with boost/shield clears boost and continues the run.
- A crash without protection ends the run.
- Restart from the game-over overlay.
- High score is saved in `localStorage`.

## Development

```bash
npm ci
npm run dev
npm run test
npm run lint
npm run build
```

The built site is emitted to `dist/`. Vite is configured with `base: "./"` so the app can be served from GitHub Pages project paths.
