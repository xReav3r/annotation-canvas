import axios from "axios";
import { useEffect, useRef, useState } from "react";

import { v4 as uuid } from "uuid";

import {
  AnnotationCanvas,
  LayersProvider,
  useLayers,
  LayerType,
  ImageCacheProvider,
  ToolProvider,
  Zoom,
  useTool,
  Tool,
  Layer,
} from "./annotation-canvas/";
import heatmaps from "./heatmaps";
import Layers from "./Layers";
import Toolbar from "./Toolbar";
import { Typography } from "@mui/material";

import config from "../frontendConfig";

async function getImage1(
  x: number,
  y: number,
  width: number,
  height: number,
  viewWidth: number,
  viewHeight: number,
  signal?: AbortSignal,
) {
  try {
    const imageResponse = await axios.post(
      config.backendUrl + "image1",
      {
        extract: {
          x,
          y,
          width,
          height,
        },
        resize: { viewWidth, viewHeight },
      },
      {
        signal,
        responseType: "blob",
      },
    );

    return imageResponse.data as Blob;
  } catch (e: any) {
    if (e?.message === "canceled") return null;
    throw e;
  }
}

async function getImage2(
  x: number,
  y: number,
  width: number,
  height: number,
  viewWidth: number,
  viewHeight: number,
  signal?: AbortSignal,
) {
  try {
    const imageResponse = await axios.post(
      config.backendUrl + "image2",
      {
        extract: {
          x,
          y,
          width,
          height,
        },
        resize: { viewWidth, viewHeight },
      },
      {
        signal,
        responseType: "blob",
      },
    );

    return imageResponse.data as Blob;
  } catch (e: any) {
    if (e?.message === "canceled") return null;
    throw e;
  }
}

function App() {
  const [rasterWidth, setRasterWidth] = useState(0);
  const [rasterHeight, setRasterHeight] = useState(0);

  const [layers, setLayers] = useState<Layer[]>([
    // {
    //   id: "animated",
    //   type: LayerType.animated,
    //   visible: true,
    //   opacity: 1,
    //   data: {
    //     canvas: (() => {
    //       const canvas = document.createElement("canvas");
    //       canvas.height = 1000;
    //       canvas.width = 1000;
    //       const ctx = canvas.getContext("2d");
    //       ctx?.fillRect(0, 0, 1000, 1000);

    //       setTimeout(() => {
    //         if (!ctx) return;
    //         ctx.fillStyle = "red";
    //         ctx.fillRect(0, 0, 1000, 1000);
    //       }, 5000);

    //       return canvas;
    //     })(),
    //   },
    // },
    {
      id: "background",
      type: LayerType.downloadedRaster,
      visible: true,
      opacity: 1,
      data: {
        getImage: getImage1,
        // coloring: heatmaps.jet,
        // hatching: {
        //   blankWidth: 10,
        //   maskWidth: 10,
        // },
      },
    },
    {
      id: "foreground",
      type: LayerType.downloadedRaster,
      visible: true,
      opacity: 0.5,
      data: {
        getImage: getImage2,
        // coloring: heatmaps.jet,
        coloring: [[255, 255, 0]],
      },
    },
    {
      id: "overlay",
      type: LayerType.downloadedVector,
      visible: true,
      opacity: 1,
      data: "",
    },
  ]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadImageResolution() {
      const res = await axios.get(config.backendUrl + "image", {
        signal: controller.signal,
      });

      setRasterWidth(res.data.width);
      setRasterHeight(res.data.height);
    }

    loadImageResolution();

    return () => {
      controller.abort();
    };
  }, []);

  // MEMORY LEAK TESTING
  const switcher = useRef(false);
  useEffect(() => {
    const ls = localStorage.getItem("memoryLeakTest");
    if (!ls) return;
    const memoryLeakTest = JSON.parse(ls);
    if (!memoryLeakTest) return;
    const interval = setInterval(() => {
      setLayers([
        {
          id: uuid(),
          type: LayerType.downloadedRaster,
          visible: true,
          opacity: 1,
          data: {
            getImage: switcher.current ? getImage1 : getImage2,
          },
        },
      ]);
      switcher.current = !switcher.current;
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <ToolProvider>
      <ImageCacheProvider>
        <LayersProvider
          rasterWidth={rasterWidth}
          rasterHeight={rasterHeight}
          tiling={{
            downloadedRasterLevelSize: 0.25,
            downloadedRasterMinTilesCount: 3,
            downloadedRasterDrawAtOnce: true,
          }}
          layers={layers}
          setLayers={setLayers}
        >
          <AnnotationCanvasDemo />
        </LayersProvider>
      </ImageCacheProvider>
    </ToolProvider>
  );
}

function AnnotationCanvasDemo() {
  const [zoom, setZoom] = useState<Zoom | null>(null);
  const [pointerPosition, setPointerPosition] = useState({ x: 0, y: 0 });

  const { setLayerById } = useLayers();

  const [svg, setSvg] = useState("");

  const { rasterWidth, rasterHeight, selectedLayerType } = useLayers();
  const { setSelectedTool } = useTool();

  useEffect(() => {
    setSelectedTool(Tool.Move);
  }, [selectedLayerType]);

  useEffect(() => {
    setLayerById({
      id: "overlay",
      type: LayerType.downloadedVector,
      visible: true,
      opacity: 1,
      data: svg,
    });
  }, [svg]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadExternalVectorLayer() {
      const res = await axios.get(config.backendUrl + "svg", {
        signal: controller.signal,
      });

      setSvg(res.data);
    }

    loadExternalVectorLayer();

    return () => {
      controller.abort();
    };
  }, []);

  return (
    <div style={{ width: "100%", height: "100vh", display: "flex" }}>
      <Toolbar svg={svg} setSvg={setSvg} />
      <div style={{ flexGrow: 1, position: "relative", minWidth: 0 }}>
        {rasterWidth > 0 && rasterHeight > 0 && (
          <>
            <AnnotationCanvas
              onPointerMove={setPointerPosition}
              onZoomChange={setZoom}
              // gridEnabled={false}
              blobColors={[{ r: 255, g: 0, b: 0 }]}
              boundingBoxes={[
                {
                  x: 100,
                  y: 100,
                  stroke: "red",
                  strokeWidth: 5,
                  opacity: 1,
                  width: 300,
                  height: 200,
                  onPointerClick: (_) => console.log(10),
                },
              ]}
            />
            <div
              style={{
                position: "absolute",
                bottom: 10,
                right: 10,
                width: 180,
                color: "white",
                background: "rgba(24, 26, 27, 0.5)",
                borderRadius: 5,
                textAlign: "center",
              }}
            >
              <Typography>{zoom && "Scale: " + Math.round(zoom?.scale * 100) + " %"}</Typography>
              <Typography>
                Pointer: x={Math.trunc(pointerPosition.x)} y={Math.trunc(pointerPosition.y)}
              </Typography>
            </div>
          </>
        )}
      </div>
      <Layers />
    </div>
  );
}

export default App;
