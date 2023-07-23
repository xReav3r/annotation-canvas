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

  const { getTile } = useImageCache();
  const { downloadedRasterLevelSize, downloadedRasterMinTilesCount, downloadedRasterDrawAtOnce } =
    useLayers();

  // Tiling
  useEffect(() => {
    if (rasterWidth === 0 || rasterHeight === 0 || layer.data.getImage === undefined) return;
    const controller = new AbortController();
    async function loadAndDrawTiles() {
      const ctx = canvasRef.current.getContext("2d", {
        willReadFrequently: true,
      });
      if (ctx === null) throw "DownloadedRasterLayer ctx - null";
      const initScale = Math.min(stageWidth / rasterWidth, stageHeight / rasterHeight);
      const boundedScale = Math.max(Math.min(scale, 1.0 - downloadedRasterLevelSize), initScale);

      const currentLevelScale =
        Math.trunc(boundedScale / downloadedRasterLevelSize) * downloadedRasterLevelSize +
        downloadedRasterLevelSize;

      const tileSizeStage = Math.ceil(
        Math.max(stageWidth, stageHeight) / downloadedRasterMinTilesCount,
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
            getTile(
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
              if (bitmap === null) return;
              ctx.clearRect(tileX * tileSize, tileY * tileSize, tileWidth, tileHeight);
              ctx.drawImage(bitmap, tileX * tileSize, tileY * tileSize, tileWidth, tileHeight);
              const coloring = layer.data.coloring;
              if (coloring) {
                let imgData = ctx.getImageData(
                  tileX * tileSize,
                  tileY * tileSize,
                  tileWidth,
                  tileHeight,
                );
                let pixels = imgData.data;
                if (coloring.length === 256)
                  for (let i = 0; i < pixels.length; i += 4) {
                    pixels[i + 3] = pixels[i]; // Alpha
                    pixels[i + 2] = coloring[pixels[i]][2]; // Blue
                    pixels[i + 1] = coloring[pixels[i]][1]; // Green
                    pixels[i] = coloring[pixels[i]][0]; // Red
                  }
                if (coloring.length === 1)
                  for (let i = 0; i < pixels.length; i += 4) {
                    pixels[i + 3] = pixels[i]; // Alpha
                    pixels[i + 2] = coloring[0][2]; // Blue
                    pixels[i + 1] = coloring[0][1]; // Green
                    pixels[i] = coloring[0][0]; // Red
                  }
                ctx.putImageData(imgData, tileX * tileSize, tileY * tileSize);
              }
              const hatching = layer.data.hatching;
              if (hatching) {
                let imgData = ctx.getImageData(
                  tileX * tileSize,
                  tileY * tileSize,
                  tileWidth,
                  tileHeight,
                );
                let pixels = imgData.data;

                for (let i = 0; i < pixels.length; i += 4) {
                  const pixel = i / 4;
                  const x = (pixel % tileWidth) + tileX * tileSize;
                  const y = Math.floor(pixel / tileWidth) + tileY * tileSize;
                  if ((x + y) % (hatching.blankWidth + hatching.maskWidth) >= hatching.maskWidth) {
                    pixels[i + 3] = 0; // Alpha
                  }
                }
                ctx.putImageData(imgData, tileX * tileSize, tileY * tileSize);
              }
              resolve(undefined);
              if (!downloadedRasterDrawAtOnce) {
                layerRef.current?.batchDraw();
              }
            });
          });
          promises.push(promise);
        }
      }
      if (downloadedRasterDrawAtOnce) {
        await Promise.all(promises);
        layerRef.current?.batchDraw();
      }
    }
    // Debounce
    timer.current = setTimeout(loadAndDrawTiles, 150);

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
