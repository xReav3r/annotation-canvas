import cv from "@techstark/opencv-js";
import Konva from "konva";
import { Color } from "./contexts/ToolContext";
import { Zoom } from "./AnnotationCanvas";

export function createRasterCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    let image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

export function bressenhamLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  put: (x: number, y: number) => void,
) {
  let x, y, dx, dy, dx1, dy1, px, py, xe, ye, i;
  dx = x2 - x1;
  dy = y2 - y1;
  dx1 = Math.abs(dx);
  dy1 = Math.abs(dy);
  // Error intervals
  px = 2 * dy1 - dx1;
  py = 2 * dx1 - dy1;
  // X axis dominant
  if (dy1 <= dx1) {
    // left to right
    if (dx >= 0) {
      x = x1;
      y = y1;
      xe = x2;
    } else {
      // right to left
      x = x2;
      y = y2;
      xe = x1;
    }
    put(x, y);
    // Rasterize line
    for (i = 0; x < xe; i++) {
      x = x + 1;
      // Octants
      if (px < 0) {
        px = px + 2 * dy1;
      } else {
        if ((dx < 0 && dy < 0) || (dx > 0 && dy > 0)) {
          y = y + 1;
        } else {
          y = y - 1;
        }
        px = px + 2 * (dy1 - dx1);
      }
      put(x, y);
    }
  } else {
    // Y axis dominant
    // bottom to top
    if (dy >= 0) {
      x = x1;
      y = y1;
      ye = y2;
    } else {
      // top to bottom
      x = x2;
      y = y2;
      ye = y1;
    }
    put(x, y);
    // Rasterize line
    for (i = 0; y < ye; i++) {
      y = y + 1;
      // Octants
      if (py <= 0) {
        py = py + 2 * dx1;
      } else {
        if ((dx < 0 && dy < 0) || (dx > 0 && dy > 0)) {
          x = x + 1;
        } else {
          x = x - 1;
        }
        py = py + 2 * (dx1 - dy1);
      }
      put(x, y);
    }
  }
}

function bressenhamCircleOdd(x: number, y: number, r: number, put: (x: number, y: number) => void) {
  // bottom left to top right
  let actualX = -r,
    actualY = 0,
    err = 2 - 2 * r;
  do {
    put(x - actualY, y - actualX);
    put(x + actualX, y - actualY);

    r = err;
    if (r <= actualY) {
      actualY++;
      err += actualY * 2 + 1;
    }
    if (r > actualX || err > actualY) {
      actualX++;
      err += actualX * 2 + 1;
    }
  } while (actualX < 0);
}

function bressenhamCircleEven(
  x: number,
  y: number,
  r: number,
  put: (x: number, y: number) => void,
) {
  x -= 1;
  y -= 1;
  // bottom left to top right
  let actualX = -r,
    actualY = 0,
    err = 2 - 2 * r;
  do {
    put(x + 1 - actualY, y - actualX);
    put(x + 1 + actualX, y + 1 - actualY);

    r = err;
    if (r <= actualY) {
      actualY++;
      err += actualY * 2 + 1;
    }
    if (r > actualX || err > actualY) {
      actualX++;
      err += actualX * 2 + 1;
    }
  } while (actualX < 0);
}

export function bressenhamCircle(
  x: number,
  y: number,
  r: number,
  put: (x: number, y: number) => void,
) {
  if (r % 2 === 0) {
    bressenhamCircleEven(x, y, r, put);
  } else {
    bressenhamCircleOdd(x, y, r, put);
  }
}

