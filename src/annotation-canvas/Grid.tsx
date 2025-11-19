import Konva from "konva";
import { useMemo, useRef } from "react";
import { Layer, Line } from "react-konva";
import { Viewport } from "../tiling";

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
    const x2 = viewport.x + viewport.width;
    const y2 = viewport.y + viewport.height;
    for (let i = viewport.y; i <= y2; i++) {
      lines.push(<Line key={i} {...line} points={[viewport.x, i, x2, i]} />);
    }
    return lines;
  }, [viewport, width, height]);

  const verticalLines = useMemo(() => {
    const lines: JSX.Element[] = [];
    const x2 = viewport.x + viewport.width;
    const y2 = viewport.y + viewport.height;
    for (let i = viewport.x; i <= x2; i++) {
      lines.push(<Line key={i} {...line} points={[i, viewport.y, i, y2]} />);
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
