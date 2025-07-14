/**
 * Frontier detection for exploration algorithms
 * Advanced component-aware frontier detection using WFD algorithm
 */

import { WavefrontFrontierDetection } from '../../core/frontier/index.js';
import { getComponentNodeId } from '../pathfinding/component-based-haa-star.js';
import { CELL_STATES } from '../../core/utils/map-utils.js';
import { findComponentPath } from './pathfinding-utils.js';
import { heuristicObjectChebyshev } from '../../utils/utilities.js';

/**
 * Advanced component-aware frontier detection using WFD algorithm
 * Combines research-grade WFD with component awareness
 */
export const detectComponentAwareFrontiers = (knownMap, componentGraph, coloredMaze, useWFD = true, frontierStrategy = 'centroid', robotPosition = null) => {
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
              const distance = heuristicObjectChebyshev(cell, targetPoint);
              if (distance < minDistance) {
                minDistance = distance;
                closestComponent = nodeId;
              }
            }
          }
          
          associatedComponent = closestComponent;
        }
        
        // Skip if this is the robot's current position
        if (robotPosition && targetPoint.row === robotPosition.row && targetPoint.col === robotPosition.col) {
          continue;
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
  
  // Use basic frontier detection when WFD is disabled
  const basicFrontiers = detectBasicFrontiers(knownMap, componentGraph, robotPosition);
  return basicFrontiers;
};

/**
 * Basic frontier detection (fallback)
 */
export const detectBasicFrontiers = (knownMap, componentGraph, robotPosition = null) => {
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
        { row: cell.row, col: cell.col + 1 },
        { row: cell.row - 1, col: cell.col - 1 }, // Northwest
        { row: cell.row - 1, col: cell.col + 1 }, // Northeast
        { row: cell.row + 1, col: cell.col - 1 }, // Southwest
        { row: cell.row + 1, col: cell.col + 1 }  // Southeast
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
        // Skip if this is the robot's current position
        if (robotPosition && cell.row === robotPosition.row && cell.col === robotPosition.col) {
          continue;
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

/**
 * Check if a target component is reachable from the robot's component
 * through known paths in the component graph
 */
export const isComponentReachable = (robotComponent, targetComponent, componentGraph) => {
  if (!robotComponent || !targetComponent || !componentGraph[robotComponent]) {
    return false;
  }
  
  if (robotComponent === targetComponent) {
    return true;
  }
  
  // BFS to find path through component graph
  const visited = new Set();
  const queue = [robotComponent];
  visited.add(robotComponent);
  
  while (queue.length > 0) {
    const current = queue.shift();
    
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

/**
 * Select optimal frontier using component-aware reachability and distance
 * Only considers frontiers in components reachable from robot's component
 */
export const selectOptimalFrontier = (frontiers, robotPosition, componentGraph, coloredMaze) => {
  if (frontiers.length === 0) return null;
  
  // Get robot's component
  const robotComponent = getComponentNodeId(robotPosition, coloredMaze, 8);
  
  // Filter frontiers to only reachable components
  const reachableFrontiers = frontiers.filter(frontier => {
    return isComponentReachable(robotComponent, frontier.componentId, componentGraph);
  });
  
  // If no reachable frontiers, return null (exploration should stop or reconsider)
  if (reachableFrontiers.length === 0) {
    return null;
  }
  
  
  return reachableFrontiers[0];
};

/**
 * Target abandonment decision interface
 * Determines whether the robot should abandon its current target
 * 
 * @param {Object} robotPosition - Current robot position {row, col}
 * @param {Object} currentTarget - Current target frontier object
 * @param {Array} frontiers - All available frontiers
 * @param {Object} pathResult - Result from pathfinding to current target {path, actualEnd}
 * @param {Object} componentGraph - Current component graph
 * @param {Array} coloredMaze - Component assignments
 * @param {Object} explorationState - Additional state (iterations, coverage, sameTargetCount, etc.)
 * @returns {null|Object} - null to keep current target, or {target, path} to switch to
 */
export const shouldAbandonCurrentTarget = (
  robotPosition, 
  currentTarget, 
  frontiers, 
  pathResult, 
  componentGraph, 
  coloredMaze, 
  explorationState
) => {
  // Always keep current target - never abandon
  return null;
  
  // Example of smarter abandonment logic (commented out):
  /*
  // Abandon if stuck on same target for too long
  if (explorationState.sameTargetCount > 50) {
    const newTarget = selectOptimalFrontier(frontiers, robotPosition, componentGraph, coloredMaze);
    if (newTarget && newTarget !== currentTarget) {
      const newPath = findComponentPath(robotPosition, newTarget, knownMap, componentGraph, coloredMaze, 8);
      return { target: newTarget, path: newPath?.path || null };
    }
  }
  
  // Switch to much closer targets if they appear (NOTE FROM USER: THIS IS DUMB BECAUSE WE ARE IN A MAZE SO EUCLIDEAN DISTANCE IS NOT GOOD)
  const currentDistance = heuristicObjectChebyshev(currentTarget, robotPosition);
  
  for (const frontier of frontiers) {
    const distance = heuristicObjectChebyshev(frontier, robotPosition);
    
    // Switch if new frontier is significantly closer (>50% closer)
    if (distance < currentDistance * 0.5) {
      if (isComponentReachable(getComponentNodeId(robotPosition, coloredMaze, 8), frontier.componentId, componentGraph)) {
        const newPath = findComponentPath(robotPosition, frontier, knownMap, componentGraph, coloredMaze, 8);
        return { target: frontier, path: newPath?.path || null };
      }
    }
  }
  
  return null;
  */
};