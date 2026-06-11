import { CELL_DEPTH } from "../tube/space";

export const SECTION_LENGTH = 500;
export const SECTION_CELLS = SECTION_LENGTH / CELL_DEPTH;
export const BASE_SPEED = 28;
export const BOOST_MULTIPLIERS = [1, 2, 3, 4] as const;
export const MAX_BOOST_LEVEL = 3;
export const PLAYER_LANES_PER_SECOND = 4.8;
export const POST_CRASH_INVULNERABLE_SECONDS = 1.1;
