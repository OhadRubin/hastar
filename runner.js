#!/usr/bin/env node
// CORE UTILITIES:
// src/utils/utilities.js
class UnionFind {
    constructor(size) {
      this.parent = new Array(size);
      this.rank = new Array(size);
      for (let i = 0; i < size; i++) {
        this.parent[i] = i;
        this.rank[i] = 0;
      }
    }
  
    find(x) {
      if (this.parent[x] !== x) {
        this.parent[x] = this.find(this.parent[x]);
      }
      return this.parent[x];
    }
  
    union(x, y) {
      const rootX = this.find(x);
      const rootY = this.find(y);
      
      if (rootX === rootY) return false;
      
      if (this.rank[rootX] < this.rank[rootY]) {
        this.parent[rootX] = rootY;
      } else if (this.rank[rootX] > this.rank[rootY]) {
        this.parent[rootY] = rootX;
      } else {
        this.parent[rootY] = rootX;
        this.rank[rootX]++;
      }
      return true;
    }
  }
  
  function heuristicString(a, b) {
    const [r1, c1] = a.split(',').map(Number);
    const [r2, c2] = b.split(',').map(Number);
    return Math.abs(r1 - r2) + Math.abs(c1 - c2);
  }
  
  function heuristicObject(a, b) {
    return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
  }
  
  function heuristicStringChebyshev(a, b) {
    const [r1, c1] = a.split(',').map(Number);
    const [r2, c2] = b.split(',').map(Number);
    const dx = Math.abs(r1 - r2);
    const dy = Math.abs(c1 - c2);
    return Math.max(dx, dy);
  }
  
  function heuristicObjectChebyshev(a, b) {
    const dx = Math.abs(a.row - b.row);
    const dy = Math.abs(a.col - b.col);
    return Math.max(dx, dy);
  }
  
  function getKey(cell) {
    return `${cell.row},${cell.col}`;
  }
  
  const DIRECTIONS = {
    NORTH: 0,
    NORTHEAST: 1,
    EAST: 2,
    SOUTHEAST: 3,
    SOUTH: 4,
    SOUTHWEST: 5,
    WEST: 6,
    NORTHWEST: 7
  };
  
  // src/core/utils/map-utils.js
  const CELL_STATES = {
    UNKNOWN: 2,
    WALL: 1,
    WALKABLE: 0
  };
  
  const updateKnownMap = (knownMap, fullMaze, sensorPositions) => {
    const newKnownMap = knownMap.map(row => [...row]); // Deep copy
    const newCells = [];
    
    for (const pos of sensorPositions) {
      const currentState = knownMap[pos.row][pos.col];
      const actualState = fullMaze[pos.row][pos.col];
      
      if (currentState === CELL_STATES.UNKNOWN) {
        newKnownMap[pos.row][pos.col] = actualState;
        newCells.push({ ...pos, newState: actualState });
      }
    }
    
    return { knownMap: newKnownMap, newCells };
  };
  
  // src/core/constants.js
  const DEFAULT_REGION_SIZE = 16;
  const DEFAULT_MAZE_SIZE = 256;
  const CLI_VIEWPORT_WIDTH = 8;
  const CLI_VIEWPORT_HEIGHT = 8;
  const CLI_VIEWPORT_BUFFER = 3;
  const CLI_FRAME_BUFFER_SIZE = 50;
  const CLI_SAVE_KEY = 's';
  
  // ALGORITHM REGISTRY & INTERFACE:
  // src/algorithms/algorithm-interface.js
  const createAlgorithm = (config) => {
    if (!config.name || !config.type || !config.execute) {
      throw new Error('Algorithm must have name, type, and execute function');
    }
  
    return {
      name: config.name,
      type: config.type,
      description: config.description || '',
      parameters: config.parameters || {},
      
      async execute(input, options = {}, onProgress = null) {
        return config.execute(input, options, onProgress);
      },
      
      createInitialState(input, options = {}) {
        if (config.createInitialState) {
          return config.createInitialState(input, options);
        }
        return {};
      },
      
      validateParameters(params = {}) {
        const validated = {};
        
        for (const [key, spec] of Object.entries(this.parameters)) {
          const value = params[key];
          
          if (value === undefined) {
            validated[key] = spec.default;
          } else if (spec.min !== undefined && value < spec.min) {
            validated[key] = spec.min;
          } else if (spec.max !== undefined && value > spec.max) {
            validated[key] = spec.max;
          } else if (spec.options && !spec.options.includes(value)) {
            validated[key] = spec.default;
          } else {
            validated[key] = value;
          }
        }
        
        return validated;
      }
    };
  };
  
  const createAlgorithmResult = (result, metrics = {}, finalState = null) => ({
    result,
    metrics: {
      executionTime: 0,
      ...metrics
    },
    finalState
  });
  
  const ParameterTypes = {
    NUMBER: 'number',
    STRING: 'string', 
    BOOLEAN: 'boolean',
    SELECT: 'select'
  };
  
  const numberParam = (min, max, defaultValue, step = 1) => ({
    type: ParameterTypes.NUMBER,
    min,
    max,
    default: defaultValue,
    step
  });
  
  const selectParam = (options, defaultValue) => ({
    type: ParameterTypes.SELECT,
    options,
    default: defaultValue
  });
  
  const booleanParam = (defaultValue) => ({
    type: ParameterTypes.BOOLEAN,
    default: defaultValue
  });
  
  // Placeholder for missing src/core/sensors/index.js
  // These are minimal definitions required for the other files to function.
  class SensorManager {
    constructor(width, height) {
      this.width = width;
      this.height = height;
      this.sensors = {};
    }
  
    addSensor(name, sensorInstance) {
      this.sensors[name] = sensorInstance;
    }
  
    getAllSensorPositions(x, y, direction, options) {
      const sensor = this.sensors.cone;
      if (sensor) {
        return sensor.getVisibleCells(x, y, direction, options.sensorRange);
      }
      return [];
    }
  
    hasLineOfSight(maze, x1, y1, x2, y2) {
      const dx = Math.abs(x2 - x1);
      const dy = Math.abs(y2 - y1);
      const sx = (x1 < x2) ? 1 : -1;
      const sy = (y1 < y2) ? 1 : -1;
      let err = dx - dy;
      
      let currentX = x1;
      let currentY = y1;
  
      while (true) {
          if ((currentX !== x1 || currentY !== y1) && (currentX !== x2 || currentY !== y2) && 
              maze[currentY * this.width + currentX] === CELL_STATES.WALL) {
              return false;
          }
  
          if (currentX === x2 && currentY === y2) {
              break;
          }
  
          const e2 = 2 * err;
          if (e2 > -dy) { err -= dy; currentX += sx; }
          if (e2 < dx) { err += dx; currentY += sy; }
      }
      return true;
    }
  }
  
  class DirectionalConeSensor {
    constructor(width, height) {
      this.width = width;
      this.height = height;
    }
  
    getVisibleCells(startX, startY, direction, range) {
      const visible = [];
      const minX = Math.max(0, startX - range);
      const maxX = Math.min(this.width - 1, startX + range);
      const minY = Math.max(0, startY - range);
      const maxY = Math.min(this.height - 1, startY + range);
  
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const dist = Math.sqrt(Math.pow(x - startX, 2) + Math.pow(y - startY, 2));
          if (dist <= range) {
            visible.push([x, y]);
          }
        }
      }
      return visible;
    }
  }
  
  // Wavefront Frontier Detection (WFD) Algorithm
  // Based on "Wavefront frontier detection algorithm for autonomous robot exploration" paper
  
  class WavefrontFrontierDetection {
    constructor(width, height) {
      this.width = width;
      this.height = height;
    }
  
    // Main WFD algorithm - returns grouped frontiers instead of individual points
    detectFrontiers(knownMap) {
      if (!knownMap) return [];
      
      const frontierPoints = this.findFrontierPoints(knownMap);
      const frontierGroups = this.groupFrontierPoints(frontierPoints, knownMap);
      
      return frontierGroups.map(group => ({
        points: group,
        centroid: this.calculateCentroid(group),
        median: this.calculateMedian(group),
        size: group.length
      }));
    }
  
    // Find all frontier points using WFD's cell classification approach
    findFrontierPoints(knownMap) {
      const frontierPoints = [];
      const mapOpenList = [];
      const mapCloseList = new Set();
      
      // Initialize: find all known open cells (Map-Open-List)
      for (let y = 1; y < this.height - 1; y++) {
        for (let x = 1; x < this.width - 1; x++) {
          const idx = y * this.width + x;
          if (knownMap[idx] === CELL_STATES.WALKABLE) { // Known open cell
            mapOpenList.push({x, y});
          }
        }
      }
  
      // BFS through known open cells to find frontiers
      while (mapOpenList.length > 0) {
        const currentCell = mapOpenList.shift();
        const key = `${currentCell.x},${currentCell.y}`;
        
        if (mapCloseList.has(key)) continue;
        mapCloseList.add(key);
  
        // Check if this open cell is adjacent to unknown space (frontier point)
        if (this.isFrontierPoint(currentCell.x, currentCell.y, knownMap)) {
          frontierPoints.push({x: currentCell.x + 0.5, y: currentCell.y + 0.5});
        }
  
        // Add unprocessed open neighbors to map-open-list
        const neighbors = this.getNeighbors(currentCell.x, currentCell.y);
        for (const neighbor of neighbors) {
          const neighborKey = `${neighbor.x},${neighbor.y}`;
          const idx = neighbor.y * this.width + neighbor.x;
          
          if (!mapCloseList.has(neighborKey) && 
              neighbor.x >= 0 && neighbor.x < this.width && 
              neighbor.y >= 0 && neighbor.y < this.height &&
              knownMap[idx] === CELL_STATES.WALKABLE && 
              !mapOpenList.some(cell => cell.x === neighbor.x && cell.y === neighbor.y)) {
            mapOpenList.push(neighbor);
          }
        }
      }
  
      return frontierPoints;
    }
  
    // Check if a cell is a frontier point (open cell adjacent to unknown, not blocked by walls)
    isFrontierPoint(x, y, knownMap) {
      const neighbors = this.getNeighbors(x, y);
      return neighbors.some(neighbor => {
        const idx = neighbor.y * this.width + neighbor.x;
        const cellState = knownMap[idx];
        
        // Frontier point must be adjacent to unknown space, not walls
        return cellState === CELL_STATES.UNKNOWN;
      });
    }
  
    // Group connected frontier points into frontiers using BFS
    groupFrontierPoints(frontierPoints, knownMap) {
      const visited = new Set();
      const frontierGroups = [];
      
      for (const point of frontierPoints) {
        const key = `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
        if (visited.has(key)) continue;
        
        const group = this.bfsGroupFrontier(point, frontierPoints, visited, knownMap);
        frontierGroups.push(group);
  
      }
      
      return frontierGroups;
    }
  
    // BFS to group connected frontier points
    bfsGroupFrontier(startPoint, allFrontierPoints, visited, _knownMap) {
      const group = [];
      const queue = [startPoint];
      const frontierCloseList = new Set();
      
      while (queue.length > 0) {
        const current = queue.shift();
        const key = `${current.x.toFixed(1)},${current.y.toFixed(1)}`;
        
        if (frontierCloseList.has(key)) continue;
        frontierCloseList.add(key);
        visited.add(key);
        group.push(current);
        
        // Find neighboring frontier points
        for (const candidate of allFrontierPoints) {
          const candidateKey = `${candidate.x.toFixed(1)},${candidate.y.toFixed(1)}`;
          if (frontierCloseList.has(candidateKey) || visited.has(candidateKey)) continue;
          
          const distance = Math.sqrt(
            Math.pow(candidate.x - current.x, 2) + 
            Math.pow(candidate.y - current.y, 2)
          );
          
          // Adjacent frontier points (within sqrt(2) distance)
          // if (distance <= 1.5) {
          if (distance < 2) {
            queue.push(candidate);
          }
        }
      }
      
      return group;
    }
  
    // Calculate centroid of frontier group (research paper's preferred method)
    calculateCentroid(points) {
      if (points.length === 0) return null;
      
      const sumX = points.reduce((sum, p) => sum + p.x, 0);
      const sumY = points.reduce((sum, p) => sum + p.y, 0);
      
      return {
        x: sumX / points.length,
        y: sumY / points.length
      };
    }
  
    // Calculate median point of frontier group (alternative method)
    calculateMedian(points) {
      if (points.length === 0) return null;
      if (points.length === 1) return points[0];
      
      // Sort by distance from geometric center
      const center = this.calculateCentroid(points);
      const sortedPoints = [...points].sort((a, b) => {
        const distA = Math.sqrt(Math.pow(a.x - center.x, 2) + Math.pow(a.y - center.y, 2));
        const distB = Math.sqrt(Math.pow(b.x - center.x, 2) + Math.pow(b.y - center.y, 2));
        return distA - distB;
      });
      
      const medianIndex = Math.floor(sortedPoints.length / 2);
      return sortedPoints[medianIndex];
    }
  
    // Get 8-connected neighbors (including diagonals)
    getNeighbors(x, y) {
      const neighbors = [];
      const directions = [
        [0, 1], [1, 0], [0, -1], [-1, 0], // up, right, down, left
        [1, 1], [1, -1], [-1, 1], [-1, -1] // northeast, southeast, northwest, southwest
      ];
      
      for (const [dx, dy] of directions) {
        const newX = x + dx;
        const newY = y + dy;
        
        if (newX >= 0 && newX < this.width && newY >= 0 && newY < this.height) {
          neighbors.push({x: newX, y: newY});
        }
      }
      
      return neighbors;
    }
  }
  // src/core/utils/maze-utils.js
  const findConnectedComponents = (maze, startRow, startCol, REGION_SIZE) => {
    const components = [];
    const visited = Array(REGION_SIZE).fill(null).map(() => Array(REGION_SIZE).fill(false));
      
    const floodFill = (row, col, componentId) => {
      if (row < 0 || row >= REGION_SIZE || col < 0 || col >= REGION_SIZE) return;
      if (visited[row][col]) return;
      
      const mazeRow = startRow + row;
      const mazeCol = startCol + col;
      if (maze[mazeRow][mazeCol] === CELL_STATES.WALL || maze[mazeRow][mazeCol] === CELL_STATES.UNKNOWN) return;
      
      visited[row][col] = true;
      components[componentId].push({ row: mazeRow, col: mazeCol });
      
      floodFill(row - 1, col, componentId);
      floodFill(row + 1, col, componentId);
      floodFill(row, col - 1, componentId);
      floodFill(row, col + 1, componentId);
      floodFill(row - 1, col - 1, componentId);
      floodFill(row - 1, col + 1, componentId);
      floodFill(row + 1, col - 1, componentId);
      floodFill(row + 1, col + 1, componentId);
    };
      
    let componentId = 0;
    for (let row = 0; row < REGION_SIZE; row++) {
      for (let col = 0; col < REGION_SIZE; col++) {
        if (!visited[row][col] && maze[startRow + row][startCol + col] === 0) {
          components[componentId] = [];
          floodFill(row, col, componentId);
          componentId++;
        }
      }
    }
      
    return components;
  };
  

  // src/core/utils/sensor-utils.js
  const scanWithSensors = (robotPosition, sensorRange, maze, robotDirection = 0) => {
    const SIZE = maze.length;
    const sensorManager = new SensorManager(SIZE, SIZE);
    sensorManager.addSensor('cone', new DirectionalConeSensor(SIZE, SIZE));
    
    const flatMaze = new Uint8Array(SIZE * SIZE);
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        flatMaze[r * SIZE + c] = maze[r][c];
      }
    }
    
    const positions = sensorManager.getAllSensorPositions(
      robotPosition.col,
      robotPosition.row, 
      robotDirection, 
      { sensorRange }
    );
    
    const visiblePositions = positions.filter(([x, y]) => 
      sensorManager.hasLineOfSight(flatMaze, 
        Math.floor(robotPosition.col), Math.floor(robotPosition.row), x, y)
    ).map(([x, y]) => ({ row: y, col: x }));
    
    return visiblePositions;
  };
  
  // src/core/rendering/ASCIIViewport.js
  class ASCIIViewport {
    constructor(options = {}) {
      this.VIEWPORT_WIDTH = options.width || CLI_VIEWPORT_WIDTH;
      this.VIEWPORT_HEIGHT = options.height || CLI_VIEWPORT_HEIGHT;
      this.BUFFER_CELLS = options.buffer || CLI_VIEWPORT_BUFFER;
      
      this.cameraPosition = { row: 0, col: 0 };
      this.initialized = false;
    }
  
    updateCamera(characterPosition, mazeSize) {
      if (!characterPosition) {
        return;
      }
  
      const targetRow = characterPosition.row - Math.floor(this.VIEWPORT_HEIGHT / 2);
      const targetCol = characterPosition.col - Math.floor(this.VIEWPORT_WIDTH / 2);
  
      this.cameraPosition = {
        row: Math.max(0, Math.min(targetRow, mazeSize - this.VIEWPORT_HEIGHT)),
        col: Math.max(0, Math.min(targetCol, mazeSize - this.VIEWPORT_WIDTH))
      };
  
      this.initialized = true;
    }
  
    getVisibleBounds(mazeSize) {
      if (!this.initialized) {
        return {
          startRow: 0,
          endRow: Math.min(this.VIEWPORT_HEIGHT, mazeSize),
          startCol: 0,
          endCol: Math.min(this.VIEWPORT_WIDTH, mazeSize)
        };
      }
  
      const startRow = Math.max(0, this.cameraPosition.row - this.BUFFER_CELLS);
      const endRow = Math.min(mazeSize, this.cameraPosition.row + this.VIEWPORT_HEIGHT + this.BUFFER_CELLS);
      const startCol = Math.max(0, this.cameraPosition.col - this.BUFFER_CELLS);
      const endCol = Math.min(mazeSize, this.cameraPosition.col + this.VIEWPORT_WIDTH + this.BUFFER_CELLS);
  
      return { startRow, endRow, startCol, endCol };
    }
  
    getViewportStats(mazeSize) {
      const bounds = this.getVisibleBounds(mazeSize);
      const totalCells = mazeSize * mazeSize;
      const visibleCells = (bounds.endRow - bounds.startRow) * (bounds.endCol - bounds.startCol);
      const cullPercentage = ((totalCells - visibleCells) / totalCells * 100).toFixed(1);
  
      return {
        totalCells,
        visibleCells,
        cullPercentage: `${cullPercentage}%`,
        cameraPosition: this.cameraPosition,
        viewportSize: {
          width: this.VIEWPORT_WIDTH,
          height: this.VIEWPORT_HEIGHT
        },
        visibleBounds: bounds
      };
    }
  
    isInViewport(row, col) {
      const bounds = this.getVisibleBounds();
      return row >= bounds.startRow && row < bounds.endRow && 
             col >= bounds.startCol && col < bounds.endCol;
    }
  
    worldToViewport(row, col) {
      return {
        row: row - this.cameraPosition.row,
        col: col - this.cameraPosition.col
      };
    }
  
    viewportToWorld(row, col) {
      return {
        row: row + this.cameraPosition.row,
        col: col + this.cameraPosition.col
      };
    }
  }
  
  // PATHFINDING ALGORITHMS:
  // src/algorithms/pathfinding/component-based-haa-star.js
  const buildComponentGraph = (maze, coloredMaze, SIZE, REGION_SIZE) => {
    const numRegions = SIZE / REGION_SIZE;
    const componentGraph = {};
    
    for (let regionRow = 0; regionRow < numRegions; regionRow++) {
      for (let regionCol = 0; regionCol < numRegions; regionCol++) {
        const startRow = regionRow * REGION_SIZE;
        const startCol = regionCol * REGION_SIZE;
        
        const componentCells = new Map();
        
        for (let r = startRow; r < startRow + REGION_SIZE; r++) {
          for (let c = startCol; c < startCol + REGION_SIZE; c++) {
            if (maze[r][c] === CELL_STATES.WALKABLE) {
              const componentId = coloredMaze[r][c];
              if (componentId !== -1) {
                if (!componentCells.has(componentId)) {
                  componentCells.set(componentId, []);
                }
                componentCells.get(componentId).push({ row: r, col: c });
              }
            }
          }
        }
        
        for (const [componentId, cells] of componentCells) {
          const nodeId = `${regionRow},${regionCol}_${componentId}`;
          componentGraph[nodeId] = {
            regionRow,
            regionCol,
            componentId,
            cells,
            neighbors: [],
            transitions: []
          };
        }
      }
    }
    
    for (let regionRow = 0; regionRow < numRegions; regionRow++) {
      for (let regionCol = 0; regionCol < numRegions; regionCol++) {
        
        if (regionCol < numRegions - 1) {
          const rightRegionRow = regionRow;
          const rightRegionCol = regionCol + 1;
          
          const borderCol = regionCol * REGION_SIZE + REGION_SIZE - 1;
          
          for (let r = regionRow * REGION_SIZE; r < (regionRow + 1) * REGION_SIZE; r++) {
            if (maze[r][borderCol] === CELL_STATES.WALKABLE && maze[r][borderCol + 1] === CELL_STATES.WALKABLE) {
              const leftComponent = coloredMaze[r][borderCol];
              const rightComponent = coloredMaze[r][borderCol + 1];
              
              if (leftComponent !== -1 && rightComponent !== -1) {
                const leftNodeId = `${regionRow},${regionCol}_${leftComponent}`;
                const rightNodeId = `${rightRegionRow},${rightRegionCol}_${rightComponent}`;
                
                if (componentGraph[leftNodeId] && componentGraph[rightNodeId]) {
                  if (!componentGraph[leftNodeId].neighbors.includes(rightNodeId)) {
                    componentGraph[leftNodeId].neighbors.push(rightNodeId);
                    componentGraph[leftNodeId].transitions.push({
                      to: rightNodeId,
                      fromCell: { row: r, col: borderCol },
                      toCell: { row: r, col: borderCol + 1 }
                    });
                  }
                  
                  if (!componentGraph[rightNodeId].neighbors.includes(leftNodeId)) {
                    componentGraph[rightNodeId].neighbors.push(leftNodeId);
                    componentGraph[rightNodeId].transitions.push({
                      to: leftNodeId,
                      fromCell: { row: r, col: borderCol + 1 },
                      toCell: { row: r, col: borderCol }
                    });
                  }
                }
              }
            }
          }
        }
        
        if (regionRow < numRegions - 1) {
          const bottomRegionRow = regionRow + 1;
          const bottomRegionCol = regionCol;
          
          const borderRow = regionRow * REGION_SIZE + REGION_SIZE - 1;
          
          for (let c = regionCol * REGION_SIZE; c < (regionCol + 1) * REGION_SIZE; c++) {
            if (maze[borderRow][c] === CELL_STATES.WALKABLE && maze[borderRow + 1][c] === CELL_STATES.WALKABLE) {
              const topComponent = coloredMaze[borderRow][c];
              const bottomComponent = coloredMaze[borderRow + 1][c];
              
              if (topComponent !== -1 && bottomComponent !== -1) {
                const topNodeId = `${regionRow},${regionCol}_${topComponent}`;
                const bottomNodeId = `${bottomRegionRow},${bottomRegionCol}_${bottomComponent}`;
                
                if (componentGraph[topNodeId] && componentGraph[bottomNodeId]) {
                  if (!componentGraph[topNodeId].neighbors.includes(bottomNodeId)) {
                    componentGraph[topNodeId].neighbors.push(bottomNodeId);
                    componentGraph[topNodeId].transitions.push({
                      to: bottomNodeId,
                      fromCell: { row: borderRow, col: c },
                      toCell: { row: borderRow + 1, col: c }
                    });
                  }
                  
                  if (!componentGraph[bottomNodeId].neighbors.includes(topNodeId)) {
                    componentGraph[bottomNodeId].neighbors.push(topNodeId);
                    componentGraph[bottomNodeId].transitions.push({
                      to: topNodeId,
                      fromCell: { row: borderRow + 1, col: c },
                      toCell: { row: borderRow, col: c }
                    });
                  }
                }
              }
            }
          }
        }
      }
    }
    
    let diagonalConnectionsAdded = 0;
    for (let regionRow = 0; regionRow < numRegions - 1; regionRow++) {
      for (let regionCol = 0; regionCol < numRegions - 1; regionCol++) {
        
        const cornerRow = regionRow * REGION_SIZE + REGION_SIZE - 1;
        const cornerCol = regionCol * REGION_SIZE + REGION_SIZE - 1;
        
        if (maze[cornerRow][cornerCol] === CELL_STATES.WALKABLE && 
            maze[cornerRow + 1][cornerCol + 1] === CELL_STATES.WALKABLE) {
          
          const verticalCell = maze[cornerRow + 1][cornerCol];
          const horizontalCell = maze[cornerRow][cornerCol + 1];
          
          if (verticalCell === CELL_STATES.WALKABLE && horizontalCell === CELL_STATES.WALKABLE) {
            const currentComponent = coloredMaze[cornerRow][cornerCol];
            const diagonalComponent = coloredMaze[cornerRow + 1][cornerCol + 1];
            
            if (currentComponent !== -1 && diagonalComponent !== -1) {
              const currentNodeId = `${regionRow},${regionCol}_${currentComponent}`;
              const diagonalNodeId = `${regionRow + 1},${regionCol + 1}_${diagonalComponent}`;
              
              if (componentGraph[currentNodeId] && componentGraph[diagonalNodeId]) {
                if (!componentGraph[currentNodeId].neighbors.includes(diagonalNodeId)) {
                  componentGraph[currentNodeId].neighbors.push(diagonalNodeId);
                  componentGraph[currentNodeId].transitions.push({
                    to: diagonalNodeId,
                    fromCell: { row: cornerRow, col: cornerCol },
                    toCell: { row: cornerRow + 1, col: cornerCol + 1 }
                  });
                  diagonalConnectionsAdded++;
                }
                
                if (!componentGraph[diagonalNodeId].neighbors.includes(currentNodeId)) {
                  componentGraph[diagonalNodeId].neighbors.push(currentNodeId);
                  componentGraph[diagonalNodeId].transitions.push({
                    to: currentNodeId,
                    fromCell: { row: cornerRow + 1, col: cornerCol + 1 },
                    toCell: { row: cornerRow, col: cornerCol }
                  });
                  diagonalConnectionsAdded++;
                }
              }
            }
          }
        }
        
        if (regionCol > 0) {
          const cornerRow = regionRow * REGION_SIZE + REGION_SIZE - 1;
          const cornerCol = regionCol * REGION_SIZE;
          
          if (maze[cornerRow][cornerCol] === CELL_STATES.WALKABLE && 
              maze[cornerRow + 1][cornerCol - 1] === CELL_STATES.WALKABLE) {
            
            const verticalCell = maze[cornerRow + 1][cornerCol];
            const horizontalCell = maze[cornerRow][cornerCol - 1];
            
            if (verticalCell === CELL_STATES.WALKABLE && horizontalCell === CELL_STATES.WALKABLE) {
              const currentComponent = coloredMaze[cornerRow][cornerCol];
              const diagonalComponent = coloredMaze[cornerRow + 1][cornerCol - 1];
              
              if (currentComponent !== -1 && diagonalComponent !== -1) {
                const currentNodeId = `${regionRow},${regionCol}_${currentComponent}`;
                const diagonalNodeId = `${regionRow + 1},${regionCol - 1}_${diagonalComponent}`;
                
                if (componentGraph[currentNodeId] && componentGraph[diagonalNodeId]) {
                  if (!componentGraph[currentNodeId].neighbors.includes(diagonalNodeId)) {
                    componentGraph[currentNodeId].neighbors.push(diagonalNodeId);
                    componentGraph[currentNodeId].transitions.push({
                      to: diagonalNodeId,
                      fromCell: { row: cornerRow, col: cornerCol },
                      toCell: { row: cornerRow + 1, col: cornerCol - 1 }
                    });
                    diagonalConnectionsAdded++;
                  }
                  
                  if (!componentGraph[diagonalNodeId].neighbors.includes(currentNodeId)) {
                    componentGraph[diagonalNodeId].neighbors.push(currentNodeId);
                    componentGraph[diagonalNodeId].transitions.push({
                      to: currentNodeId,
                      fromCell: { row: cornerRow + 1, col: cornerCol - 1 },
                      toCell: { row: cornerRow, col: cornerCol }
                    });
                    diagonalConnectionsAdded++;
                  }
                }
              }
            }
          }
        }
      }
    }
    
    console.log(`DEBUG: buildComponentGraph added ${diagonalConnectionsAdded} diagonal connections`);
    
    return componentGraph;
  };
  
  const getComponentNodeId = (position, coloredMaze, REGION_SIZE) => {
    const regionRow = Math.floor(position.row / REGION_SIZE);
    const regionCol = Math.floor(position.col / REGION_SIZE);
    const componentId = coloredMaze[position.row][position.col];
    
    if (componentId === -1) {
      return null;
    }
    
    return `${regionRow},${regionCol}_${componentId}`;
  };
  
  const getRegionFromComponentNode = (componentNodeId) => {
    const parts = componentNodeId.split('_');
    return parts[0];
  };
  
  const componentHeuristic = (fromNodeId, toNodeId, heuristicType = 'manhattan') => {
    const fromRegion = getRegionFromComponentNode(fromNodeId);
    const toRegion = getRegionFromComponentNode(toNodeId);
    
    const heuristic = heuristicType === 'chebyshev' ? heuristicStringChebyshev : heuristicString;
    
    return heuristic(fromRegion, toRegion);
  };
  
  const findAbstractComponentPath = (startNodeId, endNodeId, componentGraph, heuristicType = 'manhattan') => {
    let debugInfo = '';
    debugInfo += `\n=== HAA* ABSTRACT PATHFINDING DEBUG ===\n`;
    debugInfo += `Start: ${startNodeId} -> End: ${endNodeId}\n`;
    debugInfo += `Available components: [${Object.keys(componentGraph).join(', ')}]\n`;
    
    if (!componentGraph[startNodeId] || !componentGraph[endNodeId]) {
      debugInfo += `ERROR: Invalid component nodes!\n`;
      debugInfo += `- Start node exists: ${!!componentGraph[startNodeId]}\n`;
      debugInfo += `- End node exists: ${!!componentGraph[endNodeId]}\n`;
      return { path: null, debugInfo: debugInfo };
    }
    
    debugInfo += `Start component neighbors: [${componentGraph[startNodeId].neighbors.join(', ')}]\n`;
    debugInfo += `End component neighbors: [${componentGraph[endNodeId].neighbors.join(', ')}]\n`;
    
    const directConnection = componentGraph[startNodeId].neighbors.includes(endNodeId);
    debugInfo += `Direct connection ${startNodeId} -> ${endNodeId}: ${directConnection}\n`;
    
    if (startNodeId === endNodeId) {
      debugInfo += `Same component - returning direct path: [${startNodeId}]\n`;
      return { path: [startNodeId], debugInfo: debugInfo };
    }
    
    const openSet = [startNodeId];
    const closedSet = new Set();
    const cameFrom = {};
    const gScore = { [startNodeId]: 0 };
    const fScore = { [startNodeId]: componentHeuristic(startNodeId, endNodeId, heuristicType) };
    
    debugInfo += `\n--- A* Search Steps ---\n`;
    let iteration = 0;
    
    while (openSet.length > 0) {
      iteration++;
      let current = openSet.reduce((min, node) => 
        fScore[node] < fScore[min] ? node : min
      );
      
      debugInfo += `Step ${iteration}: Current=${current}, OpenSet=[${openSet.join(', ')}]\n`;
      
      if (current === endNodeId) {
        const path = [];
        let pathCurrent = current;
        while (pathCurrent) {
          path.unshift(pathCurrent);
          pathCurrent = cameFrom[pathCurrent];
        }
        debugInfo += `SUCCESS: Path found = [${path.join(' -> ')}]\n`;
        return { path: path, debugInfo: debugInfo };
      }
      
      openSet.splice(openSet.indexOf(current), 1);
      closedSet.add(current);
      
      debugInfo += `  Processing neighbors of ${current}: [${componentGraph[current].neighbors.join(', ')}]\n`;
      
      for (const neighbor of componentGraph[current].neighbors) {
        if (closedSet.has(neighbor)) {
          debugInfo += `    ${neighbor}: SKIPPED (in closed set)\n`;
          continue;
        }
        
        const tentativeGScore = gScore[current] + 1;
        
        if (gScore[neighbor] === undefined || tentativeGScore < gScore[neighbor]) {
          cameFrom[neighbor] = current;
          gScore[neighbor] = tentativeGScore;
          fScore[neighbor] = gScore[neighbor] + componentHeuristic(neighbor, endNodeId, heuristicType);
          
          if (!openSet.includes(neighbor)) {
            openSet.push(neighbor);
            debugInfo += `    ${neighbor}: ADDED to openSet (g=${gScore[neighbor]}, f=${fScore[neighbor]})\n`;
          } else {
            debugInfo += `    ${neighbor}: UPDATED (g=${gScore[neighbor]}, f=${fScore[neighbor]})\n`;
          }
        } else {
          debugInfo += `    ${neighbor}: SKIPPED (worse path)\n`;
        }
      }
    }
    
    debugInfo += `FAILURE: No path found after ${iteration} iterations\n`;
    debugInfo += `Final openSet: [${openSet.join(', ')}]\n`;
    debugInfo += `Final closedSet: [${Array.from(closedSet).join(', ')}]\n`;
    return { path: null, debugInfo: debugInfo };
  };
  
  const findPathWithinComponent = (start, end, maze, SIZE, componentCells, heuristicType = 'manhattan') => {
    let debugInfo = '';
    debugInfo += `\n--- WITHIN COMPONENT PATHFINDING DEBUG ---\n`;
    debugInfo += `Start: (${start.row}, ${start.col}), End: (${end.row}, ${end.col})\n`;
    debugInfo += `Component has ${componentCells.length} cells\n`;
    
    const heuristic = heuristicType === 'chebyshev' ? heuristicObjectChebyshev : heuristicObject;
    
    const validCells = new Set();
    for (const cell of componentCells) {
      validCells.add(`${cell.row},${cell.col}`);
    }
    
    const sampleCells = componentCells.slice(0, 10).map(c => `(${c.row},${c.col})`);
    debugInfo += `Sample component cells: [${sampleCells.join(', ')}${componentCells.length > 10 ? '...' : ''}]\n`;
    
    const startInComponent = validCells.has(`${start.row},${start.col}`);
    debugInfo += `Start (${start.row}, ${start.col}) in component: ${startInComponent}\n`;
    
    if (!startInComponent) {
      debugInfo += `FAILURE: Start position not in component!\n`;
      return { path: null, debugInfo: debugInfo };
    }
    
    let actualEnd = end;
    const endInComponent = validCells.has(`${end.row},${end.col}`);
    debugInfo += `End (${end.row}, ${end.col}) in component: ${endInComponent}\n`;
    
    if (!endInComponent) {
      debugInfo += `End not in component, finding closest cell...\n`;
      let minDistance = Infinity;
      for (const cell of componentCells) {
        const distance = Math.abs(cell.row - end.row) + Math.abs(cell.col - end.col);
        if (distance < minDistance) {
          minDistance = distance;
          actualEnd = cell;
        }
      }
      debugInfo += `Closest cell to end: (${actualEnd.row}, ${actualEnd.col}), distance: ${minDistance}\n`;
    } else {
      debugInfo += `Using original end position: (${actualEnd.row}, ${actualEnd.col})\n`;
    }
    
    const openSet = [start];
    const cameFrom = {};
    const gScore = { [getKey(start)]: 0 };
    const fScore = { [getKey(start)]: heuristic(start, actualEnd) };
    
    while (openSet.length > 0) {
      let current = openSet.reduce((min, node) => 
        fScore[getKey(node)] < fScore[getKey(min)] ? node : min
      );
      
      if (current.row === actualEnd.row && current.col === actualEnd.col) {
        const path = [];
        while (current) {
          path.unshift(current);
          current = cameFrom[getKey(current)];
        }
        debugInfo += `SUCCESS: Found path with ${path.length} steps\n`;
        debugInfo += `Path: [${path.slice(0, 5).map(p => `(${p.row},${p.col})`).join(' -> ')}${path.length > 5 ? '...' : ''}]\n`;
        return { path, actualEnd, debugInfo: debugInfo };
      }
      
      openSet.splice(openSet.findIndex(n => n.row === current.row && n.col === current.col), 1);
      
      const neighbors = [
        { row: current.row - 1, col: current.col, cost: 1.0 },
        { row: current.row + 1, col: current.col, cost: 1.0 },
        { row: current.row, col: current.col - 1, cost: 1.0 },
        { row: current.row, col: current.col + 1, cost: 1.0 },
        
        { row: current.row - 1, col: current.col - 1, cost: Math.SQRT2 },
        { row: current.row - 1, col: current.col + 1, cost: Math.SQRT2 },
        { row: current.row + 1, col: current.col - 1, cost: Math.SQRT2 },
        { row: current.row + 1, col: current.col + 1, cost: Math.SQRT2 }
      ];
      
      for (const neighbor of neighbors) {
        if (neighbor.row < 0 || neighbor.row >= SIZE || 
            neighbor.col < 0 || neighbor.col >= SIZE ||
            maze[neighbor.row][neighbor.col] === CELL_STATES.WALL ||
            maze[neighbor.row][neighbor.col] === CELL_STATES.UNKNOWN) {
          continue;
        }
        
        if (!validCells.has(`${neighbor.row},${neighbor.col}`)) {
          continue;
        }
        
        const tentativeGScore = gScore[getKey(current)] + neighbor.cost;
        const neighborKey = getKey(neighbor);
        
        if (gScore[neighborKey] === undefined || tentativeGScore < gScore[neighborKey]) {
          cameFrom[neighborKey] = current;
          gScore[neighborKey] = tentativeGScore;
          fScore[neighborKey] = gScore[neighborKey] + heuristic(neighbor, actualEnd);
          
          if (!openSet.some(n => n.row === neighbor.row && n.col === neighbor.col)) {
            openSet.push(neighbor);
          }
        }
      }
    }
    
    debugInfo += `FAILURE: No path found within component!\n`;
    debugInfo += `OpenSet exhausted, no more cells to explore\n`;
    return { path: null, actualEnd: null, debugInfo: debugInfo };
  };
  
  const findComponentBasedHAAStarPath = (start, end, maze, componentGraph, coloredMaze, REGION_SIZE, SIZE, heuristicType = 'manhattan') => {
    const startTime = performance.now();
    
    const startNodeId = getComponentNodeId(start, coloredMaze, REGION_SIZE);
    const endNodeId = getComponentNodeId(end, coloredMaze, REGION_SIZE);
    
    let debugInfo = '';
    debugInfo += `HAA* DEBUG: start=(${start.row},${start.col}) -> ${startNodeId}, end=(${end.row},${end.col}) -> ${endNodeId}\n`;
    
    if (!startNodeId || !endNodeId) {
      debugInfo += 'HAA* DEBUG: Invalid start or end node ID\n';
      return { abstractPath: null, detailedPath: null , debugInfo: debugInfo};
    }
    
    const abstractComponentPathResult = findAbstractComponentPath(startNodeId, endNodeId, componentGraph, heuristicType);
    const abstractComponentPath = abstractComponentPathResult.path;
    debugInfo += abstractComponentPathResult.debugInfo;
    
    if (!abstractComponentPath) {
      return { abstractPath: null, detailedPath: null , debugInfo: debugInfo};
    }
    
    debugInfo += `\n=== HAA* DETAILED PATHFINDING DEBUG ===\n`;
    debugInfo += `Abstract path: [${abstractComponentPath.join(' -> ')}]\n`;
    debugInfo += `Start position: (${start.row}, ${start.col})\n`;
    debugInfo += `End position: (${end.row}, ${end.col})\n`;
    
    const detailedPath = [];
    let currentPos = start;
    let finalActualEnd = end;
    
    for (let i = 0; i < abstractComponentPath.length; i++) {
      const currentComponentNodeId = abstractComponentPath[i];
      const currentComponent = componentGraph[currentComponentNodeId];
      
      debugInfo += `\n--- Processing Component ${i + 1}/${abstractComponentPath.length}: ${currentComponentNodeId} ---\n`;
      debugInfo += `Current position: (${currentPos.row}, ${currentPos.col})\n`;
      debugInfo += `Component has ${currentComponent.cells.length} cells\n`;
      debugInfo += `Component transitions: [${currentComponent.transitions.map(t => t.to).join(', ')}]\n`;
      
      if (i === abstractComponentPath.length - 1) {
        debugInfo += `FINAL COMPONENT: Pathing from (${currentPos.row}, ${currentPos.col}) to (${end.row}, ${end.col})\n`;
        
        const pathResult = findPathWithinComponent(currentPos, end, maze, SIZE, currentComponent.cells, heuristicType);
        
        debugInfo += `Path within component result: ${pathResult.path ? `${pathResult.path.length} steps` : 'null'}\n`;
        
        if (pathResult && pathResult.path && pathResult.path.length > 0) {
          let startIndex = 0;
          if (detailedPath.length > 0 && pathResult.path.length > 0) {
            const lastCell = detailedPath[detailedPath.length - 1];
            const firstCell = pathResult.path[0];
            if (lastCell.row === firstCell.row && lastCell.col === firstCell.col) {
              startIndex = 1;
              debugInfo += `Skipping duplicate first cell (${firstCell.row}, ${firstCell.col})\n`;
            }
          }
          detailedPath.push(...pathResult.path.slice(startIndex));
          finalActualEnd = pathResult.actualEnd;
          debugInfo += `SUCCESS: Added ${pathResult.path.slice(startIndex).length} cells to detailed path\n`;
          debugInfo += `Total detailed path length: ${detailedPath.length}\n`;
        } else {
          if (!pathResult.debugInfo) {
            throw new Error(`CRITICAL: pathResult.debugInfo is undefined for final component pathfinding from (${currentPos.row}, ${currentPos.col}) to (${end.row}, ${end.col})`);
          }
          debugInfo += `FAILURE: No path within final component! See debug info below:\n`;
          debugInfo += pathResult.debugInfo;
          return { abstractPath: abstractComponentPath, detailedPath: null, debugInfo: debugInfo };
        }
        
      } else {
        const nextComponentNodeId = abstractComponentPath[i + 1];
        
        debugInfo += `INTERMEDIATE COMPONENT: Finding transition to ${nextComponentNodeId}\n`;
        
        const transition = currentComponent.transitions.find(t => t.to === nextComponentNodeId);
        
        if (!transition) {
          debugInfo += `FAILURE: No transition found from ${currentComponentNodeId} to ${nextComponentNodeId}!\n`;
          debugInfo += `Available transitions: [${currentComponent.transitions.map(t => `${t.to} via (${t.fromCell.row},${t.fromCell.col})->(${t.toCell.row},${t.toCell.col})`).join(', ')}]\n`;
          return { abstractPath: abstractComponentPath, detailedPath: null ,debugInfo: debugInfo};
        }
        
        debugInfo += `Found transition: (${transition.fromCell.row}, ${transition.fromCell.col}) -> (${transition.toCell.row}, ${transition.toCell.col})\n`;
        
        debugInfo += `Pathing from (${currentPos.row}, ${currentPos.col}) to transition point (${transition.fromCell.row}, ${transition.fromCell.col})\n`;
        
        const pathResult = findPathWithinComponent(currentPos, transition.fromCell, maze, SIZE, currentComponent.cells, heuristicType);
        
        debugInfo += `Path to transition result: ${pathResult.path ? `${pathResult.path.length} steps` : 'null'}\n`;
        
        if (pathResult && pathResult.path && pathResult.path.length > 0) {
          let startIndex = 0;
          if (detailedPath.length > 0 && pathResult.path.length > 0) {
            const lastCell = detailedPath[detailedPath.length - 1];
            const firstCell = pathResult.path[0];
            if (lastCell.row === firstCell.row && lastCell.col === firstCell.col) {
              startIndex = 1;
              debugInfo += `Skipping duplicate first cell (${firstCell.row}, ${firstCell.col})\n`;
            }
          }
          detailedPath.push(...pathResult.path.slice(startIndex));
          debugInfo += `Added ${pathResult.path.slice(startIndex).length} cells to detailed path\n`;
          
          currentPos = transition.toCell;
          debugInfo += `Moving through transition to (${currentPos.row}, ${currentPos.col})\n`;
          
          const lastCell = detailedPath[detailedPath.length - 1];
          if (!(lastCell.row === currentPos.row && lastCell.col === currentPos.col)) {
            detailedPath.push(currentPos);
            debugInfo += `Added transition cell (${currentPos.row}, ${currentPos.col})\n`;
          } else {
            debugInfo += `Transition cell already in path\n`;
          }
          
          debugInfo += `Current detailed path length: ${detailedPath.length}\n`;
          
        } else {
          debugInfo += `FAILURE: No path to transition point within component!\n`;
          return { abstractPath: abstractComponentPath, detailedPath: null ,debugInfo: debugInfo };
        }
      }
    }
    
    debugInfo += `\n=== HAA* DETAILED PATHFINDING SUCCESS ===\n`;
    debugInfo += `Total detailed path length: ${detailedPath.length}\n`;
    debugInfo += `Path: [${detailedPath.map(p => `(${p.row},${p.col})`).slice(0, 10).join(' -> ')}${detailedPath.length > 10 ? '...' : ''}]\n`;
    
    const endTime = performance.now();
    
    return { 
      abstractPath: abstractComponentPath, 
      detailedPath,
      actualEnd: finalActualEnd,
      executionTime: endTime - startTime,
      debugInfo: debugInfo
    };
  };
  
  const componentBasedHAAStarAlgorithm = createAlgorithm({
    name: 'Component-Based Hierarchical A*',
    type: 'pathfinding',
    description: 'Hierarchical A* using component-based abstraction for efficient pathfinding',
    parameters: {
      regionSize: numberParam(4, 16, DEFAULT_REGION_SIZE, 4),
      heuristicWeight: numberParam(1, 2, 1, 0.1),
      heuristicType: selectParam(['manhattan', 'chebyshev'], 'manhattan')
    },
    
    async execute(input, options, onProgress) {
      const { maze, coloredMaze, componentGraph, start, end, SIZE = 256 } = input;
      const { regionSize = DEFAULT_REGION_SIZE, heuristicType = 'manhattan' } = options;
      
      const startTime = performance.now();
      
      const result = findComponentBasedHAAStarPath(
        start, 
        end, 
        maze, 
        componentGraph, 
        coloredMaze, 
        regionSize, 
        SIZE,
        heuristicType
      );
      
      const endTime = performance.now();
      
      if (onProgress) {
        onProgress({
          type: 'pathfinding_complete',
          abstractPath: result.abstractPath,
          detailedPath: result.detailedPath,
          executionTime: endTime - startTime
        });
      }
      
      return createAlgorithmResult(
        {
          abstractPath: result.abstractPath,
          detailedPath: result.detailedPath,
          success: result.detailedPath !== null
        },
        {
          executionTime: endTime - startTime,
          pathLength: result.detailedPath ? result.detailedPath.length : 0,
          abstractPathLength: result.abstractPath ? result.abstractPath.length : 0,
          componentsTraversed: result.abstractPath ? result.abstractPath.length : 0
        }
      );
    }
  });
  
  // EXPLORATION ALGORITHMS:
  // src/algorithms/exploration/pathfinding-utils.js
  const knownMapAreaToString = (knownMap, centerPos, radius = 10, robotPos = null, targetPos = null) => {
    const SIZE = knownMap.length;
    const { row: centerRow, col: centerCol } = centerPos;
    
    let debugInfo = '';
    debugInfo += `\n=== KNOWN MAP AREA (${radius}x${radius} around ${centerRow},${centerCol}) ===\n`;
    
    let header = '    ';
    for (let c = centerCol - radius; c <= centerCol + radius; c++) {
      if (c >= 0 && c < SIZE) {
        header += (c % 10).toString();
      } else {
        header += ' ';
      }
    }
    debugInfo += header + '\n';
    
    for (let r = centerRow - radius; r <= centerRow + radius; r++) {
      if (r < 0 || r >= SIZE) continue;
      
      let line = `${r.toString().padStart(3, ' ')} `;
      
      for (let c = centerCol - radius; c <= centerCol + radius; c++) {
        if (c < 0 || c >= SIZE) {
          line += ' ';
          continue;
        }
        
        if (robotPos && r === robotPos.row && c === robotPos.col) {
          line += 'R';
        } else if (targetPos && r === targetPos.row && c === targetPos.col) {
          line += 'T';
        } else {
          const cellState = knownMap[r][c];
          switch (cellState) {
            case CELL_STATES.WALKABLE:
              line += '.';
              break;
            case CELL_STATES.WALL:
              line += '#';
              break;
            case CELL_STATES.UNKNOWN:
              line += '?';
              break;
            default:
              line += `${cellState}`;
          }
        }
      }
      debugInfo += line + '\n';
    }
    
    debugInfo += 'Legend: R=Robot, T=Target, .=Walkable, #=Wall, ?=Unknown\n';
    debugInfo += '===================================================\n';
    
    return debugInfo;
  };
  
  const groundTruthAreaToString = (fullMaze, centerPos, radius = 10, robotPos = null, targetPos = null) => {
    const SIZE = fullMaze.length;
    const { row: centerRow, col: centerCol } = centerPos;
    
    let debugInfo = '';
    debugInfo += `\n=== GROUND TRUTH MAZE (${radius}x${radius} around ${centerRow},${centerCol}) ===\n`;
    
    let header = '    ';
    for (let c = centerCol - radius; c <= centerCol + radius; c++) {
      if (c >= 0 && c < SIZE) {
        header += (c % 10).toString();
      } else {
        header += ' ';
      }
    }
    debugInfo += header + '\n';
    
    for (let r = centerRow - radius; r <= centerRow + radius; r++) {
      if (r < 0 || r >= SIZE) continue;
      
      let line = `${r.toString().padStart(3, ' ')} `;
      
      for (let c = centerCol - radius; c <= centerCol + radius; c++) {
        if (c < 0 || c >= SIZE) {
          line += ' ';
          continue;
        }
        
        if (robotPos && r === robotPos.row && c === robotPos.col) {
          line += 'R';
        } else if (targetPos && r === targetPos.row && c === targetPos.col) {
          line += 'T';
        } else {
          const cellState = fullMaze[r][c];
          switch (cellState) {
            case 0:
              line += '.';
              break;
            case 1:
              line += '#';
              break;
            default:
              line += `${cellState}`;
          }
        }
      }
      debugInfo += line + '\n';
    }
    
    debugInfo += 'Legend: R=Robot, T=Target, .=Walkable, #=Wall\n';
    debugInfo += '================================================\n';
    
    return debugInfo;
  };
  
  const coloredMazeAreaToString = (coloredMaze, centerPos, radius = 10, robotPos = null, targetPos = null) => {
    const SIZE = coloredMaze.length;
    const { row: centerRow, col: centerCol } = centerPos;
    
    let debugInfo = '';
    debugInfo += `\n=== COLORED MAZE (Component IDs) (${radius}x${radius} around ${centerRow},${centerCol}) ===\n`;
    
    let header = '    ';
    for (let c = centerCol - radius; c <= centerCol + radius; c++) {
      if (c >= 0 && c < SIZE) {
        header += (c % 10).toString();
      } else {
        header += ' ';
      }
    }
    debugInfo += header + '\n';
    
    for (let r = centerRow - radius; r <= centerRow + radius; r++) {
      if (r < 0 || r >= SIZE) continue;
      
      let line = `${r.toString().padStart(3, ' ')} `;
      
      for (let c = centerCol - radius; c <= centerCol + radius; c++) {
        if (c < 0 || c >= SIZE) {
          line += ' ';
          continue;
        }
        
        if (robotPos && r === robotPos.row && c === robotPos.col) {
          line += 'R';
        } else if (targetPos && r === targetPos.row && c === targetPos.col) {
          line += 'T';
        } else {
          const componentId = coloredMaze[r][c];
          if (componentId === -1) {
            line += '.';
          } else if (componentId < 10) {
            line += componentId.toString();
          } else {
            line += '*';
          }
        }
      }
      debugInfo += line + '\n';
    }
    
    debugInfo += 'Legend: R=Robot, T=Target, 0-9=Component ID, .=No Component, *=ID>9\n';
    debugInfo += '=================================================================\n';
    
    return debugInfo;
  };
  
  const sensorCoverageToString = (fullMaze, knownMap, robotPos, sensorRange, sensorPositions = [], radius = 10, targetPos = null) => {
    const SIZE = fullMaze.length;
    const { row: centerRow, col: centerCol } = robotPos;
    
    let debugInfo = '';
    debugInfo += `\n=== SENSOR COVERAGE (Range: ${sensorRange}) (${radius}x${radius} around ${centerRow},${centerCol}) ===\n`;
    
    const sensorSet = new Set(sensorPositions.map(pos => `${pos.row},${pos.col}`));
    
    let header = '    ';
    for (let c = centerCol - radius; c <= centerCol + radius; c++) {
      if (c >= 0 && c < SIZE) {
        header += (c % 10).toString();
      } else {
        header += ' ';
      }
    }
    debugInfo += header + '\n';
    
    for (let r = centerRow - radius; r <= centerRow + radius; r++) {
      if (r < 0 || r >= SIZE) continue;
      
      let line = `${r.toString().padStart(3, ' ')} `;
      
      for (let c = centerCol - radius; c <= centerCol + radius; c++) {
        if (c < 0 || c >= SIZE) {
          line += ' ';
          continue;
        }
        
        if (r === robotPos.row && c === robotPos.col) {
          line += 'R';
        } else if (targetPos && r === targetPos.row && c === targetPos.col) {
          line += 'T';
        } else if (sensorSet.has(`${r},${c}`)) {
          const actualState = fullMaze[r][c];
          const knownState = knownMap[r][c];
          if (knownState === CELL_STATES.UNKNOWN) {
            line += 'S';
          } else if (actualState === 0) {
            line += 's';
          } else {
            line += '#';
          }
        } else {
          const distance = Math.sqrt(Math.pow(r - robotPos.row, 2) + Math.pow(c - robotPos.col, 2));
          if (distance <= sensorRange) {
            line += '~';
          } else {
            const actualState = fullMaze[r][c];
            if (actualState === 0) {
              line += '.';
            } else {
              line += '#';
            }
          }
        }
      }
      debugInfo += line + '\n';
    }
    
    debugInfo += 'Legend: R=Robot, T=Target, s=Sensed Walkable, S=Sensed Unknown, ~=In Range (No LOS), .=Out of Range Walkable, #=Wall\n';
    debugInfo += '=======================================================================================================\n';
    
    return debugInfo;
  };
  
  const componentConnectivityToString = (componentGraph, robotComponent, targetComponent) => {
    let debugInfo = '';
    debugInfo += `\n=== COMPONENT CONNECTIVITY ANALYSIS ===\n`;
    debugInfo += `Robot Component: ${robotComponent || 'NONE'}\n`;
    debugInfo += `Target Component: ${targetComponent || 'NONE'}\n`;
    
    if (!robotComponent || !targetComponent) {
      debugInfo += 'Cannot analyze connectivity - missing component assignments\n';
      debugInfo += '==========================================\n';
  
      return debugInfo;
    }
    
    debugInfo += `\n--- Robot Component (${robotComponent}) Details ---\n`;
    const robotNode = componentGraph[robotComponent];
    if (robotNode) {
      debugInfo += `Cells: ${robotNode.cells.length}\n`;
      debugInfo += `Neighbors: [${robotNode.neighbors.join(', ')}]\n`;
      debugInfo += `Transitions:\n`;
      robotNode.transitions.forEach((trans, i) => {
        debugInfo += `  ${i + 1}. To ${trans.to}: (${trans.fromCell.row},${trans.fromCell.col}) -> (${trans.toCell.row},${trans.toCell.col})\n`;
      });
    } else {
      debugInfo += 'ERROR: Robot component not found in graph!\n';
    }
    
    debugInfo += `\n--- Target Component (${targetComponent}) Details ---\n`;
    const targetNode = componentGraph[targetComponent];
    if (targetNode) {
      debugInfo += `Cells: ${targetNode.cells.length}\n`;
      debugInfo += `Neighbors: [${targetNode.neighbors.join(', ')}]\n`;
      debugInfo += `Transitions:\n`;
      targetNode.transitions.forEach((trans, i) => {
        debugInfo += `  ${i + 1}. To ${trans.to}: (${trans.fromCell.row},${trans.fromCell.col}) -> (${trans.toCell.row},${trans.toCell.col})\n`;
      });
    } else {
      debugInfo += 'ERROR: Target component not found in graph!\n';
    }
    
    const directlyConnected = robotNode && robotNode.neighbors.includes(targetComponent);
    debugInfo += `\n--- Connectivity Status ---\n`;
    debugInfo += `Directly Connected: ${directlyConnected ? 'YES' : 'NO'}\n`;
    
    if (!directlyConnected && robotNode && targetNode) {
      debugInfo += '\n--- Potential Path Analysis ---\n';
      const visited = new Set();
      const queue = [{component: robotComponent, path: [robotComponent]}];
      let foundPath = false;
      
      while (queue.length > 0 && !foundPath) {
        const {component, path} = queue.shift();
        
        if (component === targetComponent) {
          debugInfo += `Found path: ${path.join(' -> ')}\n`;
          foundPath = true;
          break;
        }
        
        if (visited.has(component)) continue;
        visited.add(component);
        
        const node = componentGraph[component];
        if (node) {
          for (const neighbor of node.neighbors) {
            if (!visited.has(neighbor) && path.length < 10) {
              queue.push({component: neighbor, path: [...path, neighbor]});
            }
          }
        }
      }
      
      if (!foundPath) {
        debugInfo += 'No path found between robot and target components!\n';
      }
    }
    
    debugInfo += '==========================================\n';
    return debugInfo;
  };
  
  const checkSimplePathExists = (start, goal, knownMap) => {
    const SIZE = knownMap.length;
    const queue = [start];
    const visited = new Set();
    visited.add(`${start.row},${start.col}`);
    
    while (queue.length > 0) {
      const current = queue.shift();
      
      if (current.row === goal.row && current.col === goal.col) {
        return true;
      }
      
      const neighbors = [
        { row: current.row - 1, col: current.col },
        { row: current.row + 1, col: current.col },
        { row: current.row, col: current.col - 1 },
        { row: current.row, col: current.col + 1 }
      ];
      
      for (const neighbor of neighbors) {
        if (neighbor.row >= 0 && neighbor.row < SIZE &&
            neighbor.col >= 0 && neighbor.col < SIZE &&
            knownMap[neighbor.row][neighbor.col] === CELL_STATES.WALKABLE &&
            !visited.has(`${neighbor.row},${neighbor.col}`)) {
          visited.add(`${neighbor.row},${neighbor.col}`);
          queue.push(neighbor);
        }
      }
    }
    
    return false;
  };
  
  const debugSimpleAStar = (start, goal, knownMap) => {
    const SIZE = knownMap.length;
    const openSet = [start];
    const closedSet = new Set();
    const gScore = new Map();
    const fScore = new Map();
    const cameFrom = new Map();
    
    const getKey = (pos) => `${pos.row},${pos.col}`;
    const heuristic = (a, b) => Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
    
    gScore.set(getKey(start), 0);
    fScore.set(getKey(start), heuristic(start, goal));
    
    while (openSet.length > 0) {
      openSet.sort((a, b) => (fScore.get(getKey(a)) || Infinity) - (fScore.get(getKey(b)) || Infinity));
      const current = openSet.shift();
      const currentKey = getKey(current);
      
      if (current.row === goal.row && current.col === goal.col) {
        const path = [];
        let pathCurrent = current;
        while (pathCurrent) {
          path.unshift(pathCurrent);
          pathCurrent = cameFrom.get(getKey(pathCurrent));
        }
        return path;
      }
      
      closedSet.add(currentKey);
      
      const neighbors = [
        { row: current.row - 1, col: current.col },
        { row: current.row + 1, col: current.col },
        { row: current.row, col: current.col - 1 },
        { row: current.row, col: current.col + 1 }
      ];
      
      for (const neighbor of neighbors) {
        if (neighbor.row < 0 || neighbor.row >= SIZE || 
            neighbor.col < 0 || neighbor.col >= SIZE ||
            knownMap[neighbor.row][neighbor.col] !== CELL_STATES.WALKABLE ||
            closedSet.has(getKey(neighbor))) {
          continue;
        }
        
        const tentativeGScore = (gScore.get(currentKey) || Infinity) + 1;
        const neighborKey = getKey(neighbor);
        
        if (!openSet.some(n => getKey(n) === neighborKey)) {
          openSet.push(neighbor);
        } else if (tentativeGScore >= (gScore.get(neighborKey) || Infinity)) {
          continue;
        }
        
        cameFrom.set(neighborKey, current);
        gScore.set(neighborKey, tentativeGScore);
        fScore.set(neighborKey, tentativeGScore + heuristic(neighbor, goal));
      }
    }
    
    return null;
  };
  
  const findComponentPath = (start, goal, knownMap, componentGraph, coloredMaze, REGION_SIZE) => {
    const SIZE = knownMap.length;
    
    const result = findComponentBasedHAAStarPath(
      start, 
      goal, 
      knownMap, 
      componentGraph, 
      coloredMaze, 
      REGION_SIZE, 
      SIZE
    );
    
    return { path: result.detailedPath, actualEnd: result.actualEnd };
  };
  
  // src/algorithms/exploration/component-structure.js
  const updateComponentStructure = (knownMap, componentGraph, coloredMaze, newCells, REGION_SIZE) => {
    const SIZE = knownMap.length;
    const numRegions = SIZE / REGION_SIZE;
    
    const regionsToUpdate = new Set();
    
    for (const newCell of newCells) {
      if (newCell.newState === CELL_STATES.WALKABLE) {
        const regionRow = Math.floor(newCell.row / REGION_SIZE);
        const regionCol = Math.floor(newCell.col / REGION_SIZE);
        regionsToUpdate.add(`${regionRow},${regionCol}`);
      }
    }
    
    const newComponentGraph = { ...componentGraph };
    const newColoredMaze = coloredMaze.map(row => [...row]);
    
    for (const regionKey of regionsToUpdate) {
      const [regionRow, regionCol] = regionKey.split(',').map(Number);
      const startRow = regionRow * REGION_SIZE;
      const startCol = regionCol * REGION_SIZE;
      
      Object.keys(newComponentGraph).forEach(nodeId => {
        if (nodeId.startsWith(`${regionRow},${regionCol}_`)) {
          delete newComponentGraph[nodeId];
        }
      });
      
      for (let r = startRow; r < startRow + REGION_SIZE; r++) {
        for (let c = startCol; c < startCol + REGION_SIZE; c++) {
          if (r < SIZE && c < SIZE) {
            newColoredMaze[r][c] = -1;
          }
        }
      }
      
      const components = findConnectedComponents(knownMap, startRow, startCol, REGION_SIZE);
      
      components.forEach((component, componentId) => {
        if (component.length === 0) return;
        
        const nodeId = `${regionRow},${regionCol}_${componentId}`;
        newComponentGraph[nodeId] = {
          regionRow,
          regionCol,
          componentId,
          cells: component,
          neighbors: [],
          transitions: []
        };
        
        component.forEach(cell => {
          newColoredMaze[cell.row][cell.col] = componentId;
        });
      });
    }
    
    for (const nodeId of Object.keys(newComponentGraph)) {
      newComponentGraph[nodeId].neighbors = [];
      newComponentGraph[nodeId].transitions = [];
    }
    
    let connectionsBuilt = 0;
    
    for (let regionRow = 0; regionRow < numRegions; regionRow++) {
      for (let regionCol = 0; regionCol < numRegions; regionCol++) {
      
      if (regionCol < numRegions - 1) {
        const rightRegionRow = regionRow;
        const rightRegionCol = regionCol + 1;
        const borderCol = regionCol * REGION_SIZE + REGION_SIZE - 1;
        
        for (let r = regionRow * REGION_SIZE; r < (regionRow + 1) * REGION_SIZE; r++) {
          if (r >= 0 && r < SIZE && borderCol >= 0 && borderCol < SIZE - 1 && 
              knownMap[r] && knownMap[r][borderCol] === CELL_STATES.WALKABLE && 
              knownMap[r][borderCol + 1] === CELL_STATES.WALKABLE) {
            
            const leftComponent = newColoredMaze[r][borderCol];
            const rightComponent = newColoredMaze[r][borderCol + 1];
            
            if (leftComponent !== -1 && rightComponent !== -1) {
              const leftNodeId = `${regionRow},${regionCol}_${leftComponent}`;
              const rightNodeId = `${rightRegionRow},${rightRegionCol}_${rightComponent}`;
              
              if (newComponentGraph[leftNodeId] && newComponentGraph[rightNodeId] && 
                  leftNodeId !== rightNodeId) {
                
                if (!newComponentGraph[leftNodeId].neighbors.includes(rightNodeId)) {
                  newComponentGraph[leftNodeId].neighbors.push(rightNodeId);
                  newComponentGraph[leftNodeId].transitions.push({
                    to: rightNodeId,
                    fromCell: { row: r, col: borderCol },
                    toCell: { row: r, col: borderCol + 1 }
                  });
                  connectionsBuilt++;
                }
                
                if (!newComponentGraph[rightNodeId].neighbors.includes(leftNodeId)) {
                  newComponentGraph[rightNodeId].neighbors.push(leftNodeId);
                  newComponentGraph[rightNodeId].transitions.push({
                    to: leftNodeId,
                    fromCell: { row: r, col: borderCol + 1 },
                    toCell: { row: r, col: borderCol }
                  });
                  connectionsBuilt++;
                }
              }
            }
          }
        }
      }
      
      if (regionCol > 0) {
        const leftRegionRow = regionRow;
        const leftRegionCol = regionCol - 1;
        const borderCol = regionCol * REGION_SIZE;
        
        for (let r = regionRow * REGION_SIZE; r < (regionRow + 1) * REGION_SIZE; r++) {
          if (r >= 0 && r < SIZE && borderCol > 0 && borderCol < SIZE && 
              knownMap[r] && knownMap[r][borderCol] === CELL_STATES.WALKABLE && 
              knownMap[r][borderCol - 1] === CELL_STATES.WALKABLE) {
            
            const rightComponent = newColoredMaze[r][borderCol];
            const leftComponent = newColoredMaze[r][borderCol - 1];
            
            if (leftComponent !== -1 && rightComponent !== -1) {
              const rightNodeId = `${regionRow},${regionCol}_${rightComponent}`;
              const leftNodeId = `${leftRegionRow},${leftRegionCol}_${leftComponent}`;
              
              if (newComponentGraph[rightNodeId] && newComponentGraph[leftNodeId] && 
                  rightNodeId !== leftNodeId) {
                
                if (!newComponentGraph[rightNodeId].neighbors.includes(leftNodeId)) {
                  newComponentGraph[rightNodeId].neighbors.push(leftNodeId);
                  newComponentGraph[rightNodeId].transitions.push({
                    to: leftNodeId,
                    fromCell: { row: r, col: borderCol },
                    toCell: { row: r, col: borderCol - 1 }
                  });
                }
                
                if (!newComponentGraph[leftNodeId].neighbors.includes(rightNodeId)) {
                  newComponentGraph[leftNodeId].neighbors.push(rightNodeId);
                  newComponentGraph[leftNodeId].transitions.push({
                    to: rightNodeId,
                    fromCell: { row: r, col: borderCol - 1 },
                    toCell: { row: r, col: borderCol }
                  });
                }
              }
            }
          }
        }
      }
      
      if (regionRow < numRegions - 1) {
        const bottomRegionRow = regionRow + 1;
        const bottomRegionCol = regionCol;
        const borderRow = regionRow * REGION_SIZE + REGION_SIZE - 1;
        
        for (let c = regionCol * REGION_SIZE; c < (regionCol + 1) * REGION_SIZE; c++) {
          if (c >= 0 && c < SIZE && borderRow >= 0 && borderRow < SIZE - 1 && 
              knownMap[borderRow] && knownMap[borderRow][c] === CELL_STATES.WALKABLE && 
              knownMap[borderRow + 1] && knownMap[borderRow + 1][c] === CELL_STATES.WALKABLE) {
            
            const topComponent = newColoredMaze[borderRow][c];
            const bottomComponent = newColoredMaze[borderRow + 1][c];
            
            if (topComponent !== -1 && bottomComponent !== -1) {
              const topNodeId = `${regionRow},${regionCol}_${topComponent}`;
              const bottomNodeId = `${bottomRegionRow},${bottomRegionCol}_${bottomComponent}`;
              
              if (newComponentGraph[topNodeId] && newComponentGraph[bottomNodeId] && 
                  topNodeId !== bottomNodeId) {
                
                if (!newComponentGraph[topNodeId].neighbors.includes(bottomNodeId)) {
                  newComponentGraph[topNodeId].neighbors.push(bottomNodeId);
                  newComponentGraph[topNodeId].transitions.push({
                    to: bottomNodeId,
                    fromCell: { row: borderRow, col: c },
                    toCell: { row: borderRow + 1, col: c }
                  });
                }
                
                if (!newComponentGraph[bottomNodeId].neighbors.includes(topNodeId)) {
                  newComponentGraph[bottomNodeId].neighbors.push(topNodeId);
                  newComponentGraph[bottomNodeId].transitions.push({
                    to: topNodeId,
                    fromCell: { row: borderRow + 1, col: c },
                    toCell: { row: borderRow, col: c }
                  });
                }
              }
            }
          }
        }
      }
      
      if (regionRow > 0) {
        const topRegionRow = regionRow - 1;
        const topRegionCol = regionCol;
        const borderRow = regionRow * REGION_SIZE;
        
        
        for (let c = regionCol * REGION_SIZE; c < (regionCol + 1) * REGION_SIZE; c++) {
          if (c >= 0 && c < SIZE && borderRow >= 0 && borderRow < SIZE && 
              borderRow > 0 && knownMap[borderRow] && knownMap[borderRow][c] === CELL_STATES.WALKABLE && 
              knownMap[borderRow - 1] && knownMap[borderRow - 1][c] === CELL_STATES.WALKABLE) {
            
            const bottomComponent = newColoredMaze[borderRow][c];
            const topComponent = newColoredMaze[borderRow - 1][c];
            
            if (topComponent !== -1 && bottomComponent !== -1) {
              const bottomNodeId = `${regionRow},${regionCol}_${bottomComponent}`;
              const topNodeId = `${topRegionRow},${topRegionCol}_${topComponent}`;
              
              if (newComponentGraph[bottomNodeId] && newComponentGraph[topNodeId] && 
                  bottomNodeId !== topNodeId) {
                
                if (!newComponentGraph[bottomNodeId].neighbors.includes(topNodeId)) {
                  newComponentGraph[bottomNodeId].neighbors.push(topNodeId);
                  newComponentGraph[bottomNodeId].transitions.push({
                    to: topNodeId,
                    fromCell: { row: borderRow, col: c },
                    toCell: { row: borderRow - 1, col: c }
                  });
                  connectionsBuilt++;
                }
                
                if (!newComponentGraph[topNodeId].neighbors.includes(bottomNodeId)) {
                  newComponentGraph[topNodeId].neighbors.push(bottomNodeId);
                  newComponentGraph[topNodeId].transitions.push({
                    to: bottomNodeId,
                    fromCell: { row: borderRow - 1, col: c },
                    toCell: { row: borderRow, col: c }
                  });
                  connectionsBuilt++;
                }
              }
            }
          }
        }
      }
      
      const diagonalOffsets = [
{ dr: -1, dc: -1, name: "TOP-LEFT" },
{ dr: -1, dc: 1, name: "TOP-RIGHT" },
{ dr: 1, dc: -1, name: "BOTTOM-LEFT" },
{ dr: 1, dc: 1, name: "BOTTOM-RIGHT" }
];

for (const { dr, dc, name } of diagonalOffsets) {
const neighborRegionRow = regionRow + dr;
const neighborRegionCol = regionCol + dc;

if (neighborRegionRow >= 0 && neighborRegionRow < numRegions &&
    neighborRegionCol >= 0 && neighborRegionCol < numRegions) {
  
  let cornerRow, cornerCol, neighborCornerRow, neighborCornerCol;
  
  if (dr === -1 && dc === -1) {
    cornerRow = regionRow * REGION_SIZE;
    cornerCol = regionCol * REGION_SIZE;
    neighborCornerRow = cornerRow - 1;
    neighborCornerCol = cornerCol - 1;
  } else if (dr === -1 && dc === 1) {
    cornerRow = regionRow * REGION_SIZE;
    cornerCol = (regionCol + 1) * REGION_SIZE - 1;
    neighborCornerRow = cornerRow - 1;
    neighborCornerCol = cornerCol + 1;
  } else if (dr === 1 && dc === -1) {
    cornerRow = (regionRow + 1) * REGION_SIZE - 1;
    cornerCol = regionCol * REGION_SIZE;
    neighborCornerRow = cornerRow + 1;
    neighborCornerCol = cornerCol - 1;
  } else {
    cornerRow = (regionRow + 1) * REGION_SIZE - 1;
    cornerCol = (regionCol + 1) * REGION_SIZE - 1;
    neighborCornerRow = cornerRow + 1;
    neighborCornerCol = cornerCol + 1;
  }
  
  if (cornerRow >= 0 && cornerRow < SIZE && cornerCol >= 0 && cornerCol < SIZE &&
      neighborCornerRow >= 0 && neighborCornerRow < SIZE && 
      neighborCornerCol >= 0 && neighborCornerCol < SIZE &&
      knownMap[cornerRow] && knownMap[cornerRow][cornerCol] === CELL_STATES.WALKABLE &&
      knownMap[neighborCornerRow] && knownMap[neighborCornerRow][neighborCornerCol] === CELL_STATES.WALKABLE) {
    
    const currentComponent = newColoredMaze[cornerRow][cornerCol];
    const neighborComponent = newColoredMaze[neighborCornerRow][neighborCornerCol];
    
    if (currentComponent !== -1 && neighborComponent !== -1) {
      const currentNodeId = `${regionRow},${regionCol}_${currentComponent}`;
      const neighborNodeId = `${neighborRegionRow},${neighborRegionCol}_${neighborComponent}`;
      
      if (newComponentGraph[currentNodeId] && newComponentGraph[neighborNodeId] && 
          currentNodeId !== neighborNodeId) {
        
        if (!newComponentGraph[currentNodeId].neighbors.includes(neighborNodeId)) {
          newComponentGraph[currentNodeId].neighbors.push(neighborNodeId);
          newComponentGraph[currentNodeId].transitions.push({
            to: neighborNodeId,
            fromCell: { row: cornerRow, col: cornerCol },
            toCell: { row: neighborCornerRow, col: neighborCornerCol }
          });
          connectionsBuilt++;
        }
        
        if (!newComponentGraph[neighborNodeId].neighbors.includes(currentNodeId)) {
          newComponentGraph[neighborNodeId].neighbors.push(currentNodeId);
          newComponentGraph[neighborNodeId].transitions.push({
            to: currentNodeId,
            fromCell: { row: neighborCornerRow, col: neighborCornerCol },
            toCell: { row: cornerRow, col: cornerCol }
          });
          connectionsBuilt++;
        }
      }
    }
  }
}
}

}
}

const isolatedComponents = Object.keys(newComponentGraph).filter(nodeId => 
newComponentGraph[nodeId].neighbors.length === 0
);

return { componentGraph: newComponentGraph, coloredMaze: newColoredMaze };
};

// src/algorithms/exploration/frontier-detection.js
const detectComponentAwareFrontiers = (knownMap, componentGraph, coloredMaze, useWFD = true, frontierStrategy = 'centroid', robotPosition = null) => {
const SIZE = knownMap.length;

if (useWFD) {
const wfdDetector = new WavefrontFrontierDetection(SIZE, SIZE);

const flatKnownMap = new Uint8Array(SIZE * SIZE);
for (let r = 0; r < SIZE; r++) {
for (let c = 0; c < SIZE; c++) {
  flatKnownMap[r * SIZE + c] = knownMap[r][c];
}
}

const frontierGroups = wfdDetector.detectFrontiers(flatKnownMap);

const componentAwareFrontiers = [];

for (const group of frontierGroups) {
let targetPoint = null;

if (frontierStrategy === 'centroid') {
  targetPoint = { row: Math.floor(group.centroid.y), col: Math.floor(group.centroid.x) };
} else if (frontierStrategy === 'median') {
  targetPoint = { row: Math.floor(group.median.y), col: Math.floor(group.median.x) };
} else {
  const firstPoint = group.points[0];
  targetPoint = { row: Math.floor(firstPoint.y), col: Math.floor(firstPoint.x) };
}

if (targetPoint) {
  let associatedComponent = getComponentNodeId(targetPoint, coloredMaze, DEFAULT_REGION_SIZE);
  
  if (!associatedComponent) {
    let closestComponent = null;
    let minDistance = Infinity;
    
    for (const [nodeId, component] of Object.entries(componentGraph)) {
      for (const cell of component.cells) {
        const distance = heuristicObjectChebyshev(cell, targetPoint);
        if (distance < minDistance) {
          minDistance = distance;
          closestComponent = nodeId;
        }
      }
    }
    
    associatedComponent = closestComponent;
  }
  
  if (robotPosition) {
    const distance = Math.abs(targetPoint.row - robotPosition.row) + Math.abs(targetPoint.col - robotPosition.col);
    if (distance <= 1.5) {
      continue;
    }
  }
  
  componentAwareFrontiers.push({
    row: targetPoint.row,
    col: targetPoint.col,
    componentId: associatedComponent,
    groupSize: group.size || group.points?.length || 1,
    points: group.points.map(p => ({ row: Math.floor(p.y), col: Math.floor(p.x) }))
  });
}
}

return componentAwareFrontiers;
}

const basicFrontiers = detectBasicFrontiers(knownMap, componentGraph, robotPosition);
return basicFrontiers;
};

const detectBasicFrontiers = (knownMap, componentGraph, robotPosition = null) => {
const frontiers = [];
const SIZE = knownMap.length;

for (const nodeId of Object.keys(componentGraph)) {
const component = componentGraph[nodeId];

for (const cell of component.cells) {
const neighbors = [
  { row: cell.row - 1, col: cell.col },
  { row: cell.row + 1, col: cell.col },
  { row: cell.row, col: cell.col - 1 },
  { row: cell.row, col: cell.col + 1 },
  { row: cell.row - 1, col: cell.col - 1 },
  { row: cell.row - 1, col: cell.col + 1 },
  { row: cell.row + 1, col: cell.col - 1 },
  { row: cell.row + 1, col: cell.col + 1 }
];

let hasUnknownNeighbor = false;
for (const neighbor of neighbors) {
  if (neighbor.row >= 0 && neighbor.row < SIZE && 
      neighbor.col >= 0 && neighbor.col < SIZE &&
      knownMap[neighbor.row][neighbor.col] === CELL_STATES.UNKNOWN) {
    hasUnknownNeighbor = true;
    break;
  }
}

if (hasUnknownNeighbor) {
  if (robotPosition) {
    const distance = Math.abs(cell.row - robotPosition.row) + Math.abs(cell.col - robotPosition.col);
    if (distance <= 1.5) {
      continue;
    }
  }
  
  frontiers.push({
    row: cell.row,
    col: cell.col,
    componentId: nodeId,
    groupSize: 1
  });
}
}
}

return frontiers;
};

const isComponentReachable = (robotComponent, targetComponent, componentGraph) => {
if (!robotComponent || !targetComponent || !componentGraph[robotComponent]) {
return false;
}

if (robotComponent === targetComponent) {
return true;
}

const visited = new Set();
const queue = [robotComponent];
visited.add(robotComponent);

let steps = 0;
while (queue.length > 0) {
const current = queue.shift();
steps++;

if (current === targetComponent) {
return true;
}

const node = componentGraph[current];
if (node && node.neighbors) {
for (const neighbor of node.neighbors) {
  if (!visited.has(neighbor)) {
    visited.add(neighbor);
    queue.push(neighbor);
  }
}
}
}

return false;
};

const selectOptimalFrontier = (frontiers, robotPosition, componentGraph, coloredMaze, prevTargets = [], knownMap = null) => {
if (frontiers.length === 0) return null;

const robotComponent = getComponentNodeId(robotPosition, coloredMaze, DEFAULT_REGION_SIZE);

const reachableFrontiers = frontiers.filter(frontier => {
return isComponentReachable(robotComponent, frontier.componentId, componentGraph);
});

if (reachableFrontiers.length === 0) {
return null;
}

const recentlyAbandonedTargets = prevTargets.slice(-5);
const availableFrontiers = reachableFrontiers.filter(frontier => {
return !recentlyAbandonedTargets.some(prevTarget => 
prevTarget && frontier.row === prevTarget.row && frontier.col === prevTarget.col
);
});

const finalFrontiers = availableFrontiers.length > 0 ? availableFrontiers : reachableFrontiers;

const frontiersWithDistances = finalFrontiers.map(frontier => {
let pathDistance = frontier.pathDistance || Infinity;

if (knownMap) {
const pathResult = findComponentPath(
  robotPosition,
  { row: frontier.row, col: frontier.col },
  knownMap,
  componentGraph,
  coloredMaze,
  DEFAULT_REGION_SIZE
);

if (pathResult?.path) {
  pathDistance = pathResult.path.length;
}
}

return {
...frontier,
calculatedPathDistance: pathDistance
};
});

const sortedFrontiers = frontiersWithDistances.sort((a, b) => {
return a.calculatedPathDistance - b.calculatedPathDistance;
});

return sortedFrontiers[0];
};

const shouldAbandonCurrentTarget = (
robotPosition, 
currentTarget, 
frontiers, 
pathResult, 
componentGraph, 
coloredMaze, 
explorationState,
frontierPaths
) => {
let result = null;

const currentPathCost = pathResult?.path ? pathResult.path.length : Infinity;
let newTarget = null;
let newPath = null;
let newPathCost = Infinity;

for (const pathData of frontierPaths) {
const { frontier, path, cost } = pathData;

if (!path || cost === Infinity || 
  (frontier.row === currentTarget.row && frontier.col === currentTarget.col)) {
continue;
}

const recentTargets = explorationState.prev_targets?.slice(-3) || [];
const isRecentTarget = recentTargets.some(prevTarget => 
prevTarget && frontier.row === prevTarget.row && frontier.col === prevTarget.col
);

if (isRecentTarget) {
continue;
}

if (isComponentReachable(getComponentNodeId(robotPosition, coloredMaze, DEFAULT_REGION_SIZE), frontier.componentId, componentGraph)) {
if (cost < newPathCost) {
  newTarget = frontier;
  newPath = path;
  newPathCost = cost;
}
}
}

let stuckInLoop = false;
if (explorationState.recent_positions && explorationState.recent_positions.length >= 8) {
const recentPositions = explorationState.recent_positions.slice(-8);
const positionCounts = {};

recentPositions.forEach(pos => {
const key = `${pos.row},${pos.col}`;
positionCounts[key] = (positionCounts[key] || 0) + 1;
});

const hasRepeatingPosition = Object.values(positionCounts).some(count => count >= 4);

const uniquePositions = Object.keys(positionCounts).length;
const hasAlternatingPattern = uniquePositions <= 2 && recentPositions.length >= 8;

let noProgressTowardTarget = true;

stuckInLoop = (hasRepeatingPosition || hasAlternatingPattern) && noProgressTowardTarget;
}

if (newPathCost < currentPathCost) {

if (!newTarget) {
return null;
}

const recentlyAbandonedTargets = explorationState.prev_targets.slice(-5);
const wouldBeYoyo = recentlyAbandonedTargets.some(prevTarget => 
prevTarget && newTarget && 
prevTarget.row === newTarget.row && prevTarget.col === newTarget.col
);

if (wouldBeYoyo) {
return null;
}

explorationState.prev_targets.push(currentTarget);

if (explorationState.prev_targets.length > 20) {
explorationState.prev_targets.shift();
}

result = { target: newTarget, path: newPath };
}

return result;

};

function getRotationPath(fromDirection, toDirection) {
if (fromDirection === toDirection) {
return [fromDirection];
}

const clockwiseDistance = (toDirection - fromDirection + 8) % 8;
const counterclockwiseDistance = (fromDirection - toDirection + 8) % 8;

const path = [fromDirection];

if (clockwiseDistance <= counterclockwiseDistance) {
let current = fromDirection;
while (current !== toDirection) {
current = (current + 1) % 8;
path.push(current);
}
} else {
let current = fromDirection;
while (current !== toDirection) {
current = (current - 1 + 8) % 8;
path.push(current);
}
}

return path;
}

function matrixInfo(knownMap, robotPosition, targetFrontier, fullMaze, coloredMaze, componentGraph, robotComponent, frontierComponent, sensorRange, sensorPositions) {
let debugInfo = '';
debugInfo += knownMapAreaToString(knownMap, robotPosition, DEFAULT_REGION_SIZE, robotPosition, targetFrontier);
debugInfo += '\n';

debugInfo += groundTruthAreaToString(fullMaze, robotPosition, DEFAULT_REGION_SIZE, robotPosition, targetFrontier);
debugInfo += '\n';

debugInfo += coloredMazeAreaToString(coloredMaze, robotPosition, DEFAULT_REGION_SIZE, robotPosition, targetFrontier);
debugInfo += '\n';

debugInfo += sensorCoverageToString(fullMaze, knownMap, robotPosition, sensorRange, sensorPositions, DEFAULT_REGION_SIZE, targetFrontier);
debugInfo += '\n';

debugInfo += componentConnectivityToString(componentGraph, robotComponent, frontierComponent);
debugInfo += '\n';
return debugInfo;
}

function rotateWithSensing(currentDirection, targetDirection, robotPosition, sensorRange, fullMaze, knownMap, componentGraph, coloredMaze, regionSize) {
const rotationPath = getRotationPath(currentDirection, targetDirection);
let currentKnownMap = knownMap;
let currentComponentGraph = componentGraph;
let currentColoredMaze = coloredMaze;
let allNewCells = [];

for (let i = 1; i < rotationPath.length; i++) {
const direction = rotationPath[i];
const sensorPositions = scanWithSensors(robotPosition, sensorRange, fullMaze, direction);
const updateResult = updateKnownMap(currentKnownMap, fullMaze, sensorPositions);
currentKnownMap = updateResult.knownMap;

if (updateResult.newCells) {
allNewCells = allNewCells.concat(updateResult.newCells);
}
}

const SIZE = currentKnownMap.length;
const allWalkableCells = [];
for (let r = 0; r < SIZE; r++) {
for (let c = 0; c < SIZE; c++) {
if (currentKnownMap[r][c] === CELL_STATES.WALKABLE) {
  allWalkableCells.push({ row: r, col: c, newState: CELL_STATES.WALKABLE });
}
}
}

const componentUpdate = updateComponentStructure(
currentKnownMap, {}, Array(SIZE).fill(null).map(() => Array(SIZE).fill(-1)), allWalkableCells, regionSize
);
currentComponentGraph = componentUpdate.componentGraph;
currentColoredMaze = componentUpdate.coloredMaze;

return {
finalDirection: targetDirection,
updatedKnownMap: currentKnownMap,
updatedComponentGraph: currentComponentGraph,
updatedColoredMaze: currentColoredMaze
};
}

function generatePathfindingDebugInfo(robotPosition, targetFrontier, knownMap, componentGraph, coloredMaze, regionSize) {
const robotComponent = getComponentNodeId(robotPosition, coloredMaze, regionSize);
const frontierComponent = getComponentNodeId({ row: targetFrontier.row, col: targetFrontier.col }, coloredMaze, regionSize);
let debugInfo = '';
debugInfo += 'DEBUG PATHFINDING FAILURE:\n';
debugInfo += `- Robot at: ${JSON.stringify(robotPosition)}\n`;
debugInfo += `- Robot component: ${robotComponent}\n`;
debugInfo += `- Target frontier: ${JSON.stringify(targetFrontier)}\n`;
debugInfo += `- Frontier component: ${frontierComponent}\n`;
debugInfo += `- Known map at robot: ${knownMap[robotPosition.row][robotPosition.col]}\n`;
debugInfo += `- Known map at frontier: ${knownMap[targetFrontier.row][targetFrontier.col]}\n`;

if (robotComponent && componentGraph[robotComponent]) {
debugInfo += `- Robot component neighbors: ${JSON.stringify(componentGraph[robotComponent].neighbors)}\n`;
debugInfo += `- Robot component transitions: ${JSON.stringify(componentGraph[robotComponent].transitions)}\n`;

}
if (frontierComponent && componentGraph[frontierComponent]) {
debugInfo += `- Frontier component neighbors: ${JSON.stringify(componentGraph[frontierComponent].neighbors)}\n`;
debugInfo += `- Frontier component transitions: ${JSON.stringify(componentGraph[frontierComponent].transitions)}\n`;
}

debugInfo += `- Component graph keys: ${JSON.stringify(Object.keys(componentGraph))}\n`;
debugInfo += `- Frontier details: ${JSON.stringify(targetFrontier)}`;

debugInfo += 'DEBUG: Testing if path exists with simple grid search...\n';
const simplePathExists = checkSimplePathExists(robotPosition, targetFrontier, knownMap);
debugInfo += `- Simple path exists: ${simplePathExists}\n`;

return debugInfo;
}

function perform360Scan(robotPosition, sensorRange, fullMaze, knownMap, componentGraph, coloredMaze, regionSize) {
let currentKnownMap = knownMap;
let currentComponentGraph = componentGraph;
let currentColoredMaze = coloredMaze;
let allNewCells = [];

for (let direction = 0; direction < 8; direction++) {
const sensorPositions = scanWithSensors(robotPosition, sensorRange, fullMaze, direction);
const updateResult = updateKnownMap(currentKnownMap, fullMaze, sensorPositions);
currentKnownMap = updateResult.knownMap;

if (updateResult.newCells) {
allNewCells = allNewCells.concat(updateResult.newCells);
}
}

const SIZE = currentKnownMap.length;
const allWalkableCells = [];
for (let r = 0; r < SIZE; r++) {
for (let c = 0; c < SIZE; c++) {
if (currentKnownMap[r][c] === CELL_STATES.WALKABLE) {
  allWalkableCells.push({ row: r, col: c, newState: CELL_STATES.WALKABLE });
}
}
}

const componentUpdate = updateComponentStructure(
currentKnownMap, {}, Array(SIZE).fill(null).map(() => Array(SIZE).fill(-1)), allWalkableCells, regionSize
);
currentComponentGraph = componentUpdate.componentGraph;
currentColoredMaze = componentUpdate.coloredMaze;

return {
updatedKnownMap: currentKnownMap,
updatedComponentGraph: currentComponentGraph,
updatedColoredMaze: currentColoredMaze,
newCellsCount: allNewCells.length
};
}

function initializeExplorationState(input, options, REGION_SIZE) {
const { maze: fullMaze, start: startPos, SIZE } = input;
const { sensorRange = 15, targetSwitchCooldown = 2 } = options;

let robotPosition = { row: startPos.row, col: startPos.col };
let robotDirection = 0;

let knownMap = Array(SIZE).fill(null).map(() => Array(SIZE).fill(CELL_STATES.UNKNOWN));
let coloredMaze = Array(SIZE).fill(null).map(() => Array(SIZE).fill(-1));
let componentGraph = {};
let exploredPositions = [{ ...robotPosition }];

const initialSensorPositions = scanWithSensors(robotPosition, sensorRange, fullMaze, robotDirection);
const initialUpdate = updateKnownMap(knownMap, fullMaze, initialSensorPositions);
knownMap = initialUpdate.knownMap;

const initialComponentUpdate = updateComponentStructure(
knownMap, componentGraph, coloredMaze, initialUpdate.newCells, REGION_SIZE
);
componentGraph = initialComponentUpdate.componentGraph;
coloredMaze = initialComponentUpdate.coloredMaze;

return {
robotPosition,
robotDirection,
knownMap,
coloredMaze,
componentGraph,
exploredPositions,
iterationCount: 0,
lastSelectedFrontier: null,
sameTargetCount: 0,
currentTarget: null,
prevTargets: [],
recentPositions: [],
lastTargetSwitchIteration: -targetSwitchCooldown
};
}

function performSensingAndUpdate(state, fullMaze, sensorRange, REGION_SIZE) {
const sensorPositions = scanWithSensors(state.robotPosition, sensorRange, fullMaze, state.robotDirection);
const updateResult = updateKnownMap(state.knownMap, fullMaze, sensorPositions);
state.knownMap = updateResult.knownMap;

const componentUpdate = updateComponentStructure(
state.knownMap, state.componentGraph, state.coloredMaze, updateResult.newCells, REGION_SIZE
);
state.componentGraph = componentUpdate.componentGraph;
state.coloredMaze = componentUpdate.coloredMaze;

return { sensorPositions, newCellsDetected: updateResult.newCells };
}

function calculateCoverage(knownMap, fullMaze, SIZE) {
let knownCells = 0;
let totalCells = 0;
for (let r = 0; r < SIZE; r++) {
for (let c = 0; c < SIZE; c++) {
if (fullMaze[r][c] === CELL_STATES.WALKABLE) {
  totalCells++;
  if (knownMap[r][c] === CELL_STATES.WALKABLE) {
    knownCells++;
  }
}
}
}
return totalCells > 0 ? (knownCells / totalCells) * 100 : 0;
}

function detectAndSelectFrontier(state, options, fullMaze, REGION_SIZE, currentSensorPositions) {
const { useWFD, frontierStrategy, sensorRange } = options;

let frontiers = detectComponentAwareFrontiers(
state.knownMap,
state.componentGraph,
state.coloredMaze,
useWFD === 'true',
frontierStrategy,
state.robotPosition
);

const robotComponent = getComponentNodeId(state.robotPosition, state.coloredMaze, REGION_SIZE);
frontiers = frontiers.map(frontier => ({
...frontier,
isReachable: isComponentReachable(robotComponent, frontier.componentId, state.componentGraph)
}));

if (state.currentTarget) {
const deltaRow = state.currentTarget.row - state.robotPosition.row;
const deltaCol = state.currentTarget.col - state.robotPosition.col;

let lookAheadDirection = state.robotDirection;
if (Math.abs(deltaRow) > Math.abs(deltaCol)) {
lookAheadDirection = deltaRow < 0 ? DIRECTIONS.NORTH : DIRECTIONS.SOUTH;
} else if (Math.abs(deltaCol) > Math.abs(deltaRow)) {
lookAheadDirection = deltaCol > 0 ? DIRECTIONS.EAST : DIRECTIONS.WEST;
} else if (deltaRow !== 0 && deltaCol !== 0) {
if (deltaRow < 0 && deltaCol > 0) {
  lookAheadDirection = DIRECTIONS.NORTHEAST;
} else if (deltaRow > 0 && deltaCol > 0) {
  lookAheadDirection = DIRECTIONS.SOUTHEAST;
} else if (deltaRow > 0 && deltaCol < 0) {
  lookAheadDirection = DIRECTIONS.SOUTHWEST;
} else if (deltaRow < 0 && deltaCol < 0) {
  lookAheadDirection = DIRECTIONS.NORTHWEST;
}
}

if (state.robotDirection !== lookAheadDirection) {
const rotationResult = rotateWithSensing(
  state.robotDirection,
  lookAheadDirection,
  state.robotPosition,
  sensorRange,
  fullMaze,
  state.knownMap,
  state.componentGraph,
  state.coloredMaze,
  REGION_SIZE
);
state.robotDirection = rotationResult.finalDirection;
state.knownMap = rotationResult.updatedKnownMap;
state.componentGraph = rotationResult.updatedComponentGraph;
state.coloredMaze = rotationResult.updatedColoredMaze;

let updatedFrontiers = detectComponentAwareFrontiers(
  state.knownMap,
  state.componentGraph,
  state.coloredMaze,
  useWFD === 'true',
  frontierStrategy,
  state.robotPosition
);

const updatedRobotComponent = getComponentNodeId(state.robotPosition, state.coloredMaze, REGION_SIZE);
updatedFrontiers = updatedFrontiers.map(frontier => ({
  ...frontier,
  isReachable: isComponentReachable(updatedRobotComponent, frontier.componentId, state.componentGraph)
}));

frontiers.splice(0, frontiers.length, ...updatedFrontiers);
}
}

let targetFrontier = state.currentTarget;
const needNewTarget = !state.currentTarget ||
(state.currentTarget && state.robotPosition.row === state.currentTarget.row && state.robotPosition.col === state.currentTarget.col) ||
(state.currentTarget && !frontiers.some(f => f.row === state.currentTarget.row && f.col === state.currentTarget.col));

if (needNewTarget) {
targetFrontier = selectOptimalFrontier(frontiers, state.robotPosition, state.componentGraph, state.coloredMaze, state.prevTargets, state.knownMap);
state.currentTarget = targetFrontier;
state.lastTargetSwitchIteration = state.iterationCount;

if (!targetFrontier) {
const robotComponent = getComponentNodeId(state.robotPosition, state.coloredMaze, REGION_SIZE);
const SIZE = state.knownMap.length;

let debugOutput = `Exploration stopped: No reachable frontier targets found after ${state.iterationCount} iterations`;
debugOutput += `\nRobot is in position (${state.robotPosition.row},${state.robotPosition.col}) in component ${robotComponent}. Found ${frontiers.length} total frontiers, but none are reachable through known paths.`;
debugOutput += `\n${knownMapAreaToString(state.knownMap, state.robotPosition, 20)}`;
debugOutput += `\n${coloredMazeAreaToString(state.coloredMaze, state.robotPosition, 20)}`;

debugOutput += `\n=== FRONTIER REACHABILITY ANALYSIS ===`;
frontiers.forEach((frontier, i) => {
  const frontierComponent = getComponentNodeId({ row: frontier.row, col: frontier.col }, state.coloredMaze, REGION_SIZE);
  const reachable = isComponentReachable(robotComponent, frontierComponent, state.componentGraph);
  debugOutput += `\nFrontier ${i}: (${frontier.row},${frontier.col}) component ${frontierComponent}, reachable: ${reachable}`;
});

if (frontiers.length > 0) {
  const pathfindingDebugInfo = generatePathfindingDebugInfo(state.robotPosition, frontiers[0], state.knownMap, state.componentGraph, state.coloredMaze, REGION_SIZE);
  debugOutput += `\n\n=== PATHFINDING DEBUG INFO FOR FIRST FRONTIER ===\n${pathfindingDebugInfo}`;
}

debugOutput += `\n${componentConnectivityToString(state.componentGraph, robotComponent, frontiers[0]?.componentId)}`;

console.log(debugOutput);
return { frontiers, targetFrontier: null, shouldBreak: true };
}
}

const frontierKey = targetFrontier ? `${targetFrontier.row},${targetFrontier.col}` : null;
if (state.lastSelectedFrontier && state.lastSelectedFrontier === frontierKey) {
state.sameTargetCount++;
} else {
state.sameTargetCount = 1;
state.lastSelectedFrontier = frontierKey;
}

return { frontiers, targetFrontier, shouldBreak: false };
}

function navigateToTarget(state, currentIterationTargetFrontier, frontiers, fullMaze, sensorRange, currentSensorPositions, REGION_SIZE, options) {
const { targetSwitchCooldown } = options;
let targetFrontier = currentIterationTargetFrontier;

const robotComponent = getComponentNodeId(state.robotPosition, state.coloredMaze, REGION_SIZE);
let targetComponent = getComponentNodeId({ row: targetFrontier.row, col: targetFrontier.col }, state.coloredMaze, REGION_SIZE);
let isTargetReachable = isComponentReachable(robotComponent, targetComponent, state.componentGraph);

if (!isTargetReachable) {
console.log(`ERROR: Target frontier (${targetFrontier.row},${targetFrontier.col}) in component ${targetComponent} is not reachable from robot component ${robotComponent}`);
console.log(`ERROR: This should have been filtered out during frontier selection!`);
console.log(`ERROR: Component graph keys: ${Object.keys(state.componentGraph)}`);
console.log(`ERROR: Robot component exists: ${!!state.componentGraph[robotComponent]}`);
console.log(`ERROR: Target component exists: ${!!state.componentGraph[targetComponent]}`);

console.log(`FIXING: Forcing complete component structure rebuild...`);

const SIZE = state.knownMap.length;
const allWalkableCells = [];
for (let r = 0; r < SIZE; r++) {
for (let c = 0; c < SIZE; c++) {
  if (state.knownMap[r][c] === CELL_STATES.WALKABLE) {
    allWalkableCells.push({ row: r, col: c, newState: CELL_STATES.WALKABLE });
  }
}
}

const rebuiltUpdate = updateComponentStructure(
state.knownMap, {}, Array(SIZE).fill(null).map(() => Array(SIZE).fill(-1)), allWalkableCells, REGION_SIZE
);
state.componentGraph = rebuiltUpdate.componentGraph;
state.coloredMaze = rebuiltUpdate.coloredMaze;

console.log(`FIXING: Rebuilt component graph with ${Object.keys(state.componentGraph).length} components`);

state.currentTarget = null;
return { pathResult: null, currentActualEnd: null, targetFrontier: null, shouldReplan: true };
}

let pathResult = findComponentPath(
state.robotPosition,
{ row: targetFrontier.row, col: targetFrontier.col },
state.knownMap,
state.componentGraph,
state.coloredMaze,
REGION_SIZE
);

const canSwitchTarget = (state.iterationCount - state.lastTargetSwitchIteration) >= targetSwitchCooldown;

if (pathResult?.path && pathResult.path.length > 0) {
const frontierPaths = [];
for (const frontier of frontiers) {
const frontierPath = findComponentPath(
  state.robotPosition,
  { row: frontier.row, col: frontier.col },
  state.knownMap,
  state.componentGraph,
  state.coloredMaze,
  REGION_SIZE
);

frontierPaths.push({
  frontier: frontier,
  path: frontierPath?.path || null,
  cost: frontierPath?.path ? frontierPath.path.length : Infinity
});
}

frontiers.forEach(frontier => {
const pathData = frontierPaths.find(fp => fp.frontier.row === frontier.row && fp.frontier.col === frontier.col);
frontier.pathDistance = pathData ? pathData.cost : Infinity;
});

const abandonDecision = shouldAbandonCurrentTarget(
state.robotPosition,
state.currentTarget,
frontiers,
pathResult,
state.componentGraph,
state.coloredMaze,
{
  iterations: state.iterationCount,
  coverage: calculateCoverage(state.knownMap, fullMaze, state.knownMap.length),
  sameTargetCount: state.sameTargetCount,
  exploredPositions: state.exploredPositions.length,
  prev_targets: state.prevTargets,
  recent_positions: state.recentPositions
},
frontierPaths
);

if (abandonDecision !== null) {
state.currentTarget = abandonDecision.target;
targetFrontier = abandonDecision.target;
state.lastTargetSwitchIteration = state.iterationCount;

if (abandonDecision.path && abandonDecision.path.length > 0) {
  pathResult = {
    path: abandonDecision.path,
    actualEnd: abandonDecision.target
  };
} else {
  pathResult = findComponentPath(
    state.robotPosition,
    { row: targetFrontier.row, col: targetFrontier.col },
    state.knownMap,
    state.componentGraph,
    state.coloredMaze,
    REGION_SIZE
  );
}
}
}

if (!pathResult?.path || pathResult.path.length === 0) {
const SIZE = state.knownMap.length;
targetComponent = getComponentNodeId({ row: targetFrontier.row, col: targetFrontier.col }, state.coloredMaze, REGION_SIZE);
let debugInfo = generatePathfindingDebugInfo(state.robotPosition, targetFrontier, state.knownMap, state.componentGraph, state.coloredMaze, REGION_SIZE);

if (state.knownMap[targetFrontier.row][targetFrontier.col] !== CELL_STATES.WALKABLE) {
debugInfo += `DEBUG: Frontier (${targetFrontier.row}, ${targetFrontier.col}) is not walkable in known map! State: ${state.knownMap[targetFrontier.row][targetFrontier.col]}\n`;
}

if (state.knownMap[state.robotPosition.row][state.robotPosition.col] !== CELL_STATES.WALKABLE) {
debugInfo += `DEBUG: Robot position (${state.robotPosition.row}, ${state.robotPosition.col}) is not walkable! State: ${state.knownMap[state.robotPosition.row][state.robotPosition.col]}\n`;
}
debugInfo += `DEBUG: No path found from (${state.robotPosition.row}, ${state.robotPosition.col}) to frontier (${targetFrontier.row}, ${targetFrontier.col}) at iteration ${state.iterationCount}. Robot component: ${robotComponent}, Frontier component: ${targetComponent}\n`;

debugInfo += `\n=== DEBUG: COMPREHENSIVE MATRIX ANALYSIS ===\n`;
let matrix_info = matrixInfo(state.knownMap, state.robotPosition, targetFrontier, fullMaze, state.coloredMaze, state.componentGraph, robotComponent, targetComponent, sensorRange, currentSensorPositions);
debugInfo += `\n${matrix_info}\n`;

if (Math.abs(state.robotPosition.row - targetFrontier.row) > 16 || Math.abs(state.robotPosition.col - targetFrontier.col) > 16) {
console.log(`\n--- TARGET AREA (separate view) ---`);
console.log(knownMapAreaToString(state.knownMap, targetFrontier, DEFAULT_REGION_SIZE, state.robotPosition, targetFrontier));
console.log(groundTruthAreaToString(fullMaze, targetFrontier, DEFAULT_REGION_SIZE, state.robotPosition, targetFrontier));
console.log(coloredMazeAreaToString(state.coloredMaze, targetFrontier, DEFAULT_REGION_SIZE, state.robotPosition, targetFrontier));
}

throw new Error(debugInfo);
}

if (!frontiers[0]?.pathDistance) {
frontiers.forEach(frontier => {
const frontierPath = findComponentPath(
  state.robotPosition,
  { row: frontier.row, col: frontier.col },
  state.knownMap,
  state.componentGraph,
  state.coloredMaze,
  REGION_SIZE
);
frontier.pathDistance = frontierPath?.path ? frontierPath.path.length : Infinity;
});
}

return { pathResult, currentActualEnd: pathResult.actualEnd, targetFrontier: targetFrontier, shouldReplan: false };
}

function moveRobot(state, pathResult, targetFrontier, fullMaze, options, REGION_SIZE) {
const { stepSize, sensorRange, scan360OnFrontier } = options;

const targetIndex = Math.min(Math.floor(stepSize) + 1, pathResult.path.length - 1);
const oldPosition = { ...state.robotPosition };

if (pathResult.path.length === 1) {
if (scan360OnFrontier === 'true') {
const scanResult = perform360Scan(
  state.robotPosition,
  sensorRange,
  fullMaze,
  state.knownMap,
  state.componentGraph,
  state.coloredMaze,
  REGION_SIZE
);
state.knownMap = scanResult.updatedKnownMap;
state.componentGraph = scanResult.updatedComponentGraph;
state.coloredMaze = scanResult.updatedColoredMaze;
}

state.prevTargets.push(targetFrontier);
if (state.prevTargets.length > 5) {
state.prevTargets.shift();
}
state.currentTarget = null;

return true;
}

if (targetIndex > 0) {
const newPosition = { row: pathResult.path[targetIndex].row, col: pathResult.path[targetIndex].col };

const deltaRow = newPosition.row - state.robotPosition.row;
const deltaCol = newPosition.col - state.robotPosition.col;

let targetDirection = state.robotDirection;

if (deltaRow !== 0 && deltaCol !== 0) {
if (deltaRow < 0 && deltaCol > 0) {
  targetDirection = DIRECTIONS.NORTHEAST;
} else if (deltaRow > 0 && deltaCol > 0) {
  targetDirection = DIRECTIONS.SOUTHEAST;
} else if (deltaRow > 0 && deltaCol < 0) {
  targetDirection = DIRECTIONS.SOUTHWEST;
} else if (deltaRow < 0 && deltaCol < 0) {
  targetDirection = DIRECTIONS.NORTHWEST;
}
} else if (deltaRow !== 0) {
targetDirection = deltaRow < 0 ? DIRECTIONS.NORTH : DIRECTIONS.SOUTH;
} else if (deltaCol !== 0) {
targetDirection = deltaCol > 0 ? DIRECTIONS.EAST : DIRECTIONS.WEST;
}

state.robotPosition = newPosition;

if (state.robotDirection !== targetDirection) {
const rotationResult = rotateWithSensing(
  state.robotDirection,
  targetDirection,
  state.robotPosition,
  sensorRange,
  fullMaze,
  state.knownMap,
  state.componentGraph,
  state.coloredMaze,
  REGION_SIZE
);
state.robotDirection = rotationResult.finalDirection;
state.knownMap = rotationResult.updatedKnownMap;
state.componentGraph = rotationResult.updatedComponentGraph;
state.coloredMaze = rotationResult.updatedColoredMaze;
}
state.exploredPositions.push({ ...state.robotPosition });

state.recentPositions.push({ ...state.robotPosition });
if (state.recentPositions.length > 20) {
state.recentPositions.shift();
}

if (oldPosition.row === state.robotPosition.row && oldPosition.col === state.robotPosition.col) {
throw new Error(`DEBUG: Robot didn't move from (${oldPosition.row}, ${oldPosition.col}) at iteration ${state.iterationCount}`);
}
return false;
} else {
throw new Error(`DEBUG: targetIndex is 0, path length: ${pathResult.path.length}, stepSize: ${stepSize} at iteration ${state.iterationCount}`);
}
}

