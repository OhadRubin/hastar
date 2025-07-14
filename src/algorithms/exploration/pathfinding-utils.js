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
  
  // FALLBACK: If HAA* fails but simple path exists, use simple A* as fallback
  if (!result || !result.detailedPath || result.detailedPath.length === 0) {
    console.log(`DEBUG: HAA* failed, trying simple A* fallback...`);
    const fallbackPath = debugSimpleAStar(start, goal, knownMap);
    if (fallbackPath && fallbackPath.length > 0) {
      console.log(`DEBUG: Simple A* fallback succeeded with ${fallbackPath.length} steps`);
      return { path: fallbackPath, actualEnd: goal };
    }
    console.log(`DEBUG: Both HAA* and simple A* failed`);
    return { path: null, actualEnd: null };
  }
  
  return { path: result.detailedPath, actualEnd: result.actualEnd };
};