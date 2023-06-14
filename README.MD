# annotation-canvas - React 2D vector and raster drawing library
## Author: Martin Schneider

# Usage
```
npm i
```

## Running test application
Configure backend URL in `frontendConfig.ts`.
```
npm start
```

## Building annotation-canvas library
```
npm run build
```

## Running memory leak test
Start test application, set `memoryLeakTest: "true"` in `localStorage` and get its process ID.
```
./measureMemory.sh <PID>
```