function finalizeExploration(state, fullMaze, SIZE, options, startTime) {
const endTime = performance.now();

let finalKnownCells = 0;
let finalTotalCells = 0;
for (let r = 0; r < SIZE; r++) {
for (let c = 0; c < SIZE; c++) {
if (fullMaze[r][c] === CELL_STATES.WALKABLE) {
  finalTotalCells++;
  if (state.knownMap[r][c] === CELL_STATES.WALKABLE) {
    finalKnownCells++;
  }
}
}
}
const finalCoverage = finalTotalCells > 0 ? (finalKnownCells / finalTotalCells) * 100 : 0;

return createAlgorithmResult(
{
success: true,
exploredPositions: state.exploredPositions,
knownMap: state.knownMap,
componentGraph: state.componentGraph,
coloredMaze: state.coloredMaze,
finalCoverage,
robotPosition: state.robotPosition,
robotDirection: state.robotDirection
},
{
executionTime: endTime - startTime,
iterations: state.iterationCount,
positionsExplored: state.exploredPositions.length,
coverage: finalCoverage,
componentsDiscovered: Object.keys(state.componentGraph).length,
frontierStrategy: options.frontierStrategy,
useWFD: options.useWFD === 'true'
}
);
}

const componentBasedExplorationAlgorithm = createAlgorithm({
name: 'Component-Based Exploration',
type: 'exploration',
description: 'Dynamic HPA* exploration with online component graph evolution',
parameters: {
sensorRange: numberParam(5, 30, 15, 1),
stepSize: numberParam(0.5, 2.0, 1.0, 0.1),
maxIterations: numberParam(100, 50000, 10000, 100),
explorationThreshold: numberParam(80, 100, 100, 1),
useWFD: selectParam(['true', 'false'], 'true'),
frontierStrategy: selectParam(['nearest', 'centroid', 'median'], 'median'),
targetSwitchCooldown: numberParam(0, 20, 5, 1),
scan360OnFrontier: selectParam(['true', 'false'], 'true')
},

async execute(input, options, onProgress) {
const { maze: fullMaze, SIZE = 256 } = input;
const {
explorationThreshold = 100,
delay = 50,
maxIterations = 10000
} = options;

const REGION_SIZE = DEFAULT_REGION_SIZE;
const startTime = performance.now();

const explorationState = initializeExplorationState(input, options, REGION_SIZE);

while (true) {
explorationState.iterationCount++;

const { sensorPositions: currentSensorPositions } = performSensingAndUpdate(
  explorationState, fullMaze, options.sensorRange, REGION_SIZE
);

const coverage = calculateCoverage(explorationState.knownMap, fullMaze, SIZE);

const frontierSelectionResult = detectAndSelectFrontier(
  explorationState,
  options,
  fullMaze,
  REGION_SIZE,
  currentSensorPositions
);

const { frontiers, targetFrontier, shouldBreak: selectionShouldBreak } = frontierSelectionResult;

if (frontiers.length === 0) {
  console.log(`Exploration completed: No more frontiers found after ${explorationState.iterationCount} iterations (Coverage: ${coverage.toFixed(1)}%)`);
  break;
}
if (coverage >= explorationThreshold) {
  console.log(`Exploration completed: Coverage threshold reached ${coverage.toFixed(1)}% >= ${explorationThreshold}% after ${explorationState.iterationCount} iterations`);
  break;
}
if (selectionShouldBreak) {
  break;
}

if (targetFrontier.row < 0 || targetFrontier.row >= SIZE || targetFrontier.col < 0 || targetFrontier.col >= SIZE) {
  throw new Error(`DEBUG: Invalid target frontier at (${targetFrontier.row}, ${targetFrontier.col})`);
}

const navigationResult = navigateToTarget(
  explorationState,
  targetFrontier,
  frontiers,
  fullMaze,
  options.sensorRange,
  currentSensorPositions,
  REGION_SIZE,
  options
);

if (navigationResult.shouldReplan) {
  continue;
}

const { pathResult, currentActualEnd, targetFrontier: finalTargetForThisIteration } = navigationResult;

const targetReachedAndScanned = moveRobot(
  explorationState,
  pathResult,
  finalTargetForThisIteration,
  fullMaze,
  options,
  REGION_SIZE
);

if (targetReachedAndScanned) {
  continue;
}

if (onProgress) {
  onProgress({
    type: 'exploration_progress',
    robotPosition: explorationState.robotPosition,
    robotDirection: explorationState.robotDirection,
    knownMap: explorationState.knownMap,
    componentGraph: explorationState.componentGraph,
    coloredMaze: explorationState.coloredMaze,
    frontiers,
    currentTarget: finalTargetForThisIteration,
    exploredPositions: [...explorationState.exploredPositions],
    coverage,
    iteration: explorationState.iterationCount,
    sensorPositions: currentSensorPositions,
    currentPath: pathResult.path ? [...pathResult.path] : [],
    currentPathIndex: 0,
    actualEnd: currentActualEnd
  });

  await new Promise(resolve => setTimeout(resolve, delay));
}
}

return finalizeExploration(
explorationState, fullMaze, SIZE, options, startTime
);
}
});

