/**
 * Frontier detection for exploration algorithms
 * Advanced component-aware frontier detection using WFD algorithm
 */

import { WavefrontFrontierDetection } from '../../core/frontier/index.js';
import { getComponentNodeId } from '../pathfinding/component-based-haa-star.js';
import { CELL_STATES } from '../../core/utils/map-utils.js';

/**
 * Advanced component-aware frontier detection using WFD algorithm
 * Combines research-grade WFD with component awareness
 */
export const detectComponentAwareFrontiers = (knownMap, componentGraph, coloredMaze, useWFD = true, frontierStrategy = 'centroid') => {
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
    
    return componentAwareFrontiers;
  }
  
  // Use basic frontier detection when WFD is disabled
  const basicFrontiers = detectBasicFrontiers(knownMap, componentGraph);
  return basicFrontiers;
};

/**
 * Basic frontier detection (fallback)
 */
export const detectBasicFrontiers = (knownMap, componentGraph) => {
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
export const selectOptimalFrontier = (frontiers, robotPosition) => {
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