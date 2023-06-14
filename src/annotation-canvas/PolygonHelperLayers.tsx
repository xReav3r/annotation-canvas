import { Dispatch, SetStateAction } from "react";
import { Circle, Group, Layer, Line } from "react-konva";
import { getBoundedRelativePointer, pointsObjectsToArray, rgbaToString, stageBound } from "./utils";
import {
  CreatedVectorLayer,
  ElementType,
  HistoryAction,
  useLayers,
} from "./contexts/LayersContext";
import { useTool } from "./contexts/ToolContext";

function PolygonHelperLayer({
  stageWidth,
  stageHeight,
  zoom,
  polygonHelper,
  setPolygonHelper,
  polygonHelperOffset,
  setPolygonHelperOffset,
  setDragging,
  resetPolygon,
}: {
  stageWidth: number;
  stageHeight: number;
  zoom: {
    scale: number;
    position: { x: number; y: number };
  };
  polygonHelper: { x: number; y: number }[];
  setPolygonHelper: Dispatch<SetStateAction<{ x: number; y: number }[]>>;
  polygonHelperOffset: { x: number; y: number };
  setPolygonHelperOffset: Dispatch<SetStateAction<{ x: number; y: number }>>;
  setDragging: Dispatch<SetStateAction<boolean>>;
  resetPolygon: () => void;
}) {
  const { drawColor, toolSize } = useTool();
  const { rasterWidth, rasterHeight, setLayerByIndex, selectedLayer, historyPush } = useLayers();

  return (
    <Layer>
      <Group
        draggable
        onDragStart={() => setDragging(true)}
        onDragEnd={(e) => {
          setPolygonHelperOffset((prev) => {
            return {
              x: prev.x + e.target.x(),
              y: prev.y + e.target.y(),
            };
          });
          setDragging(false);
        }}
      >
        <Line
          points={pointsObjectsToArray(polygonHelper)}
          stroke={rgbaToString(drawColor)}
          strokeWidth={toolSize}
          closed={false}
          opacity={drawColor.a}
          lineCap="round"
          lineJoin="round"
          onPointerEnter={(e) => {
            const stage = e.target.getStage();
            if (stage === null) throw "polygonHelper - stage null";
            stage.container().style.cursor = "grab";

            setDragging(true);
          }}
          onPointerLeave={(e) => {
            const stage = e.target.getStage();
            if (stage === null) throw "polygonHelper - stage null";
            stage.container().style.cursor = "auto";

            setDragging(false);
          }}
        />
        {polygonHelper.map((point, i) => {
          return (
            <Circle
              key={i}
              x={point.x}
              y={point.y}
              scale={{ x: 1 / zoom.scale, y: 1 / zoom.scale }}
              radius={10}
              stroke="black"
              strokeWidth={1}
              fill={i === 0 ? "red" : "white"}
              draggable={true}
              onPointerClick={(e) => {
                e.cancelBubble = true;
                if (i === 0) {
                  setLayerByIndex(selectedLayer, (prev) => {
                    const newLayer = { ...prev } as CreatedVectorLayer;
                    newLayer.data.elements.push({
                      type: ElementType.Line,
                      x: polygonHelperOffset.x,
                      y: polygonHelperOffset.y,
                      points: pointsObjectsToArray(polygonHelper),
                      stroke: rgbaToString(drawColor),
                      strokeWidth: toolSize,
                      closed: true,
                      opacity: drawColor.a,
                      lineCap: "round",
                      lineJoin: "round",
                    });
                    const backupLayer = newLayer;
                    historyPush({ action: HistoryAction.edit, layer: backupLayer });

                    return newLayer;
                  });
                  resetPolygon();
                }
              }}
              onPointerDblClick={() => {
                setPolygonHelper((prev) => {
                  const newState = [...prev];
                  newState.splice(i, 1);
                  return newState;
                });
              }}
              onDragStart={(e) => {
                e.cancelBubble = true;
              }}
              onDragEnd={(e) => {
                e.cancelBubble = true;
              }}
              onDragMove={(e) => {
                const stage = e.target.getStage();
                if (stage === null) throw "polygonHelper - stage null";
                const { pointerPosition, pointerOverflow } = getBoundedRelativePointer(
                  stage,
                  rasterWidth,
                  rasterHeight,
                );

                if (pointerOverflow) return;
                setPolygonHelper((prev) => {
                  const newState = [...prev];
                  newState[i] = {
                    x: pointerPosition.x - polygonHelperOffset.x,
                    y: pointerPosition.y - polygonHelperOffset.y,
                  };
                  return newState;
                });
              }}
              dragBoundFunc={(e) =>
                stageBound(e, stageWidth, stageHeight, rasterWidth, rasterHeight, zoom.scale)
              }
              onPointerEnter={(e) => {
                const stage = e.target.getStage();
                if (stage === null) throw "polygonHelper - stage null";
                stage.container().style.cursor = "crosshair";

                setDragging(true);
              }}
              onPointerLeave={(e) => {
                const stage = e.target.getStage();
                if (stage === null) throw "polygonHelper - stage null";
                stage.container().style.cursor = "auto";

                setDragging(false);
              }}
            />
          );
        })}
      </Group>
    </Layer>
  );
}
export default PolygonHelperLayer;
