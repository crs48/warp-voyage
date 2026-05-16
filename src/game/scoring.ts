const HIGH_SCORE_KEY = "warp-voyage.high-score";

export const scoreFromDistance = (distance: number): number =>
  Math.max(0, Math.floor(distance));

export const readHighScore = (storage: Pick<Storage, "getItem">): number => {
  const stored = storage.getItem(HIGH_SCORE_KEY);
  const parsed = stored === null ? 0 : Number.parseInt(stored, 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

export const writeHighScore = (
  storage: Pick<Storage, "setItem">,
  score: number,
): void => {
  storage.setItem(HIGH_SCORE_KEY, String(scoreFromDistance(score)));
};

export const maybeUpdateHighScore = (
  storage: Pick<Storage, "getItem" | "setItem">,
  score: number,
): number => {
  const previous = readHighScore(storage);
  const next = Math.max(previous, scoreFromDistance(score));

  if (next !== previous) {
    writeHighScore(storage, next);
  }

  return next;
};
