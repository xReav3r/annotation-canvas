import { LayerType, useLayers } from "./annotation-canvas/";

import { Button, Paper, Typography } from "@mui/material";

import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import VisibilityIcon from "@mui/icons-material/Visibility";
import DeleteIcon from "@mui/icons-material/Delete";
import Grid4x4Icon from "@mui/icons-material/Grid4x4";

function Layers() {
  const {
    layers,
    setLayers,
    selectedLayer,
    setSelectedLayer,
    createLayer,
    setLayerByIndex,
    removeLayer,
    rasterizeLayer,
  } = useLayers();

  return (
    <Paper
      style={{
        display: "flex",
        flexDirection: "column",
        padding: "10px",
        gap: "10px",
        overflowY: "auto",
      }}
    >
      <Typography variant="h4" textAlign="center">
        Layers
      </Typography>
      <div style={{ display: "flex", justifyContent: "space-evenly" }}>
        <Button
          variant="contained"
          onClick={() => {
            const id = crypto.randomUUID();
            createLayer({
              id,
              visible: true,
              opacity: 100,
              type: LayerType.createdRaster,
              data: null,
            });
          }}
        >
          New raster
        </Button>
        <Button
          variant="contained"
          onClick={() => {
            const id = crypto.randomUUID();
            createLayer({
              id,
              visible: true,
              opacity: 100,
              type: LayerType.createdVector,
              data: { elements: [] },
            });
          }}
        >
          New vector
        </Button>
      </div>
      <DragDropContext
        onDragEnd={(result) => {
          if (!result.destination) return;

          const newLayers = [...layers];
          const [removed] = newLayers.splice(result.source.index, 1);
          newLayers.splice(result.destination.index, 0, removed);

          setLayers(newLayers);
        }}
      >
        <Droppable droppableId="DnDLayers">
          {(provided, snapshot) => (
            <Paper
              {...provided.droppableProps}
              ref={provided.innerRef}
              style={{
                background: snapshot.isDraggingOver ? "#bbdefb" : undefined,
                padding: 8,
                width: 250,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {layers.map((layer, i) => (
                <Draggable key={layer.id} draggableId={layer.id} index={i}>
                  {(provided, snapshot) => (
                    <Paper
                      elevation={i === selectedLayer ? 6 : 0}
                      variant={i === selectedLayer ? undefined : "outlined"}
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                        userSelect: "none",
                        padding: 16,
                        background: snapshot.isDragging ? "#c8e6c9" : undefined,

                        ...provided.draggableProps.style,
                      }}
                    >
                      <Typography>Type: {layer.type}</Typography>
                      <Typography>ID: {layer.id}</Typography>
                      <Button
                        variant="outlined"
                        onClick={() => {
                          setLayerByIndex(i, (prev) => {
                            const newLayer = { ...prev };
                            newLayer.visible = !layer.visible;
                            return newLayer;
                          });
                        }}
                        endIcon={layer.visible ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      >
                        {layer.visible ? "Hide" : "Show"}
                      </Button>
                      <Button
                        variant="outlined"
                        color="error"
                        onClick={() => {
                          removeLayer(i);
                        }}
                        endIcon={<DeleteIcon />}
                      >
                        Remove
                      </Button>
                      {layer.type === LayerType.createdVector && (
                        <Button
                          variant="outlined"
                          color="warning"
                          onClick={() => {
                            rasterizeLayer(i);
                          }}
                          endIcon={<Grid4x4Icon />}
                        >
                          Rasterize
                        </Button>
                      )}
                      <Button
                        variant="contained"
                        disabled={i === selectedLayer}
                        onClick={() => {
                          setSelectedLayer(i);
                        }}
                      >
                        Select
                      </Button>
                    </Paper>
                  )}
                </Draggable>
              ))}
              {/* Create space in the <Droppable /> as needed during a drag */}
              {provided.placeholder}
            </Paper>
          )}
        </Droppable>
      </DragDropContext>
    </Paper>
  );
}

export default Layers;