// src/algorithms/exploration/index.js
const explorationAlgorithms = {
'component-based-exploration': componentBasedExplorationAlgorithm,
};

const getExplorationAlgorithm = (name) => {
return explorationAlgorithms[name] || null;
};

const getExplorationAlgorithmNames = () => {
return Object.keys(explorationAlgorithms);
};

const getExplorationAlgorithmMetadata = () => {
return Object.entries(explorationAlgorithms).map(([name, algorithm]) => ({
name,
displayName: algorithm.name,
description: algorithm.description,
parameters: algorithm.parameters
}));
};

// MAZE GENERATION ALGORITHMS:
// src/algorithms/maze-generation/shared-utils.js
const analyzeComponents = (maze, SIZE, REGION_SIZE, colors) => {
const coloredMaze = Array(SIZE).fill(null).map(() => Array(SIZE).fill(-1));
let totalComponentCount = 0;

for (let regionRow = 0; regionRow < SIZE / REGION_SIZE; regionRow++) {
for (let regionCol = 0; regionCol < SIZE / REGION_SIZE; regionCol++) {
const startRow = regionRow * REGION_SIZE;
const startCol = regionCol * REGION_SIZE;

const components = findConnectedComponents(maze, startRow, startCol, REGION_SIZE);

components.forEach((component, idx) => {
  const colorIndex = idx % colors.length;
  component.forEach(cell => {
    coloredMaze[cell.row][cell.col] = colorIndex;
  });
});

totalComponentCount += components.length;
}
}

return { coloredMaze, totalComponentCount };
};

