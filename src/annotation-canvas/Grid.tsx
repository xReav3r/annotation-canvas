import Konva from "konva";
import { useMemo, useRef } from "react";
import { Layer, Line } from "react-konva";
import { Viewport } from "./AnnotationCanvas";

function Grid({
  width,
  height,
  viewport,
  line,
}: {
  width: number;
  height: number;
  viewport: Viewport;
  line: { stroke?: string; strokeWidth: number };
}) {
  const layerRef = useRef<Konva.Layer>(null);

  const horizontalLines = useMemo(() => {
    const lines: JSX.Element[] = [];
    for (let i = viewport.y1; i <= viewport.y2; i++) {
      lines.push(<Line key={i} {...line} points={[viewport.x1, i, viewport.x2, i]} />);
    }
    return lines;
  }, [viewport, width, height]);

  const verticalLines = useMemo(() => {
    const lines: JSX.Element[] = [];
    for (let i = viewport.x1; i <= viewport.x2; i++) {
      lines.push(<Line key={i} {...line} points={[i, viewport.y1, i, viewport.y2]} />);
    }
    return lines;
  }, [viewport, width, height]);

  return (
    <Layer ref={layerRef} listening={false}>
      {verticalLines}
      {horizontalLines}
    </Layer>
  );
}

export default Grid;
