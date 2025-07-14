/**
 * Component structure management for exploration algorithms
 * Handles online component graph evolution during exploration
 */

import { findConnectedComponents } from '../../core/utils/maze-utils.js';
import { CELL_STATES } from '../../core/utils/map-utils.js';

/**
 * Online component structure updates
 * Handles component growth, merging, and evolution
 */
export const updateComponentStructure = (knownMap, componentGraph, coloredMaze, newCells, REGION_SIZE) => {
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