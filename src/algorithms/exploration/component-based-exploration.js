/**
 * Component-Based Exploration Algorithm
 * 
 * Novel "Dynamic HPA* for Unknown Environments" approach that combines:
 * - Online component graph evolution during exploration
 * - Component-aware frontier detection and selection
 * - HAA* pathfinding with dynamically discovered structure
 * 
 * Based on the pseudocode from EXPLORATION_PSEUDOCODE.md
 */

import { createAlgorithm, createAlgorithmResult, numberParam, selectParam } from '../algorithm-interface.js';
import { 
  buildComponentGraph, 
  findComponentBasedHAAStarPath,
  getComponentNodeId 
} from '../pathfinding/component-based-haa-star.js';
import { findConnectedComponents } from '../../core/utils/maze-utils.js';
import { SensorManager, DirectionalConeSensor } from '../../core/sensors/index.js';
import { WavefrontFrontierDetection } from '../../core/frontier/index.js';

// Cell states for known map
const CELL_STATES = {
  UNKNOWN: 2,
  WALL: 1,
  WALKABLE: 0
};

/**
 * Advanced robot sensor scanning using DirectionalConeSensor with line-of-sight
 * Returns positions that would be visible to the robot's sensors
 */
const scanWithSensors = (robotPosition, sensorRange, maze, robotDirection = 0) => {
  const SIZE = maze.length;
  const sensorManager = new SensorManager(SIZE, SIZE);
  sensorManager.addSensor('cone', new DirectionalConeSensor(SIZE, SIZE));
  
  // Convert 2D maze to flat array for SensorManager (required format)
  const flatMaze = new Uint8Array(SIZE * SIZE);
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      flatMaze[r * SIZE + c] = maze[r][c];
    }
  }
  
  // Get sensor positions with line-of-sight checking
  const positions = sensorManager.getAllSensorPositions(
    robotPosition.col, // Note: SensorManager expects x,y (col,row)
    robotPosition.row, 
    robotDirection, 
    { sensorRange }
  );
  
  // Filter positions that have line of sight and convert back to row/col format
  const visiblePositions = positions.filter(([x, y]) => 
    sensorManager.hasLineOfSight(flatMaze, 
      Math.floor(robotPosition.col), Math.floor(robotPosition.row), x, y)
  ).map(([x, y]) => ({ row: y, col: x }));
  
  return visiblePositions;
};

/**
 * Update known map with sensor readings
 */
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

/**
 * Online component structure updates
 * Handles component growth, merging, and evolution
 */
