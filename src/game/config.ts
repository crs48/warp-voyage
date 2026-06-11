import { CELL_DEPTH } from "../tube/space";

// Temporary re-exports while src/render/ still imports spatial constants
// from here; removed once the render layer reads src/tube/ directly.
export {
  CELL_DEPTH,
  CUBE_SIZE as OBSTACLE_CUBE_SIZE,
  LANE_ANGLE,
  LANES,
  TUBE_RADIUS,
  VISIBLE_CELLS,
} from "../tube/space";

export const SECTION_LENGTH = 500;
export const SECTION_CELLS = SECTION_LENGTH / CELL_DEPTH;
export const BASE_SPEED = 28;
export const BOOST_MULTIPLIERS = [1, 2, 3, 4] as const;
export const MAX_BOOST_LEVEL = 3;
export const PLAYER_LANES_PER_SECOND = 4.8;
export const POST_CRASH_INVULNERABLE_SECONDS = 1.1;