const generateColors = (count = 20) => {
const colors = [];
for (let i = 0; i < count; i++) {
const hue = (i * 137.508) % 360;
colors.push(`hsl(${hue}, 70%, 60%)`);
}
return colors;
};

const executeAlgorithm = async (mazeGenerator, algorithmName, input, options, onProgress) => {
const { SIZE, REGION_SIZE } = input;
const startTime = performance.now();

if (onProgress) {
onProgress({ type: 'generation_start', algorithm: algorithmName });
}

const maze = mazeGenerator(SIZE);

const colors = generateColors(20);
const { coloredMaze, totalComponentCount } = analyzeComponents(maze, SIZE, REGION_SIZE, colors);

const componentGraph = buildComponentGraph(maze, coloredMaze, SIZE, REGION_SIZE);

const endTime = performance.now();

if (onProgress) {
onProgress({ 
type: 'generation_complete', 
maze, 
coloredMaze, 
componentGraph,
totalComponents: totalComponentCount
});
}

return {
result: {
maze,
coloredMaze,
componentGraph,
totalComponents: totalComponentCount,
colors
},
metrics: {
executionTime: endTime - startTime,
mazeSize: SIZE,
regionSize: REGION_SIZE,
componentCount: Object.keys(componentGraph).length
}
};
};

