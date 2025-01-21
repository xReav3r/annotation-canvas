import { createContext, ReactNode, useContext, useState } from "react";

export enum Tool {
  // General
  Move = "move",
  ZoomIn = "zoomIn",
  ZoomOut = "zoomOut",
  // Vector
  Drag = "drag",
  Edit = "edit",
  Remove = "remove",
  Rectangle = "rectangle",
  Circle = "circle",
  Line = "line",
  Polygon = "polygon",
  ChangeFill = "changeFill",
  // Raster
  Brush = "brush",
  Eraser = "eraser",
  Floodfill = "floodfill",
  Clear = "clear",
}
export const GeneralTools = new Set([Tool.Move, Tool.ZoomIn, Tool.ZoomOut]);
export const VectorTools = new Set([
  Tool.Drag,
  Tool.Edit,
  Tool.Remove,
  Tool.Rectangle,
  Tool.Circle,
  Tool.Line,
  Tool.Polygon,
  Tool.ChangeFill,
]);
export const RasterTools = new Set([Tool.Brush, Tool.Eraser, Tool.Floodfill, Tool.Clear]);

export interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
}

export enum BrushShape {
  Square = "square",
  Circle = "circle",
}

interface IToolContext {
  selectedTool: Tool;
  setSelectedTool: React.Dispatch<React.SetStateAction<Tool>>;
  drawColor: Color;
  setDrawColor: React.Dispatch<React.SetStateAction<Color>>;
  fillColor: Color | undefined;
  setFillColor: React.Dispatch<React.SetStateAction<Color | undefined>>;
  toolSize: number;
  setToolSize: React.Dispatch<React.SetStateAction<number>>;
  brushShape: BrushShape;
  setBrushShape: React.Dispatch<React.SetStateAction<BrushShape>>;
}

const ToolContext = createContext<IToolContext | null>(null);

const ToolProvider = ({ children }: { children: ReactNode }) => {
  const [selectedTool, setSelectedTool] = useState<Tool>(Tool.Move);
  const [drawColor, setDrawColor] = useState({ r: 0, g: 0, b: 0, a: 1.0 });
  const [toolSize, setToolSize] = useState(10);
  const [brushShape, setBrushShape] = useState(BrushShape.Circle);
  const [fillColor, setFillColor] = useState<Color | undefined>(undefined);

  return (
    <ToolContext.Provider
      value={{
        selectedTool,
        setSelectedTool,
        drawColor,
        setDrawColor,
        fillColor,
        setFillColor,
        toolSize,
        setToolSize,
        brushShape,
        setBrushShape,
      }}
    >
      {children}
    </ToolContext.Provider>
  );
};

function useTool() {
  const context = useContext(ToolContext);
  if (context === null) {
    throw "No provider for ToolContext";
  }

  return context;
}

export { ToolProvider, useTool };
