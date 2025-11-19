# Annotation Canvas

> A powerful React canvas component for image annotation with raster and vector drawing tools. Features efficient tiling for large images, built with Konva.

[![npm version](https://img.shields.io/npm/v/annotation-canvas.svg)](https://www.npmjs.com/package/annotation-canvas)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Originally developed as a Master's thesis project** at Brno University of Technology (2023), focusing on creating a reusable 2D editor for web applications with optimizations for segmentation neural networks and remote data transfer.

## Features

### 🎨 Drawing Tools
- **Raster Tools**: Brush, Eraser, Flood Fill, Clear
  - **Pixel-Perfect Drawing**: Custom Bresenham algorithm implementation for antialiasing-free raster drawing
  - **Brush Shapes**: Circle and Square
  - **Configurable**: Size, color, opacity, shape
- **Vector Tools**: Rectangle, Circle, Line, Polygon
  - **Editable**: Drag, resize, remove, edit points
  - **Fill Support**: Transparent, solid, or custom fill colors

### ⚡ Performance & Scalability
- **Efficient Tiling System**: Handles large images (10,000×10,000+ px) with on-demand tile loading
- **Viewport-based Rendering**: Only renders visible portions
- **Configurable LOD (Level of Detail)**: Adaptive quality based on zoom level
- **Image Caching**: Built-in cache management using localforage

### 📚 Layer Management
- **Multiple Layer Types**:
  - **Downloaded Raster**: Tiled images from server (optimized for large images)
  - **Downloaded Vector**: SVG shapes from server
  - **Created Raster**: Drawing canvas for pixel-perfect annotations
  - **Created Vector**: User-drawn shapes (rectangles, circles, lines, polygons)
  - **Animated**: Dynamic canvas layers (usable for canvas streaming)
- **Layer Operations**: Show/hide, reorder, opacity control
- **History System**: Full undo/redo with IndexedDB persistence

### 🎯 Canvas Controls
- **Pan & Zoom**: Smooth navigation with mouse/touch
- **Multi-touch Support**: Pinch-to-zoom on touch devices
- **Grid Overlay**: Optional grid with customizable appearance
- **Bounding Boxes**: Contour detection for blob analysis

## Use Cases

- **Machine Learning Annotation**: Create pixel-perfect annotations for training segmentation neural networks
- **Computer Vision QA**: Monitor and visualize neural network outputs with heatmaps
- **Industrial Inspection**: Annotate defects on large product images
- **Medical Imaging**: Annotate regions of interest on diagnostic images
- **Geospatial Analysis**: Annotate satellite or aerial imagery
- **Document Processing**: Mark regions on scanned documents

## Installation

```bash
npm install annotation-canvas
```


## Quick Start

```tsx
import {
  AnnotationCanvas,
  LayersProvider,
  ToolProvider,
  ImageCacheProvider,
  LayerType
} from 'annotation-canvas';

function App() {
  return (
    <ImageCacheProvider>
      <LayersProvider
        rasterWidth={1000}
        rasterHeight={1000}
        defaultLayers={[
          {
            id: 'drawing-layer',
            type: LayerType.createdRaster,
            visible: true,
            opacity: 1,
            data: null
          }
        ]}
      >
        <ToolProvider>
          <div style={{ width: '100vw', height: '100vh' }}>
            <AnnotationCanvas />
          </div>
        </ToolProvider>
      </LayersProvider>
    </ImageCacheProvider>
  );
}
```

**For complete examples** including toolbar UI, layer management, and tiling setup, see the [demo application](./src/App.tsx) in this repository.

## Tiling for Large Images

The annotation-canvas library includes an efficient tiling system specifically designed for handling large images:

### Configuration

```tsx
import type { TileConfig } from 'annotation-canvas';

const tilingConfig: TileConfig = {
  levelSize: 0.25,        // Scale interval (0.25 = 4 levels between 0-1)
  minTilesCount: 4,       // Minimum tiles on larger dimension
  drawAtOnce: false       // Progressive loading (false) or batch (true)
};

<ImageCacheProvider>
  <LayersProvider
    rasterWidth={5000}
    rasterHeight={5000}
    tiling={tilingConfig}
    defaultLayers={[{
      id: 'large-image',
      type: LayerType.downloadedRaster,
      visible: true,
      opacity: 1,
      data: {
        getImage: async (x, y, width, height, viewWidth, viewHeight, signal) => {
          const response = await fetch(`/api/tiles`, {
            method: 'POST',
            body: JSON.stringify({ x, y, width, height, viewWidth, viewHeight }),
            signal
          });
          return response.ok ? response.blob() : null;
        }
      }
    }]}
  >
    <AnnotationCanvas />
  </LayersProvider>
</ImageCacheProvider>
```

**For a complete implementation**, see [src/App.tsx](./src/App.tsx) and the backend example in [backend/](./backend/).

### How Tiling Works

The tiling system optimizes large image handling through several mechanisms:

1. **Viewport Calculation**: Automatically calculates which tiles are currently visible based on pan/zoom state
2. **Level of Detail (LOD)**: Selects appropriate resolution level based on current zoom
   - Closer zoom = higher resolution tiles
   - Zoomed out = lower resolution tiles (faster loading)
3. **On-Demand Loading**: Only fetches visible tiles, reducing memory usage
4. **Tile Caching**: Stores loaded tiles using localforage for instant reuse

**Example:** A 10,000×10,000px image with `minTilesCount: 4` and `levelSize: 0.25`:
- Tile size adapts to zoom level for optimal performance
- Higher zoom = more tiles at higher resolution
- Lower zoom = fewer tiles at lower resolution
- Only visible tiles within the current viewport are loaded

**Benefits:**
- ✅ **Memory Efficient**: 10MB vs 400MB+ for full image
- ✅ **Fast Initial Load**: <1s vs 10-30s for full image
- ✅ **Smooth Interaction**: No lag when panning/zooming
- ✅ **Server-Friendly**: Distribute load across multiple tile requests

### Implementing a Tile Server

The `getImage` function receives tile coordinates and dimensions:

```tsx
type GetImage = (
  x: number,               // Top-left X coordinate in original image
  y: number,               // Top-left Y coordinate in original image
  width: number,           // Tile width in original image coordinates
  height: number,          // Tile height in original image coordinates
  viewWidth: number,       // Desired output width (for LOD)
  viewHeight: number,      // Desired output height (for LOD)
  signal?: AbortSignal     // Optional: Abort signal for cancellation
) => Promise<Blob | null>;

// Example implementation:
async function getImage(
  x: number,
  y: number,
  width: number,
  height: number,
  viewWidth: number,
  viewHeight: number,
  signal?: AbortSignal
): Promise<Blob | null> {
  const response = await fetch(`/api/image/tile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ x, y, width, height, viewWidth, viewHeight }),
    signal  // Pass AbortSignal for request cancellation
  });

  if (!response.ok) return null;
  return response.blob();
}
```

**Backend implementation** (example with Node.js + Sharp):

```javascript
const sharp = require('sharp');

