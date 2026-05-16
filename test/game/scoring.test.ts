import { describe, expect, it } from "vitest";

import { maybeUpdateHighScore, readHighScore, scoreFromDistance } from "../../src/game/scoring";

const createStorage = (): Storage => {
  const data = new Map<string, string>();

  return {
    get length() {
      return data.size;
    },
    clear: () => {
      data.clear();
    },
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => [...data.keys()][index] ?? null,
    removeItem: (key: string) => {
      data.delete(key);
    },
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
};

describe("scoring", () => {
  it("uses whole distance units as score", () => {
    expect(scoreFromDistance(42.9)).toBe(42);
    expect(scoreFromDistance(-5)).toBe(0);
  });

  it("persists only improved high scores", () => {
    const storage = createStorage();

    expect(readHighScore(storage)).toBe(0);
    expect(maybeUpdateHighScore(storage, 100.6)).toBe(100);
    expect(maybeUpdateHighScore(storage, 90)).toBe(100);
  });
});
