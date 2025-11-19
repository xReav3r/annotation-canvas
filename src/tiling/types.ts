/**
 * Configuration for the tiling system
 */
export interface TileConfig {
  /**
   * Scale interval between tile levels (e.g., 0.25 means levels at 0.25, 0.5, 0.75, 1.0)
   */
  levelSize: number;

  /**
   * Minimum number of tiles on the larger dimension
   */
  minTilesCount: number;

  /**
   * Whether to draw all tiles at once (true) or progressively as they load (false)
   */
  drawAtOnce: boolean;
}

/**
 * Represents the visible viewport area
 */
export interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Represents the zoom/view state
 */
export interface ZoomState {
  position: { x: number; y: number };
  scale: number;
}

/**
 * Information about a single tile
 */
export interface TileInfo {
  /**
   * X position in the raster image (top-left corner)
   */
  x: number;

  /**
   * Y position in the raster image (top-left corner)
   */
  y: number;

  /**
   * Width of the tile
   */
  width: number;

  /**
   * Height of the tile
   */
  height: number;

  /**
   * Resolution level/scale of this tile
   */
  level: number;
}

