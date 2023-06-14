import { useEffect, useState } from "react";
import { Image as KonvaImage, Layer } from "react-konva";
import { DownloadedVectorLayer as IDownloadedVectorLayer } from "./contexts/LayersContext";
import { loadImage } from "./utils";

function DownloadedVectorLayer({ layer }: { layer: IDownloadedVectorLayer }) {
  const [image, setImage] = useState<HTMLImageElement | undefined>();

  useEffect(() => {
    if (layer.data === "") return;
    const blob = new Blob([layer.data as string], { type: "image/svg+xml" });
    const objectUrl = URL.createObjectURL(blob);

    async function loadAndSetImage() {
      const loadedImage = await loadImage(objectUrl);
      setImage(loadedImage);
    }

    loadAndSetImage();

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [layer]);

  return (
    <Layer listening={false} visible={layer.visible} opacity={layer.opacity}>
      <KonvaImage image={image} />
    </Layer>
  );
}

export default DownloadedVectorLayer;