const updateComponentStructure = (knownMap, componentGraph, coloredMaze, newCells, REGION_SIZE) => {
  const SIZE = knownMap.length;
  const numRegions = SIZE / REGION_SIZE;
  
  // Track regions that need component reanalysis
  const regionsToUpdate = new Set();
  
  for (const newCell of newCells) {
    if (newCell.newState === CELL_STATES.WALKABLE) {
      const regionRow = Math.floor(newCell.row / REGION_SIZE);
      const regionCol = Math.floor(newCell.col / REGION_SIZE);
      regionsToUpdate.add(`${regionRow},${regionCol}`);
    }
  }
  
  // Rebuild components for affected regions
  const newComponentGraph = { ...componentGraph };
  const newColoredMaze = coloredMaze.map(row => [...row]);
  
  for (const regionKey of regionsToUpdate) {
    const [regionRow, regionCol] = regionKey.split(',').map(Number);
    const startRow = regionRow * REGION_SIZE;
    const startCol = regionCol * REGION_SIZE;
    
    
    // Clear existing components in this region
    Object.keys(newComponentGraph).forEach(nodeId => {
      if (nodeId.startsWith(`${regionRow},${regionCol}_`)) {
        delete newComponentGraph[nodeId];
      }
    });
    
    // Clear colored maze for this region
    for (let r = startRow; r < startRow + REGION_SIZE; r++) {
      for (let c = startCol; c < startCol + REGION_SIZE; c++) {
        if (r < SIZE && c < SIZE) {
          newColoredMaze[r][c] = -1;
        }
      }
    }
    
    // Reanalyze components in this region
    const components = findConnectedComponents(knownMap, startRow, startCol, REGION_SIZE);
    
    
    // Create new component nodes
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
      
      
      // Color the cells
      component.forEach(cell => {
        newColoredMaze[cell.row][cell.col] = componentId;
      });
    });
  }
  
  // ROBUST FIX: More aggressive connection rebuilding to prevent missing connections
  // Get ALL regions that might need connection updates (wider net to catch edge cases)
  const affectedRegions = new Set();
  
  // Add all updated regions and their neighbors (2-level neighborhood for safety)
  for (const regionKey of regionsToUpdate) {
    const [regionRow, regionCol] = regionKey.split(',').map(Number);
    
    // Add 2-level neighborhood to ensure we catch all potential connections
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const neighborRow = regionRow + dr;
        const neighborCol = regionCol + dc;
        if (neighborRow >= 0 && neighborRow < numRegions && 
            neighborCol >= 0 && neighborCol < numRegions) {
          affectedRegions.add(`${neighborRow},${neighborCol}`);
        }
      }
    }
  }
  
  console.log(`DEBUG: Rebuilding connections for ${affectedRegions.size} regions:`, [...affectedRegions]);
  
  // Clear ALL connections for affected regions (complete rebuild)
  for (const nodeId of Object.keys(newComponentGraph)) {
    const [regionPart] = nodeId.split('_');
    if (affectedRegions.has(regionPart)) {
      newComponentGraph[nodeId].neighbors = [];
      newComponentGraph[nodeId].transitions = [];
    }
  }
  
  // COMPREHENSIVE connection rebuilding - check ALL possible border connections
  for (const regionKey of affectedRegions) {
    const [regionRow, regionCol] = regionKey.split(',').map(Number);
    
    // Check RIGHT border connections (this region to region on the right)
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
            
            // More robust existence check
            if (newComponentGraph[leftNodeId] && newComponentGraph[rightNodeId] && 
                leftNodeId !== rightNodeId) {
              
              // Add bidirectional connection with duplicate checking
              if (!newComponentGraph[leftNodeId].neighbors.includes(rightNodeId)) {
                newComponentGraph[leftNodeId].neighbors.push(rightNodeId);
                newComponentGraph[leftNodeId].transitions.push({
                  to: rightNodeId,
                  fromCell: { row: r, col: borderCol },
                  toCell: { row: r, col: borderCol + 1 }
                });
                console.log(`DEBUG: Added connection ${leftNodeId} -> ${rightNodeId} at border (${r}, ${borderCol})`);
              }
              
              if (!newComponentGraph[rightNodeId].neighbors.includes(leftNodeId)) {
                newComponentGraph[rightNodeId].neighbors.push(leftNodeId);
                newComponentGraph[rightNodeId].transitions.push({
                  to: leftNodeId,
                  fromCell: { row: r, col: borderCol + 1 },
                  toCell: { row: r, col: borderCol }
                });
              }
            } else {
              if (!newComponentGraph[leftNodeId]) {
                console.log(`DEBUG: Missing left component ${leftNodeId} at (${r}, ${borderCol})`);
              }
              if (!newComponentGraph[rightNodeId]) {
                console.log(`DEBUG: Missing right component ${rightNodeId} at (${r}, ${borderCol + 1})`);
              }
            }
          }
        }
      }
    }
    
    // Check BOTTOM border connections (this region to region below)
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
            
            // More robust existence check
            if (newComponentGraph[topNodeId] && newComponentGraph[bottomNodeId] && 
                topNodeId !== bottomNodeId) {
              
              // Add bidirectional connection with duplicate checking
              if (!newComponentGraph[topNodeId].neighbors.includes(bottomNodeId)) {
                newComponentGraph[topNodeId].neighbors.push(bottomNodeId);
                newComponentGraph[topNodeId].transitions.push({
                  to: bottomNodeId,
                  fromCell: { row: borderRow, col: c },
                  toCell: { row: borderRow + 1, col: c }
                });
                console.log(`DEBUG: Added connection ${topNodeId} -> ${bottomNodeId} at border (${borderRow}, ${c})`);
              }
              
              if (!newComponentGraph[bottomNodeId].neighbors.includes(topNodeId)) {
                newComponentGraph[bottomNodeId].neighbors.push(topNodeId);
                newComponentGraph[bottomNodeId].transitions.push({
                  to: topNodeId,
                  fromCell: { row: borderRow + 1, col: c },
                  toCell: { row: borderRow, col: c }
                });
              }
            } else {
              if (!newComponentGraph[topNodeId]) {
                console.log(`DEBUG: Missing top component ${topNodeId} at (${borderRow}, ${c})`);
              }
              if (!newComponentGraph[bottomNodeId]) {
                console.log(`DEBUG: Missing bottom component ${bottomNodeId} at (${borderRow + 1}, ${c})`);
              }
            }
          }
        }
      }
    }
  }
  
  return { componentGraph: newComponentGraph, coloredMaze: newColoredMaze };
};

