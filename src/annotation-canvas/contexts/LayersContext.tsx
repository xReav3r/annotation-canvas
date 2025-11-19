import { createContext, ReactNode, useContext, useEffect, useRef, useState } from "react";
import Konva from "konva";
import { LineCap, LineJoin } from "konva/lib/Shape";

import _ from "lodash";

import { GetImage } from "./ImageCacheContext";
import { toBlob } from "../utils";
import localforage from "localforage";
import { TileConfig } from "../../tiling";

export enum ElementType {
  Line = "line",
  Rectangle = "rectangle",
  Circle = "circle",
}

export type AnimatedLayerData = {
  canvas: HTMLCanvasElement;
};

export type CreatedRasterLayerData = {
  canvas?: HTMLCanvasElement;
  ctx?: CanvasRenderingContext2D;
  layer?: Konva.Layer;
  initImage?: Blob;
  actualImage?: Blob;
  actualImageStorageId?: string;
} | null;

export interface CreatedVectorLayerData {
  elements: (CreatedVectorLayerLine | CreatedVectorLayerRectangle | CreatedVectorLayerCircle)[];
  forcedEditElementIndex?: number;
  initElements?: (
    | CreatedVectorLayerLine
    | CreatedVectorLayerRectangle
    | CreatedVectorLayerCircle
  )[];
  layer?: Konva.Layer;
}

export type CreatedVectorLayerLine = {
  type: ElementType.Line;
  x: number;
  y: number;
  stroke: string;
  fill: string | undefined;
  strokeWidth: number;
  opacity: number;
  closed?: boolean;
  points: number[];
  lineCap: LineCap;
  lineJoin: LineJoin;
};

export type CreatedVectorLayerRectangle = {
  type: ElementType.Rectangle;
  x: number;
  y: number;
  stroke: string;
  fill: string | undefined;
  strokeWidth: number;
  opacity: number;
  width: number;
  height: number;
};

export type CreatedVectorLayerCircle = {
  type: ElementType.Circle;
  x: number;
  y: number;
  stroke: string;
  fill: string | undefined;
  strokeWidth: number;
  opacity: number;
  radius: number;
};

export interface DownloadedRasterLayerData {
  getImage?: GetImage;
  coloring?: number[][];
  threshold?: { min: number; max: number };
  hatching?: {
    blankWidth: number;
    maskWidth: number;
  };
}

export type DownloadedVectorLayerData = string;

export enum LayerType {
  animated = "animated",
  downloadedVector = "downloadedVector",
  createdVector = "createdVector",
  downloadedRaster = "downloadedRaster",
  createdRaster = "createdRaster",
}

interface GenericLayer<Type, DataType> {
  id: string | number;
  type: Type;
  visible: boolean;
  opacity: number;
  data: DataType;
}

export type AnimatedLayer = GenericLayer<LayerType.animated, AnimatedLayerData>;

export type CreatedRasterLayer = GenericLayer<LayerType.createdRaster, CreatedRasterLayerData>;

export type CreatedVectorLayer = GenericLayer<LayerType.createdVector, CreatedVectorLayerData>;

export type DownloadedRasterLayer = GenericLayer<
  LayerType.downloadedRaster,
  DownloadedRasterLayerData
>;

export type DownloadedVectorLayer = GenericLayer<
  LayerType.downloadedVector,
  DownloadedVectorLayerData
>;

export type Layer =
  | AnimatedLayer
  | CreatedRasterLayer
  | CreatedVectorLayer
  | DownloadedRasterLayer
  | DownloadedVectorLayer;

export enum HistoryAction {
  create = "create",
  remove = "remove",
  edit = "edit",
  rasterize = "rasterize",
}
export interface HistoryRecord {
  action: HistoryAction;
  layer: Layer;
}

interface ILayersContext {
  rasterWidth: number;
  rasterHeight: number;

  layers: Layer[];
  setLayers: React.Dispatch<React.SetStateAction<Layer[]>>;

  selectedLayer: number;
  setSelectedLayer: React.Dispatch<React.SetStateAction<number>>;
  selectedLayerType: LayerType | undefined;