// src/algorithms/maze-generation/frontier-maze.js
const generateFrontierMaze = (SIZE) => {
const maze = Array(SIZE).fill(null).map(() => Array(SIZE).fill(1));

const carve3x3 = (x, y) => {
const endY = Math.min(y + 3, SIZE);
const endX = Math.min(x + 3, SIZE);
for (let dy = y; dy < endY; dy++) {
for (let dx = x; dx < endX; dx++) {
  maze[dy][dx] = 0;
}
}
};

const carveConnection = (x1, y1, x2, y2) => {
if (x1 === x2) {
const minY = Math.min(y1, y2);
const maxY = Math.max(y1, y2) + 2;
const endY = Math.min(maxY + 1, SIZE);
const endX = Math.min(x1 + 3, SIZE);

for (let y = minY; y < endY; y++) {
  for (let dx = x1; dx < endX; dx++) {
    maze[y][dx] = 0;
  }
}
} else {
const minX = Math.min(x1, x2);
const maxX = Math.max(x1, x2) + 2;
const endX = Math.min(maxX + 1, SIZE);
const endY = Math.min(y1 + 3, SIZE);

for (let y = y1; y < endY; y++) {
  for (let x = minX; x < endX; x++) {
    maze[y][x] = 0;
  }
}
}
};

const visited = new Set();
const toKey = (x, y) => `${x},${y}`;

const stack = [];
const startX = 2, startY = 2;

carve3x3(startX, startY);
stack.push([startX, startY]);
visited.add(toKey(startX, startY));

const directions = [[4, 0], [0, 4], [-4, 0], [0, -4]];

const shuffle = (arr) => {
for (let i = arr.length - 1; i > 0; i--) {
const j = Math.floor(Math.random() * (i + 1));
[arr[i], arr[j]] = [arr[j], arr[i]];
}
return arr;
};

while (stack.length > 0) {
const [currentX, currentY] = stack[stack.length - 1];
const shuffledDirs = shuffle([...directions]);
let found = false;

for (const [dx, dy] of shuffledDirs) {
const newX = currentX + dx;
const newY = currentY + dy;

if (newX > 0 && newX < SIZE - 3 && newY > 0 && newY < SIZE - 3) {
  const key = toKey(newX, newY);
  if (!visited.has(key)) {
    carveConnection(currentX, currentY, newX, newY);
    carve3x3(newX, newY);
    visited.add(key);
    stack.push([newX, newY]);
    found = true;
    break;
  }
}
}

if (!found) stack.pop();
}

const random = Math.random;
const roomThreshold = 0.002;
const loopThreshold = 0.005;
const wideningThreshold = 0.003;

for (let y = 1; y < SIZE - 1; y++) {
for (let x = 1; x < SIZE - 1; x++) {
const rand = random();

if (rand < roomThreshold && x < SIZE - DEFAULT_REGION_SIZE && y < SIZE - DEFAULT_REGION_SIZE) {
  const roomWidth = 4 + Math.floor(random() * 3);
  const roomHeight = 4 + Math.floor(random() * 3);
  const maxY = Math.min(y + roomHeight, SIZE - 2);
  const maxX = Math.min(x + roomWidth, SIZE - 2);
  
  for (let dy = y; dy < maxY; dy++) {
    for (let dx = x; dx < maxX; dx++) {
      maze[dy][dx] = 0;
    }
  }
}
else if (rand < loopThreshold && maze[y][x] === 1) {
  let paths = 0;
  if (y > 0 && maze[y - 1][x] === 0) paths++;
  if (y < SIZE - 1 && maze[y + 1][x] === 0) paths++;
  if (x > 0 && maze[y][x - 1] === 0) paths++;
  if (x < SIZE - 1 && maze[y][x + 1] === 0) paths++;
  
  if (paths >= 2) maze[y][x] = 0;
}
else if (rand < wideningThreshold && maze[y][x] === 0 && x < SIZE - 4 && y < SIZE - 4) {
  const size = random() > 0.5 ? 3 : 4;
  const maxY = Math.min(y + size, SIZE - 1);
  const maxX = Math.min(x + size, SIZE - 1);
  
  for (let dy = y; dy < maxY; dy++) {
    for (let dx = x; dx < maxX; dx++) {
      maze[dy][dx] = 0;
    }
  }
}
}
}

for (let i = 0; i < 3; i++) {
maze[2 + i][0] = 0;
maze[SIZE - 3 - i][SIZE - 1] = 0;
}

return maze;
};