app.post('/api/image/tile', async (req, res) => {
  const { x, y, width, height, viewWidth, viewHeight } = req.body;

  const tile = await sharp('large-image.tif')
    .extract({ left: x, top: y, width, height })
    .resize(viewWidth, viewHeight)
    .png()
    .toBuffer();

  res.type('image/png').send(tile);
});
```

## API Reference

### LayersProvider

Manages canvas layers and history.

```tsx
<LayersProvider
  rasterWidth={number}                  // Required: Canvas width in pixels
  rasterHeight={number}                 // Required: Canvas height in pixels
  defaultLayers={Layer[]}               // Optional: Initial layers (uncontrolled)
  layers={Layer[]}                      // Optional: Controlled layers state
  setLayers={React.Dispatch}            // Optional: Controlled layers setter
  tiling={TileConfig}                   // Optional: Tiling configuration
  onHistoryChange={() => void}          // Optional: Called on history changes
>
```

### AnnotationCanvas

Main canvas component.

```tsx
<AnnotationCanvas
  onPointerMove={(position) => void}                        // Optional: Pointer position callback
  onZoomChange={(zoom, viewport, externalInvoke) => void}   // Optional: Zoom change callback
  gridEnabled={boolean}                                     // Optional: Show grid (default: true)
  gridScale={number}                                        // Optional: Grid zoom threshold (default: 6)
  gridLine={{ stroke?: string; strokeWidth: number }}      // Optional: Grid style (default: white, 0.05)
  disableZoom={boolean}                                     // Optional: Disable zoom (default: false)
  blobColors={Array<{r, g, b}>}                            // Optional: Colors for blob detection
  boundingBoxes={RectConfig[]}                             // Optional: Additional overlay boxes