  tiling: TileConfig | undefined;

  createLayer: (layer: Layer) => void;
  setLayerByIndex: (index: number, value: ((prev: Layer) => Layer) | Layer) => void;
  setLayerById: (layer: Layer) => void;
  removeLayer: (index: number) => Promise<void>;
  removeLayerById: (id: string | number) => void;
  rasterizeLayer: (index: number) => void;

  historyPush: (record: HistoryRecord, rasterImage?: Blob) => void;

  undo: () => void;
  undoAvailable: boolean;
  redo: () => void;
  redoAvailable: boolean;
}

const LayersContext = createContext<ILayersContext | null>(null);

const LayersProvider = ({
  children,
  rasterWidth,
  rasterHeight,
  layers: propsLayers,
  setLayers: setPropsLayers,
  onHistoryChange,
  defaultLayers,
  tiling,
}: {
  children: ReactNode;
  rasterWidth: number;
  rasterHeight: number;
  layers?: Layer[];
  setLayers?: React.Dispatch<React.SetStateAction<Layer[]>>;
  onHistoryChange?: () => void;
  defaultLayers?: Layer[];
  tiling?: TileConfig;
}) => {
  // Controlled and uncontrolled layers support
  if (propsLayers !== undefined && setPropsLayers !== undefined && defaultLayers !== undefined) {
    console.warn(
      "annotation-canvas - LayersProvider: layers, setLayers and defaultLayers provided. defaultLayers is ignored.",
    );
  }

  const [internalLayers, setInternalLayers] = useState(
    defaultLayers !== undefined ? defaultLayers : [],
  );

  let layers = internalLayers;
  if (propsLayers === undefined && setPropsLayers !== undefined) {
    throw new Error("annotation-canvas - LayersProvider: setLayers provided, but not layers. Use defaultLayers if component is intended to be non controlled.");
  }
  if (propsLayers !== undefined) {
    layers = propsLayers;
  }

  let setLayers = setInternalLayers;
  if (propsLayers !== undefined && setPropsLayers === undefined) {
    console.warn(
      "annotation-canvas - LayersProvider: layers provided, but not setLayers. Component will not draw.",
    );
    setLayers = () => {};
  }
  if (setPropsLayers !== undefined) {
    setLayers = setPropsLayers;
  }

  // Backup initial vector elements for undo
  useEffect(() => {
    layers.forEach((layer, i) => {
      if (layer.type === LayerType.createdVector) {
        layer.data.initElements = _.cloneDeep(layer.data.elements);
        setLayerByIndex(i, layer);
      }
    });
  }, []);

  const storage = useRef(localforage.createInstance({ name: "annotation-canvas:historyStorage" }));
  useEffect(() => {
    storage.current.clear();
    return () => {
      storage.current.clear();
    };
  }, []);
  const storageAbortController = useRef(new AbortController());

  const history = useRef<HistoryRecord[]>([]);
  const historyIndex = useRef(-1);

  const undoRedoInProgress = useRef(false);
  const [undoAvailable, setUndoAvailable] = useState(false);
  const [redoAvailable, setRedoAvailable] = useState(false);

  function createStorageHistoryRecord(
    record: HistoryRecord,
    storageId: string,
    rasterImage?: Blob,
  ) {
    let recordCopy: HistoryRecord;
    recordCopy = _.cloneDeep(record);
    if (recordCopy.layer.type === LayerType.createdRaster && recordCopy.layer.data) {
      recordCopy.layer.data.actualImageStorageId = storageId;
      storage.current.setItem(storageId, rasterImage);
    }
    return recordCopy;
  }

  async function createLayerHistoryRecord(record: HistoryRecord) {
    let recordCopy: HistoryRecord;
    recordCopy = _.cloneDeep(record);
    if (recordCopy.layer.type === LayerType.createdRaster && recordCopy.layer.data) {
      const storageId = recordCopy.layer.data.actualImageStorageId as string;
      const image = await storage.current.getItem(storageId);
      recordCopy.layer.data.actualImage = image as Blob;
    }
    return recordCopy;
  }

  function historyPush(record: HistoryRecord, rasterImage?: Blob) {
    let recordCopy: HistoryRecord;

    try {
      history.current = history.current.slice(historyIndex.current + 1);
      recordCopy = createStorageHistoryRecord(
        record,
        history.current.length.toString(),
        rasterImage,
      );
      history.current.unshift(recordCopy);
    } catch (err) {
      console.log(err);
      storage.current.clear().then(() => {
        recordCopy = createStorageHistoryRecord(
          record,
          history.current.length.toString(),
          rasterImage,
        );
        history.current = [recordCopy];
      });
    }

    onHistoryChange?.();
    historyIndex.current = -1;
    calculateUndoRedoAvailability();
  }

  function calculateUndoRedoAvailability() {
    setUndoAvailable(historyIndex.current < history.current.length - 1);
    setRedoAvailable(historyIndex.current > -1);
  }

  async function applyUndo() {
    const historyRecord = history.current[historyIndex.current];
    if (!historyRecord) return;

    switch (historyRecord.action) {
      case HistoryAction.create:
        _removeLayerById(historyRecord.layer.id);
        break;
      case HistoryAction.remove:
        _createLayer(historyRecord.layer);
        break;
      case HistoryAction.edit:
        // Find previous layer state
        const prevHistoryRecord = history.current
          .slice(historyIndex.current + 1)
          .find(
            (iHistoryRecord) =>
              iHistoryRecord.layer.id === historyRecord.layer.id &&
              iHistoryRecord.action === HistoryAction.edit,
          );
        if (prevHistoryRecord) {
          storageAbortController.current.abort();
          let recordCopy = await createLayerHistoryRecord(prevHistoryRecord);
          setLayerById(recordCopy.layer);
        } else {
          // Set layer to default
          switch (historyRecord.layer.type) {
            case LayerType.createdRaster:
              setLayerById({
                ...historyRecord.layer,
                data: { ...historyRecord.layer.data, actualImage: new Blob() },
              });
              break;
            case LayerType.createdVector:
              setLayerById({
                ...historyRecord.layer,
                data: {
                  ...historyRecord.layer.data,
                  elements: _.cloneDeep(historyRecord.layer.data.initElements) || [],
                },
              });
          }
        }
        break;

      case HistoryAction.rasterize:
        _removeLayerById(historyRecord.layer.id);
        _createLayer(historyRecord.layer);
    }
    onHistoryChange?.();
  }

  async function applyRedo() {
    const historyRecord = history.current[historyIndex.current];
    if (!historyRecord) return;

    let recordCopy: HistoryRecord;
    if (historyRecord.layer.type === LayerType.createdRaster) {
      storageAbortController.current.abort();
      recordCopy = await createLayerHistoryRecord(historyRecord);
    } else {
      recordCopy = _.cloneDeep(historyRecord);
    }
    switch (historyRecord.action) {
      case HistoryAction.create:
        _createLayer(recordCopy.layer);
        break;
      case HistoryAction.remove:
        _removeLayerById(recordCopy.layer.id);
        break;
      case HistoryAction.edit:
        setLayerById(recordCopy.layer);
        break;
      case HistoryAction.rasterize:
        const index = layers?.findIndex((iLayer) => iLayer.id === recordCopy.layer.id);
        _rasterizeLayer(index);
    }
    onHistoryChange?.();
  }

  async function undo() {
    if (undoRedoInProgress.current) return;
    undoRedoInProgress.current = true;

    historyIndex.current += 1;
    await applyUndo();

    undoRedoInProgress.current = false;
    calculateUndoRedoAvailability();
  }

  async function redo() {
    if (undoRedoInProgress.current) return;
    undoRedoInProgress.current = true;

    await applyRedo();
    historyIndex.current -= 1;

    undoRedoInProgress.current = false;
    calculateUndoRedoAvailability();
  }

  const [selectedLayer, setSelectedLayer] = useState(0);

  const selectedLayerType = layers[selectedLayer]?.type;

  function _createLayer(layer: Layer) {
    setLayers((prev) => {
      const newLayers = [...prev];
      newLayers.push(layer);
      return newLayers;
    });
  }
  function createLayer(layer: Layer) {
    historyPush({ action: HistoryAction.create, layer: layer });

    _createLayer(layer);
  }

  function setLayerByIndex(index: number, value: ((prev: Layer) => Layer) | Layer) {
    setLayers((prev) => {
      const newLayers = [...prev];
      typeof value === "function"
        ? (newLayers[index] = value(newLayers[index]))
        : (newLayers[index] = value);

      return newLayers;
    });
  }

  function setLayerById(layer: Layer) {
    const foundLayerIndex = layers.findIndex((iLayer) => iLayer.id === layer.id);
    if (foundLayerIndex !== -1) {
      setLayers((prev) => {
        const newLayers = [...prev];
        newLayers[foundLayerIndex] = layer;
        return newLayers;
      });
    }
  }
  function _removeLayer(index: number) {
    if (layers.length - 2 < selectedLayer) {
      setSelectedLayer((prev) => prev - 1);
    }
    setLayers((prev) => {
      const newLayers = [...prev];
      newLayers.splice(index, 1);
      return newLayers;
    });
  } // TODO - store index
  async function removeLayer(index: number) {
    const layer = layers[index];
    if (layer.type === LayerType.createdRaster && layer.data?.canvas !== undefined) {
      layer.data.actualImage = await toBlob(layer.data.canvas);
    }

    historyPush({ action: HistoryAction.remove, layer: layer });

    _removeLayer(index);
  }

  function _removeLayerById(id: string | number) {
    const foundLayerIndex = layers.findIndex((layer) => layer.id === id);
    if (foundLayerIndex !== -1) {
      setLayers((prev) => {
        const newLayers = [...prev];
        newLayers.splice(foundLayerIndex, 1);
        return newLayers;
      });
    }
  }
  async function removeLayerById(id: string | number) {
    const foundLayerIndex = layers.findIndex((layer) => layer.id === id);
    if (foundLayerIndex !== -1) {
      const layer = layers[foundLayerIndex];
      if (layer.type === LayerType.createdRaster && layer.data?.canvas !== undefined) {
        layer.data.actualImage = await toBlob(layer.data.canvas);
      }
      historyPush({ action: HistoryAction.remove, layer: layer });

      _removeLayerById(id);
    }
  }

  async function _rasterizeLayer(index: number) {
    const vectorLayer = layers[index];
    if (vectorLayer.type === LayerType.createdVector && vectorLayer.data.layer) {
      const width = vectorLayer.data.layer.width();
      const height = vectorLayer.data.layer.height();

      const clonedLayer = vectorLayer.data.layer.clone();
      const newScale = Math.min(width / rasterWidth, height / rasterHeight);

      // Centering
      clonedLayer.position({
        x: (width - rasterWidth * newScale) / 2,
        y: (height - rasterHeight * newScale) / 2,
      });

      const blob = await clonedLayer.toBlob({
        width: rasterWidth,
        height: rasterHeight,
        // @ts-ignore konva types bug
        imageSmoothingEnabled: false,
      });

      const newLayer = {
        ...layers[index],
        type: LayerType.createdRaster,
        data: {
          initImage: blob,
        },
      } as CreatedRasterLayer;
      setLayerByIndex(index, newLayer);
  }
}

  function rasterizeLayer(index: number) {
    const vectorLayer = layers[index];
    historyPush({ action: HistoryAction.rasterize, layer: vectorLayer });
    _rasterizeLayer(index);
  }

  return (
    <LayersContext.Provider
      value={{
        layers: layers,
        rasterWidth,
        rasterHeight,
        setLayers: setLayers,

        selectedLayer,
        setSelectedLayer,
        selectedLayerType,

        tiling,
        
        createLayer,
        setLayerByIndex,
        setLayerById,
        removeLayer,
        removeLayerById,
        rasterizeLayer,

        historyPush,

        undo,
        undoAvailable,
        redo,
        redoAvailable,
      }}
    >
      {children}
    </LayersContext.Provider>
  );
};

function useLayers() {
  const context = useContext(LayersContext);
  if (context === null) {
    throw new Error("No provider for LayersContext");
  }

  return context;
}

export { LayersProvider, useLayers };
