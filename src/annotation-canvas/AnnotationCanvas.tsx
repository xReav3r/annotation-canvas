import Konva from "konva";
import { useEffect, useRef, useState } from "react";
import { Image, Label, Layer, Rect, Stage, Tag, Text } from "react-konva";
import {
  useLayers,
  ElementType,
  LayerType,
  CreatedRasterLayer as CreatedRasterLayerType,
  CreatedVectorLayer as CreatedVectorLayerType,
  CreatedRasterLayerData,
  CreatedVectorLayerRectangle,
  CreatedVectorLayerCircle,
  CreatedVectorLayerLine,
  HistoryAction,
} from "./contexts/LayersContext";
import { Tool, BrushShape, useTool } from "./contexts/ToolContext";
import AnimatedLayer from "./AnimatedLayer";
import CreatedRasterLayer from "./CreatedRasterLayer";
import CreatedVectorLayer from "./CreatedVectorLayer";
import DownloadedRasterLayer from "./DownloadedRasterLayer";
import DownloadedVectorLayer from "./DownloadedVectorLayer";
import Grid from "./Grid";
import {
  absoluteRectangle,
  createRasterCanvas,
  drawFilledCircleLine,
  drawFilledSquareLine,
  getBoundedRelativePointer,
  getContoursBoundingBoxes,
  rgbaToString,
  stageBound,
  toBlob,
} from "./utils";
import PolygonHelperLayer from "./PolygonHelperLayers";
import { RectConfig } from "konva/lib/shapes/Rect";

interface PixelData {
  width: number;
  height: number;
  data: Uint32Array;
}

export interface Zoom {
  scale: number;
  position: { x: number; y: number };
}

