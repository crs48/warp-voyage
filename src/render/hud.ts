import type { PlayerState } from "../game/collision";

export type Hud = {
  readonly root: HTMLDivElement;
  readonly score: HTMLDivElement;
  readonly highScore: HTMLDivElement;
  readonly pattern: HTMLDivElement;
  readonly boosts: HTMLDivElement;
  readonly restart: HTMLButtonElement;
  readonly gyro: HTMLButtonElement;
  readonly gyroStatus: HTMLDivElement;
};

export type HudFrame = {
  readonly score: number;
  readonly highScore: number;
  readonly pattern: string;
  readonly player: PlayerState;
};

export const createHud = (host: HTMLElement): Hud => {
  const root = document.createElement("div");
  root.className = "hud";
  root.innerHTML = `
    <div class="hud__top">
      <div>
        <div class="hud__label">DISTANCE</div>
        <div class="hud__value" data-score>0</div>
      </div>
      <div>
        <div class="hud__label">BEST</div>
        <div class="hud__value" data-high-score>0</div>
      </div>
      <div>
        <div class="hud__label">PATTERN</div>
        <div class="hud__value" data-pattern>semi-random</div>
      </div>
      <div>
        <div class="hud__label">BOOST</div>
        <div class="hud__value" data-boosts>0</div>
      </div>
    </div>
    <div class="hud__actions">
      <button type="button" class="hud__button" data-gyro>Gyro</button>
      <div class="hud__gyro" data-gyro-status>keyboard</div>
    </div>
    <div class="hud__gameover" data-gameover hidden>
      <div class="hud__title">Warp Voyage</div>
      <button type="button" class="hud__restart" data-restart>Restart</button>
    </div>
  `;

  host.append(root);

  const query = (selector: string): HTMLElement => {
    const element = root.querySelector<HTMLElement>(selector);

    if (element === null) {
      throw new Error(`Missing HUD element: ${selector}`);
    }

    return element;
  };
  const queryDiv = (selector: string): HTMLDivElement => {
    const element = query(selector);

    if (!(element instanceof HTMLDivElement)) {
      throw new Error(`Expected div HUD element: ${selector}`);
    }

    return element;
  };
  const queryButton = (selector: string): HTMLButtonElement => {
    const element = query(selector);

    if (!(element instanceof HTMLButtonElement)) {
      throw new Error(`Expected button HUD element: ${selector}`);
    }

    return element;
  };

  return {
    root,
    score: queryDiv("[data-score]"),
    highScore: queryDiv("[data-high-score]"),
    pattern: queryDiv("[data-pattern]"),
    boosts: queryDiv("[data-boosts]"),
    restart: queryButton("[data-restart]"),
    gyro: queryButton("[data-gyro]"),
    gyroStatus: queryDiv("[data-gyro-status]"),
  };
};

export const updateHud = (hud: Hud, frame: HudFrame): void => {
  hud.score.textContent = String(frame.score);
  hud.highScore.textContent = String(frame.highScore);
  hud.pattern.textContent = frame.pattern;
  hud.boosts.textContent = frame.player.shielded
    ? `${String(frame.player.boostLevel)} + shield`
    : String(frame.player.boostLevel);

  const gameOver = hud.root.querySelector<HTMLElement>("[data-gameover]");
  if (gameOver !== null) {
    gameOver.hidden = frame.player.status !== "gameOver";
  }
};