/>
```

### ImageCacheProvider

Manages tile caching for downloaded raster layers. **Required** when using downloaded raster layers with tiling.

```tsx
<ImageCacheProvider>
  {/* Your LayersProvider and AnnotationCanvas */}
</ImageCacheProvider>
```

---

### ToolProvider

Provides drawing tool context.

```tsx
import { Tool, BrushShape, useTool } from 'annotation-canvas';

function Toolbar() {
  const {
    selectedTool,        // Currently selected tool
    setSelectedTool,     // Change tool
    drawColor,           // Stroke/draw color (RGBA)
    setDrawColor,        // Change stroke color
    fillColor,           // Fill color for vector shapes (RGBA or undefined)
    setFillColor,        // Change fill color
    toolSize,            // Brush/tool size in pixels
    setToolSize,         // Change tool size
    brushShape,          // BrushShape.Circle or BrushShape.Square
    setBrushShape        // Change brush shape
  } = useTool();

  return (
    <div>
      <button onClick={() => setSelectedTool(Tool.Brush)}>Brush</button>
      <button onClick={() => setSelectedTool(Tool.Eraser)}>Eraser</button>
      <button onClick={() => setSelectedTool(Tool.Rectangle)}>Rectangle</button>

      {/* Set color */}
      <button onClick={() => setDrawColor({ r: 255, g: 0, b: 0, a: 1 })}>
        Red
      </button>

      {/* Set tool size */}
      <input
        type="range"
        min="1"
        max="50"
        value={toolSize}
        onChange={(e) => setToolSize(parseInt(e.target.value))}
      />
    </div>
  );
}
```

**Available Tools:**

General:
- `Tool.Move` - Pan canvas
- `Tool.ZoomIn` / `Tool.ZoomOut` - Zoom controls

Raster:
- `Tool.Brush` - Paint with brush
- `Tool.Eraser` - Erase drawn content
- `Tool.Floodfill` - Flood fill areas
- `Tool.Clear` - Clear rectangular regions

Vector:
- `Tool.Rectangle` - Draw rectangles
- `Tool.Circle` - Draw circles
- `Tool.Line` - Draw lines
- `Tool.Polygon` - Draw polygons
- `Tool.Drag` - Drag/move vector elements
- `Tool.Edit` - Edit vector element points (polygons)
- `Tool.Remove` - Remove vector elements
- `Tool.ChangeFill` - Toggle fill on/off for vector elements

### Layer Types and Structures

```typescript
enum LayerType {
  downloadedRaster,   // Tiled images from server
  downloadedVector,   // SVG shapes from server
  createdRaster,      // Drawing canvas
  createdVector,      // User-drawn shapes
  animated            // Dynamic canvas layers
}

// Layer structure (all types share these base properties)
interface Layer {
  id: string | number;       // Unique identifier
  type: LayerType;           // Layer type
  visible: boolean;          // Show/hide layer
  opacity: number;           // 0.0 to 1.0
  data: LayerData;          // Type-specific data
}

