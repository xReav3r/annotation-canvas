import { useState } from "react";
import { ChromePicker, RGBColor } from "react-color";
import { LayerType, useLayers, Tool, BrushShape, useTool } from "./annotation-canvas";

import { Button, Paper, Slider, Typography } from "@mui/material";

import AceEditor from "react-ace";
import "ace-builds/src-noconflict/mode-svg";
import "ace-builds/src-noconflict/ext-language_tools";

import UndoIcon from "@mui/icons-material/Undo";
import RedoIcon from "@mui/icons-material/Redo";
import PanToolIcon from "@mui/icons-material/PanTool";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";

function Toolbar({
  svg,
  setSvg,
}: {
  svg: string;
  setSvg: React.Dispatch<React.SetStateAction<string>>;
}) {
  const { selectedTool, setSelectedTool, drawColor, setDrawColor, toolSize, setToolSize } =
    useTool();

  const { selectedLayerType, undo, undoAvailable, redo, redoAvailable } = useLayers();

  const [color, setColor] = useState<RGBColor>(drawColor);

  return (
    <Paper
      style={{
        display: "flex",
        flexDirection: "column",
        padding: 10,
        gap: 10,
        width: 300,
      }}
    >
      <Typography variant="h4" textAlign="center">
        Tools
      </Typography>
      <Paper style={{ display: "flex", flexDirection: "column", padding: 10, gap: 10 }}>
        <Typography variant="h5" textAlign="center">
          General
        </Typography>
        <div style={{ display: "flex", justifyContent: "space-evenly" }}>
          <Button
            variant="outlined"
            disabled={!undoAvailable}
            onClick={undo}
            endIcon={<UndoIcon />}
          >
            Undo
          </Button>
          <Button
            variant="outlined"
            disabled={!redoAvailable}
            onClick={redo}
            endIcon={<RedoIcon />}
          >
            Redo
          </Button>
        </div>
        <Button
          onClick={() => setSelectedTool(Tool.Move)}
          disabled={selectedTool === Tool.Move}
          endIcon={<PanToolIcon />}
        >
          Pan
        </Button>
        <Button
          onClick={() => setSelectedTool(Tool.ZoomIn)}
          disabled={selectedTool === Tool.ZoomIn}
          endIcon={<ZoomInIcon />}
        >
          Zoom in
        </Button>
        <Button
          onClick={() => setSelectedTool(Tool.ZoomOut)}
          disabled={selectedTool === Tool.ZoomOut}
          endIcon={<ZoomOutIcon />}
        >
          Zoom out
        </Button>
        {selectedLayerType &&
          [LayerType.createdRaster, LayerType.createdVector].includes(selectedLayerType) && (
            <>
              <ChromePicker
                color={color}
                onChange={(newColor) => setColor(newColor.rgb)}
                onChangeComplete={(newColor) => {
                  setDrawColor({
                    r: newColor.rgb.r,
                    g: newColor.rgb.g,
                    b: newColor.rgb.b,
                    a: newColor.rgb.a as number, // alpha is optional but always present
                  });
                }}
                styles={{ default: { picker: { width: "100%" } } }}
              />
              <Typography gutterBottom>Tool size: {toolSize}</Typography>
              <Slider
                min={1}
                max={50}
                value={toolSize}
                onChange={(_, value) => setToolSize(value as number)}
              />
            </>
          )}
      </Paper>
      {selectedLayerType === LayerType.createdRaster && <RasterTools />}
      {selectedLayerType === LayerType.createdVector && <VectorTools />}
      {selectedLayerType === LayerType.downloadedVector && (
        <Paper style={{ display: "flex", flexDirection: "column", padding: "10px" }}>
          <Typography variant="h5" textAlign="center" style={{ marginBottom: 10 }}>
            Downloaded vector
          </Typography>
          <AceEditor
            mode="svg"
            value={svg}
            onChange={(newValue) => setSvg(newValue)}
            showGutter={false}
            width="100%"
            setOptions={{
              useWorker: false,
              enableBasicAutocompletion: true,
              enableLiveAutocompletion: true,
            }}
          />
        </Paper>
      )}
    </Paper>
  );
}

function RasterTools() {
  const { selectedTool, setSelectedTool, brushShape, setBrushShape } = useTool();

  return (
    <Paper style={{ display: "flex", flexDirection: "column", padding: 10 }}>
      <Typography variant="h5" textAlign="center" style={{ marginBottom: 10 }}>
        Raster
      </Typography>
      <Button
        onClick={() => {
          setSelectedTool(Tool.Brush);
          setBrushShape(BrushShape.Circle);
        }}
        disabled={selectedTool === Tool.Brush && brushShape === BrushShape.Circle}
      >
        Brush - circle
      </Button>
      <Button
        onClick={() => {
          setSelectedTool(Tool.Brush);
          setBrushShape(BrushShape.Square);
        }}
        disabled={selectedTool === Tool.Brush && brushShape === BrushShape.Square}
      >
        Brush - square
      </Button>
      <Button
        onClick={() => {
          setSelectedTool(Tool.Eraser);
          setBrushShape(BrushShape.Circle);
        }}
        disabled={selectedTool === Tool.Eraser && brushShape === BrushShape.Circle}
      >
        Eraser - circle
      </Button>
      <Button
        onClick={() => {
          setSelectedTool(Tool.Eraser);
          setBrushShape(BrushShape.Square);
        }}
        disabled={selectedTool === Tool.Eraser && brushShape === BrushShape.Square}
      >
        Eraser - square
      </Button>
      <Button
        onClick={() => setSelectedTool(Tool.Floodfill)}
        disabled={selectedTool === Tool.Floodfill}
      >
        Floodfill
      </Button>
      <Button onClick={() => setSelectedTool(Tool.Clear)} disabled={selectedTool === Tool.Clear}>
        Clear
      </Button>
    </Paper>
  );
}

function VectorTools() {
  const { selectedTool, setSelectedTool } = useTool();

  return (
    <Paper style={{ display: "flex", flexDirection: "column", padding: 10 }}>
      <Typography variant="h5" textAlign="center" style={{ marginBottom: 10 }}>
        Vector
      </Typography>
      <Button onClick={() => setSelectedTool(Tool.Drag)} disabled={selectedTool === Tool.Drag}>
        Drag
      </Button>
      <Button onClick={() => setSelectedTool(Tool.Remove)} disabled={selectedTool === Tool.Remove}>
        Remove
      </Button>
      <Button onClick={() => setSelectedTool(Tool.Line)} disabled={selectedTool === Tool.Line}>
        Line
      </Button>
      <Button
        onClick={() => setSelectedTool(Tool.Polygon)}
        disabled={selectedTool === Tool.Polygon}
      >
        Polygon
      </Button>
      <Button
        onClick={() => setSelectedTool(Tool.Rectangle)}
        disabled={selectedTool === Tool.Rectangle}
      >
        Rectangle
      </Button>
      <Button onClick={() => setSelectedTool(Tool.Circle)} disabled={selectedTool === Tool.Circle}>
        Circle
      </Button>
    </Paper>
  );
}

export default Toolbar;