const frontierMazeAlgorithm = createAlgorithm({
name: 'Frontier Maze Generation',
type: 'maze-generation',
description: 'Generates mazes with larger rooms and corridors using frontier-style algorithm',
parameters: {
roomThreshold: numberParam(0.001, 0.005, 0.002, 0.001),
loopThreshold: numberParam(0.003, 0.01, 0.005, 0.001),
wideningThreshold: numberParam(0.001, 0.005, 0.003, 0.001)
},

async execute(input, options, onProgress) {
const { SIZE = DEFAULT_MAZE_SIZE, REGION_SIZE = DEFAULT_REGION_SIZE } = input;
const result = await executeAlgorithm(generateFrontierMaze, 'Frontier', { SIZE, REGION_SIZE }, options, onProgress);
return createAlgorithmResult(result.result, result.metrics);
}
});

// src/algorithms/maze-generation/kruskal-maze.js (placeholder as it's not used by CLI_exploration_runner)
const kruskalMazeAlgorithm = createAlgorithm({
name: 'Kruskal Maze Generation',
type: 'maze-generation',
description: 'Generates mazes using Kruskal\'s algorithm (Minimum Spanning Tree)',
parameters: {
bias: numberParam(0, 1, 0.5, 0.1)
},
async execute(input, options, onProgress) {
const { SIZE = 256, REGION_SIZE = 16 } = input;
const { bias = 0.5 } = options;

const maze = Array(SIZE).fill(null).map(() => Array(SIZE).fill(1)); // All walls initially
const uf = new UnionFind(SIZE * SIZE); // Union-Find for connected components

const walls = [];

// Initialize walls (only vertical and horizontal between cells)
for (let r = 0; r < SIZE; r += 2) {
for (let c = 0; c < SIZE; c += 2) {
  maze[r][c] = 0; // Carve passages

  // Add right wall
  if (c + 1 < SIZE - 1) {
    walls.push({
      x: c + 1, y: r,
      cell1: { x: c, y: r },
      cell2: { x: c + 2, y: r }
    });
  }
  // Add bottom wall
  if (r + 1 < SIZE - 1) {
    walls.push({
      x: c, y: r + 1,
      cell1: { x: c, y: r },
      cell2: { x: c, y: r + 2 }
    });
  }
}
}

// Shuffle walls with bias (not fully implemented here, simple shuffle for now)
for (let i = walls.length - 1; i > 0; i--) {
const j = Math.floor(Math.random() * (i + 1));
[walls[i], walls[j]] = [walls[j], walls[i]];
}

// Process walls
for (const wall of walls) {
if (wall.cell1 && wall.cell2) {
  const index1 = wall.cell1.y * SIZE + wall.cell1.x;
  const index2 = wall.cell2.y * SIZE + wall.cell2.x;

  if (uf.union(index1, index2)) {
    // If union successful (cells were in different sets), carve the wall
    if (wall.y % 2 !== 0) { // Horizontal wall
      maze[wall.y][wall.x] = 0;
    } else if (wall.x % 2 !== 0) { // Vertical wall
      maze[wall.y][wall.x] = 0;
    }
  }
}
}

// Add entrance and exit
for (let i = 0; i < 3; i++) {
  maze[2 + i][0] = 0;
  maze[SIZE - 3 - i][SIZE - 1] = 0;
}

// This section is copied from shared-utils and slightly adapted for Kruskal's output
const colors = generateColors(20);
const { coloredMaze, totalComponentCount } = analyzeComponents(maze, SIZE, REGION_SIZE, colors);
const componentGraph = buildComponentGraph(maze, coloredMaze, SIZE, REGION_SIZE);

const endTime = performance.now();

if (onProgress) {
  onProgress({
      type: 'generation_complete',
      maze,
      coloredMaze,
      componentGraph,
      totalComponents: totalComponentCount
  });
}

return createAlgorithmResult(
{
  maze,
  coloredMaze,
  componentGraph,
  totalComponents: totalComponentCount,
  colors
},
{
  executionTime: endTime - startTime,
  mazeSize: SIZE,
  regionSize: REGION_SIZE,
  componentCount: Object.keys(componentGraph).length
}
);
}
});

