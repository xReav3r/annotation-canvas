import { Viewport, ZoomState } from './types';

/**
 * Calculates the visible viewport area based on zoom and stage dimensions
 * @param zoom - Current zoom state (position and scale)
 * @param stageWidth - Canvas/viewport container width
 * @param stageHeight - Canvas/viewport container height
 * @param rasterWidth - Full raster image width
 * @param rasterHeight - Full raster image height
 * @returns Viewport object with x, y, width, height
 */
export function calculateViewport(
  zoom: ZoomState,
  stageWidth: number,
  stageHeight: number,
  rasterWidth: number,
  rasterHeight: number
): Viewport {
  let x1 = Math.max(0, -Math.trunc(zoom.position.x / zoom.scale));
  let y1 = Math.max(0, -Math.trunc(zoom.position.y / zoom.scale));

  let x2 = Math.max(0, Math.ceil((stageWidth - zoom.position.x) / zoom.scale));
  let y2 = Math.max(0, Math.ceil((stageHeight - zoom.position.y) / zoom.scale));

  // Cut to raster dimensions
  x1 = Math.min(rasterWidth, x1);
  y1 = Math.min(rasterHeight, y1);
  x2 = Math.min(rasterWidth, x2);
  y2 = Math.min(rasterHeight, y2);

  return {
    x: x1,
    y: y1,
    width: x2 - x1,
    height: y2 - y1,
  };
}
