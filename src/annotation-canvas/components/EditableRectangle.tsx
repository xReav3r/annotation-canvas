import Konva from "konva";
import { useEffect, useRef } from "react";
import { Rect, Transformer } from "react-konva";
import { CreatedVectorLayerRectangle, useLayers } from "../contexts/LayersContext";
import { Tool, useTool } from "../contexts/ToolContext";

function EditableRectangle({
  zoom,
  shapeProps,
  isSelected,
  setEditedElementIndexState,
  removeElement,
  onChangeEnd,
}: {
  zoom: {
    scale: number;
    position: { x: number; y: number };
  };
  shapeProps: CreatedVectorLayerRectangle;
  isSelected: boolean;
  setEditedElementIndexState: () => void;
  removeElement: () => void;
  onChangeEnd: ({
    x,
    y,
    width,
    height,
  }: {
    x: number;
    y: number;
    width?: number;
    height?: number;
  }) => void;
}) {
  const shapeRef = useRef<Konva.Rect>();
  const transformerRef = useRef<Konva.Transformer>();

  const { rasterWidth, rasterHeight } = useLayers();
  const { selectedTool } = useTool();

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
        draggable={selectedTool === Tool.Drag || isSelected}
        onDragEnd={(e) => {
          onChangeEnd({ x: e.target.x(), y: e.target.y() });
        }}
        onPointerClick={(e) => {
          e.cancelBubble = true;
          if (selectedTool === Tool.Edit) {
            setEditedElementIndexState();
            return;
          }

          if (selectedTool === Tool.Remove) {
            removeElement();
          }
        }}
        dragBoundFunc={(node) => {
          if (!shapeRef.current) return;
          const { x, y, width, height } = shapeRef.current.attrs;

          const normalizedWidth = width * zoom.scale;
          const normalizedHeight = height * zoom.scale;

          const normalizedRasterWidth = rasterWidth * zoom.scale;
          const normalizedRasterHeight = rasterHeight * zoom.scale;

          const offsetX = zoom.position.x;
          const offsetY = zoom.position.y;

          const newPos = { x: node.x, y: node.y };

          if (node.x < offsetX) {
            newPos.x = offsetX;
          }
          if (node.y < offsetY) {
            newPos.y = offsetY;
          }
          if (node.x + normalizedWidth - offsetX > normalizedRasterWidth) {
            newPos.x = offsetX + normalizedRasterWidth - normalizedWidth;
          }
          if (node.y + normalizedHeight - offsetY > normalizedRasterHeight) {
            newPos.y = offsetY + normalizedRasterHeight - normalizedHeight;
          }

          return newPos;
        }}
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
            skewX: 0,
            skewY: 0,
          });
        }}
        onTransformEnd={(e) => {
          const node = shapeRef.current;
          if (!node) return;

          let newWidth = node.width() * node.scaleX();
          let newHeight = node.height() * node.scaleY();

          // Konva sets rotation when flipping horizontally
          // https://konvajs.org/docs/select_and_transform/Transform_Events.html
          if (node.rotation() !== 0) {
            newWidth = -newWidth;
            newHeight = -newHeight;
          }

          // Normalize negative width and height
          const normalizedProps = {
            x: newWidth < 0 ? node.x() + newWidth : node.x(),
            y: newHeight < 0 ? node.y() + newHeight : node.y(),
            width: Math.abs(newWidth),
            height: Math.abs(newHeight),
          };

          // transformer is changing scale of the node and NOT its width or height
          node.setAttrs({
            ...normalizedProps,
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
            skewX: 0,
            skewY: 0,
          });

          onChangeEnd(normalizedProps);
        }}
      />
      {isSelected && (
        <Transformer
          ref={transformerRef}
          rotateEnabled={false}
          ignoreStroke={true}
          padding={shapeProps.strokeWidth}
          boundBoxFunc={(oldBox, newBox) => {
            const normalizedRasterWidth = rasterWidth * zoom.scale;
            const normalizedRasterHeight = rasterHeight * zoom.scale;

            const offsetX = zoom.position.x;
            const offsetY = zoom.position.y;

            const maxX = newBox.x + newBox.width;
            const maxY = newBox.y + newBox.height;

            if (newBox.x < offsetX) {
              newBox.width = newBox.width + newBox.x - offsetX;
              newBox.x = offsetX;
            }
            if (newBox.y < offsetY) {
              newBox.height = newBox.height + newBox.y - offsetY;
              newBox.y = offsetY;
            }
            if (maxX > normalizedRasterWidth + offsetX) {
              newBox.width = normalizedRasterWidth + offsetX - newBox.x;
            }
            if (maxY > normalizedRasterHeight + offsetY) {
              newBox.height = normalizedRasterHeight + offsetY - newBox.y;
            }

            if (Math.abs(newBox.width) < 0.0001) newBox.width = 0.0001;
            if (Math.abs(newBox.height) < 0.0001) newBox.height = 0.0001;
            return newBox;
          }}
        />
      )}
    </>
  );
}

export default EditableRectangle;
