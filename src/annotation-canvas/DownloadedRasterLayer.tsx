import Konva from "konva";
import { useEffect, useRef } from "react";
import { Image as KonvaImage, Layer } from "react-konva";

import { GetImage, useImageCache } from "./contexts/ImageCacheContext";
import {
  DownloadedRasterLayer as IDownloadedRasterLayer,
  useLayers,
} from "./contexts/LayersContext";
import { iterateTiles, Viewport } from "../tiling";
import { createRasterCanvas } from "./utils";

function DownloadedRasterLayer({
  layer,
  stageWidth,
  stageHeight,
  viewport,
  scale,
}: {
  layer: IDownloadedRasterLayer;
  stageWidth: number;
  stageHeight: number;
  viewport: Viewport;
  scale: number;
}) {
  const { rasterWidth, rasterHeight } = useLayers();
  const canvasRef = useRef<HTMLCanvasElement>(createRasterCanvas(rasterWidth, rasterHeight));
  const layerRef = useRef<Konva.Layer>(null);

  const timer = useRef<NodeJS.Timeout>();

  const { getImageCached } = useImageCache();
  const { tiling } = useLayers();

  useEffect(() => {
    if (rasterWidth === 0 || rasterHeight === 0 || layer.data.getImage === undefined) return;
    const controller = new AbortController();
    async function loadAndDrawScaled() {
      const ctx = canvasRef.current.getContext("2d", {
        willReadFrequently: true,
      });

      function drawBitmap(
        bitmap: null | ImageBitmap,
        bitmapX: number,
        bitmapY: number,
        bitmapWidth: number,
        bitmapHeight: number,
      ) {
        if (ctx === null) throw new Error("DownloadedRasterLayer ctx is null");

        if (bitmap === null) return;
        ctx.clearRect(bitmapX, bitmapY, bitmapWidth, bitmapHeight);
        ctx.drawImage(bitmap, bitmapX, bitmapY, bitmapWidth, bitmapHeight);
        const coloring = layer.data.coloring;
        if (coloring) {
          let imgData = ctx.getImageData(bitmapX, bitmapY, bitmapWidth, bitmapHeight);
          let pixels = imgData.data;
          let threshold = layer.data.threshold;
          if (threshold === undefined) {
            threshold = { min: 0, max: 255 };
          } else if (threshold.min < 0 || threshold.max > 255 || threshold.max < threshold.min)
            throw new Error("Invalid DownloadedRasterLayer threshold values. Valid range is 0 - 255 and min must be lesser or equal to max.");

          const thresholdRange = threshold.max - threshold.min;
          const thresholdRatio = Math.trunc(255 / thresholdRange);

          if (coloring.length === 256)
            // Heatmap coloring
            for (let i = 0; i < pixels.length; i += 4) {
              let grayscaleValue = pixels[i];
              if (grayscaleValue < threshold.min || grayscaleValue > threshold.max) {
                pixels[i + 3] = 0; // Alpha
                continue;
              }

              grayscaleValue -= threshold.min;
              grayscaleValue *= thresholdRatio;

              pixels[i + 3] = grayscaleValue; // Alpha
              pixels[i + 2] = coloring[grayscaleValue][2]; // Blue
              pixels[i + 1] = coloring[grayscaleValue][1]; // Green
              pixels[i] = coloring[grayscaleValue][0]; // Red
            }
          if (coloring.length === 1)
            // Solid color coloring
            for (let i = 0; i < pixels.length; i += 4) {
              const grayscaleValue = pixels[i];
              if (grayscaleValue < threshold.min || grayscaleValue > threshold.max) {
                pixels[i + 3] = 0; // Alpha
                continue;
              }
              pixels[i + 3] = grayscaleValue; // Alpha
              pixels[i + 2] = coloring[0][2]; // Blue
              pixels[i + 1] = coloring[0][1]; // Green
              pixels[i] = coloring[0][0]; // Red
            }
          ctx.putImageData(imgData, bitmapX, bitmapY);
        }
        const hatching = layer.data.hatching;
        if (hatching) {
          let imgData = ctx.getImageData(bitmapX, bitmapY, bitmapWidth, bitmapHeight);
          let pixels = imgData.data;

          for (let i = 0; i < pixels.length; i += 4) {
            const pixel = i / 4;
            const x = (pixel % bitmapWidth) + bitmapX;
            const y = Math.floor(pixel / bitmapWidth) + bitmapY;
            if ((x + y) % (hatching.blankWidth + hatching.maskWidth) >= hatching.maskWidth) {
              pixels[i + 3] = 0; // Alpha
            }
          }
          ctx.putImageData(imgData, bitmapX, bitmapY);
        }
      }

      const initScale = Math.min(stageWidth / rasterWidth, stageHeight / rasterHeight);

      if (tiling === undefined) {
        if (layer.data.getImage === undefined) throw new Error("DownloadedRasterLayer getImage is undefined");
        if (viewport.width <= 0 || viewport.height <= 0) return;

        const boundedScale = Math.max(Math.min(scale, 1.0), initScale);
        const blob = await layer.data.getImage(
          viewport.x,
          viewport.y,
          viewport.width,
          viewport.height,
          Math.ceil(viewport.width * boundedScale),
          Math.ceil(viewport.height * boundedScale),
        );
        if (blob === null) return;
        const bitmap = await createImageBitmap(blob);
        drawBitmap(bitmap, viewport.x, viewport.y, viewport.width, viewport.height);
        layerRef.current?.batchDraw();
      } else {

        const promises: Promise<undefined>[] = [];
        // Use generator to iterate tiles efficiently without creating intermediate array
        for (const tile of iterateTiles(
          viewport,
          scale,
          stageWidth,
          stageHeight,
          rasterWidth,
          rasterHeight,
          tiling.levelSize,
          tiling.minTilesCount
        )) {
          const promise = new Promise<undefined>((resolve) => {
            getImageCached(
              layer.data.getImage as GetImage,
              tile.x,
              tile.y,
              tile.width,
              tile.height,
              Math.ceil(tile.width * tile.level),
              Math.ceil(tile.height * tile.level),
              controller.signal,
              layer.id,
            ).then((bitmap) => {
              drawBitmap(bitmap, tile.x, tile.y, tile.width, tile.height);
              resolve(undefined);
              if (!tiling.drawAtOnce) {
                layerRef.current?.batchDraw();
              }
            });
          });
          promises.push(promise);
        }
        if (tiling.drawAtOnce) {
          await Promise.all(promises);
          layerRef.current?.batchDraw();
        }
      }
    }
    // Debounce
    timer.current = setTimeout(loadAndDrawScaled, 500);

    return () => {
      clearTimeout(timer.current);
      controller.abort();
    };
  }, [
    viewport,
    rasterWidth,
    rasterHeight,
    stageWidth,
    stageHeight,
    layer.data.hatching,
    layer.data.coloring,
  ]);

  return (
    <Layer
      ref={layerRef}
      imageSmoothingEnabled={false}
      listening={false}
      visible={layer.visible}
      opacity={layer.opacity}
    >
      <KonvaImage image={canvasRef.current} />
    </Layer>
  );
}

export default DownloadedRasterLayer;
