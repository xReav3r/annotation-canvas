import { useEffect, useRef } from "react";

import Konva from "konva";
import { Image, Layer } from "react-konva";

import { AnimatedLayer as IAnimatedLayer } from "./contexts/LayersContext";

function AnimatedLayer({ layer }: { layer: IAnimatedLayer }) {
  const layerRef = useRef<Konva.Layer>(null);

  useEffect(() => {
    const anim = new Konva.Animation(function () {
      // do nothing, animation just need to update the layer
    }, layerRef.current);
    anim.start();

    return () => {
      anim.stop();
    };
  }, []);

  return (
    <Layer
      ref={layerRef}
      imageSmoothingEnabled={false}
      listening={false}
      visible={layer.visible}
      opacity={layer.opacity}
    >
      <Image image={layer.data.canvas} />
    </Layer>
  );
}

export default AnimatedLayer;
