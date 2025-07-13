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

import { createAlgorithm, createAlgorithmResult, numberParam } from '../algorithm-interface.js';
import { 
  buildComponentGraph, 
  findComponentBasedHAAStarPath,
  getComponentNodeId 
} from '../pathfinding/component-based-haa-star.js';
import { findConnectedComponents } from '../../core/utils/maze-utils.js';

// Cell states for known map
const CELL_STATES = {
  UNKNOWN: 2,
  WALL: 1,
  WALKABLE: 0
};

/**
 * Simulate robot sensors scanning the environment
 * Returns positions that would be visible to the robot's sensors
 */
const scanWithSensors = (robotPosition, sensorRange, maze) => {
  const sensorPositions = [];
  const robotRow = Math.floor(robotPosition.row);
  const robotCol = Math.floor(robotPosition.col);
  
  // Simple directional cone sensor (can be enhanced later)
  for (let dr = -sensorRange; dr <= sensorRange; dr++) {
    for (let dc = -sensorRange; dc <= sensorRange; dc++) {
      const distance = Math.sqrt(dr * dr + dc * dc);
      if (distance <= sensorRange) {
        const row = robotRow + dr;
        const col = robotCol + dc;
        
        if (row >= 0 && row < maze.length && col >= 0 && col < maze[0].length) {
          sensorPositions.push({ row, col });
        }
      }
    }
  }
  
  return sensorPositions;
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
  
  // Rebuild inter-component connections for affected regions and their neighbors
  const affectedRegions = new Set(regionsToUpdate);
  for (const regionKey of regionsToUpdate) {
    const [regionRow, regionCol] = regionKey.split(',').map(Number);
    
    // Add neighboring regions to update connections
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const neighborRow = regionRow + dr;
        const neighborCol = regionCol + dc;
        if (neighborRow >= 0 && neighborRow < numRegions && 
            neighborCol >= 0 && neighborCol < numRegions) {
          affectedRegions.add(`${neighborRow},${neighborCol}`);
        }
      }
    }
  }
  
  // Clear and rebuild connections for affected regions
  for (const nodeId of Object.keys(newComponentGraph)) {
    const [regionPart] = nodeId.split('_');
    if (affectedRegions.has(regionPart)) {
      newComponentGraph[nodeId].neighbors = [];
      newComponentGraph[nodeId].transitions = [];
    }
  }
  
  // Rebuild connections using the same logic as buildComponentGraph
  for (const regionKey of affectedRegions) {
    const [regionRow, regionCol] = regionKey.split(',').map(Number);
    
    // Check right border connections
    if (regionCol < numRegions - 1) {
      const rightRegionRow = regionRow;
      const rightRegionCol = regionCol + 1;
      const borderCol = regionCol * REGION_SIZE + REGION_SIZE - 1;
      
      for (let r = regionRow * REGION_SIZE; r < (regionRow + 1) * REGION_SIZE; r++) {
        if (r < SIZE && borderCol < SIZE - 1 && 
            knownMap[r][borderCol] === CELL_STATES.WALKABLE && 
            knownMap[r][borderCol + 1] === CELL_STATES.WALKABLE) {
          
          const leftComponent = newColoredMaze[r][borderCol];
          const rightComponent = newColoredMaze[r][borderCol + 1];
          
          if (leftComponent !== -1 && rightComponent !== -1) {
            const leftNodeId = `${regionRow},${regionCol}_${leftComponent}`;
            const rightNodeId = `${rightRegionRow},${rightRegionCol}_${rightComponent}`;
            
            if (newComponentGraph[leftNodeId] && newComponentGraph[rightNodeId]) {
              // Add bidirectional connection
              if (!newComponentGraph[leftNodeId].neighbors.includes(rightNodeId)) {
                newComponentGraph[leftNodeId].neighbors.push(rightNodeId);
                newComponentGraph[leftNodeId].transitions.push({
                  to: rightNodeId,
                  fromCell: { row: r, col: borderCol },
                  toCell: { row: r, col: borderCol + 1 }
                });
              }
              
              if (!newComponentGraph[rightNodeId].neighbors.includes(leftNodeId)) {
                newComponentGraph[rightNodeId].neighbors.push(leftNodeId);
                newComponentGraph[rightNodeId].transitions.push({
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
    
    // Check bottom border connections
    if (regionRow < numRegions - 1) {
      const bottomRegionRow = regionRow + 1;
      const bottomRegionCol = regionCol;
      const borderRow = regionRow * REGION_SIZE + REGION_SIZE - 1;
      
      for (let c = regionCol * REGION_SIZE; c < (regionCol + 1) * REGION_SIZE; c++) {
        if (c < SIZE && borderRow < SIZE - 1 && 
            knownMap[borderRow][c] === CELL_STATES.WALKABLE && 
            knownMap[borderRow + 1][c] === CELL_STATES.WALKABLE) {
          
          const topComponent = newColoredMaze[borderRow][c];
          const bottomComponent = newColoredMaze[borderRow + 1][c];
          
          if (topComponent !== -1 && bottomComponent !== -1) {
            const topNodeId = `${regionRow},${regionCol}_${topComponent}`;
            const bottomNodeId = `${bottomRegionRow},${bottomRegionCol}_${bottomComponent}`;
            
            if (newComponentGraph[topNodeId] && newComponentGraph[bottomNodeId]) {
              // Add bidirectional connection
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
  }
  
  return { componentGraph: newComponentGraph, coloredMaze: newColoredMaze };
};

/**
 * Component-aware frontier detection
 * Finds frontiers at the boundaries of known components
 */
const detectFrontiers = (knownMap, componentGraph) => {
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
          componentId: nodeId
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
 * Component-aware pathfinding using existing HAA* infrastructure
 */
const findComponentPath = (start, goal, knownMap, componentGraph, coloredMaze, REGION_SIZE) => {
  const SIZE = knownMap.length;
  
  // Use existing HAA* pathfinding with current component graph
  const result = findComponentBasedHAAStarPath(
    start, 
    goal, 
    knownMap, 
    componentGraph, 
    coloredMaze, 
    REGION_SIZE, 
    SIZE
  );
  
  return result.detailedPath;
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
    maxIterations: numberParam(100, 1000, 500, 50),
    explorationThreshold: numberParam(80, 100, 95, 1)
  },
  
  async execute(input, options, onProgress) {
    const { maze: fullMaze, start: startPos, SIZE = 256 } = input;
    const { 
      sensorRange = 15,
      stepSize = 1.0,
      maxIterations = 500,
      explorationThreshold = 95,
      delay = 50
    } = options;
    
    const REGION_SIZE = 8;
    const startTime = performance.now();
    
    // Initialize exploration state
    let robotPosition = { row: startPos.row, col: startPos.col };
    
    // Initialize known map with everything unknown
    let knownMap = Array(SIZE).fill(null).map(() => Array(SIZE).fill(CELL_STATES.UNKNOWN));
    
    // Initialize colored maze for component tracking
    let coloredMaze = Array(SIZE).fill(null).map(() => Array(SIZE).fill(-1));
    
    // Initialize empty component graph
    let componentGraph = {};
    
    // Initial sensor scan
    const initialSensorPositions = scanWithSensors(robotPosition, sensorRange, fullMaze);
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
    
    // Main exploration loop: SENSE → UPDATE → PLAN → NAVIGATE → MOVE
    while (iterationCount < maxIterations) {
      iterationCount++;
      
      // 1. SENSE: Robot scans environment
      const sensorPositions = scanWithSensors(robotPosition, sensorRange, fullMaze);
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
      
      // 3. PLAN: Find next exploration target
      const frontiers = detectFrontiers(knownMap, componentGraph);
      
      // Check exploration completion
      if (frontiers.length === 0) {
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
        break; // Exploration threshold reached
      }
      
      const targetFrontier = selectOptimalFrontier(frontiers, robotPosition);
      if (!targetFrontier) break;
      
      // 4. NAVIGATE: Use component-based pathfinding
      const path = findComponentPath(
        robotPosition, 
        { row: targetFrontier.row, col: targetFrontier.col },
        knownMap,
        componentGraph,
        coloredMaze,
        REGION_SIZE
      );
      
      if (!path || path.length === 0) {
        // If no path found, continue to next iteration
        continue;
      }
      
      // 5. MOVE: Execute path segment
      const targetIndex = Math.min(Math.floor(stepSize) + 1, path.length - 1);
      if (targetIndex > 0) {
        robotPosition = { row: path[targetIndex].row, col: path[targetIndex].col };
        exploredPositions.push({ ...robotPosition });
      }
      
      // Call progress callback
      if (onProgress) {
        onProgress({
          type: 'exploration_progress',
          robotPosition,
          knownMap,
          componentGraph,
          coloredMaze,
          frontiers,
          exploredPositions: [...exploredPositions],
          coverage,
          iteration: iterationCount
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
        robotPosition
      },
      {
        executionTime: endTime - startTime,
        iterations: iterationCount,
        positionsExplored: exploredPositions.length,
        coverage: finalCoverage,
        componentsDiscovered: Object.keys(componentGraph).length
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
  detectFrontiers,
  selectOptimalFrontier,
  findComponentPath,
  CELL_STATES
};