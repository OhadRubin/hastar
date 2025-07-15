/**
 * Frontier detection for exploration algorithms
 * Advanced component-aware frontier detection using WFD algorithm
 */

import { WavefrontFrontierDetection } from '../../core/frontier/index.js';
import { getComponentNodeId } from '../pathfinding/component-based-haa-star.js';
import { CELL_STATES } from '../../core/utils/map-utils.js';
import { findComponentPath } from './pathfinding-utils.js';
import { heuristicObjectChebyshev } from '../../utils/utilities.js';
import { DEFAULT_REGION_SIZE } from '../../core/constants.js';

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
        let associatedComponent = getComponentNodeId(targetPoint, coloredMaze, DEFAULT_REGION_SIZE);
        
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
        
        // Skip if this frontier is at or very close to the robot's current position
        // When robot reaches a frontier, nearby areas should have been explored by sensors
        if (robotPosition) {
          const distance = Math.abs(targetPoint.row - robotPosition.row) + Math.abs(targetPoint.col - robotPosition.col);
          if (distance <= 1.5) { // Skip frontiers within 1.5 cells of robot
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
        // Skip if this frontier is at or very close to the robot's current position
        // When robot reaches a frontier, nearby areas should have been explored by sensors
        if (robotPosition) {
          const distance = Math.abs(cell.row - robotPosition.row) + Math.abs(cell.col - robotPosition.col);
          if (distance <= 1.5) { // Skip frontiers within 1.5 cells of robot
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

/**
 * Check if a target component is reachable from the robot's component
 * through known paths in the component graph
 */
export const isComponentReachable = (robotComponent, targetComponent, componentGraph) => {
  if (!robotComponent || !targetComponent || !componentGraph[robotComponent]) {
    // console.log(`[REACHABLE] FAIL: Missing components - robot:${robotComponent}, target:${targetComponent}, robotExists:${!!componentGraph[robotComponent]}`);
    return false;
  }
  
  if (robotComponent === targetComponent) {
    return true;
  }
  
  // BFS to find path through component graph
  const visited = new Set();
  const queue = [robotComponent];
  visited.add(robotComponent);
  
  let steps = 0;
  while (queue.length > 0) { // Safety limit
    const current = queue.shift();
    steps++;
    
    if (current === targetComponent) {
      // console.log(`[REACHABLE] SUCCESS: ${robotComponent} → ${targetComponent} in ${steps} steps`);
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
  
  // console.log(`[REACHABLE] FAIL: ${robotComponent} → ${targetComponent}, visited ${visited.size} components`);
  // console.log(`[REACHABLE] Robot neighbors: ${componentGraph[robotComponent]?.neighbors?.length || 0}`);
  // console.log(`[REACHABLE] Target exists: ${!!componentGraph[targetComponent]}`);
  return false;
};

/**
 * Select optimal frontier using component-aware reachability and distance
 * Only considers frontiers in components reachable from robot's component
 */
export const selectOptimalFrontier = (frontiers, robotPosition, componentGraph, coloredMaze, prevTargets = [], knownMap = null) => {
  if (frontiers.length === 0) return null;
  
  // Get robot's component
  const robotComponent = getComponentNodeId(robotPosition, coloredMaze, DEFAULT_REGION_SIZE);
  
  // Filter frontiers to only reachable components
  const reachableFrontiers = frontiers.filter(frontier => {
    return isComponentReachable(robotComponent, frontier.componentId, componentGraph);
  });
  
  // If no reachable frontiers, return null (exploration should stop or reconsider)
  if (reachableFrontiers.length === 0) {
    return null;
  }
  
  // Filter out recently abandoned targets to prevent immediate re-selection
  const recentlyAbandonedTargets = prevTargets.slice(-5); // Check last 5 targets
  const availableFrontiers = reachableFrontiers.filter(frontier => {
    return !recentlyAbandonedTargets.some(prevTarget => 
      prevTarget && frontier.row === prevTarget.row && frontier.col === prevTarget.col
    );
  });
  
  // If we filtered out all frontiers, fall back to reachable ones (better than getting stuck)
  const finalFrontiers = availableFrontiers.length > 0 ? availableFrontiers : reachableFrontiers;
  
  // Calculate actual path distances for all remaining frontiers
  const frontiersWithDistances = finalFrontiers.map(frontier => {
    let pathDistance = frontier.pathDistance || Infinity;
    
    // If we have knownMap, calculate actual path distance
    if (knownMap) {
      const pathResult = findComponentPath(
        robotPosition,
        { row: frontier.row, col: frontier.col },
        knownMap,
        componentGraph,
        coloredMaze,
        DEFAULT_REGION_SIZE // regionSize
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
  
  // Sort frontiers by actual path distance (shortest first)
  const sortedFrontiers = frontiersWithDistances.sort((a, b) => {
    return a.calculatedPathDistance - b.calculatedPathDistance;
  });
  
  return sortedFrontiers[0];
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
 * @param {Array} frontierPaths - Pre-calculated paths to all frontiers [{frontier, path, cost}]
 * @returns {null|Object} - null to keep current target, or {target, path} to switch to
 */
export const shouldAbandonCurrentTarget = (
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
  
  // Example of smarter abandonment logic (commented out):
  

  
  // Switch to much closer targets based on actual path cost (better than Euclidean distance)
  const currentPathCost = pathResult?.path ? pathResult.path.length : Infinity;
  let newTarget = null;
  let newPath = null;
  let newPathCost = Infinity;
  
  for (const pathData of frontierPaths) {
    const { frontier, path, cost } = pathData;
    
    // Skip if no path exists or if this is the current target
    if (!path || cost === Infinity || 
        (frontier.row === currentTarget.row && frontier.col === currentTarget.col)) {
      continue;
    }
    
    // Skip if this target was recently used (prevent yoyo-ing)
    const recentTargets = explorationState.prev_targets?.slice(-3) || []; // Check last 3 targets
    const isRecentTarget = recentTargets.some(prevTarget => 
      prevTarget && frontier.row === prevTarget.row && frontier.col === prevTarget.col
    );
    
    if (isRecentTarget) {
      continue;
    }
    
    // Switch if new frontier has significantly shorter path (>50% shorter)
    
    if (isComponentReachable(getComponentNodeId(robotPosition, coloredMaze, DEFAULT_REGION_SIZE), frontier.componentId, componentGraph)) {
      if (cost < newPathCost) {
        newTarget = frontier;
        newPath = path;
        newPathCost = cost;
      }
    }
    
  }
  // Check if robot is stuck in a movement loop
  let stuckInLoop = false;
  if (explorationState.recent_positions && explorationState.recent_positions.length >= 8) {
    const recentPositions = explorationState.recent_positions.slice(-8); // Check last 8 positions
    const positionCounts = {};
    
    recentPositions.forEach(pos => {
      const key = `${pos.row},${pos.col}`;
      positionCounts[key] = (positionCounts[key] || 0) + 1;
    });
    
    // Check for repeating positions (same position 4+ times in last 8 moves)
    const hasRepeatingPosition = Object.values(positionCounts).some(count => count >= 4);
    
    // Check for true alternating pattern (only 2 unique positions in last 8 moves, with persistent pattern)
    const uniquePositions = Object.keys(positionCounts).length;
    const hasAlternatingPattern = uniquePositions <= 2 && recentPositions.length >= 8;
    
    // // Additional check: make sure we're not making progress toward target
    let noProgressTowardTarget = true;
    // let noProgressTowardTarget = false;
    // if (currentTarget && recentPositions.length >= 6) {
    //   const oldPos = recentPositions[0];
    //   const newPos = recentPositions[recentPositions.length - 1];
    //   const oldDistance = Math.abs(oldPos.row - currentTarget.row) + Math.abs(oldPos.col - currentTarget.col);
    //   const newDistance = Math.abs(newPos.row - currentTarget.row) + Math.abs(newPos.col - currentTarget.col);
    //   noProgressTowardTarget = newDistance >= oldDistance; // No improvement in distance
    // }
    
    // Only consider stuck if we have both a pattern AND no progress toward target
    stuckInLoop = (hasRepeatingPosition || hasAlternatingPattern) && noProgressTowardTarget;
  }
  
  if (newPathCost < currentPathCost) {
    
    // Check if we have a valid new target
    if (!newTarget) {
      return null;
    }
    
    // Check if we're about to yoyo back to any recently abandoned target
    const recentlyAbandonedTargets = explorationState.prev_targets.slice(-5); // Check last 5 targets
    const wouldBeYoyo = recentlyAbandonedTargets.some(prevTarget => 
      prevTarget && newTarget && 
      prevTarget.row === newTarget.row && prevTarget.col === newTarget.col
    );
    
    if (wouldBeYoyo) {
      // Don't switch - this would be a yoyo
      return null;
    }
    
    explorationState.prev_targets.push(currentTarget);
    
    // Keep only last 20 targets
    if (explorationState.prev_targets.length > 20) {
      explorationState.prev_targets.shift();
    }

    result = { target: newTarget, path: newPath };
  }
  
  
  return result;
  
};