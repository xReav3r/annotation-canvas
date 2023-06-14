import express, { ErrorRequestHandler } from "express";
import cors from "cors";

import fs from "fs";
import path from "path";
import sharp from "sharp";
import bodyParser from "body-parser";

async function loop() {
  const imageData1 = fs.readFileSync("./background.png");
  let image1 = sharp(imageData1);

  const imageData2 = fs.readFileSync("./foreground.png");
  let image2 = sharp(imageData2);

  const app = express();
  const port = 3000;

  app.use(cors());
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(bodyParser.json());

  const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
    console.error(err);
    res.status(500);
    res.send(err.stack);
  };
  app.use(errorHandler);

  interface ImageRequest {
    extract?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    resize?: {
      viewWidth: number;
      viewHeight: number;
    };
  }

  app.get("/data-service/svg", async (req, res) => {
    res.sendFile(path.resolve(__dirname + "/../overlay.svg"));
  });

  app.get("/data-service/image", async (req, res) => {
    const metadata = await image1.metadata();
    res.send({ width: metadata.width, height: metadata.height });
  });

  app.post("/data-service/image1", async (req, res, next) => {
    const { extract, resize }: ImageRequest = req.body;
    let tmpImage = image1.clone();
    if (typeof extract !== "undefined")
      tmpImage = tmpImage.extract({
        left: extract.x,
        top: extract.y,
        width: extract.width,
        height: extract.height,
      });
    if (typeof resize !== "undefined")
      tmpImage = tmpImage.resize(resize.viewWidth, resize.viewHeight, {
        fit: "fill",
      });

    try {
      const imageBuffer = await tmpImage.toBuffer();
      res.contentType("image/png");
      res.send(imageBuffer);
    } catch (e) {
      next(e);
    }
  });

  app.post("/data-service/image2", async (req, res, next) => {
    const { extract, resize }: ImageRequest = req.body;
    let tmpImage = image2.clone();
    if (typeof extract !== "undefined")
      tmpImage = tmpImage.extract({
        left: extract.x,
        top: extract.y,
        width: extract.width,
        height: extract.height,
      });
    if (typeof resize !== "undefined")
      tmpImage = tmpImage.resize(resize.viewWidth, resize.viewHeight, {
        fit: "fill",
      });

    try {
      const imageBuffer = await tmpImage.toBuffer();
      res.contentType("image/png");
      res.send(imageBuffer);
    } catch (e) {
      next(e);
    }
  });

  app.listen(port, () => {
    console.log(`Listening on port ${port}`);
  });
}

loop();
