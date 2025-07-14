/**
 * Pathfinding utilities for exploration algorithms
 * Debug and utility functions for pathfinding
 */

import { 
  findComponentBasedHAAStarPath,
  getComponentNodeId 
} from '../pathfinding/component-based-haa-star.js';
import { CELL_STATES } from '../../core/utils/map-utils.js';

/**
 * Generate ASCII representation of known map around a position for debugging
 */
export const knownMapAreaToString = (knownMap, centerPos, radius = 10, robotPos = null, targetPos = null) => {
  const SIZE = knownMap.length;
  const { row: centerRow, col: centerCol } = centerPos;
  
  let debugInfo = '';
  debugInfo += `\n=== KNOWN MAP AREA (${radius}x${radius} around ${centerRow},${centerCol}) ===\n`;
  
  // Print column headers
  let header = '    ';
  for (let c = centerCol - radius; c <= centerCol + radius; c++) {
    if (c >= 0 && c < SIZE) {
      header += (c % 10).toString();
    } else {
      header += ' ';
    }
  }
  debugInfo += header + '\n';
  
  // Print rows
  for (let r = centerRow - radius; r <= centerRow + radius; r++) {
    if (r < 0 || r >= SIZE) continue;
    
    let line = `${r.toString().padStart(3, ' ')} `;
    
    for (let c = centerCol - radius; c <= centerCol + radius; c++) {
      if (c < 0 || c >= SIZE) {
        line += ' ';
        continue;
      }
      
      // Check for special positions
      if (robotPos && r === robotPos.row && c === robotPos.col) {
        line += 'R';  // Robot
      } else if (targetPos && r === targetPos.row && c === targetPos.col) {
        line += 'T';  // Target
      } else {
        // Show cell state
        const cellState = knownMap[r][c];
        switch (cellState) {
          case CELL_STATES.WALKABLE:
            line += '.';  // Walkable
            break;
          case CELL_STATES.WALL:
            line += '#';  // Wall
            break;
          case CELL_STATES.UNKNOWN:
            line += '?';  // Unknown
            break;
          default:
            line += `${cellState}`;  // Other states
        }
      }
    }
    debugInfo += line + '\n';
  }
  
  debugInfo += 'Legend: R=Robot, T=Target, .=Walkable, #=Wall, ?=Unknown\n';
  debugInfo += '===================================================\n';
  
  return debugInfo;
};

/**
 * Generate ASCII representation of ground truth maze around a position for debugging
 */
export const groundTruthAreaToString = (fullMaze, centerPos, radius = 10, robotPos = null, targetPos = null) => {
  const SIZE = fullMaze.length;
  const { row: centerRow, col: centerCol } = centerPos;
  
  let debugInfo = '';
  debugInfo += `\n=== GROUND TRUTH MAZE (${radius}x${radius} around ${centerRow},${centerCol}) ===\n`;
  
  // Print column headers
  let header = '    ';
  for (let c = centerCol - radius; c <= centerCol + radius; c++) {
    if (c >= 0 && c < SIZE) {
      header += (c % 10).toString();
    } else {
      header += ' ';
    }
  }
  debugInfo += header + '\n';
  
  // Print rows
  for (let r = centerRow - radius; r <= centerRow + radius; r++) {
    if (r < 0 || r >= SIZE) continue;
    
    let line = `${r.toString().padStart(3, ' ')} `;
    
    for (let c = centerCol - radius; c <= centerCol + radius; c++) {
      if (c < 0 || c >= SIZE) {
        line += ' ';
        continue;
      }
      
      // Check for special positions
      if (robotPos && r === robotPos.row && c === robotPos.col) {
        line += 'R';  // Robot
      } else if (targetPos && r === targetPos.row && c === targetPos.col) {
        line += 'T';  // Target
      } else {
        // Show actual maze state (assuming 0=walkable, 1=wall)
        const cellState = fullMaze[r][c];
        switch (cellState) {
          case 0:
            line += '.';  // Walkable
            break;
          case 1:
            line += '#';  // Wall
            break;
          default:
            line += `${cellState}`;  // Other states
        }
      }
    }
    debugInfo += line + '\n';
  }
  
  debugInfo += 'Legend: R=Robot, T=Target, .=Walkable, #=Wall\n';
  debugInfo += '================================================\n';
  
  return debugInfo;
};

/**
 * Generate ASCII representation of colored maze (component assignments) around a position for debugging
 */