// src/algorithms/maze-generation/index.js
const mazeGenerationAlgorithms = {
'frontier': frontierMazeAlgorithm,
'kruskal': kruskalMazeAlgorithm
};

const getMazeGenerationAlgorithm = (name) => {
return mazeGenerationAlgorithms[name] || null;
};

const getMazeGenerationAlgorithmNames = () => {
return Object.keys(mazeGenerationAlgorithms);
};

const getMazeGenerationAlgorithmMetadata = () => {
return Object.entries(mazeGenerationAlgorithms).map(([name, algorithm]) => ({
name,
displayName: algorithm.name,
description: algorithm.description,
parameters: algorithm.parameters
}));
};

// src/algorithms/index.js
const algorithmRegistry = {
pathfinding: { 'component-based-haa-star': componentBasedHAAStarAlgorithm },
exploration: explorationAlgorithms,
'maze-generation': mazeGenerationAlgorithms
};

const getAlgorithm = (type, name) => {
return algorithmRegistry[type]?.[name] || null;
};

const getAlgorithmsByType = (type) => {
return algorithmRegistry[type] || {};
};

const getAlgorithmTypes = () => {
return Object.keys(algorithmRegistry);
};

const getAlgorithmMetadata = () => {
const metadata = {};

for (const [type, algorithms] of Object.entries(algorithmRegistry)) {
metadata[type] = Object.entries(algorithms).map(([name, algorithm]) => ({
name,
displayName: algorithm.name,
description: algorithm.description,
parameters: algorithm.parameters
}));
}

return metadata;
};

