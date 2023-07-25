import { createContext, ReactNode, useContext, useEffect, useRef } from "react";
import { loadImage } from "../utils";
import localforage from "localforage";

export type GetImage = (
  x: number,
  y: number,
  width: number,
  height: number,
  viewWidth: number,
  viewHeight: number,
  signal?: AbortSignal,
) => Promise<Blob | null>;

export type GetImageCached = (
  getImage: GetImage,
  x: number,
  y: number,
  width: number,
  height: number,
  viewWidth: number,
  viewHeight: number,
  signal?: AbortSignal,
  cacheId?: number | string,
) => Promise<ImageBitmap | null>;

interface IImageCacheContext {
  getImageCached: GetImageCached;
}

const ImageCacheContext = createContext<IImageCacheContext | null>(null);

const ImageCacheProvider = ({ children }: { children: ReactNode }) => {
  const cache = useRef(localforage.createInstance({ name: "annotation-canvas:imageCache" }));
  useEffect(() => {
    cache.current.clear();
    return () => {
      cache.current.clear();
    };
  }, []);

  const canvas = useRef<HTMLCanvasElement>();

  useEffect(() => {
    canvas.current = document.createElement("canvas");

    return () => {
      canvas.current?.remove();
    };
  }, []);

  async function getImageCached(
    getImage: GetImage,
    x: number,
    y: number,
    width: number,
    height: number,
    viewWidth: number,
    viewHeight: number,
    signal?: AbortSignal,
    cacheId?: number | string,
  ) {
    const key =
      cacheId + "," + x + "," + y + "," + width + "," + height + "," + viewWidth + "," + viewHeight;

    const item = (await cache.current.getItem(key)) as ImageBitmap;
    if (item !== null) return item;

    const imageData = await getImage(x, y, width, height, viewWidth, viewHeight, signal);

    // getImage has been canceled because of zoom change
    if (imageData === null) return null;

    const urlObject = URL.createObjectURL(imageData);

    const image = await loadImage(urlObject);

    URL.revokeObjectURL(urlObject);

    if (canvas.current === undefined) throw "ImageCache canvas undefined";
    canvas.current.width = viewWidth;
    canvas.current.height = viewHeight;

    const ctx = canvas.current.getContext("2d");
    if (ctx === null) throw "ImageCache canvas ctx null";

    ctx.drawImage(image, 0, 0);
    const bitmap = await createImageBitmap(canvas.current);

    // Do not await - faster drawing
    cache.current.setItem(key, bitmap).catch((err) => {
      console.log(err);
      cache.current.clear();
    });

    return bitmap;
  }

  return (
    <ImageCacheContext.Provider
      value={{
        getImageCached,
      }}
    >
      {children}
    </ImageCacheContext.Provider>
  );
};

function useImageCache() {
  const context = useContext(ImageCacheContext);
  if (context === null) {
    throw "No provider for ImageCacheContext";
  }

  return context;
}

export { ImageCacheProvider, useImageCache };
