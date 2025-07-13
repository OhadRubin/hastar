/**
 * Component-Based Hierarchical A* (HAA*) Pathfinding Algorithm
 * 
 * Extracted and adapted from the original component-based-pathfinding.js
 * Now follows the standard algorithm interface pattern.
 */

import { createAlgorithm, createAlgorithmResult, numberParam } from '../algorithm-interface.js';
import { heuristicString, heuristicObject, getKey } from '../../utils/utilities.js';

/**
 * Build component-based abstract graph from maze
 * Returns graph where nodes are "regionRow,regionCol_componentId"
 */
const buildComponentGraph = (maze, coloredMaze, SIZE, REGION_SIZE) => {
  const numRegions = SIZE / REGION_SIZE;
  const componentGraph = {};
  
  // Step 1: Create component nodes for each region
  for (let regionRow = 0; regionRow < numRegions; regionRow++) {
    for (let regionCol = 0; regionCol < numRegions; regionCol++) {
      const startRow = regionRow * REGION_SIZE;
      const startCol = regionCol * REGION_SIZE;
      
      // Find all components in this region
      const componentCells = new Map(); // componentId -> cells[]
      
      for (let r = startRow; r < startRow + REGION_SIZE; r++) {
        for (let c = startCol; c < startCol + REGION_SIZE; c++) {
          if (maze[r][c] === 0) { // Walkable cell
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
      
      // Create nodes for each component
      for (const [componentId, cells] of componentCells) {
        const nodeId = `${regionRow},${regionCol}_${componentId}`;
        componentGraph[nodeId] = {
          regionRow,
          regionCol,
          componentId,
          cells,
          neighbors: [],
          transitions: [] // component-to-component transitions
        };
      }
    }
  }
  
  // Step 2: Find component-to-component connectivity across region boundaries
  for (let regionRow = 0; regionRow < numRegions; regionRow++) {
    for (let regionCol = 0; regionCol < numRegions; regionCol++) {
      
      // Check right border connections
      if (regionCol < numRegions - 1) {
        const rightRegionRow = regionRow;
        const rightRegionCol = regionCol + 1;
        
        const borderCol = regionCol * REGION_SIZE + REGION_SIZE - 1;
        
        for (let r = regionRow * REGION_SIZE; r < (regionRow + 1) * REGION_SIZE; r++) {
          if (maze[r][borderCol] === 0 && maze[r][borderCol + 1] === 0) {
            // Found walkable connection across border
            const leftComponent = coloredMaze[r][borderCol];
            const rightComponent = coloredMaze[r][borderCol + 1];
            
            if (leftComponent !== -1 && rightComponent !== -1) {
              const leftNodeId = `${regionRow},${regionCol}_${leftComponent}`;
              const rightNodeId = `${rightRegionRow},${rightRegionCol}_${rightComponent}`;
              
              if (componentGraph[leftNodeId] && componentGraph[rightNodeId]) {
                // Add bidirectional connection
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
      
      // Check bottom border connections
      if (regionRow < numRegions - 1) {
        const bottomRegionRow = regionRow + 1;
        const bottomRegionCol = regionCol;
        
        const borderRow = regionRow * REGION_SIZE + REGION_SIZE - 1;
        
        for (let c = regionCol * REGION_SIZE; c < (regionCol + 1) * REGION_SIZE; c++) {
          if (maze[borderRow][c] === 0 && maze[borderRow + 1][c] === 0) {
            // Found walkable connection across border
            const topComponent = coloredMaze[borderRow][c];
            const bottomComponent = coloredMaze[borderRow + 1][c];
            
            if (topComponent !== -1 && bottomComponent !== -1) {
              const topNodeId = `${regionRow},${regionCol}_${topComponent}`;
              const bottomNodeId = `${bottomRegionRow},${bottomRegionCol}_${bottomComponent}`;
              
              if (componentGraph[topNodeId] && componentGraph[bottomNodeId]) {
                // Add bidirectional connection
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
  
  return componentGraph;
};

/**
 * Find component ID for a given cell position
 */
const getComponentNodeId = (position, coloredMaze, REGION_SIZE) => {
  const regionRow = Math.floor(position.row / REGION_SIZE);
  const regionCol = Math.floor(position.col / REGION_SIZE);
  const componentId = coloredMaze[position.row][position.col];
  
  if (componentId === -1) {
    return null; // Not in a valid component
  }
  
  return `${regionRow},${regionCol}_${componentId}`;
};

/**
 * Extract region coordinates from component node ID for heuristic calculation
 */
const getRegionFromComponentNode = (componentNodeId) => {
  // componentNodeId format: "regionRow,regionCol_componentId"
  const parts = componentNodeId.split('_');
  return parts[0]; // Returns "regionRow,regionCol"
};

/**
 * Component-based heuristic: distance between regions containing the components
 */
const componentHeuristic = (fromNodeId, toNodeId) => {
  const fromRegion = getRegionFromComponentNode(fromNodeId);
  const toRegion = getRegionFromComponentNode(toNodeId);
  return heuristicString(fromRegion, toRegion);
};

/**
 * Standard A* pathfinding on component graph with proper heuristic
 * Returns array of component node IDs
 */
const findAbstractComponentPath = (startNodeId, endNodeId, componentGraph) => {
  console.log(`Abstract path DEBUG: ${startNodeId} -> ${endNodeId}`);
  console.log('Available components:', Object.keys(componentGraph));
  
  if (!componentGraph[startNodeId] || !componentGraph[endNodeId]) {
    console.error('Invalid start or end component node:', startNodeId, endNodeId);
    console.log('Start node exists:', !!componentGraph[startNodeId]);
    console.log('End node exists:', !!componentGraph[endNodeId]);
    return null;
  }
  
  // Special case: same component
  if (startNodeId === endNodeId) {
    console.log('Abstract path DEBUG: Same component, returning direct path');
    return [startNodeId];
  }
  
  const openSet = [startNodeId];
  const cameFrom = {};
  const gScore = { [startNodeId]: 0 };
  const fScore = { [startNodeId]: componentHeuristic(startNodeId, endNodeId) };
  
  while (openSet.length > 0) {
    let current = openSet.reduce((min, node) => 
      fScore[node] < fScore[min] ? node : min
    );
    
    if (current === endNodeId) {
      const path = [];
      while (current) {
        path.unshift(current);
        current = cameFrom[current];
      }
      return path;
    }
    
    openSet.splice(openSet.indexOf(current), 1);
    
    for (const neighbor of componentGraph[current].neighbors) {
      const tentativeGScore = gScore[current] + 1;
      
      if (gScore[neighbor] === undefined || tentativeGScore < gScore[neighbor]) {
        cameFrom[neighbor] = current;
        gScore[neighbor] = tentativeGScore;
        fScore[neighbor] = gScore[neighbor] + componentHeuristic(neighbor, endNodeId);
        
        if (!openSet.includes(neighbor)) {
          openSet.push(neighbor);
        }
      }
    }
  }
  
  return null; // No path found
};

/**
 * Standard A* pathfinding within a specific component
 * Only explores cells that belong to the given component
 */
const findPathWithinComponent = (start, end, maze, SIZE, componentCells) => {
  // Create set of valid cells for O(1) lookup
  const validCells = new Set();
  for (const cell of componentCells) {
    validCells.add(`${cell.row},${cell.col}`);
  }
  
  // Ensure start and end are in the component
  if (!validCells.has(`${start.row},${start.col}`) || 
      !validCells.has(`${end.row},${end.col}`)) {
    return null;
  }
  
  const openSet = [start];
  const cameFrom = {};
  const gScore = { [getKey(start)]: 0 };
  const fScore = { [getKey(start)]: heuristicObject(start, end) };
  
  while (openSet.length > 0) {
    let current = openSet.reduce((min, node) => 
      fScore[getKey(node)] < fScore[getKey(min)] ? node : min
    );
    
    if (current.row === end.row && current.col === end.col) {
      const path = [];
      while (current) {
        path.unshift(current);
        current = cameFrom[getKey(current)];
      }
      return path;
    }
    
    openSet.splice(openSet.findIndex(n => n.row === current.row && n.col === current.col), 1);
    
    const neighbors = [
      { row: current.row - 1, col: current.col },
      { row: current.row + 1, col: current.col },
      { row: current.row, col: current.col - 1 },
      { row: current.row, col: current.col + 1 }
    ];
    
    for (const neighbor of neighbors) {
      if (neighbor.row < 0 || neighbor.row >= SIZE || 
          neighbor.col < 0 || neighbor.col >= SIZE ||
          maze[neighbor.row][neighbor.col] === 1) {
        continue;
      }
      
      // Only explore cells within this component
      if (!validCells.has(`${neighbor.row},${neighbor.col}`)) {
        continue;
      }
      
      const tentativeGScore = gScore[getKey(current)] + 1;
      const neighborKey = getKey(neighbor);
      
      if (gScore[neighborKey] === undefined || tentativeGScore < gScore[neighborKey]) {
        cameFrom[neighborKey] = current;
        gScore[neighborKey] = tentativeGScore;
        fScore[neighborKey] = gScore[neighborKey] + heuristicObject(neighbor, end);
        
        if (!openSet.some(n => n.row === neighbor.row && n.col === neighbor.col)) {
          openSet.push(neighbor);
        }
      }
    }
  }
  
  return null; // No path found
};

/**
 * Main Component-based HAA* pathfinding implementation
 */
const findComponentBasedHAAStarPath = (start, end, maze, componentGraph, coloredMaze, REGION_SIZE, SIZE) => {
  const startTime = performance.now();
  
  // Step 1: Find start and end component nodes
  const startNodeId = getComponentNodeId(start, coloredMaze, REGION_SIZE);
  const endNodeId = getComponentNodeId(end, coloredMaze, REGION_SIZE);
  
  console.log(`HAA* DEBUG: start=(${start.row},${start.col}) -> ${startNodeId}, end=(${end.row},${end.col}) -> ${endNodeId}`);
  
  if (!startNodeId || !endNodeId) {
    console.log('HAA* DEBUG: Invalid start or end node ID');
    return { abstractPath: null, detailedPath: null };
  }
  
  // Step 2: Find abstract path through component graph
  const abstractComponentPath = findAbstractComponentPath(startNodeId, endNodeId, componentGraph);
  
  console.log('HAA* DEBUG: Abstract path:', abstractComponentPath);
  
  if (!abstractComponentPath) {
    console.log('HAA* DEBUG: No abstract path found');
    return { abstractPath: null, detailedPath: null };
  }
  
  // Step 3: Build detailed path by connecting through each component
  const detailedPath = [];
  let currentPos = start;
  
  for (let i = 0; i < abstractComponentPath.length; i++) {
    const currentComponentNodeId = abstractComponentPath[i];
    const currentComponent = componentGraph[currentComponentNodeId];
    
    if (i === abstractComponentPath.length - 1) {
      // Last component - path directly to end
      const pathSegment = findPathWithinComponent(currentPos, end, maze, SIZE, currentComponent.cells);
      
      if (pathSegment && pathSegment.length > 0) {
        // Skip first cell if it duplicates the last cell in our path
        let startIndex = 0;
        if (detailedPath.length > 0 && pathSegment.length > 0) {
          const lastCell = detailedPath[detailedPath.length - 1];
          const firstCell = pathSegment[0];
          if (lastCell.row === firstCell.row && lastCell.col === firstCell.col) {
            startIndex = 1;
          }
        }
        detailedPath.push(...pathSegment.slice(startIndex));
      } else {
        return { abstractPath: abstractComponentPath, detailedPath: null };
      }
      
    } else {
      // Find transition to next component
      const nextComponentNodeId = abstractComponentPath[i + 1];
      
      // Find the transition between these components
      const transition = currentComponent.transitions.find(t => t.to === nextComponentNodeId);
      
      if (!transition) {
        return { abstractPath: abstractComponentPath, detailedPath: null };
      }
      
      // Path within current component to the transition point
      const pathSegment = findPathWithinComponent(currentPos, transition.fromCell, maze, SIZE, currentComponent.cells);
      
      if (pathSegment && pathSegment.length > 0) {
        // Skip first cell if it duplicates the last cell in our path
        let startIndex = 0;
        if (detailedPath.length > 0 && pathSegment.length > 0) {
          const lastCell = detailedPath[detailedPath.length - 1];
          const firstCell = pathSegment[0];
          if (lastCell.row === firstCell.row && lastCell.col === firstCell.col) {
            startIndex = 1;
          }
        }
        detailedPath.push(...pathSegment.slice(startIndex));
        
        // Move to next component through transition
        currentPos = transition.toCell;
        
        // Add transition cell if it's not already the last cell
        const lastCell = detailedPath[detailedPath.length - 1];
        if (!(lastCell.row === currentPos.row && lastCell.col === currentPos.col)) {
          detailedPath.push(currentPos);
        }
        
      } else {
        return { abstractPath: abstractComponentPath, detailedPath: null };
      }
    }
  }
  
  const endTime = performance.now();
  
  return { 
    abstractPath: abstractComponentPath, 
    detailedPath,
    executionTime: endTime - startTime
  };
};

/**
 * Component-Based HAA* Algorithm
 */
const componentBasedHAAStarAlgorithm = createAlgorithm({
  name: 'Component-Based Hierarchical A*',
  type: 'pathfinding',
  description: 'Hierarchical A* using component-based abstraction for efficient pathfinding',
  parameters: {
    regionSize: numberParam(4, 16, 8, 4),
    heuristicWeight: numberParam(1, 2, 1, 0.1)
  },
  
  async execute(input, options, onProgress) {
    const { maze, coloredMaze, componentGraph, start, end, SIZE = 256 } = input;
    const { regionSize = 8 } = options;
    
    const startTime = performance.now();
    
    // Execute HAA* pathfinding
    const result = findComponentBasedHAAStarPath(
      start, 
      end, 
      maze, 
      componentGraph, 
      coloredMaze, 
      regionSize, 
      SIZE
    );
    
    const endTime = performance.now();
    
    // Call progress callback if provided
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

export default componentBasedHAAStarAlgorithm;

// Export utility functions for reuse
export {
  buildComponentGraph,
  getComponentNodeId,
  findAbstractComponentPath,
  findPathWithinComponent,
  findComponentBasedHAAStarPath,
  componentHeuristic,
  getRegionFromComponentNode
};