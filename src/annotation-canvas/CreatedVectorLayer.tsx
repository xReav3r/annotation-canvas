import Konva from "konva";
import { Dispatch, SetStateAction, useEffect, useRef, useState } from "react";
import { Circle, Group, Layer, Line } from "react-konva";
import {
  CreatedVectorLayer as ICreatedVectorLayer,
  CreatedVectorLayerLine,
  CreatedVectorLayerRectangle,
  ElementType,
  useLayers,
  HistoryAction,
} from "./contexts/LayersContext";
import { Tool, useTool } from "./contexts/ToolContext";

import { getBoundedRelativePointer, pointToLineDistance, pointsArrayToObjects } from "./utils";
import { KonvaEventObject } from "konva/lib/Node";
import EditableRectangle from "./components/EditableRectangle";

function CreatedVectorLayer({
  layer,
  active,
  zoom,
  setDragging,
}: {
  layer: ICreatedVectorLayer;
  active: boolean;
  zoom: {
    scale: number;
    position: { x: number; y: number };
  };
  setDragging: Dispatch<SetStateAction<boolean>>;
}) {
  const layerRef = useRef<Konva.Layer>(null);
  const polygonGroupRef = useRef<Konva.Group>(null);

  const { selectedTool } = useTool();
  const { setLayerById, rasterWidth, rasterHeight, selectedLayer, historyPush } = useLayers();

  useEffect(() => {
    if (layerRef.current === null) throw "ctx from layerRef is null";
    const newLayer = {
      ...layer,
      data: {
        ...layer.data,
        layer: layerRef.current,
      },
    };
    setLayerById(newLayer);
  }, []);

  const [editedElementIndex, setEditedElementIndex] = useState(-1);
  useEffect(() => {
    setEditedElementIndex(-1);
  }, [selectedTool, selectedLayer]);

  const selectedElement = layer.data.elements[editedElementIndex];
  const selectedPolygon =
    selectedElement?.type === ElementType.Line
      ? (selectedElement as CreatedVectorLayerLine)
      : undefined;

  const [polygonNewPoint, setPolygonNewPoint] = useState<{
    point: {
      x: number;
      y: number;
    };
    pointIndex: number;
  } | null>(null);

  function setPositionAfterDrag(e: KonvaEventObject<DragEvent>, i: number) {
    const newLayer = { ...layer };
    newLayer.data.elements[i].x = e.target.x();
    newLayer.data.elements[i].y = e.target.y();
    historyPush({ action: HistoryAction.edit, layer: newLayer });
    setLayerById(newLayer);
  }
  function removeElement(i: number) {
    const newLayer = { ...layer };
    newLayer.data.elements.splice(i, 1);
    historyPush({ action: HistoryAction.edit, layer: newLayer });
    setLayerById(newLayer);
  }

  function handleRectangleChange(newRect: Konva.Rect) {
    const newElements = [...layer.data.elements];
    newElements[editedElementIndex] = {
      type: ElementType.Rectangle,
      x: newRect.x,
      y: newRect.y,
      stroke: newRect.stroke,
      strokeWidth: newRect.strokeWidth,
      opacity: newRect.opacity,
      width: newRect.width,
      height: newRect.height,
    };
    const newLayer = {
      ...layer,
      data: {
        ...layer.data,
        elements: newElements,
      },
    };
    setLayerById(newLayer);
    return newLayer;
  }

  function handlePolygonPointDrag(
    e: KonvaEventObject<DragEvent>,
    pointIndex: number,
    selectedPolygon: CreatedVectorLayerLine,
  ) {
    e.cancelBubble = true;
    const stage = e.target.getStage();
    if (stage === null) throw "polygonHelper - stage null";
    const { pointerPosition, pointerOverflow } = getBoundedRelativePointer(
      stage,
      rasterWidth,
      rasterHeight,
    );

    if (pointerOverflow) return;

    const newElements = [...layer.data.elements];
    selectedPolygon.points[pointIndex * 2] = pointerPosition.x - selectedPolygon.x;
    selectedPolygon.points[pointIndex * 2 + 1] = pointerPosition.y - selectedPolygon.y;
    const newLayer = {
      ...layer,
      data: {
        ...layer.data,
        elements: newElements,
      },
    };
    setLayerById(newLayer);
    return newLayer;
  }

  return (
    <Layer ref={layerRef} listening={active} visible={layer.visible} opacity={layer.opacity}>
      {layer.data.elements.map((element, i) => {
        switch (element.type) {
          case ElementType.Rectangle:
            return (
              <EditableRectangle
                key={i}
                shapeProps={{
                  ...element,
                  draggable: selectedTool === Tool.Drag || editedElementIndex === i,
                  onDragEnd: (e) => {
                    setPositionAfterDrag(e, i);
                  },
                  onPointerClick: (e) => {
                    e.cancelBubble = true;
                    if (selectedTool === Tool.Edit) {
                      setEditedElementIndex(i);
                      return;
                    }

                    if (selectedTool === Tool.Remove) {
                      removeElement(i);
                    }
                  },
                }}
                isSelected={editedElementIndex === i}
                onChange={(newRect) => {
                  handleRectangleChange(newRect);
                }}
                onChangeEnd={(newRect) => {
                  const newLayer = handleRectangleChange(newRect);
                  historyPush({
                    action: HistoryAction.edit,
                    layer: newLayer,
                  });
                }}
              />
            );
          case ElementType.Circle:
            return (
              <Circle
                {...element}
                key={i}
                draggable={selectedTool === Tool.Drag}
                onDragEnd={(e) => {
                  setPositionAfterDrag(e, i);
                }}
                onPointerClick={(e) => {
                  e.cancelBubble = true;
                  if (selectedTool === Tool.Remove) {
                    removeElement(i);
                  }
                }}
              />
            );
          case ElementType.Line:
            return (
              editedElementIndex !== i && (
                <Line
                  {...element}
                  key={i}
                  draggable={selectedTool === Tool.Drag}
                  onPointerClick={(e) => {
                    e.cancelBubble = true;
                    if (selectedTool === Tool.Edit) {
                      setEditedElementIndex(i);
                      return;
                    }

                    if (selectedTool === Tool.Remove) {
                      removeElement(i);
                    }
                  }}
                  onDragEnd={(e) => {
                    setPositionAfterDrag(e, i);
                  }}
                />
              )
            );
        }
      })}
      {selectedPolygon !== undefined && (
        <Group
          ref={polygonGroupRef}
          draggable={selectedTool === Tool.Polygon}
          onDragStart={() => {
            setDragging(true);
          }}
          onDragEnd={(e) => {
            const newElements = [...layer.data.elements];
            const line = newElements[editedElementIndex] as CreatedVectorLayerLine;
            line.x += e.target.x();
            line.y += e.target.y();
            const newLayer = {
              ...layer,
              data: {
                ...layer.data,
                elements: newElements,
              },
            };
            setLayerById(newLayer);
            historyPush({
              action: HistoryAction.edit,
              layer: newLayer,
            });
            polygonGroupRef.current?.x(0);
            polygonGroupRef.current?.y(0);

            setDragging(false);
          }}
        >
          <Line
            {...selectedPolygon}
            onPointerClick={(e) => {
              e.cancelBubble = true;
              if (polygonNewPoint) {
                const newElements = [...layer.data.elements];
                selectedPolygon.points.splice(
                  polygonNewPoint.pointIndex + 2,
                  0,
                  polygonNewPoint.point.x - selectedPolygon.x,
                );
                selectedPolygon.points.splice(
                  polygonNewPoint.pointIndex + 3,
                  0,
                  polygonNewPoint.point.y - selectedPolygon.y,
                );

                const newLayer = {
                  ...layer,
                  data: {
                    ...layer.data,
                    elements: newElements,
                  },
                };
                setLayerById(newLayer);
                historyPush({
                  action: HistoryAction.edit,
                  layer: newLayer,
                });
              } else {
                setEditedElementIndex(-1);
                setDragging(false);
              }
            }}
            onPointerEnter={(e) => {
              const stage = e.target.getStage();
              if (stage === null) throw "polygonHelper - stage null";
              stage.container().style.cursor = "grab";

              setDragging(true);
            }}
            onPointerMove={(e) => {
              const stage = e.target.getStage();
              if (stage === null) throw "onMouseDown - stage null";
              const { pointerPosition } = getBoundedRelativePointer(
                stage,
                rasterWidth,
                rasterHeight,
              );

              const offsetedPointerPosition = {
                x: pointerPosition.x - selectedPolygon.x,
                y: pointerPosition.y - selectedPolygon.y,
              };

              for (let i = 0; i < selectedPolygon.points.length - 1; i += 2) {
                const lineStart = {
                  x: selectedPolygon.points[i],
                  y: selectedPolygon.points[i + 1],
                };
                const lineEnd = {
                  x: selectedPolygon.points[(i + 2) % selectedPolygon.points.length],
                  y: selectedPolygon.points[(i + 3) % selectedPolygon.points.length],
                };

                const distance = pointToLineDistance(offsetedPointerPosition, lineStart, lineEnd);
                if (distance !== null && distance < selectedPolygon.strokeWidth / 2) {
                  setPolygonNewPoint({ point: pointerPosition, pointIndex: i });
                  return;
                }
              }

              setPolygonNewPoint(null);
            }}
            onPointerLeave={(e) => {
              const stage = e.target.getStage();
              if (stage === null) throw "polygonHelper - stage null";
              stage.container().style.cursor = "auto";

              setDragging(false);
              setPolygonNewPoint(null);
            }}
          />
          {pointsArrayToObjects(selectedPolygon.points).map((point, pointIndex) => {
            return (
              <Circle
                x={point.x + selectedPolygon.x}
                y={point.y + selectedPolygon.y}
                scale={{ x: 1 / zoom.scale, y: 1 / zoom.scale }}
                radius={10}
                stroke="black"
                fill="white"
                draggable={true}
                onPointerDblClick={(e) => {
                  e.cancelBubble = true;
                  const newElements = [...layer.data.elements];
                  selectedPolygon.points.splice(pointIndex * 2, 2);

                  // Delete whole polygon
                  if (selectedPolygon.points.length <= 1) {
                    newElements.splice(editedElementIndex, 2);
                    setEditedElementIndex(-1);
                  }
                  const newLayer = {
                    ...layer,
                    data: {
                      ...layer.data,
                      elements: newElements,
                    },
                  };
                  setLayerById(newLayer);
                  historyPush({
                    action: HistoryAction.edit,
                    layer: newLayer,
                  });
                }}
                onDragStart={(e) => {
                  e.cancelBubble = true;
                  setDragging(true);
                }}
                onDragMove={(e) => {
                  handlePolygonPointDrag(e, pointIndex, selectedPolygon);
                }}
                onDragEnd={(e) => {
                  const newLayer = handlePolygonPointDrag(e, pointIndex, selectedPolygon);
                  if (newLayer)
                    historyPush({
                      action: HistoryAction.edit,
                      layer: newLayer,
                    });
                  setDragging(false);
                }}
                onPointerClick={(e) => {
                  e.cancelBubble = true;
                }}
                onPointerEnter={(e) => {
                  const stage = e.target.getStage();
                  if (stage === null) throw "polygonHelper - stage null";
                  stage.container().style.cursor = "crosshair";
                }}
                onPointerLeave={(e) => {
                  const stage = e.target.getStage();
                  if (stage === null) throw "polygonHelper - stage null";
                  stage.container().style.cursor = "auto";
                }}
              />
            );
          })}
          {polygonNewPoint !== null && (
            <Circle
              listening={false}
              x={polygonNewPoint.point.x}
              y={polygonNewPoint.point.y}
              scale={{ x: 1 / zoom.scale, y: 1 / zoom.scale }}
              radius={10}
              stroke="green"
              fill="white"
            />
          )}
        </Group>
      )}
    </Layer>
  );
}

export default CreatedVectorLayer;