export interface Viewport {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface IAnnotationCanvas {
  onPointerMove?: ((position: { x: number; y: number }) => void) | null;
  onZoomChange?: ((zoom: Zoom, viewport: Viewport) => void) | null;
  gridEnabled?: boolean;
  gridScale?: number;
  gridLine?: { stroke?: string; strokeWidth: number };
  disableZoom?: boolean;
  blobColors?: { r: number; g: number; b: number }[];
  boundingBoxes?: RectConfig[];
  zoom?: Zoom;
  setZoom?: React.Dispatch<React.SetStateAction<Zoom>>;
}

function AnnotationCanvas({
  onPointerMove = null,
  onZoomChange = null,
  gridEnabled = true,
  gridScale = 6,
  gridLine = { stroke: "white", strokeWidth: 0.05 },
  disableZoom = false,
  blobColors = [],
  boundingBoxes = [],
  zoom: propsZoom,
  setZoom: setPropsZoom,
}: IAnnotationCanvas) {
  const { selectedTool, drawColor, toolSize, brushShape } = useTool();

  const {
    rasterWidth,
    rasterHeight,
    layers,
    setLayerByIndex,
    selectedLayer,
    selectedLayerType,
    historyPush,
  } = useLayers();

  if (propsZoom === undefined && setPropsZoom !== undefined) {
    throw "annotation-canvas - AnnotationCanvas: setZoom provided, but not zoom.";
  }

  const [internalZoom, setInternalZoom] = useState({
    scale: 1,
    position: { x: 0, y: 0 },
  });

  let zoom = internalZoom;

  if (propsZoom !== undefined) {
    zoom = propsZoom;
  }

  let setZoom = setInternalZoom;
  if (propsZoom !== undefined && setPropsZoom === undefined) {
    console.warn(
      "annotation-canvas - AnnotationCanvas: zoom provided, but not setZoom. Component will not zoom.",
    );
    setZoom = () => {};
  }
  if (setPropsZoom !== undefined) {
    setZoom = setPropsZoom;
  }

  const containerRef = useRef<HTMLDivElement>(null); // default element for TypeScript
  const stageRef = useRef<Konva.Stage>(null);

  const rasterCanvasPointerRef = useRef<HTMLCanvasElement | null>(null);
  const rasterCanvasPointerLayerRef = useRef<Konva.Layer>(null);
  const rasterClearRect = useRef({ x: 0, y: 0 }); // Start position of clear rectangle pointer

  const prevPointer = useRef({ x: 0, y: 0 });

  const [stageWidth, setStageWidth] = useState(0);
  const [stageHeight, setStageHeight] = useState(0);

  useEffect(() => {
    if (rasterWidth < 1 || rasterHeight < 1) return;
    rasterCanvasPointerRef.current?.remove();
    rasterCanvasPointerRef.current = createRasterCanvas(rasterWidth, rasterHeight);
  }, [rasterWidth, rasterHeight]);

  const [viewport, setViewport] = useState<Viewport>({
    x1: 0,
    y1: 0,
    x2: 0,
    y2: 0,
  });

  // Calculate viewport
  useEffect(() => {
    if (stageWidth <= 0 || stageHeight <= 0) return;
    let x1 = Math.max(0, -Math.trunc(zoom.position.x / zoom.scale));
    let y1 = Math.max(0, -Math.trunc(zoom.position.y / zoom.scale));

    let x2 = Math.max(0, Math.ceil((stageWidth - zoom.position.x) / zoom.scale));
    let y2 = Math.max(0, Math.ceil((stageHeight - zoom.position.y) / zoom.scale));

    // Cut to layers dimensions
    x1 = Math.min(rasterWidth, x1);
    y1 = Math.min(rasterHeight, y1);
    x2 = Math.min(rasterWidth, x2);
    y2 = Math.min(rasterHeight, y2);

    if (onZoomChange) onZoomChange(zoom, { x1, y1, x2, y2 });
    setViewport({ x1, y1, x2, y2 });
  }, [zoom, rasterWidth, rasterHeight, stageWidth, stageHeight]);

  const [drawing, setDrawing] = useState(false);

  async function drawRasterLine(
    brushShape: BrushShape,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    ctx: CanvasRenderingContext2D,
    layer: Konva.Layer,
  ) {
    switch (brushShape) {
      case BrushShape.Circle:
        drawFilledCircleLine(x1, y1, x2, y2, toolSize, ctx);
        break;
      case BrushShape.Square:
        drawFilledSquareLine(x1, y1, x2, y2, toolSize, ctx);
    }
    layer.batchDraw();
  }

  useEffect(() => {
    Konva.hitOnDragEnabled = true; // Initialization for multi touch
    if (containerRef.current === null) throw "containerRef - null";
    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current === null) return;
      const newStageWidth = containerRef.current.clientWidth;
      const newStageHeight = containerRef.current.clientHeight;
      setStageWidth(newStageWidth);
      setStageHeight(newStageHeight);
      if (stageRef.current === null) throw "stageRef - null";
      const newScale = Math.min(newStageWidth / rasterWidth, newStageHeight / rasterHeight);
      stageRef.current.scale({ x: newScale, y: newScale });
      setZoom((prev) => {
        return { ...prev, scale: newScale };
      });

      // Centering
      stageRef.current.position({
        x: (newStageWidth - rasterWidth * newScale) / 2,
        y: (newStageHeight - rasterHeight * newScale) / 2,
      });
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  function applyZoom(direction: "in" | "out", scaleBy: number) {
    const stage = stageRef.current;
    if (stage === null) throw "onWheel - stage null";
    const pointer = stage.getPointerPosition();
    if (pointer === null) throw "onWheel - pointerPosition null";

    const oldScale = stage.scaleX();

    const pointerPosition = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    let newScale = direction === "in" ? oldScale * scaleBy : oldScale / scaleBy;

    // Limit scale to stage size
    newScale = Math.max(newScale, Math.min(stageWidth / rasterWidth, stageHeight / rasterHeight));

    stage.scale({ x: newScale, y: newScale });

    let newPos = {
      x: pointer.x - pointerPosition.x * newScale,
      y: pointer.y - pointerPosition.y * newScale,
    };
    newPos = stageBound(newPos, stageWidth, stageHeight, rasterWidth, rasterHeight, newScale);

    stage.position(newPos);

    setZoom({ scale: newScale, position: newPos });
  }

  const [polygonHelper, setPolygonHelper] = useState<{ x: number; y: number }[]>([]);
  const [polygonHelperOffset, setPolygonHelperOffset] = useState({
    x: 0,
    y: 0,
  });
  const [dragging, setDragging] = useState(false);

  function resetPolygon() {
    setPolygonHelper([]);
    setPolygonHelperOffset({ x: 0, y: 0 });
    setDragging(false);
  }

  useEffect(() => {
    resetPolygon();
  }, [selectedTool, selectedLayer]);

  const [contoursBoundingBoxes, setContoursBoundingBoxes] = useState<
    {
      color: { r: number; g: number; b: number };
      boundingBoxes: { x: number; y: number; width: number; height: number }[];
    }[]
  >([]);

  function getAndSetContoursBoundingBoxes(canvas: HTMLCanvasElement) {
    setContoursBoundingBoxes(getContoursBoundingBoxes(canvas, blobColors));
  }

  useEffect(() => {
    if (selectedLayerType === LayerType.createdRaster && blobColors.length > 0) {
      const createdRasterLayerData = layers[selectedLayer].data as CreatedRasterLayerData;
      if (!createdRasterLayerData?.canvas || !createdRasterLayerData?.layer)
        throw "createdRasterLayer undefined";
      getAndSetContoursBoundingBoxes(createdRasterLayerData.canvas);
    } else setContoursBoundingBoxes([]);
  }, [selectedLayer]);

  // Multi touch pinch zoom
  const touchLastCenter = useRef<{ x: number; y: number } | null>(null);
  const touchLastDistance = useRef(0);

  let cursor = "auto";
  switch (selectedTool) {
    case Tool.Move:
      cursor = "move";
      break;
    case Tool.ZoomIn:
      cursor = "zoom-in";
      break;
    case Tool.ZoomOut:
      cursor = "zoom-out";
      break;
  }

  return (
    <div style={{ width: "100%", height: "100%" }} ref={containerRef}>
      <Stage
        style={{ overflow: "hidden", cursor }}
        ref={stageRef}
        draggable={selectedTool === Tool.Move}
        width={stageWidth}
        height={stageHeight}
        onWheel={(e) => {
          if (disableZoom) return;
          e.evt.preventDefault();

          applyZoom(e.evt.deltaY > 0 ? "out" : "in", Math.abs(e.evt.deltaY / 1500) + 1);
        }}
        onDragMove={(e) => {
          const stage = stageRef.current;
          if (stage === null) throw "onDragMove - stage null";
          setZoom((prev) => {
            return {
              ...prev,
              position: { x: stage.attrs.x, y: stage.attrs.y },
            };
          });
        }}
        dragBoundFunc={(pos) => {
          return stageBound(pos, stageWidth, stageHeight, rasterWidth, rasterHeight, zoom.scale);
        }}
        onPointerDblClick={(e) => {
          if (disableZoom || !stageRef.current) return;
          const newScale = Math.min(stageWidth / rasterWidth, stageHeight / rasterHeight);
          stageRef.current.scale({ x: newScale, y: newScale });
          setZoom((prev) => {
            return { ...prev, scale: newScale };
          });

          // Centering
          stageRef.current.position({
            x: (stageWidth - rasterWidth * newScale) / 2,
            y: (stageHeight - rasterHeight * newScale) / 2,
          });
        }}
        // DOWN
        onPointerDown={(e) => {
          if (selectedTool === Tool.Move) return;

          const stage = e.target.getStage();
          if (stage === null) throw "onMouseDown - stage null";
          const { pointerPosition, pointerOverflow } = getBoundedRelativePointer(
            stage,
            rasterWidth,
            rasterHeight,
          );

          if (pointerOverflow) return; // Do not init actions out of image

          // DOWN - VECTOR
          if (selectedTool === Tool.Rectangle) {
            setDrawing(true);

            setLayerByIndex(selectedLayer, (prev) => {
              const newLayer = { ...prev } as CreatedVectorLayerType;
              newLayer.data.elements.push({
                type: ElementType.Rectangle,
                x: pointerPosition.x,
                y: pointerPosition.y,
                width: 0,
                height: 0,
                stroke: rgbaToString(drawColor),
                strokeWidth: toolSize,
                opacity: drawColor.a,
              });

              return newLayer;
            });
            return;
          }

          if (selectedTool === Tool.Circle) {
            setDrawing(true);

            setLayerByIndex(selectedLayer, (prev) => {
              const newLayer = { ...prev } as CreatedVectorLayerType;
              newLayer.data.elements.push({
                type: ElementType.Circle,
                x: pointerPosition.x,
                y: pointerPosition.y,
                radius: 0,
                stroke: rgbaToString(drawColor),
                strokeWidth: toolSize,
                opacity: drawColor.a,
              });
              return newLayer;
            });
            return;
          }

          if (selectedTool === Tool.Line) {
            setDrawing(true);

            setLayerByIndex(selectedLayer, (prev) => {
              const newLayer = { ...prev } as CreatedVectorLayerType;
              newLayer.data.elements.push({
                type: ElementType.Line,
                x: 0,
                y: 0,
                points: [pointerPosition.x, pointerPosition.y],
                stroke: rgbaToString(drawColor),
                strokeWidth: toolSize,
                opacity: drawColor.a,
                lineCap: "round",
                lineJoin: "round",
              });
              return newLayer;
            });
            return;
          }

          // DOWN - RASTER
          if (selectedTool === Tool.Brush || selectedTool === Tool.Eraser) {
            const createdRasterLayer = layers[selectedLayer].data as CreatedRasterLayerData;
            if (!createdRasterLayer?.ctx || !createdRasterLayer?.layer)
              throw "createdRasterLayer undefined";
            createdRasterLayer.ctx.globalCompositeOperation =
              selectedTool === Tool.Brush ? "source-over" : "destination-out";
            createdRasterLayer.ctx.fillStyle = rgbaToString(drawColor);

            const x = pointerPosition.x;
            const y = pointerPosition.y;
            drawRasterLine(
              brushShape,
              x,
              y,
              x,
              y,
              createdRasterLayer.ctx,
              createdRasterLayer.layer,
            );

            prevPointer.current = pointerPosition;
            setDrawing(true);
            return;
          }

          if (selectedTool === Tool.Clear) {
            const stage = e.target.getStage();
            if (stage === null) throw "onMouseMove - stage null";

            rasterClearRect.current = {
              ...pointerPosition,
            };
            setDrawing(true);
            return;
          }
        }}
        // LEAVE - no pointer on touch devices
        onMouseLeave={(e) => {
          if (selectedTool === Tool.Brush || selectedTool === Tool.Eraser) {
            if (rasterCanvasPointerRef.current === null)
              throw "onMouseLeave - rasterPointer - canvas null";
            const rasterCanvasPointerCtx = rasterCanvasPointerRef.current.getContext("2d");
            if (rasterCanvasPointerCtx === null) throw "onMouseLeave - rasterPointer - ctx null";
            if (rasterCanvasPointerLayerRef.current === null)
              throw "onMouseLeave - rasterPointer - layer null";

            rasterCanvasPointerCtx.clearRect(
              0,
              0,
              rasterCanvasPointerRef.current.width,
              rasterCanvasPointerRef.current.height,
            );
            rasterCanvasPointerLayerRef.current.batchDraw();
          }
          return;
        }}
        // MOVE
        onPointerMove={(e) => {
          const stage = e.target.getStage();
          if (stage === null) throw "onMouseMove - stage null";
          const { pointerPosition, pointerOverflow } = getBoundedRelativePointer(
            stage,
            rasterWidth,
            rasterHeight,
          );

          if (!pointerOverflow && onPointerMove) onPointerMove(pointerPosition);

          if (selectedTool === Tool.Move) {
            return;
          }
          // MOVE - VECTOR
          if (selectedTool === Tool.Rectangle) {
            if (!drawing) return;
            setLayerByIndex(selectedLayer, (prev) => {
              const newLayer = { ...prev } as CreatedVectorLayerType;
              const rectangle = newLayer.data.elements[
                newLayer.data.elements.length - 1
              ] as CreatedVectorLayerRectangle;

              rectangle.width = pointerPosition.x - rectangle.x;
              rectangle.height = pointerPosition.y - rectangle.y;
              return newLayer;
            });
            return;
          }

          if (selectedTool === Tool.Circle) {
            if (!drawing) return;

            setLayerByIndex(selectedLayer, (prev) => {
              const newLayer = { ...prev } as CreatedVectorLayerType;
              const circle = newLayer.data.elements[
                newLayer.data.elements.length - 1
              ] as CreatedVectorLayerCircle;

              let radius = Math.sqrt(
                Math.pow(pointerPosition.x - circle.x, 2) +
                  Math.pow(pointerPosition.y - circle.y, 2),
              );

              if (circle.x - radius < 0) radius = circle.x;
              if (circle.y - radius < 0) radius = circle.y;
              if (circle.x + radius > rasterWidth) radius = rasterWidth - circle.x;
              if (circle.y + radius > rasterHeight) radius = rasterHeight - circle.y;

              circle.radius = radius;
              return newLayer;
            });
            return;
          }

          if (selectedTool === Tool.Line) {
            if (!drawing) return;

            setLayerByIndex(selectedLayer, (prev) => {
              const newLayer = { ...prev } as CreatedVectorLayerType;
              const line = newLayer.data.elements[
                newLayer.data.elements.length - 1
              ] as CreatedVectorLayerLine;
              line.points = [...line.points];

              line.points[2] = pointerPosition.x;
              line.points[3] = pointerPosition.y;
              return newLayer;
            });
            return;
          }

          // MOVE - RASTER
          if (selectedTool === Tool.Brush || selectedTool === Tool.Eraser) {
            if (rasterCanvasPointerRef.current === null)
              throw "onMouseMove - rasterPointer - canvas null";
            const rasterCanvasPointerCtx = rasterCanvasPointerRef.current.getContext("2d");
            if (rasterCanvasPointerCtx === null) throw "onMouseMove - rasterPointer - ctx null";

            rasterCanvasPointerCtx.clearRect(
              0,
              0,
              rasterCanvasPointerRef.current.width,
              rasterCanvasPointerRef.current.height,
            );

            if (!pointerOverflow) {
              rasterCanvasPointerCtx.fillStyle = rgbaToString(drawColor);

              const x = pointerPosition.x;
              const y = pointerPosition.y;
              if (rasterCanvasPointerLayerRef.current === null)
                throw "rasterCanvasPointerLayer - null";
              drawRasterLine(
                brushShape,
                x,
                y,
                x,
                y,
                rasterCanvasPointerCtx,
                rasterCanvasPointerLayerRef.current,
              );

              if (!drawing) return;

              const createdRasterLayer = layers[selectedLayer].data as CreatedRasterLayerData;
              if (!createdRasterLayer?.ctx || !createdRasterLayer?.layer)
                throw "createdRasterLayer undefined";
              drawRasterLine(
                brushShape,
                prevPointer.current.x,
                prevPointer.current.y,
                pointerPosition.x,
                pointerPosition.y,
                createdRasterLayer.ctx,
                createdRasterLayer.layer,
              );

              prevPointer.current = pointerPosition;
            }
            return;
          }
          if (selectedTool === Tool.Clear) {
            if (!drawing) return;

            if (rasterCanvasPointerRef.current === null)
              throw "onMouseDown - rasterPointer - canvas null";
            const rasterCanvasPointerCtx = rasterCanvasPointerRef.current.getContext("2d");
            if (rasterCanvasPointerLayerRef.current === null)
              throw "onMouseDown - rasterPointer - layer null";
            if (rasterCanvasPointerCtx === null) throw "onMouseDown - rasterPointer - ctx null";

            const x = Math.round(rasterClearRect.current.x);
            const y = Math.round(rasterClearRect.current.y);
            const width = Math.round(pointerPosition.x - rasterClearRect.current.x);
            const height = Math.round(pointerPosition.y - rasterClearRect.current.y);

            rasterCanvasPointerCtx.clearRect(
              0,
              0,
              rasterCanvasPointerRef.current.width,
              rasterCanvasPointerRef.current.height,
            );
            rasterCanvasPointerCtx.fillStyle = "black";
            rasterCanvasPointerCtx.fillRect(x, y, width, height);
            rasterCanvasPointerLayerRef.current.batchDraw();
            return;
          }
        }}
        // UP
        onPointerUp={(e) => {
          if (selectedTool === Tool.Move) return;

          // All drawing tools stop drawing
          setDrawing(false);

          const stage = e.target.getStage();
          if (stage === null) throw "onMouseUp - stage null";
          const { pointerPosition } = getBoundedRelativePointer(stage, rasterWidth, rasterHeight);

          // UP - VECTOR
          if (selectedTool === Tool.Rectangle) {
            // Converting to positive size for Konva getClientRect
            setLayerByIndex(selectedLayer, (prev) => {
              const newLayer = { ...prev } as CreatedVectorLayerType;
              newLayer.data.elements[newLayer.data.elements.length - 1] = absoluteRectangle(
                newLayer.data.elements[
                  newLayer.data.elements.length - 1
                ] as CreatedVectorLayerRectangle,
              ) as CreatedVectorLayerRectangle;

              return newLayer;
            });
            // NO RETURN BECAUSE OF HISTORY PUSH
          }

          if ([Tool.Circle, Tool.Line, Tool.Rectangle].includes(selectedTool)) {
            historyPush({ action: HistoryAction.edit, layer: layers[selectedLayer] });
            return;
          }

          // UP - RASTER
          if (selectedTool === Tool.Clear) {
            const stage = e.target.getStage();
            if (stage === null) throw "onMouseMove - stage null";

            if (rasterCanvasPointerRef.current === null)
              throw "onMouseDown - rasterPointer - canvas null";
            const rasterCanvasPointerCtx = rasterCanvasPointerRef.current.getContext("2d");
            if (rasterCanvasPointerLayerRef.current === null)
              throw "onMouseDown - rasterPointer - layer null";
            if (rasterCanvasPointerCtx === null) throw "onMouseDown - rasterPointer - ctx null";

            // Clear pointer canvas
            rasterCanvasPointerCtx.clearRect(
              0,
              0,
              rasterCanvasPointerRef.current.width,
              rasterCanvasPointerRef.current.height,
            );
            rasterCanvasPointerLayerRef.current.batchDraw();

            const x = Math.round(rasterClearRect.current.x);
            const y = Math.round(rasterClearRect.current.y);
            const width = Math.round(pointerPosition.x - rasterClearRect.current.x);
            const height = Math.round(pointerPosition.y - rasterClearRect.current.y);

            // Clear rectangle from current raster layer
            const createdRasterLayer = layers[selectedLayer].data as CreatedRasterLayerData;
            if (!createdRasterLayer?.ctx || !createdRasterLayer?.layer)
              throw "createdRasterLayer undefined";

            createdRasterLayer.ctx.clearRect(x, y, width, height);
            createdRasterLayer.layer.batchDraw();

            // NO RETURN BECAUSE OF BLOB IDENTIFIYNG AND HISTORY PUSH
          }

          if ([Tool.Brush, Tool.Clear, Tool.Eraser, Tool.Floodfill].includes(selectedTool)) {
            const createdRasterLayer = layers[selectedLayer] as CreatedRasterLayerType;
            if (!createdRasterLayer.data?.canvas || !createdRasterLayer.data?.layer)
              throw "createdRasterLayer undefined";

            // TODO - clone optimalization - do not copy images
            toBlob(createdRasterLayer.data.canvas).then((blob) => {
              historyPush({ action: HistoryAction.edit, layer: createdRasterLayer }, blob);
            });

            // Set actualImage to undefined to trigger drawing if undo is used
            setLayerByIndex(selectedLayer, (prev) => {
              const layer = prev as CreatedRasterLayerType;
              if (layer.data !== null) layer.data.actualImage = undefined;
              return layer;
            });

            if (blobColors.length > 0) {
              getAndSetContoursBoundingBoxes(createdRasterLayer.data.canvas);
            }
          }
        }}
        // CLICK
        onPointerClick={(e) => {
          const stage = e.target.getStage();
          if (stage === null) throw "onMouseDown - stage null";

          const { pointerPosition } = getBoundedRelativePointer(stage, rasterWidth, rasterHeight);

          if (selectedTool === Tool.ZoomIn) {
            applyZoom("in", 1.2);
          }
          if (selectedTool === Tool.ZoomOut) {
            applyZoom("out", 1.2);
          }

          // CLICK - RASTER
          if (selectedTool === Tool.Floodfill) {
            const createdRasterLayer = layers[selectedLayer].data as CreatedRasterLayerData;
            if (!createdRasterLayer?.ctx || !createdRasterLayer?.layer)
              throw "createdRasterLayer undefined";
            const imageData = createdRasterLayer.ctx.getImageData(0, 0, rasterWidth, rasterHeight);

            if (!imageData) throw "Floodfill ctx getImageData fail";

            const pixelData: PixelData = {
              width: imageData.width,
              height: imageData.height,
              data: new Uint32Array(imageData.data.buffer),
            };

            let x = Math.trunc(pointerPosition.x);
            let y = Math.trunc(pointerPosition.y);

            function getPixel(pixelData: PixelData, x: number, y: number) {
              if (x < 0 || y < 0 || x >= pixelData.width || y >= pixelData.height) {
                return -1; // -1 is impossible color
              } else {
                return pixelData.data[y * pixelData.width + x];
              }
            }

            const targetColor = getPixel(pixelData, x, y);

            const fillColor =
              ((Math.round(255 * drawColor.a) * 256 + drawColor.b) * 256 + drawColor.g) * 256 +
              drawColor.r; //ARGB format for imageData
            if (targetColor !== fillColor) {
              const pixelsToCheck = [x, y, targetColor];
              while (pixelsToCheck.length > 0) {
                const lastColor = pixelsToCheck.pop() as number;
                y = pixelsToCheck.pop() as number;
                x = pixelsToCheck.pop() as number;

                const currentColor = getPixel(pixelData, x, y);
                if (
                  currentColor !== fillColor &&
                  currentColor >= lastColor &&
                  currentColor !== -1 // not out of bounds
                ) {
                  pixelData.data[y * pixelData.width + x] = fillColor;
                  pixelsToCheck.push(x + 1, y, currentColor);
                  pixelsToCheck.push(x - 1, y, currentColor);
                  pixelsToCheck.push(x, y + 1, currentColor);
                  pixelsToCheck.push(x, y - 1, currentColor);
                }
              }
              createdRasterLayer?.ctx.putImageData(imageData, 0, 0);
              createdRasterLayer?.layer.batchDraw();
            }
            return;
          }
          // CLICK - VECTOR
          if (selectedTool === Tool.Polygon) {
            if (dragging) return;

            setPolygonHelper((prev) => {
              return [
                ...prev,
                {
                  x: pointerPosition.x - polygonHelperOffset.x,
                  y: pointerPosition.y - polygonHelperOffset.y,
                },
              ];
            });
          }
        }}
        // MULTI TOUCH - PINCH ZOOM
        onTouchMove={(e) => {
          if (disableZoom) return;
          e.evt.preventDefault();
          const touch1 = e.evt.touches[0];
          const touch2 = e.evt.touches[1];

          const stage = e.target.getStage();

          if (touch1 && touch2 && stage) {
            if (stage.isDragging()) {
              stage.stopDrag();
            }

            const p1 = {
              x: touch1.clientX,
              y: touch1.clientY,
            };
            const p2 = {
              x: touch2.clientX,
              y: touch2.clientY,
            };

            function getCenter(p1: { x: number; y: number }, p2: { x: number; y: number }) {
              return {
                x: (p1.x + p2.x) / 2,
                y: (p1.y + p2.y) / 2,
              };
            }

            if (!touchLastCenter.current) {
              touchLastCenter.current = getCenter(p1, p2);
              return;
            }
            const newCenter = getCenter(p1, p2);

            const dist = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));

            if (!touchLastDistance.current) {
              touchLastDistance.current = dist;
            }

            const pointTo = {
              x: (newCenter.x - stage.x()) / stage.scaleX(),
              y: (newCenter.y - stage.y()) / stage.scaleX(),
            };

            let newScale = stage.scaleX() * (dist / touchLastDistance.current);
            // Limit scale to stage size
            newScale = Math.max(
              newScale,
              Math.min(stageWidth / rasterWidth, stageHeight / rasterHeight),
            );

            stage.scaleX(newScale);
            stage.scaleY(newScale);

            const dx = newCenter.x - touchLastCenter.current.x;
            const dy = newCenter.y - touchLastCenter.current.y;

            let newPos = {
              x: newCenter.x - pointTo.x * newScale + dx,
              y: newCenter.y - pointTo.y * newScale + dy,
            };
            (newPos = stageBound(
              newPos,
              stageWidth,
              stageHeight,
              rasterWidth,
              rasterHeight,
              newScale,
            )),
              stage.position(newPos);

            setZoom({ scale: newScale, position: newPos });

            touchLastDistance.current = dist;
            touchLastCenter.current = newCenter;
          }
        }}
        onTouchEnd={() => {
          touchLastDistance.current = 0;
          touchLastCenter.current = null;
        }}
      >
        {layers.map((layer, i) => {
          switch (layer.type) {
            case LayerType.animated:
              return <AnimatedLayer key={layer.id} layer={layer} />;
            case LayerType.createdRaster:
              return (
                <CreatedRasterLayer
                  key={layer.id}
                  layer={layer}
                  width={rasterWidth}
                  height={rasterHeight}
                  getAndSetContoursBoundingBoxes={getAndSetContoursBoundingBoxes}
                />
              );
            case LayerType.createdVector:
              return (
                <CreatedVectorLayer
                  key={layer.id}
                  layer={layer}
                  active={selectedLayer === i}
                  zoom={zoom}
                  setDragging={setDragging}
                />
              );
            case LayerType.downloadedRaster:
              return (
                <DownloadedRasterLayer
                  key={layer.id}
                  layer={layer}
                  stageWidth={stageWidth}
                  stageHeight={stageHeight}
                  viewport={viewport}
                  scale={zoom.scale}
                />
              );
            case LayerType.downloadedVector:
              return <DownloadedVectorLayer key={layer.id} layer={layer} />;
          }
        })}

        {gridEnabled && zoom.scale > gridScale && (
          <Grid width={rasterWidth} height={rasterHeight} viewport={viewport} line={gridLine} />
        )}
        <Layer ref={rasterCanvasPointerLayerRef} imageSmoothingEnabled={false} listening={false}>
          <Image
            image={
              rasterCanvasPointerRef.current !== null ? rasterCanvasPointerRef.current : undefined
            }
          />
        </Layer>
        {contoursBoundingBoxes.length > 0 && (
          <Layer>
            {contoursBoundingBoxes.map((contour) => {
              return contour.boundingBoxes.map((boundingBox, i) => (
                <Label
                  scale={{ x: 1 / zoom.scale, y: 1 / zoom.scale }}
                  key={i}
                  x={boundingBox.x + boundingBox.width / 2}
                  y={boundingBox.y + boundingBox.height / 2}
                >
                  <Tag fill="white" stroke="black" />
                  <Text
                    padding={5}
                    text={`#${contour.color.r.toString(16).padStart(2, "0")}${contour.color.g
                      .toString(16)
                      .padStart(2, "0")}${contour.color.b.toString(16).padStart(2, "0")} ${i}`}
                  />
                </Label>
              ));
            })}
          </Layer>
        )}
        {boundingBoxes.length > 0 && (
          <Layer>
            {boundingBoxes.map((box) => (
              <Rect
                {...box}
                strokeWidth={
                  box.strokeWidth !== undefined ? (box.strokeWidth * 1) / zoom.scale : undefined
                }
              />
            ))}
          </Layer>
        )}
        {/* TODO Selected vector layer must be rendered in front, because bounding boxes events will collide
             { selectedLayer == i &&(
                <CreatedVectorLayer
                  key={layer.id}
                  layer={layer}
                  active={selectedLayer === i}
                  zoom={zoom}
                  setDragging={setDragging}
                />
              );} */}
        {polygonHelper.length > 0 && (
          // TODO - context maybe
          <PolygonHelperLayer
            stageWidth={stageWidth}
            stageHeight={stageHeight}
            zoom={zoom}
            polygonHelper={polygonHelper}
            setPolygonHelper={setPolygonHelper}
            polygonHelperOffset={polygonHelperOffset}
            setPolygonHelperOffset={setPolygonHelperOffset}
            setDragging={setDragging}
            resetPolygon={resetPolygon}
          />
        )}
      </Stage>
    </div>
  );
}

export default AnnotationCanvas;
