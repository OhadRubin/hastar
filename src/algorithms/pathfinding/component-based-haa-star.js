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
  let debugInfo = '';
  debugInfo += `\n=== HAA* ABSTRACT PATHFINDING DEBUG ===\n`;
  debugInfo += `Start: ${startNodeId} -> End: ${endNodeId}\n`;
  debugInfo += `Available components: [${Object.keys(componentGraph).join(', ')}]\n`;
  
  if (!componentGraph[startNodeId] || !componentGraph[endNodeId]) {
    debugInfo += `ERROR: Invalid component nodes!\n`;
    debugInfo += `- Start node exists: ${!!componentGraph[startNodeId]}\n`;
    debugInfo += `- End node exists: ${!!componentGraph[endNodeId]}\n`;
    // console.log(debugInfo);
    return { path: null, debugInfo: debugInfo };
  }
  
  debugInfo += `Start component neighbors: [${componentGraph[startNodeId].neighbors.join(', ')}]\n`;
  debugInfo += `End component neighbors: [${componentGraph[endNodeId].neighbors.join(', ')}]\n`;
  
  // Check if end is directly reachable
  const directConnection = componentGraph[startNodeId].neighbors.includes(endNodeId);
  debugInfo += `Direct connection ${startNodeId} -> ${endNodeId}: ${directConnection}\n`;
  
  // Special case: same component
  if (startNodeId === endNodeId) {
    debugInfo += `Same component - returning direct path: [${startNodeId}]\n`;
    // console.log(debugInfo);
    return { path: [startNodeId], debugInfo: debugInfo };
  }
  
  const openSet = [startNodeId];
  const closedSet = new Set();
  const cameFrom = {};
  const gScore = { [startNodeId]: 0 };
  const fScore = { [startNodeId]: componentHeuristic(startNodeId, endNodeId) };
  
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
      // console.log(debugInfo);
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
        fScore[neighbor] = gScore[neighbor] + componentHeuristic(neighbor, endNodeId);
        
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
  // console.log(debugInfo);
  return { path: null, debugInfo: debugInfo };
};

/**
 * Standard A* pathfinding within a specific component
 * Only explores cells that belong to the given component
 */
const findPathWithinComponent = (start, end, maze, SIZE, componentCells) => {
  let debugInfo = '';
  debugInfo += `\n--- WITHIN COMPONENT PATHFINDING DEBUG ---\n`;
  debugInfo += `Start: (${start.row}, ${start.col}), End: (${end.row}, ${end.col})\n`;
  debugInfo += `Component has ${componentCells.length} cells\n`;
  
  // Create set of valid cells for O(1) lookup
  const validCells = new Set();
  for (const cell of componentCells) {
    validCells.add(`${cell.row},${cell.col}`);
  }
  
  // Show sample component cells for debugging
  const sampleCells = componentCells.slice(0, 10).map(c => `(${c.row},${c.col})`);
  debugInfo += `Sample component cells: [${sampleCells.join(', ')}${componentCells.length > 10 ? '...' : ''}]\n`;
  
  // Ensure start is in the component
  const startInComponent = validCells.has(`${start.row},${start.col}`);
  debugInfo += `Start (${start.row}, ${start.col}) in component: ${startInComponent}\n`;
  
  if (!startInComponent) {
    debugInfo += `FAILURE: Start position not in component!\n`;
    // console.log(debugInfo);
    return { path: null, debugInfo: debugInfo };
  }
  
  // If end is not in component, find closest valid cell
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
  const fScore = { [getKey(start)]: heuristicObject(start, actualEnd) };
  
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
      // console.log(debugInfo);
      return { path, actualEnd, debugInfo: debugInfo };
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
        fScore[neighborKey] = gScore[neighborKey] + heuristicObject(neighbor, actualEnd);
        
        if (!openSet.some(n => n.row === neighbor.row && n.col === neighbor.col)) {
          openSet.push(neighbor);
        }
      }
    }
  }
  
  debugInfo += `FAILURE: No path found within component!\n`;
  debugInfo += `OpenSet exhausted, no more cells to explore\n`;
  // console.log(debugInfo);
  return { path: null, actualEnd: null, debugInfo: debugInfo }; // No path found
};

/**
 * Main Component-based HAA* pathfinding implementation
 */