/**
 * Advanced component-aware frontier detection using WFD algorithm
 * Combines research-grade WFD with component awareness
 */
const detectComponentAwareFrontiers = (knownMap, componentGraph, coloredMaze, useWFD = true, frontierStrategy = 'centroid') => {
  const SIZE = knownMap.length;
  
  if (useWFD) {
    const wfdDetector = new WavefrontFrontierDetection(SIZE, SIZE);
    
    // Convert 2D knownMap to flat array for WFD
    const flatKnownMap = new Uint8Array(SIZE * SIZE);
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        flatKnownMap[r * SIZE + c] = knownMap[r][c];
      }
    }
    
    const frontierGroups = wfdDetector.detectFrontiers(flatKnownMap);
    
    // Convert frontier groups to component-aware frontiers
    const componentAwareFrontiers = [];
    
    for (const group of frontierGroups) {
      let targetPoint = null;
      
      // Select frontier target based on strategy
      if (frontierStrategy === 'centroid') {
        targetPoint = { row: Math.floor(group.centroid.y), col: Math.floor(group.centroid.x) };
      } else if (frontierStrategy === 'median') {
        targetPoint = { row: Math.floor(group.median.y), col: Math.floor(group.median.x) };
      } else {
        const firstPoint = group.points[0];
        targetPoint = { row: Math.floor(firstPoint.y), col: Math.floor(firstPoint.x) };
      }
      
      if (targetPoint) {
        // Find which component this frontier is associated with - use same logic as pathfinding
        let associatedComponent = getComponentNodeId(targetPoint, coloredMaze, 8);
        
        // If frontier is not directly in a component, find the closest one
        if (!associatedComponent) {
          let closestComponent = null;
          let minDistance = Infinity;
          
          for (const [nodeId, component] of Object.entries(componentGraph)) {
            for (const cell of component.cells) {
              const distance = Math.abs(cell.row - targetPoint.row) + Math.abs(cell.col - targetPoint.col);
              if (distance < minDistance) {
                minDistance = distance;
                closestComponent = nodeId;
              }
            }
          }
          
          associatedComponent = closestComponent;
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
    
    console.log('Component-aware frontiers:', componentAwareFrontiers.length);
    return componentAwareFrontiers;
  }
  
  // Use basic frontier detection when WFD is disabled
  const basicFrontiers = detectBasicFrontiers(knownMap, componentGraph);
  console.log('Basic frontiers:', basicFrontiers.length);
  return basicFrontiers;
};

/**
 * Basic frontier detection (fallback)
 */
const detectBasicFrontiers = (knownMap, componentGraph) => {
  const frontiers = [];
  const SIZE = knownMap.length;
  
  // Iterate through all component cells to find frontier points
  for (const nodeId of Object.keys(componentGraph)) {
    const component = componentGraph[nodeId];
    
    for (const cell of component.cells) {
      // Check if this cell borders unknown space
      const neighbors = [
        { row: cell.row - 1, col: cell.col },
        { row: cell.row + 1, col: cell.col },
        { row: cell.row, col: cell.col - 1 },
        { row: cell.row, col: cell.col + 1 }
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

/**
 * Select optimal frontier using nearest strategy
 * Can be enhanced with more sophisticated component-aware strategies
 */
const selectOptimalFrontier = (frontiers, robotPosition) => {
  if (frontiers.length === 0) return null;
  
  let bestFrontier = null;
  let minDistance = Infinity;
  
  for (const frontier of frontiers) {
    const distance = Math.sqrt(
      Math.pow(frontier.row - robotPosition.row, 2) + 
      Math.pow(frontier.col - robotPosition.col, 2)
    );
    
    if (distance < minDistance) {
      minDistance = distance;
      bestFrontier = frontier;
    }
  }
  
  return bestFrontier;
};

/**
 * Simple BFS to check if path exists (for debugging)
 */
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
    
    // Check 4 neighbors
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

/**
 * Simple A* pathfinding for debugging purposes only
 */
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

/**
 * Component-aware pathfinding using existing HAA* infrastructure
 */
const findComponentPath = (start, goal, knownMap, componentGraph, coloredMaze, REGION_SIZE) => {
  const SIZE = knownMap.length;
  
  // DEBUG: Test with simple A* first to see if path exists at all
  const debugPath = debugSimpleAStar(start, goal, knownMap);
  if (debugPath) {
    console.log(`DEBUG: Simple A* found path with ${debugPath.length} steps:`);
    console.log(`DEBUG: A* Path:`, debugPath.map(p => `(${p.row},${p.col})`).join(' -> '));
  } else {
    console.log(`DEBUG: Simple A* pathfinding result: no path found`);
  }
  
  // DEBUG: Check component connectivity
  const startComponent = getComponentNodeId(start, coloredMaze, REGION_SIZE);
  const goalComponent = getComponentNodeId(goal, coloredMaze, REGION_SIZE);
  console.log(`DEBUG: Start component: ${startComponent}, Goal component: ${goalComponent}`);
  
  if (startComponent && goalComponent && startComponent !== goalComponent) {
    // Check if components are connected in the graph
    const startNode = componentGraph[startComponent];
    const goalNode = componentGraph[goalComponent];
    
    if (startNode && goalNode) {
      const isConnected = startNode.neighbors.includes(goalComponent);
      console.log(`DEBUG: Component connection ${startComponent} -> ${goalComponent}: ${isConnected ? 'CONNECTED' : 'NOT CONNECTED'}`);
      
      if (!isConnected) {
        console.log(`DEBUG: Start component neighbors:`, startNode.neighbors);
        console.log(`DEBUG: Goal component neighbors:`, goalNode.neighbors);
      }
    } else {
      console.log(`DEBUG: Missing component nodes - Start: ${!!startNode}, Goal: ${!!goalNode}`);
    }
  }
  
  // Use original HAA* pathfinding
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

/**
 * Main Component-Based Exploration Algorithm
 */
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
    frontierStrategy: selectParam(['nearest', 'centroid', 'median'], 'nearest')
  },
  
  async execute(input, options, onProgress) {
    const { maze: fullMaze, start: startPos, SIZE = 256 } = input;
    const { 
      sensorRange = 15,
      stepSize = 1.0,
      maxIterations = 10000,
      explorationThreshold = 100,
      useWFD = 'true',
      frontierStrategy = 'nearest',
      delay = 50
    } = options;
    
    const REGION_SIZE = 8;
    const startTime = performance.now();
    
    // Initialize exploration state
    let robotPosition = { row: startPos.row, col: startPos.col };
    let robotDirection = 0; // 0=NORTH, 1=EAST, 2=SOUTH, 3=WEST
    
    // Initialize known map with everything unknown
    let knownMap = Array(SIZE).fill(null).map(() => Array(SIZE).fill(CELL_STATES.UNKNOWN));
    
    // Initialize colored maze for component tracking
    let coloredMaze = Array(SIZE).fill(null).map(() => Array(SIZE).fill(-1));
    
    // Initialize empty component graph
    let componentGraph = {};
    
    // Initial sensor scan with direction
    const initialSensorPositions = scanWithSensors(robotPosition, sensorRange, fullMaze, robotDirection);
    const initialUpdate = updateKnownMap(knownMap, fullMaze, initialSensorPositions);
    knownMap = initialUpdate.knownMap;
    
    // Build initial component graph
    const initialComponentUpdate = updateComponentStructure(
      knownMap, componentGraph, coloredMaze, initialUpdate.newCells, REGION_SIZE
    );
    componentGraph = initialComponentUpdate.componentGraph;
    coloredMaze = initialComponentUpdate.coloredMaze;
    
    let exploredPositions = [{ ...robotPosition }];
    let iterationCount = 0;
    
    // Track current path for visualization
    let currentPath = [];
    let currentPathIndex = 0;
    
    // DEBUG: Track frontier selection history
    let frontierHistory = [];
    let lastSelectedFrontier = null;
    let sameTargetCount = 0;
    let lastDistanceToTarget = Infinity;
    
    // Main exploration loop: SENSE → UPDATE → PLAN → NAVIGATE → MOVE
    while (true) {
      iterationCount++;
      
      // Safety check to prevent infinite loops
      // if (iterationCount > maxIterations) {
      //   console.log(`Exploration stopped: Reached maximum iterations (${maxIterations})`);
      //   break;
      // }
      
      // 1. SENSE: Robot scans environment with current direction
      const sensorPositions = scanWithSensors(robotPosition, sensorRange, fullMaze, robotDirection);
      const updateResult = updateKnownMap(knownMap, fullMaze, sensorPositions);
      knownMap = updateResult.knownMap;
      
      // 2. UPDATE: Online component analysis
      if (updateResult.newCells.length > 0) {
        const componentUpdate = updateComponentStructure(
          knownMap, componentGraph, coloredMaze, updateResult.newCells, REGION_SIZE
        );
        componentGraph = componentUpdate.componentGraph;
        coloredMaze = componentUpdate.coloredMaze;
      }
      
      // 3. PLAN: Find next exploration target using advanced frontier detection
      const frontiers = detectComponentAwareFrontiers(
        knownMap, 
        componentGraph,
        coloredMaze,
        useWFD === 'true', 
        frontierStrategy
      );
      
      // Check exploration completion - PRIMARY TERMINATION CONDITION
      if (frontiers.length === 0) {
        console.log(`Exploration completed: No more frontiers found after ${iterationCount} iterations (Coverage: ${coverage.toFixed(1)}%)`);
        break; // No more frontiers to explore
      }
      

      
      // Calculate coverage
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
      const coverage = totalCells > 0 ? (knownCells / totalCells) * 100 : 0;
      
      if (coverage >= explorationThreshold) {
        console.log(`Exploration completed: Coverage threshold reached ${coverage.toFixed(1)}% >= ${explorationThreshold}% after ${iterationCount} iterations`);
        break; // Exploration threshold reached
      }
      
      const targetFrontier = selectOptimalFrontier(frontiers, robotPosition);
      if (!targetFrontier) {
        console.log(`Exploration stopped: No valid frontier target found after ${iterationCount} iterations`);
        break;
      }
      
      // DEBUG: Track frontier selection patterns
      const frontierKey = `${targetFrontier.row},${targetFrontier.col}`;
      frontierHistory.push(frontierKey);
      
      if (lastSelectedFrontier && lastSelectedFrontier === frontierKey) {
        sameTargetCount++;
        if (sameTargetCount > 10) {
          console.log(`DEBUG: Same frontier selected too many times (${sameTargetCount})`, targetFrontier);
          console.log('DEBUG: Robot position:', robotPosition);
          console.log('DEBUG: Available frontiers:', frontiers.map(f => `(${f.row},${f.col})`));
          // throw new Error(`DEBUG: Same frontier (${frontierKey}) selected ${sameTargetCount} times - robot stuck!`);
        }
      } else {
        sameTargetCount = 1;
        lastSelectedFrontier = frontierKey;
      }
      
      // DEBUG: Check if target frontier is valid
      if (targetFrontier.row < 0 || targetFrontier.row >= SIZE || targetFrontier.col < 0 || targetFrontier.col >= SIZE) {
        throw new Error(`DEBUG: Invalid target frontier at (${targetFrontier.row}, ${targetFrontier.col})`);
      }
      
      // 4. NAVIGATE: Use component-based pathfinding
      console.log(`DEBUG: Attempting pathfinding from (${robotPosition.row}, ${robotPosition.col}) to (${targetFrontier.row}, ${targetFrontier.col})`);
      
      const pathResult = findComponentPath(
        robotPosition, 
        { row: targetFrontier.row, col: targetFrontier.col },
        knownMap,
        componentGraph,
        coloredMaze,
        REGION_SIZE
      );
      
      console.log(`DEBUG: Pathfinding result - path length: ${pathResult?.path ? pathResult.path.length : 'null'}`);
      
      if (!pathResult?.path || pathResult.path.length === 0) {
        // DEBUG: Detailed pathfinding failure analysis
        const robotComponent = getComponentNodeId(robotPosition, coloredMaze, REGION_SIZE);
        const frontierComponent = getComponentNodeId({ row: targetFrontier.row, col: targetFrontier.col }, coloredMaze, REGION_SIZE);
        
        console.log('DEBUG PATHFINDING FAILURE:');
        console.log('- Robot at:', robotPosition);
        console.log('- Robot component:', robotComponent);
        console.log('- Target frontier:', targetFrontier);
        console.log('- Frontier component:', frontierComponent);
        console.log('- Known map at robot:', knownMap[robotPosition.row][robotPosition.col]);
        console.log('- Known map at frontier:', knownMap[targetFrontier.row][targetFrontier.col]);
        console.log('- Component graph keys:', Object.keys(componentGraph));
        console.log('- Frontier details:', targetFrontier);
        
        // DEBUG: Try simple A* pathfinding as fallback to test if path exists
        console.log('DEBUG: Testing if path exists with simple grid search...');
        const simplePathExists = checkSimplePathExists(robotPosition, targetFrontier, knownMap);
        console.log('- Simple path exists:', simplePathExists);
        
        // Check if frontier is actually walkable in known map
        if (knownMap[targetFrontier.row][targetFrontier.col] !== CELL_STATES.WALKABLE) {
          throw new Error(`DEBUG: Frontier (${targetFrontier.row}, ${targetFrontier.col}) is not walkable in known map! State: ${knownMap[targetFrontier.row][targetFrontier.col]}`);
        }
        
        // Check if robot position is walkable
        if (knownMap[robotPosition.row][robotPosition.col] !== CELL_STATES.WALKABLE) {
          throw new Error(`DEBUG: Robot position (${robotPosition.row}, ${robotPosition.col}) is not walkable! State: ${knownMap[robotPosition.row][robotPosition.col]}`);
        }
        
        throw new Error(`DEBUG: No path found from (${robotPosition.row}, ${robotPosition.col}) to frontier (${targetFrontier.row}, ${targetFrontier.col}) at iteration ${iterationCount}. Robot component: ${robotComponent}, Frontier component: ${frontierComponent}`);
      }
      
      // Update current path for visualization
      currentPath = [...pathResult.path];
      currentPathIndex = 0;
      
      // Store actualEnd for visualization
      const currentActualEnd = pathResult.actualEnd;
      
      // 5. MOVE: Execute path segment and update robot direction
      const targetIndex = Math.min(Math.floor(stepSize) + 1, pathResult.path.length - 1);
      
      // DEBUG: Check if robot is actually moving
      const oldPosition = { ...robotPosition };
      
      if (targetIndex > 0) {
        const newPosition = { row: pathResult.path[targetIndex].row, col: pathResult.path[targetIndex].col };
        
        // Update robot direction based on movement
        const deltaRow = newPosition.row - robotPosition.row;
        const deltaCol = newPosition.col - robotPosition.col;
        
        if (Math.abs(deltaRow) > Math.abs(deltaCol)) {
          // Vertical movement
          robotDirection = deltaRow < 0 ? 0 : 2; // NORTH : SOUTH
        } else if (deltaCol !== 0) {
          // Horizontal movement
          robotDirection = deltaCol > 0 ? 1 : 3; // EAST : WEST
        }
        // If deltaRow === 0 && deltaCol === 0, keep current direction
        
        robotPosition = newPosition;
        exploredPositions.push({ ...robotPosition });
        
        // DEBUG: Check if robot actually moved
        if (oldPosition.row === robotPosition.row && oldPosition.col === robotPosition.col) {
          throw new Error(`DEBUG: Robot didn't move from (${oldPosition.row}, ${oldPosition.col}) at iteration ${iterationCount}`);
        }
        
        // DEBUG: Check if robot is making progress toward target
        const currentDistanceToTarget = Math.sqrt(
          Math.pow(targetFrontier.row - robotPosition.row, 2) + 
          Math.pow(targetFrontier.col - robotPosition.col, 2)
        );
        
        if (lastSelectedFrontier === frontierKey && currentDistanceToTarget >= lastDistanceToTarget) {
          console.log(`DEBUG: No progress toward target ${frontierKey}. Distance: ${lastDistanceToTarget.toFixed(2)} -> ${currentDistanceToTarget.toFixed(2)}`);
        }
        
        lastDistanceToTarget = currentDistanceToTarget;
        
        // Update path index to show remaining path
        currentPathIndex = targetIndex;
      } else {
        // DEBUG: Check why targetIndex is 0
        throw new Error(`DEBUG: targetIndex is 0, path length: ${pathResult.path.length}, stepSize: ${stepSize} at iteration ${iterationCount}`);
      }
      
      // Call progress callback
      if (onProgress) {
        onProgress({
          type: 'exploration_progress',
          robotPosition,
          robotDirection,
          knownMap,
          componentGraph,
          coloredMaze,
          frontiers,
          currentTarget: targetFrontier, // Highlight current target
          exploredPositions: [...exploredPositions],
          coverage,
          iteration: iterationCount,
          sensorPositions,
          currentPath: pathResult.path ? [...pathResult.path] : [], // Show full detailed path
          currentPathIndex: 0, // Always start from beginning of new path
          actualEnd: currentActualEnd // Show the actual target being used
        });
        
        // Add delay for visualization
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    const endTime = performance.now();
    
    // Calculate final metrics
    let finalKnownCells = 0;
    let finalTotalCells = 0;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (fullMaze[r][c] === CELL_STATES.WALKABLE) {
          finalTotalCells++;
          if (knownMap[r][c] === CELL_STATES.WALKABLE) {
            finalKnownCells++;
          }
        }
      }
    }
    const finalCoverage = finalTotalCells > 0 ? (finalKnownCells / finalTotalCells) * 100 : 0;
    
    return createAlgorithmResult(
      {
        success: true,
        exploredPositions,
        knownMap,
        componentGraph,
        coloredMaze,
        finalCoverage,
        robotPosition,
        robotDirection
      },
      {
        executionTime: endTime - startTime,
        iterations: iterationCount,
        positionsExplored: exploredPositions.length,
        coverage: finalCoverage,
        componentsDiscovered: Object.keys(componentGraph).length,
        frontierStrategy,
        useWFD: useWFD === 'true'
      }
    );
  }
});

export default componentBasedExplorationAlgorithm;

// Export utility functions for reuse
export {
  scanWithSensors,
  updateKnownMap,
  updateComponentStructure,
  detectComponentAwareFrontiers,
  detectBasicFrontiers,
  selectOptimalFrontier,
  findComponentPath,
  CELL_STATES
};