import Konva from "konva";
import { useEffect, useRef } from "react";
import { Image as KonvaImage, Layer } from "react-konva";

import { Viewport } from "./AnnotationCanvas";
import { GetImage, useImageCache } from "./contexts/ImageCacheContext";
import {
  DownloadedRasterLayer as IDownloadedRasterLayer,
  useLayers,
} from "./contexts/LayersContext";
import { createRasterCanvas, loadImage } from "./utils";

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

  const urlObjects = useRef([]);

  const timer = useRef<NodeJS.Timeout>();

  const { getImageCached } = useImageCache();
  const { tiling } = useLayers();

  // Tiling
  useEffect(() => {
    if (rasterWidth === 0 || rasterHeight === 0 || layer.data.getImage === undefined) return;
    const controller = new AbortController();
    async function loadAndDrawTiles() {
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
        if (ctx === null) throw "DownloadedRasterLayer ctx - null";

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
            throw "Invalid DownloadedRasterLayer threshold values. Valid range is 0 - 255 and min must be lesser or equal to max.";

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
        if (layer.data.getImage === undefined) throw "DownloadedRasterLayer getImage - undefined";
        const x = viewport.x1;
        const y = viewport.y1;
        const width = viewport.x2 - viewport.x1;
        const height = viewport.y2 - viewport.y1;
        if (width <= 0 || height <= 0) return;

        const boundedScale = Math.max(Math.min(scale, 1.0), initScale);
        const blob = await layer.data.getImage(
          x,
          y,
          width,
          height,
          Math.ceil(width * boundedScale),
          Math.ceil(height * boundedScale),
        );
        if (blob === null) return;
        const bitmap = await createImageBitmap(blob);
        drawBitmap(bitmap, x, y, width, height);
        layerRef.current?.batchDraw();
      } else {
        const boundedScale = Math.max(
          Math.min(scale, 1.0 - tiling.downloadedRasterLevelSize),
          initScale,
        );

        const currentLevelScale =
          Math.trunc(boundedScale / tiling.downloadedRasterLevelSize) *
            tiling.downloadedRasterLevelSize +
          tiling.downloadedRasterLevelSize;

        const tileSizeStage = Math.ceil(
          Math.max(stageWidth, stageHeight) / tiling.downloadedRasterMinTilesCount,
        );
        const tileSize = Math.ceil(tileSizeStage / currentLevelScale);

        const promises: Promise<undefined>[] = [];
        for (
          let tileX = Math.trunc(viewport.x1 / tileSize);
          tileX <= Math.trunc(viewport.x2 / tileSize);
          tileX++
        ) {
          for (
            let tileY = Math.trunc(viewport.y1 / tileSize);
            tileY <= Math.trunc(viewport.y2 / tileSize);
            tileY++
          ) {
            const tileWidth = Math.min(rasterWidth - tileSize * tileX, tileSize);
            const tileHeight = Math.min(rasterHeight - tileSize * tileY, tileSize);

            const promise = new Promise<undefined>((resolve) => {
              getImageCached(
                layer.data.getImage as GetImage,
                tileX * tileSize,
                tileY * tileSize,
                tileWidth,
                tileHeight,
                Math.ceil(tileWidth * currentLevelScale),
                Math.ceil(tileHeight * currentLevelScale),
                controller.signal,
                layer.id,
              ).then((bitmap) => {
                drawBitmap(bitmap, tileX * tileSize, tileY * tileSize, tileWidth, tileHeight);
                resolve(undefined);
                if (!tiling.downloadedRasterDrawAtOnce) {
                  layerRef.current?.batchDraw();
                }
              });
            });
            promises.push(promise);
          }
        }
        if (tiling.downloadedRasterDrawAtOnce) {
          await Promise.all(promises);
          layerRef.current?.batchDraw();
        }
      }
    }
    // Debounce
    timer.current = setTimeout(loadAndDrawTiles, 500);

    return () => {
      clearTimeout(timer.current);
      controller.abort();
      urlObjects.current.forEach((urlObject) => URL.revokeObjectURL(urlObject));
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

  // No tiling
  useEffect(() => {
    if (layer.data.image === undefined) return;
    async function drawImage() {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx === null) throw "DownloadedRasterLayer ctx - null";

      const urlObject = URL.createObjectURL(layer.data.image as Blob);
      const image = await loadImage(urlObject);
      URL.revokeObjectURL(urlObject);
      ctx.drawImage(image, 0, 0);
    }

    drawImage();
  }, []);

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
