import Konva from "konva";
import { useEffect, useRef } from "react";
import { Image, Layer } from "react-konva";

import { useLayers, CreatedRasterLayer as ICreatedRasterLayer } from "./contexts/LayersContext";
import { createRasterCanvas, loadImage } from "./utils";

function CreatedRasterLayer({
  layer,
  width,
  height,
  getAndSetContoursBoundingBoxes,
}: {
  layer: ICreatedRasterLayer;
  width: number;
  height: number;
  getAndSetContoursBoundingBoxes: (canvas: HTMLCanvasElement) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(createRasterCanvas(width, height));
  const layerRef = useRef<Konva.Layer>(null);

  const { setLayerById } = useLayers();

  function drawImage(image: Blob | null) {
    const ctx = canvasRef.current.getContext("2d");
    if (ctx === null) throw "ctx from canvasRef is null";
    if (layerRef.current === null) throw "ctx from layerRef is null";

    if (image !== null && image.size > 0) {
      createImageBitmap(image).then((bitmap) => {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        ctx.drawImage(bitmap, 0, 0);
        getAndSetContoursBoundingBoxes(canvasRef.current);
        layerRef.current?.batchDraw();
      });
    } else {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      getAndSetContoursBoundingBoxes(canvasRef.current);
      layerRef.current?.batchDraw();
    }
  }
  useEffect(() => {
    const ctx = canvasRef.current.getContext("2d");
    if (ctx === null) throw "ctx from canvasRef is null";
    if (layerRef.current === null) throw "ctx from layerRef is null";

    if (layer.data?.initImage) drawImage(layer.data.initImage);
    setLayerById({
      ...layer,
      data: {
        canvas: canvasRef.current,
        ctx,
        layer: layerRef.current,
      },
    });
  }, []);

  useEffect(() => {
    if (layer.data?.actualImage) {
      drawImage(layer.data.actualImage);
    } else if (layer.data?.initImage) {
      drawImage(layer.data.initImage);
    }
  }, [layer.data?.actualImage]);

  return (
    <Layer
      ref={layerRef}
      imageSmoothingEnabled={false}
      listening={false}
      visible={layer.visible}
      opacity={layer.opacity}
    >
      <Image image={canvasRef.current} />
    </Layer>
  );
}

export default CreatedRasterLayer;