const searchAlgorithms = (query) => {
const results = [];
const lowerQuery = query.toLowerCase();

for (const [type, algorithms] of Object.entries(algorithmRegistry)) {
for (const [name, algorithm] of Object.entries(algorithms)) {
if (
  algorithm.name.toLowerCase().includes(lowerQuery) ||
  algorithm.description.toLowerCase().includes(lowerQuery) ||
  name.toLowerCase().includes(lowerQuery)
) {
  results.push({
    type,
    name,
    algorithm
  });
}
}
}

return results;
};

// MAIN DEMO CLASS:
// src/demos/exploration-demo/CLIExplorationDemo.js
class CLIExplorationDemo {
constructor() {
this.state = {
maze: [],
coloredMaze: [],
componentGraph: {},
totalComponents: 0,
start: null,
end: null,
mazeAlgorithm: 'frontier'
};

this.explorationState = {
isExploring: false,
robotPosition: null,
robotDirection: 0,
knownMap: null,
frontiers: [],
exploredPositions: [],
coverage: 0,
iteration: 0,
explorationComplete: false,
sensorPositions: [],
sensorRange: 15,
actualEnd: null,
currentPath: [],
prev_targets: []
};

this.viewport = new ASCIIViewport({
width: CLI_VIEWPORT_WIDTH,
height: CLI_VIEWPORT_HEIGHT,
buffer: CLI_VIEWPORT_BUFFER
});

this.frameBuffer = [];

this.setupKeyboardHandling();
}

setMazeData(data) {
this.state = { ...this.state, ...data };
}

startGeneration() {
}

setExplorationState(newState) {
this.explorationState = typeof newState === 'function' 
? newState(this.explorationState) 
: { ...this.explorationState, ...newState };
}

setupKeyboardHandling() {
if (process.stdin.isTTY) {
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding('utf8');

process.stdin.on('data', (key) => {
  if (key === '\u0003') {
    process.exit();
  } else if (key === CLI_SAVE_KEY) {
    this.saveAnimationBuffer();
  }
});
}
}

addFrameToBuffer(frameContent) {
const timestamp = new Date().toISOString();
const frame = {
timestamp,
content: frameContent,
robotPosition: this.explorationState.robotPosition,
coverage: this.explorationState.coverage,
iteration: this.explorationState.iteration
};

this.frameBuffer.push(frame);

if (this.frameBuffer.length > CLI_FRAME_BUFFER_SIZE) {
this.frameBuffer.shift();
}
}

saveAnimationBuffer() {
if (this.frameBuffer.length === 0) {
console.log('\n📁 No frames to save!');
return;
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const filename = `maze-exploration-${timestamp}.txt`;

let content = `Maze Exploration Animation Buffer\n`;
content += `Generated: ${new Date().toISOString()}\n`;
content += `Total frames: ${this.frameBuffer.length}\n`;
content += `Maze size: ${this.state.maze.length}x${this.state.maze.length}\n`;
content += `${'='.repeat(80)}\n\n`;

this.frameBuffer.forEach((frame, index) => {
content += `Frame ${index + 1}/${this.frameBuffer.length}\n`;
content += `Timestamp: ${frame.timestamp}\n`;
content += `Robot: (${frame.robotPosition?.row || 'N/A'}, ${frame.robotPosition?.col || 'N/A'})\n`;
content += `Coverage: ${frame.coverage?.toFixed(1) || '0.0'}% | Iteration: ${frame.iteration || 0}\n`;
content += `${'-'.repeat(80)}\n`;
content += frame.content;
content += `\n${'='.repeat(80)}\n\n`;
});

try {
require('fs').writeFileSync(filename, content);
console.log(`\n💾 Animation saved to: ${filename}`);
console.log(`📊 Saved ${this.frameBuffer.length} frames`);
} catch (error) {
console.error(`\n❌ Error saving animation: ${error.message}`);
}
}

getMazeGenerationAlgorithm() {
return getAlgorithm('maze-generation', this.state.mazeAlgorithm);
}

getExplorationAlgorithm() {
return getAlgorithm('exploration', 'component-based-exploration');
}

findRandomStart(maze) {
const walkableCells = [];
for (let row = 0; row < maze.length; row++) {
for (let col = 0; col < maze[row].length; col++) {
  if (maze[row][col] === 0) {
    walkableCells.push({ row, col });
  }
}
}
return walkableCells[Math.floor(Math.random() * walkableCells.length)];
}

getCellCheckers() {
const { robotPosition, frontiers, knownMap } = this.explorationState;

const frontierSet = new Set(frontiers.map(f => `${f.row},${f.col}`));

const frontierCircleSizes = new Map();
if (robotPosition && frontiers.length > 0) {
const pathDistances = frontiers.map(f => ({
  key: `${f.row},${f.col}`,
  distance: f.pathDistance || Infinity
}));

const reachableDistances = pathDistances.filter(d => d.distance < Infinity);

if (reachableDistances.length > 0) {
  const closestDistance = Math.min(...reachableDistances.map(d => d.distance));
  
  pathDistances.forEach(({ key, distance }) => {
    if (distance === Infinity) {
      frontierCircleSizes.set(key, 0.2);
    } else {
      const normalizedDistance = distance / Math.max(closestDistance, 1);
      const circleSize = Math.max(0.3, 1.0 / normalizedDistance);
      frontierCircleSizes.set(key, circleSize);
    }
  });
}
}

const exploredSet = new Set();
if (knownMap) {
for (let row = 0; row < knownMap.length; row++) {
  for (let col = 0; col < knownMap[row].length; col++) {
    if (knownMap[row][col] === CELL_STATES.WALKABLE) {
      exploredSet.add(`${row},${col}`);
    }
  }
}
}

const detailedPathSet = new Set();
const componentTransitionSet = new Set();

if (this.explorationState.currentPath && this.explorationState.currentPath.length > 0) {
const remainingPath = this.explorationState.currentPath;
remainingPath.forEach(pos => {
  detailedPathSet.add(`${pos.row},${pos.col}`);
});

if (this.explorationState.componentGraph) {
  for (let i = 0; i < remainingPath.length - 1; i++) {
    const current = remainingPath[i];
    const next = remainingPath[i + 1];
    
    const currentComponent = this.findPositionComponent(current, this.explorationState.componentGraph);
    const nextComponent = this.findPositionComponent(next, this.explorationState.componentGraph);
    
    if (currentComponent && nextComponent && currentComponent !== nextComponent) {
      componentTransitionSet.add(`${next.row},${next.col}`);
    }
  }
}
}

const unreachableFrontierSet = new Set(
frontiers
  .filter(f => f.isReachable === false)
  .map(f => `${f.row},${f.col}`)
);

return {
isRobotPosition: (row, col) => {
  return robotPosition && robotPosition.row === row && robotPosition.col === col;
},
isFrontier: (row, col) => {
  return frontierSet.has(`${row},${col}`);
},
isUnreachableFrontier: (row, col) => {
  return unreachableFrontierSet.has(`${row},${col}`);
},
isExplored: (row, col) => {
  return exploredSet.has(`${row},${col}`);
},
isUnknown: (row, col) => {
  if (!knownMap || !knownMap[row] || knownMap[row][col] === undefined) {
    return true;
  }
  return knownMap[row][col] === CELL_STATES.UNKNOWN;
},
isInDetailedPath: (row, col) => {
  return detailedPathSet.has(`${row},${col}`);
},
isComponentTransition: (row, col) => {
  return componentTransitionSet.has(`${row},${col}`);
},
isStartPoint: (row, col) => {
  return this.state.start && this.state.start.row === row && this.state.start.col === col;
},
isActualEnd: (row, col) => {
  return this.explorationState.actualEnd && 
         this.explorationState.actualEnd.row === row && 
         this.explorationState.actualEnd.col === col;
},
getFrontierCircleSize: (row, col) => {
  return frontierCircleSizes.get(`${row},${col}`) || 0;
}
};
}

findPositionComponent(position, componentGraph) {
for (const [nodeId, component] of Object.entries(componentGraph)) {
if (component.cells && component.cells.some(cell => 
  cell.row === position.row && cell.col === position.col
)) {
  return nodeId;
}
}
return null;
}

getExplorationColors() {
const generatePathfindingColors = (count = 20) => {
const colors = [];
const goldenAngle = 137.508;

for (let i = 0; i < count; i++) {
  const hue = (i * goldenAngle) % 360;
  colors.push(`hsl(${hue}, 70%, 60%)`);
}
return colors;
};

return {
ROBOT: '#00ff00',
FRONTIER: '#ff6b6b',
EXPLORED: '#e8e8e8',
START: '#10B981',
UNKNOWN: '#808080',
pathfindingColors: generatePathfindingColors(20)
};
}

async generateNewMaze() {
const mazeGenerationAlgorithm = this.getMazeGenerationAlgorithm();
if (!mazeGenerationAlgorithm) {
console.error('No maze generation algorithm found for:', this.state.mazeAlgorithm);
return;
}

this.startGeneration();

this.setExplorationState({
isExploring: false,
robotPosition: null,
robotDirection: 0,
knownMap: null,
frontiers: [],
exploredPositions: [],
coverage: 0,
iteration: 0,
explorationComplete: false,
sensorPositions: [],
sensorRange: 15,
actualEnd: null,
currentPath: []
});

try {
const result = await mazeGenerationAlgorithm.execute(
  { SIZE: DEFAULT_MAZE_SIZE, REGION_SIZE: DEFAULT_REGION_SIZE },
  {},
  (progress) => {
    if (progress.type === 'generation_complete') {
      const start = this.findRandomStart(progress.maze);
      
      this.setMazeData({
        maze: progress.maze,
        coloredMaze: progress.coloredMaze,
        componentGraph: progress.componentGraph,
        totalComponents: progress.totalComponents,
        start,
        end: null
      });
    }
  }
);

if (result.result) {
  const { maze, coloredMaze, componentGraph, totalComponents } = result.result;
  const start = this.findRandomStart(maze);
  
  this.setMazeData({
    maze,
    coloredMaze,
    componentGraph,
    totalComponents,
    start,
    end: null
  });
}
} catch (error) {
console.error('Maze generation failed:', error);
}
}

async startExploration() {
const explorationAlgorithm = this.getExplorationAlgorithm();
if (!explorationAlgorithm || !this.state.maze || !this.state.start) {
console.error('Cannot start exploration: missing algorithm, maze, or start position');
return;
}

this.setExplorationState(prev => ({
...prev,
isExploring: true,
explorationComplete: false
}));
await explorationAlgorithm.execute(
{
  maze: this.state.maze,
  start: this.state.start,
  SIZE: DEFAULT_MAZE_SIZE
},
{
  sensorRange: 15,
  stepSize: 1.0,
  maxIterations: 500,
  explorationThreshold: 95,
  useWFD: 'true',
  frontierStrategy: 'nearest',
  delay: 100
},
(progress) => {
  if (progress.type === 'exploration_progress') {
    this.setExplorationState(prev => ({
      ...prev,
      robotPosition: progress.robotPosition,
      robotDirection: progress.robotDirection,
      knownMap: progress.knownMap,
      frontiers: progress.frontiers,
      exploredPositions: progress.exploredPositions,
      coverage: progress.coverage,
      iteration: progress.iteration,
      sensorPositions: progress.sensorPositions,
      actualEnd: progress.actualEnd,
      currentPath: progress.currentPath || []
    }));
    
    this.setMazeData({
      maze: this.state.maze,
      coloredMaze: progress.coloredMaze,
      componentGraph: progress.componentGraph,
      totalComponents: Object.keys(progress.componentGraph).length,
      start: this.state.start,
      end: null
    });
    
    this.printMaze(false);
    
    return new Promise(resolve => setTimeout(resolve, 200));
  }
}
);

this.setExplorationState(prev => ({
...prev,
isExploring: false,
explorationComplete: true
}));

}

stopExploration() {
this.setExplorationState(prev => ({
...prev,
isExploring: false
}));
}

resetExploration() {
this.setExplorationState({
isExploring: false,
robotPosition: null,
robotDirection: 0,
knownMap: null,
frontiers: [],
exploredPositions: [],
coverage: 0,
iteration: 0,
explorationComplete: false,
sensorPositions: [],
sensorRange: 15,
actualEnd: null,
currentPath: []
});
}

getComputed() {
return {
canStartExploration: this.state.maze.length > 0 && this.state.start && !this.explorationState.isExploring,
canGenerateNewMaze: !this.explorationState.isExploring,
hasRobot: this.explorationState.robotPosition !== null,
isComplete: this.explorationState.explorationComplete
};
}

getASCIIChar(row, col, cellCheckers) {
if (cellCheckers.isRobotPosition(row, col)) {
return '@';
}

if (cellCheckers.isStartPoint(row, col)) {
return '@';
}

if (cellCheckers.isInDetailedPath(row, col)) {
return '*';
}

if (cellCheckers.isFrontier(row, col)) {
return '?';
}

if (cellCheckers.isExplored(row, col)) {
return ' ';
}

if (cellCheckers.isUnknown(row, col)) {
return '█';
}

if (this.state.maze[row] && this.state.maze[row][col] === 1) {
return '█';
}

return '░';
}

renderASCII() {
if (!this.state.maze || this.state.maze.length === 0) {
return "Loading maze...";
}

const mazeSize = this.state.maze.length;

const cameraTarget = this.explorationState.robotPosition || this.state.start || { row: 0, col: 0 };

this.viewport.updateCamera(cameraTarget, mazeSize);

const bounds = this.viewport.getVisibleBounds(mazeSize);

const cellCheckers = this.getCellCheckers();

let output = '';

for (let row = bounds.startRow; row < bounds.endRow; row++) {
let line = '';
for (let col = bounds.startCol; col < bounds.endCol; col++) {
  if (row >= 0 && row < mazeSize && col >= 0 && col < mazeSize) {
    line += this.getASCIIChar(row, col, cellCheckers);
  } else {
    line += ' ';
  }
}
output += line + '\n';
}

return output;
}

printMaze(clearScreen = true) {
if (clearScreen) {
process.stdout.write('\x1B[2J\x1B[0f');
} else {
process.stdout.write('\x1B[0f');
}

const mazeSize = this.state.maze.length;
const robotPos = this.explorationState.robotPosition;
const viewportStats = this.viewport.getViewportStats(mazeSize);

let frameContent = '';
frameContent += 'CLI Exploration Demo - Component-based Exploration\n';
frameContent += 'Legend: █=Wall/Unknown, ░=Walkable, ?=Frontier, @=Robot, *=Path,  =Explored\n';
frameContent += `Coverage: ${this.explorationState.coverage?.toFixed(1) || '0.0'}% | Iteration: ${this.explorationState.iteration || 0}\n`;

if (robotPos) {
frameContent += `Robot: (${robotPos.row}, ${robotPos.col}) | Maze: ${mazeSize}x${mazeSize} | Culling: ${viewportStats.cullPercentage}\n`;
}

frameContent += '=' + '='.repeat(CLI_VIEWPORT_WIDTH) + '\n';
frameContent += this.renderASCII();
frameContent += `\nPress '${CLI_SAVE_KEY}' to save last ${CLI_FRAME_BUFFER_SIZE} frames | Ctrl+C to exit\n`;

this.addFrameToBuffer(frameContent);

console.log('CLI Exploration Demo - Component-based Exploration');
console.log('Legend: █=Wall/Unknown, ░=Walkable, ?=Frontier, @=Robot, *=Path,  =Explored');
console.log(`Coverage: ${this.explorationState.coverage?.toFixed(1) || '0.0'}% | Iteration: ${this.explorationState.iteration || 0}`);

if (robotPos) {
console.log(`Robot: (${robotPos.row}, ${robotPos.col}) | Maze: ${mazeSize}x${mazeSize} | Culling: ${viewportStats.cullPercentage}`);
}

console.log('=' + '='.repeat(CLI_VIEWPORT_WIDTH));
console.log(this.renderASCII());
}

getData() {
return {
state: this.state,
explorationState: this.explorationState,
computed: this.getComputed(),

cellCheckers: this.getCellCheckers(),

explorationColors: this.getExplorationColors(),

algorithms: {
  mazeGeneration: this.getMazeGenerationAlgorithm(),
  exploration: this.getExplorationAlgorithm()
}
};
}
}




async function runExplorationDemo() {
console.log('🚀 Starting CLI Exploration Demo...\n');

try {
const demo = new CLIExplorationDemo();

console.log('📦 Generating maze...');
await demo.generateNewMaze();

if (demo.state.maze.length === 0) {
console.log('❌ Failed to generate maze');
return;
}

console.log('✅ Maze generated successfully!');
console.log(`   Size: ${demo.state.maze.length}x${demo.state.maze.length}`);
console.log(`   Start: (${demo.state.start?.row}, ${demo.state.start?.col})`);
console.log(`   Components: ${demo.state.totalComponents}`);

console.log('\n🗺️  Initial maze state:');
demo.printMaze();

console.log('\n🤖 Starting exploration...');

await demo.startExploration();

console.log('\n🎉 Exploration completed!');
console.log(`   Final coverage: ${demo.explorationState.coverage?.toFixed(1) || '0.0'}%`);
console.log(`   Iterations: ${demo.explorationState.iteration || 0}`);

console.log('\n🗺️  Final maze state:');
demo.printMaze();

console.log('\n✅ Demo completed successfully!');

} catch (error) {
console.error('❌ Demo failed:', error.message);
console.error(error.stack);
process.exit(1);
}
}

process.on('SIGINT', () => {
console.log('\n👋 Goodbye!');
process.exit(0);
});

runExplorationDemo();