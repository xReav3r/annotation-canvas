import { TileInfo, Viewport } from './types';

/**
 * Calculates the appropriate level scale based on current zoom scale
 * Snaps to discrete levels to improve cache hit rate
 * @param scale - Current zoom scale
 * @param initScale - Initial fit scale (minimum scale)
 * @param levelSize - Scale interval between tile levels (e.g., 0.25)
 * @returns Bounded and snapped level scale
 */
export function calculateLevel(
  scale: number,
  initScale: number,
  levelSize: number
): number {
  // Bound scale between init scale and maximum (1.0 - levelSize)
  const boundedScale = Math.max(
    Math.min(scale, 1.0 - levelSize),
    initScale
  );

  // Snap to discrete levels
  const currentLevelScale =
    Math.trunc(boundedScale / levelSize) * levelSize + levelSize;

  return currentLevelScale;
}

/**
 * Calculates the tile size in raster coordinates
 * @param stageWidth - Canvas/viewport width
 * @param stageHeight - Canvas/viewport height
 * @param levelScale - Current level scale
 * @param minTilesCount - Minimum number of tiles on the larger dimension
 * @returns Tile size in pixels
 */
export function calculateTileSize(
  stageWidth: number,
  stageHeight: number,
  levelScale: number,
  minTilesCount: number
): number {
  const tileSizeStage = Math.ceil(
    Math.max(stageWidth, stageHeight) / minTilesCount
  );
  return Math.ceil(tileSizeStage / levelScale);
}

/**
 * Generator that yields tiles intersecting with the current viewport
 * More efficient than creating an array - processes tiles one at a time
 * @param viewport - Current visible area
 * @param scale - Current zoom scale
 * @param stageWidth - Canvas/viewport width
 * @param stageHeight - Canvas/viewport height
 * @param rasterWidth - Full raster image width
 * @param rasterHeight - Full raster image height
 * @param levelSize - Scale interval between tile levels
 * @param minTilesCount - Minimum number of tiles on the larger dimension
 * @yields TileInfo objects for each tile
 */
export function* iterateTiles(
  viewport: Viewport,
  scale: number,
  stageWidth: number,
  stageHeight: number,
  rasterWidth: number,
  rasterHeight: number,
  levelSize: number,
  minTilesCount: number
): Generator<TileInfo> {
  // Calculate initial fit scale
  const initScale = Math.min(stageWidth / rasterWidth, stageHeight / rasterHeight);

  // Get level scale
  const levelScale = calculateLevel(scale, initScale, levelSize);

  // Calculate tile size
  const tileSize = calculateTileSize(stageWidth, stageHeight, levelScale, minTilesCount);

  // Loop through all tiles that intersect the viewport
  for (
    let tileX = Math.trunc(viewport.x / tileSize);
    tileX <= Math.trunc((viewport.x + viewport.width) / tileSize);
    tileX++
  ) {
    for (
      let tileY = Math.trunc(viewport.y / tileSize);
      tileY <= Math.trunc((viewport.y + viewport.height) / tileSize);
      tileY++
    ) {
      const x = tileX * tileSize;
      const y = tileY * tileSize;
      const width = Math.min(rasterWidth - x, tileSize);
      const height = Math.min(rasterHeight - y, tileSize);

      // Only yield valid tiles
      if (width > 0 && height > 0) {
        yield {
          x,
          y,
          width,
          height,
          level: levelScale,
        };
      }
    }
  }
}