const findComponentBasedHAAStarPath = (start, end, maze, componentGraph, coloredMaze, REGION_SIZE, SIZE) => {
  const startTime = performance.now();
  
  // Step 1: Find start and end component nodes
  const startNodeId = getComponentNodeId(start, coloredMaze, REGION_SIZE);
  const endNodeId = getComponentNodeId(end, coloredMaze, REGION_SIZE);
  
  let debugInfo = '';
  debugInfo += `HAA* DEBUG: start=(${start.row},${start.col}) -> ${startNodeId}, end=(${end.row},${end.col}) -> ${endNodeId}\n`;
  
  if (!startNodeId || !endNodeId) {
    debugInfo += 'HAA* DEBUG: Invalid start or end node ID\n';
    return { abstractPath: null, detailedPath: null , debugInfo: debugInfo};
  }
  
  // Step 2: Find abstract path through component graph
  const abstractComponentPathResult = findAbstractComponentPath(startNodeId, endNodeId, componentGraph);
  const abstractComponentPath = abstractComponentPathResult.path;
  debugInfo += abstractComponentPathResult.debugInfo;
  
  // console.log('HAA* DEBUG: Abstract path:', abstractComponentPath);
  
  if (!abstractComponentPath) {
    // console.log('HAA* DEBUG: No abstract path found');
    return { abstractPath: null, detailedPath: null , debugInfo: debugInfo};
  }
  
  // Step 3: Build detailed path by connecting through each component
  debugInfo += `\n=== HAA* DETAILED PATHFINDING DEBUG ===\n`;
  debugInfo += `Abstract path: [${abstractComponentPath.join(' -> ')}]\n`;
  debugInfo += `Start position: (${start.row}, ${start.col})\n`;
  debugInfo += `End position: (${end.row}, ${end.col})\n`;
  
  const detailedPath = [];
  let currentPos = start;
  let finalActualEnd = end; // Track the actual end position used
  
  for (let i = 0; i < abstractComponentPath.length; i++) {
    const currentComponentNodeId = abstractComponentPath[i];
    const currentComponent = componentGraph[currentComponentNodeId];
    
    debugInfo += `\n--- Processing Component ${i + 1}/${abstractComponentPath.length}: ${currentComponentNodeId} ---\n`;
    debugInfo += `Current position: (${currentPos.row}, ${currentPos.col})\n`;
    debugInfo += `Component has ${currentComponent.cells.length} cells\n`;
    debugInfo += `Component transitions: [${currentComponent.transitions.map(t => t.to).join(', ')}]\n`;
    
    if (i === abstractComponentPath.length - 1) {
      // Last component - path directly to end
      debugInfo += `FINAL COMPONENT: Pathing from (${currentPos.row}, ${currentPos.col}) to (${end.row}, ${end.col})\n`;
      
      const pathResult = findPathWithinComponent(currentPos, end, maze, SIZE, currentComponent.cells);
      
      debugInfo += `Path within component result: ${pathResult.path ? `${pathResult.path.length} steps` : 'null'}\n`;
      
      if (pathResult && pathResult.path && pathResult.path.length > 0) {
        // Skip first cell if it duplicates the last cell in our path
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
        // console.log(debugInfo);
        return { abstractPath: abstractComponentPath, detailedPath: null, debugInfo: debugInfo };
      }
      
    } else {
      // Find transition to next component
      const nextComponentNodeId = abstractComponentPath[i + 1];
      
      debugInfo += `INTERMEDIATE COMPONENT: Finding transition to ${nextComponentNodeId}\n`;
      
      // Find the transition between these components
      const transition = currentComponent.transitions.find(t => t.to === nextComponentNodeId);
      
      if (!transition) {
        debugInfo += `FAILURE: No transition found from ${currentComponentNodeId} to ${nextComponentNodeId}!\n`;
        debugInfo += `Available transitions: [${currentComponent.transitions.map(t => `${t.to} via (${t.fromCell.row},${t.fromCell.col})->(${t.toCell.row},${t.toCell.col})`).join(', ')}]\n`;
        // console.log(debugInfo);
        return { abstractPath: abstractComponentPath, detailedPath: null , debugInfo: debugInfo};
      }
      
      debugInfo += `Found transition: (${transition.fromCell.row}, ${transition.fromCell.col}) -> (${transition.toCell.row}, ${transition.toCell.col})\n`;
      
      // Path within current component to the transition point
      debugInfo += `Pathing from (${currentPos.row}, ${currentPos.col}) to transition point (${transition.fromCell.row}, ${transition.fromCell.col})\n`;
      
      const pathResult = findPathWithinComponent(currentPos, transition.fromCell, maze, SIZE, currentComponent.cells);
      
      debugInfo += `Path to transition result: ${pathResult.path ? `${pathResult.path.length} steps` : 'null'}\n`;
      
      if (pathResult && pathResult.path && pathResult.path.length > 0) {
        // Skip first cell if it duplicates the last cell in our path
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
        
        // Move to next component through transition
        currentPos = transition.toCell;
        debugInfo += `Moving through transition to (${currentPos.row}, ${currentPos.col})\n`;
        
        // Add transition cell if it's not already the last cell
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
        // console.log(debugInfo);
        return { abstractPath: abstractComponentPath, detailedPath: null ,debugInfo: debugInfo };
      }
    }
  }
  
  debugInfo += `\n=== HAA* DETAILED PATHFINDING SUCCESS ===\n`;
  debugInfo += `Total detailed path length: ${detailedPath.length}\n`;
  debugInfo += `Path: [${detailedPath.map(p => `(${p.row},${p.col})`).slice(0, 10).join(' -> ')}${detailedPath.length > 10 ? '...' : ''}]\n`;
  // console.log(debugInfo);
  
  const endTime = performance.now();
  
  return { 
    abstractPath: abstractComponentPath, 
    detailedPath,
    actualEnd: finalActualEnd,
    executionTime: endTime - startTime,
    debugInfo: debugInfo
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