export function drawFilledCircleLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  diameter: number,
  ctx: CanvasRenderingContext2D,
) {
  x1 = Math.trunc(x1);
  x2 = Math.trunc(x2);
  y1 = Math.trunc(y1);
  y2 = Math.trunc(y2);
  const radius = Math.trunc(diameter / 2);

  if (x1 === x2 && y1 === y2) {
    switch (diameter) {
      case 1:
        ctx.clearRect(x1, y1, 1, 1);
        ctx.fillRect(x1, y1, 1, 1);
        break;
      case 2:
        ctx.clearRect(x1 - 1, y1 - 1, 2, 2);
        ctx.fillRect(x1 - 1, y1 - 1, 2, 2);
        break;
      case 3:
        ctx.clearRect(x1 - 1, y1, 3, 1);
        ctx.fillRect(x1 - 1, y1, 3, 1);
        ctx.clearRect(x1, y1 - 1, 1, 3);
        ctx.fillRect(x1, y1 - 1, 1, 3);
        break;

      default:
        bressenhamCircle(x1, y1, radius, (x, y) => {
          if (x < x1) {
            ctx.clearRect(x, y, (x1 - x) * 2, 1);
            ctx.fillRect(x, y, (x1 - x) * 2, 1);
          }
        });
    }
  } else {
    switch (diameter) {
      case 1:
        bressenhamLine(x1, y1, x2, y2, (lineX, lineY) => {
          ctx.clearRect(lineX, lineY, 1, 1);
          ctx.fillRect(lineX, lineY, 1, 1);
        });
        break;
      case 2:
        bressenhamLine(x1, y1, x2, y2, (lineX, lineY) => {
          ctx.clearRect(lineX - 1, lineY - 1, 2, 2);
          ctx.fillRect(lineX - 1, lineY - 1, 2, 2);
        });
        break;
      case 3:
        bressenhamLine(x1, y1, x2, y2, (lineX, lineY) => {
          ctx.clearRect(lineX - 1, lineY, 3, 1);
          ctx.fillRect(lineX - 1, lineY, 3, 1);
          ctx.clearRect(lineX, lineY - 1, 1, 3);
          ctx.fillRect(lineX, lineY - 1, 1, 3);
        });
        break;

      default:
        bressenhamLine(x1, y1, x2, y2, (lineX, lineY) => {
          bressenhamCircle(lineX, lineY, radius, (x, y) => {
            if (x < lineX) {
              ctx.clearRect(x, y, (lineX - x) * 2, 1);
              ctx.fillRect(x, y, (lineX - x) * 2, 1);
            }
          });
        });
    }
  }
}

export function drawFilledSquareLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  diameter: number,
  ctx: CanvasRenderingContext2D,
) {
  x1 = Math.trunc(x1);
  x2 = Math.trunc(x2);
  y1 = Math.trunc(y1);
  y2 = Math.trunc(y2);
  const halfDiameter = Math.trunc(diameter / 2);
  if (x1 === x2 && y1 === y2) {
    ctx.clearRect(x1 - halfDiameter, y1 - halfDiameter, diameter, diameter);
    ctx.fillRect(x1 - halfDiameter, y1 - halfDiameter, diameter, diameter);
  } else {
    bressenhamLine(x1, y1, x2, y2, (lineX, lineY) => {
      ctx.clearRect(lineX - halfDiameter, lineY - halfDiameter, diameter, diameter);
      ctx.fillRect(lineX - halfDiameter, lineY - halfDiameter, diameter, diameter);
    });
  }
}

export function absoluteRectangle(rectangle: {
  x: number;
  y: number;
  width: number;
  height: number;
  [key: string]: any;
}): { x: number; y: number; width: number; height: number; [key: string]: any } {
  const newRectangle = {
    ...rectangle,
    x: rectangle.x,
    y: rectangle.y,
    width: rectangle.width,
    height: rectangle.height,
  };
  if (rectangle.width < 0) {
    newRectangle.x = rectangle.x + rectangle.width;
    newRectangle.width = Math.abs(rectangle.width);
  }
  if (rectangle.height < 0) {
    newRectangle.y = rectangle.y + rectangle.height;
    newRectangle.height = Math.abs(rectangle.height);
  }
  return newRectangle;
}

export function getContoursBoundingBoxes(
  canvas: HTMLCanvasElement,
  colors: { r: number; g: number; b: number }[],
) {
  let src = cv.imread(canvas);
  const contoursBoundingBoxes = [];

  for (let i = 0; i < colors.length; ++i) {
    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();
    let dst = new cv.Mat(src.cols, src.rows, cv.CV_8UC3);

    let color = colors[i];

    let low = new cv.Mat(src.rows, src.cols, src.type(), [color.r, color.g, color.b, 1]);
    let high = new cv.Mat(src.rows, src.cols, src.type(), [color.r, color.g, color.b, 255]);

    cv.inRange(src, low, high, dst);

    cv.findContours(dst, contours, hierarchy, cv.RETR_CCOMP, cv.CHAIN_APPROX_SIMPLE);
    const boundingBoxes: cv.Rect[] = [];

    const contoursFilterIndexes: number[] = [];

    if (hierarchy.data32S.length <= 0) continue;
    let contoursFilterIndex = 0;
    while (contoursFilterIndex !== -1) {
      contoursFilterIndexes.push(contoursFilterIndex);
      contoursFilterIndex = hierarchy.data32S[contoursFilterIndex * 4];
    }
    // @ts-ignore bug, size of vector is one number
    contoursFilterIndexes.forEach((contoursFilterIndex) => {
      const cnt = contours.get(contoursFilterIndex);
      const rect = cv.boundingRect(cnt);

      boundingBoxes.push(rect);
    });

    contoursBoundingBoxes.push({ color, boundingBoxes });

    dst.delete();
    contours.delete();
    // hierarchy.delete();
    low.delete();
    high.delete();
  }
  src.delete();

  return contoursBoundingBoxes;
}

