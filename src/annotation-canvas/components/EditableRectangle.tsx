import Konva from "konva";
import { useEffect, useRef } from "react";
import { Rect, Transformer } from "react-konva";
import { useLayers } from "../contexts/LayersContext";
import { boundPointer, stageBound } from "../utils";

function EditableRectangle({
  stageWidth,
  stageHeight,
  zoom,
  shapeProps,
  isSelected,
  onChange,
  onChangeEnd,
}: {
  stageWidth: number;
  stageHeight: number;
  zoom: {
    scale: number;
    position: { x: number; y: number };
  };
  shapeProps: Konva.Rect;
  isSelected: boolean;
  onChange: (newRect: Konva.Rect) => void;
  onChangeEnd: (newRect: Konva.Rect) => void;
}) {
  const shapeRef = useRef<Konva.Rect>();
  const transformerRef = useRef<Konva.Transformer>();

  const { rasterWidth, rasterHeight } = useLayers();

  useEffect(() => {
    if (isSelected && shapeRef.current && transformerRef.current) {
      transformerRef.current.nodes([shapeRef.current]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  return (
    <>
      <Rect
        ref={shapeRef}
        {...shapeProps}
        onTransform={(e) => {
          const node = shapeRef.current;
          if (!node) return;

          const newWidth = node.width() * node.scaleX();
          const newHeight = node.height() * node.scaleY();

          // transformer is changing scale of the node and NOT its width or height
          node.setAttrs({
            width: newWidth,
            height: newHeight,
            scaleX: 1,
            scaleY: 1,
          });
        }}
        onTransformEnd={(e) => {
          const node = shapeRef.current;
          if (!node) return;

          const newWidth = node.width() * node.scaleX();
          const newHeight = node.height() * node.scaleY();

          // transformer is changing scale of the node and NOT its width or height
          node.setAttrs({
            width: newWidth,
            height: newHeight,
            scaleX: 1,
            scaleY: 1,
          });
          onChangeEnd({
            ...shapeProps,
            x: node.x(),
            y: node.y(),
            width: newWidth,
            height: newHeight,
          });
        }}
      />
      {isSelected && (
        <Transformer
          ref={transformerRef}
          rotateEnabled={false}
          ignoreStroke={true}
          padding={shapeProps.strokeWidth}
          // TODO + dragging bounding
          // boundBoxFunc={(oldBox, newBox) => {
          //   // limit resize to be too small
          //   if (newBox.width < shapeProps.strokeWidth || newBox.height < shapeProps.strokeWidth) {
          //     return oldBox;
          //   }

          //   console.log(
          //     "BOX",
          //     newBox.x / zoom.scale,
          //     newBox.y / zoom.scale,
          //     newBox.width / zoom.scale,
          //     newBox.height / zoom.scale,
          //   );

          //   // Limit to raster
          //   const rasterToViewportRatioX = stageWidth / rasterWidth;

          //   const rasterToViewportRatioY = stageHeight / rasterHeight;
          //   console.log(stageWidth / zoom.scale, stageHeight / zoom.scale);

          //   // console.log(rasterToViewportRatioX, rasterToViewportRatioY);

          //   const rasterToStageOffsetX = stageWidth / rasterToViewportRatioX - rasterWidth;
          //   const rasterToStageOffsetY = stageHeight / rasterToViewportRatioY - rasterHeight;

          //   console.log(rasterWidth, rasterHeight);
          //   console.log(rasterToStageOffsetX, rasterToStageOffsetY);

          //   const offsetX1 = newBox.x + rasterToStageOffsetX;
          //   const offsetY1 = newBox.y + rasterToStageOffsetY;
          //   const offsetX2 = newBox.x + newBox.width + rasterToStageOffsetX;
          //   const offsetY2 = newBox.y + newBox.height + rasterToStageOffsetY;

          //   const { pointerPosition: pos1 } = boundPointer(
          //     { x: offsetX1 * zoom.scale, y: offsetY1 * zoom.scale },
          //     rasterWidth,
          //     rasterHeight,
          //   );
          //   const { pointerPosition: pos2 } = boundPointer(
          //     {
          //       x: offsetX2 * zoom.scale,
          //       y: offsetY2 * zoom.scale,
          //     },
          //     rasterWidth,
          //     rasterHeight,
          //   );

          //   // console.log(pos1, pos2);

          //   return newBox;
          // }}
        />
      )}
    </>
  );
}

export default EditableRectangle;
