import Konva from "konva";
import { useEffect, useRef } from "react";
import { Rect, Transformer } from "react-konva";

function EditableRectangle({
  shapeProps,
  isSelected,
  onChange,
  onChangeEnd,
}: {
  shapeProps: Konva.Rect;
  isSelected: boolean;
  onChange: (newRect: Konva.Rect) => void;
  onChangeEnd: (newRect: Konva.Rect) => void;
}) {
  const shapeRef = useRef<Konva.Rect>();
  const transformerRef = useRef<Konva.Transformer>();

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
          
          // transformer is changing scale of the node and NOT its width or height
          onChange({
            ...shapeProps,
            x: node.x(),
            y: node.y(),
            width: node.width() * node.scaleX(),
            height: node.height() * node.scaleY(),
          });
        }}
        onTransformEnd={(e) => {
          const node = shapeRef.current;
          if (!node) return;
          onChangeEnd({
            ...shapeProps,
            x: node.x(),
            y: node.y(),
            width: node.width() * node.scaleX(),
            height: node.height() * node.scaleY(),
          });
        }}
      />
      {isSelected && (
        <Transformer
          ref={transformerRef}
          rotateEnabled={false}
          boundBoxFunc={(oldBox, newBox) => {
            // limit resize
            if (newBox.width < shapeProps.strokeWidth || newBox.height < shapeProps.strokeWidth) {
              return oldBox;
            }
            return newBox;
          }}
        />
      )}
    </>
  );
}

export default EditableRectangle;