export const coloredMazeAreaToString = (coloredMaze, centerPos, radius = 10, robotPos = null, targetPos = null) => {
  const SIZE = coloredMaze.length;
  const { row: centerRow, col: centerCol } = centerPos;
  
  let debugInfo = '';
  debugInfo += `\n=== COLORED MAZE (Component IDs) (${radius}x${radius} around ${centerRow},${centerCol}) ===\n`;
  
  // Print column headers
  let header = '    ';
  for (let c = centerCol - radius; c <= centerCol + radius; c++) {
    if (c >= 0 && c < SIZE) {
      header += (c % 10).toString();
    } else {
      header += ' ';
    }
  }
  debugInfo += header + '\n';
  
  // Print rows
  for (let r = centerRow - radius; r <= centerRow + radius; r++) {
    if (r < 0 || r >= SIZE) continue;
    
    let line = `${r.toString().padStart(3, ' ')} `;
    
    for (let c = centerCol - radius; c <= centerCol + radius; c++) {
      if (c < 0 || c >= SIZE) {
        line += ' ';
        continue;
      }
      
      // Check for special positions
      if (robotPos && r === robotPos.row && c === robotPos.col) {
        line += 'R';  // Robot
      } else if (targetPos && r === targetPos.row && c === targetPos.col) {
        line += 'T';  // Target
      } else {
        // Show component ID
        const componentId = coloredMaze[r][c];
        if (componentId === -1) {
          line += '.';  // No component assigned
        } else if (componentId < 10) {
          line += componentId.toString();  // Single digit component ID
        } else {
          line += '*';  // Multi-digit component ID (simplified)
        }
      }
    }
    debugInfo += line + '\n';
  }
  
  debugInfo += 'Legend: R=Robot, T=Target, 0-9=Component ID, .=No Component, *=ID>9\n';
  debugInfo += '=================================================================\n';
  
  return debugInfo;
};

/**
 * Generate ASCII representation of sensor coverage around robot position for debugging
 */
export const sensorCoverageToString = (fullMaze, knownMap, robotPos, sensorRange, sensorPositions = [], radius = 10, targetPos = null) => {
  const SIZE = fullMaze.length;
  const { row: centerRow, col: centerCol } = robotPos;
  
  let debugInfo = '';
  debugInfo += `\n=== SENSOR COVERAGE (Range: ${sensorRange}) (${radius}x${radius} around ${centerRow},${centerCol}) ===\n`;
  
  // Create set of sensor positions for O(1) lookup
  const sensorSet = new Set(sensorPositions.map(pos => `${pos.row},${pos.col}`));
  
  // Print column headers
  let header = '    ';
  for (let c = centerCol - radius; c <= centerCol + radius; c++) {
    if (c >= 0 && c < SIZE) {
      header += (c % 10).toString();
    } else {
      header += ' ';
    }
  }
  debugInfo += header + '\n';
  
  // Print rows
  for (let r = centerRow - radius; r <= centerRow + radius; r++) {
    if (r < 0 || r >= SIZE) continue;
    
    let line = `${r.toString().padStart(3, ' ')} `;
    
    for (let c = centerCol - radius; c <= centerCol + radius; c++) {
      if (c < 0 || c >= SIZE) {
        line += ' ';
        continue;
      }
      
      // Check for special positions first
      if (r === robotPos.row && c === robotPos.col) {
        line += 'R';  // Robot
      } else if (targetPos && r === targetPos.row && c === targetPos.col) {
        line += 'T';  // Target
      } else if (sensorSet.has(`${r},${c}`)) {
        // Cell is within sensor range and has line of sight
        const actualState = fullMaze[r][c];
        const knownState = knownMap[r][c];
        if (knownState === CELL_STATES.UNKNOWN) {
          line += 'S';  // Sensed but not yet updated (should be rare)
        } else if (actualState === 0) {
          line += 's';  // Sensed walkable area
        } else {
          line += '#';  // Sensed wall
        }
      } else {
        // Check if within sensor range but no line of sight
        const distance = Math.sqrt(Math.pow(r - robotPos.row, 2) + Math.pow(c - robotPos.col, 2));
        if (distance <= sensorRange) {
          line += '~';  // Within range but blocked by walls
        } else {
          // Show what's actually there (ground truth)
          const actualState = fullMaze[r][c];
          if (actualState === 0) {
            line += '.';  // Walkable but out of range
          } else {
            line += '#';  // Wall out of range
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

/**
 * Print component connectivity information for debugging
 */
export const componentConnectivityToString = (componentGraph, robotComponent, targetComponent) => {
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
  
  // Check if components are directly connected
  const directlyConnected = robotNode && robotNode.neighbors.includes(targetComponent);
  debugInfo += `\n--- Connectivity Status ---\n`;
  debugInfo += `Directly Connected: ${directlyConnected ? 'YES' : 'NO'}\n`;
  
  if (!directlyConnected && robotNode && targetNode) {
    debugInfo += '\n--- Potential Path Analysis ---\n';
    // Try to find path through intermediate components
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
          if (!visited.has(neighbor) && path.length < 10) { // Prevent infinite loops
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

/**
 * Simple BFS to check if path exists (for debugging)
 */
export const checkSimplePathExists = (start, goal, knownMap) => {
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
export const debugSimpleAStar = (start, goal, knownMap) => {
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
export const findComponentPath = (start, goal, knownMap, componentGraph, coloredMaze, REGION_SIZE) => {
  const SIZE = knownMap.length;
  
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
  
  // // FALLBACK: If HAA* fails but simple path exists, use simple A* as fallback
  // if (!result || !result.detailedPath || result.detailedPath.length === 0) {
  //   const fallbackPath = debugSimpleAStar(start, goal, knownMap);
  //   if (fallbackPath && fallbackPath.length > 0) {
  //     return { path: fallbackPath, actualEnd: goal };
  //   }
  //   return { path: null, actualEnd: null };
  // }
  
  return { path: result.detailedPath, actualEnd: result.actualEnd };
};