export function pointsObjectsToArray(points: { x: number; y: number }[]) {
  const arrayPoints: number[] = [];
  points.forEach((point) => {
    arrayPoints.push(point.x, point.y);
  });

  return arrayPoints;
}

export function pointsArrayToObjects(points: number[]) {
  const objectPoints: { x: number; y: number }[] = [];
  for (let i = 0; i < points.length; i += 2) {
    objectPoints.push({ x: points[i], y: points[i + 1] });
  }

  return objectPoints;
}

export function getBoundedRelativePointer(
  stage: Konva.Stage,
  rasterWidth: number,
  rasterHeight: number,
) {
  let pointerPosition = stage.getRelativePointerPosition();
  if (pointerPosition === null) throw "pointerPosition null";

  return boundPointer(pointerPosition, rasterWidth, rasterHeight);
}

export function boundPointer(
  pointerPosition: {
    x: number;
    y: number;
  },
  rasterWidth: number,
  rasterHeight: number,
) {
  let pointerOverflow = false;

  if (pointerPosition.x < 0) {
    pointerPosition.x = 0;
    pointerOverflow = true;
  }
  if (pointerPosition.y < 0) {
    pointerPosition.y = 0;
    pointerOverflow = true;
  }
  if (pointerPosition.x > rasterWidth) {
    pointerPosition.x = rasterWidth;
    pointerOverflow = true;
  }
  if (pointerPosition.y > rasterHeight) {
    pointerPosition.y = rasterHeight;
    pointerOverflow = true;
  }
  return { pointerPosition, pointerOverflow };
}

export function pointToLineDistance(
  point: { x: number; y: number },
  lineStart: { x: number; y: number },
  lineEnd: { x: number; y: number },
) {
  const lineVector = { x: lineEnd.x - lineStart.x, y: lineEnd.y - lineStart.y };
  const lineStartToPointVector = { x: point.x - lineStart.x, y: point.y - lineStart.y };
  const lineEndToPointVector = { x: point.x - lineEnd.x, y: point.y - lineEnd.y };

  const lineStartDotProduct =
    lineVector.x * lineStartToPointVector.x + lineVector.y * lineStartToPointVector.y;

  const lineEndDotProduct =
    lineVector.x * lineEndToPointVector.x + lineVector.y * lineEndToPointVector.y;

  if (lineStartDotProduct < 0 || lineEndDotProduct > 0) return null;

  const x1 = lineVector.x;
  const y1 = lineVector.y;
  const x2 = lineStartToPointVector.x;
  const y2 = lineStartToPointVector.y;
  const mod = Math.sqrt(x1 * x1 + y1 * y1);
  return Math.abs(x1 * y2 - y1 * x2) / mod;
}

export function rgbaToString(rgba: Color) {
  return `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${rgba.a})`;
}

export function stageBound(
  pos: { x: number; y: number },
  stageWidth: number,
  stageHeight: number,
  rasterWidth: number,
  rasterHeight: number,
  scale: number,
): { x: number; y: number } {
  if (rasterWidth * scale < stageWidth) {
    pos.x = (stageWidth - rasterWidth * scale) / 2;
  } else if (pos.x > 0) {
    pos.x = 0;
  } else if (pos.x + rasterWidth * scale < stageWidth) {
    pos.x = -(rasterWidth * scale) + stageWidth;
  }

  if (rasterHeight * scale < stageHeight) {
    pos.y = (stageHeight - rasterHeight * scale) / 2;
  } else if (pos.y > 0) {
    pos.y = 0;
  } else if (pos.y + rasterHeight * scale < stageHeight) {
    pos.y = -(rasterHeight * scale) + stageHeight;
  }

  return pos;
}

export function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
    });
  });
}

export function calculateViewport(
  zoom: Zoom,
  stageWidth: number,
  stageHeight: number,
  rasterWidth: number,
  rasterHeight: number,
) {
  let x1 = Math.max(0, -Math.trunc(zoom.position.x / zoom.scale));
  let y1 = Math.max(0, -Math.trunc(zoom.position.y / zoom.scale));

  let x2 = Math.max(0, Math.ceil((stageWidth - zoom.position.x) / zoom.scale));
  let y2 = Math.max(0, Math.ceil((stageHeight - zoom.position.y) / zoom.scale));

  // Cut to layers dimensions
  x1 = Math.min(rasterWidth, x1);
  y1 = Math.min(rasterHeight, y1);
  x2 = Math.min(rasterWidth, x2);
  y2 = Math.min(rasterHeight, y2);
  return { x1, y1, x2, y2 };
}