// Downloaded Raster Layer data
interface DownloadedRasterLayerData {
  getImage?: GetImage;       // Optional: Function to fetch tile data
  coloring?: number[][];     // Optional: Color mapping (256x3 for heatmap, 1x3 for solid)
  threshold?: {              // Optional: Threshold for grayscale
    min: number;             // Min threshold (0-255)
    max: number;             // Max threshold (0-255)
  };
  hatching?: {               // Optional: Hatching pattern overlay
    blankWidth: number;      // Width of transparent stripes
    maskWidth: number;       // Width of visible stripes
  };
}

// Downloaded Vector Layer data (SVG string)
type DownloadedVectorLayerData = string;

// Created Raster Layer data (initialized as null, canvas created internally)
type CreatedRasterLayerData = null;

// Created Vector Layer data
interface CreatedVectorLayerData {
  elements: (CreatedVectorLayerLine | CreatedVectorLayerRectangle | CreatedVectorLayerCircle)[];
  layer?: Konva.Layer;       // Internal reference (auto-managed)
}
```

### useLayers Hook

Provides access to layer state and operations:

```tsx
import { useLayers } from 'annotation-canvas';

function LayerControls() {
  const {
    // Layer state
    rasterWidth,              // Canvas width
    rasterHeight,             // Canvas height
    layers,                   // Array of all layers
    setLayers,                // Update layers array
    selectedLayer,            // Index of selected layer
    setSelectedLayer,         // Change selected layer
    selectedLayerType,        // Type of selected layer
    tiling,                   // Tiling configuration (if set)

    // Layer operations
    createLayer,              // (layer: Layer) => void
    setLayerByIndex,          // (index, updater) => void
    setLayerById,             // (layer) => void
    removeLayer,              // (index) => Promise<void>
    removeLayerById,          // (id) => void
    rasterizeLayer,           // (index) => void - Convert vector to raster

    // History
    historyPush,              // Internal use - adds history record
    undo,                     // Undo last action
    undoAvailable,            // Can undo?
    redo,                     // Redo last undone action
    redoAvailable,            // Can redo?
  } = useLayers();

  return (
    <>
      <button onClick={undo} disabled={!undoAvailable}>Undo</button>
      <button onClick={redo} disabled={!redoAvailable}>Redo</button>
      <button onClick={() => rasterizeLayer(selectedLayer)}>
        Convert to Raster
      </button>
    </>
  );
}
```

### Memory Leak Testing

The library includes tools for long-term memory monitoring (validated over 40+ hours of continuous operation):

```bash
# 1. Start dev server and set memory test mode in browser console:
localStorage.setItem('memoryLeakTest', 'true')

# 2. Get browser process ID and run:
./measureMemory.sh <PID>

# 3. View results at http://localhost:8000
```

See [memoryFrontend/](./memoryFrontend/) for the visualization tool.

## Advanced Features

### Pixel-Perfect Raster Drawing

The library implements custom **Bresenham line and circle algorithms** to achieve antialiasing-free pixel-perfect drawing. This is critical for machine learning annotations where exact pixel values matter - browser native canvas applies antialiasing that can corrupt training data.

### Heatmap & Blob Detection

- **Heatmap visualization**: Apply color mapping to grayscale images (e.g., neural network outputs)
- **Blob detection**: Automatically detect and label colored regions using OpenCV.js
- **Threshold & Hatching**: Additional visualization options for raster layers

**See the [demo application](./src/App.tsx) for complete examples** of these features.

## License

MIT © Martin Schneider

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Links

- [GitHub Repository](https://github.com/xReav3r/annotation-canvas)
- [npm Package](https://www.npmjs.com/package/annotation-canvas)
- [Issue Tracker](https://github.com/xReav3r/annotation-canvas/issues)
