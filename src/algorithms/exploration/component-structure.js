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
  
  // NUCLEAR OPTION: Rebuild ALL connections from scratch when any region changes
  // This is less efficient but guarantees correctness
  
  // Clear ALL connections for ALL components
  for (const nodeId of Object.keys(newComponentGraph)) {
    newComponentGraph[nodeId].neighbors = [];
    newComponentGraph[nodeId].transitions = [];
  }
  
  // COMPREHENSIVE connection rebuilding - rebuild ALL border connections for ALL regions
  // console.log(`[COMPONENT] Rebuilding connections for ${numRegions}x${numRegions} regions`);
  let connectionsBuilt = 0;
  
  for (let regionRow = 0; regionRow < numRegions; regionRow++) {
    for (let regionCol = 0; regionCol < numRegions; regionCol++) {
    
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
                connectionsBuilt++;
              }
              
              if (!newComponentGraph[rightNodeId].neighbors.includes(leftNodeId)) {
                newComponentGraph[rightNodeId].neighbors.push(leftNodeId);
                newComponentGraph[rightNodeId].transitions.push({
                  to: leftNodeId,
                  fromCell: { row: r, col: borderCol + 1 },
                  toCell: { row: r, col: borderCol }
                });
                connectionsBuilt++;
              }
            }
          }
        }
      }
    }
    
    // Check LEFT border connections (this region to region on the left)
    if (regionCol > 0) {
      const leftRegionRow = regionRow;
      const leftRegionCol = regionCol - 1;
      const borderCol = regionCol * REGION_SIZE;
      
      for (let r = regionRow * REGION_SIZE; r < (regionRow + 1) * REGION_SIZE; r++) {
        if (r >= 0 && r < SIZE && borderCol > 0 && borderCol < SIZE && 
            knownMap[r] && knownMap[r][borderCol] === CELL_STATES.WALKABLE && 
            knownMap[r][borderCol - 1] === CELL_STATES.WALKABLE) {
          
          const rightComponent = newColoredMaze[r][borderCol];
          const leftComponent = newColoredMaze[r][borderCol - 1];
          
          if (leftComponent !== -1 && rightComponent !== -1) {
            const rightNodeId = `${regionRow},${regionCol}_${rightComponent}`;
            const leftNodeId = `${leftRegionRow},${leftRegionCol}_${leftComponent}`;
            
            // More robust existence check
            if (newComponentGraph[rightNodeId] && newComponentGraph[leftNodeId] && 
                rightNodeId !== leftNodeId) {
              
              // Add bidirectional connection with duplicate checking
              if (!newComponentGraph[rightNodeId].neighbors.includes(leftNodeId)) {
                newComponentGraph[rightNodeId].neighbors.push(leftNodeId);
                newComponentGraph[rightNodeId].transitions.push({
                  to: leftNodeId,
                  fromCell: { row: r, col: borderCol },
                  toCell: { row: r, col: borderCol - 1 }
                });
              }
              
              if (!newComponentGraph[leftNodeId].neighbors.includes(rightNodeId)) {
                newComponentGraph[leftNodeId].neighbors.push(rightNodeId);
                newComponentGraph[leftNodeId].transitions.push({
                  to: rightNodeId,
                  fromCell: { row: r, col: borderCol - 1 },
                  toCell: { row: r, col: borderCol }
                });
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
    
    // Check TOP border connections (this region to region above)
    if (regionRow > 0) {
      const topRegionRow = regionRow - 1;
      const topRegionCol = regionCol;
      const borderRow = regionRow * REGION_SIZE;
      
      
      for (let c = regionCol * REGION_SIZE; c < (regionCol + 1) * REGION_SIZE; c++) {
        if (c >= 0 && c < SIZE && borderRow >= 0 && borderRow < SIZE && 
            borderRow > 0 && knownMap[borderRow] && knownMap[borderRow][c] === CELL_STATES.WALKABLE && 
            knownMap[borderRow - 1] && knownMap[borderRow - 1][c] === CELL_STATES.WALKABLE) {
          
          const bottomComponent = newColoredMaze[borderRow][c];
          const topComponent = newColoredMaze[borderRow - 1][c];
          
          if (topComponent !== -1 && bottomComponent !== -1) {
            const bottomNodeId = `${regionRow},${regionCol}_${bottomComponent}`;
            const topNodeId = `${topRegionRow},${topRegionCol}_${topComponent}`;
            
            // Debug missing connections
            // console.log(`[BORDER-CHECK] Found TOP border: ${topNodeId} ↔ ${bottomNodeId} at (${borderRow-1},${c})→(${borderRow},${c})`);
            
            // More robust existence check
            if (newComponentGraph[bottomNodeId] && newComponentGraph[topNodeId] && 
                bottomNodeId !== topNodeId) {
              // console.log(`[BORDER-BUILD] Building connection: ${topNodeId} ↔ ${bottomNodeId}`);
              
              // Add bidirectional connection with duplicate checking
              if (!newComponentGraph[bottomNodeId].neighbors.includes(topNodeId)) {
                newComponentGraph[bottomNodeId].neighbors.push(topNodeId);
                newComponentGraph[bottomNodeId].transitions.push({
                  to: topNodeId,
                  fromCell: { row: borderRow, col: c },
                  toCell: { row: borderRow - 1, col: c }
                });
                connectionsBuilt++;
              }
              
              if (!newComponentGraph[topNodeId].neighbors.includes(bottomNodeId)) {
                newComponentGraph[topNodeId].neighbors.push(bottomNodeId);
                newComponentGraph[topNodeId].transitions.push({
                  to: bottomNodeId,
                  fromCell: { row: borderRow - 1, col: c },
                  toCell: { row: borderRow, col: c }
                });
                connectionsBuilt++;
              }
            }
          }
        }
      }
    }
    
    // CHECK DIAGONAL CONNECTIONS for 8-directional movement
    // These are critical for preventing isolated components
    
    // Check DIAGONAL borders (4 diagonal directions)
    const diagonalOffsets = [
      { dr: -1, dc: -1, name: "TOP-LEFT" },     // to region above-left
      { dr: -1, dc: 1, name: "TOP-RIGHT" },    // to region above-right  
      { dr: 1, dc: -1, name: "BOTTOM-LEFT" },  // to region below-left
      { dr: 1, dc: 1, name: "BOTTOM-RIGHT" }   // to region below-right
    ];
    
    for (const { dr, dc, name } of diagonalOffsets) {
      const neighborRegionRow = regionRow + dr;
      const neighborRegionCol = regionCol + dc;
      
      // Check if neighbor region exists
      if (neighborRegionRow >= 0 && neighborRegionRow < numRegions &&
          neighborRegionCol >= 0 && neighborRegionCol < numRegions) {
        
        // Check diagonal corner connection
        let cornerRow, cornerCol, neighborCornerRow, neighborCornerCol;
        
        if (dr === -1 && dc === -1) { // TOP-LEFT
          cornerRow = regionRow * REGION_SIZE;
          cornerCol = regionCol * REGION_SIZE;
          neighborCornerRow = cornerRow - 1;
          neighborCornerCol = cornerCol - 1;
        } else if (dr === -1 && dc === 1) { // TOP-RIGHT  
          cornerRow = regionRow * REGION_SIZE;
          cornerCol = (regionCol + 1) * REGION_SIZE - 1;
          neighborCornerRow = cornerRow - 1;
          neighborCornerCol = cornerCol + 1;
        } else if (dr === 1 && dc === -1) { // BOTTOM-LEFT
          cornerRow = (regionRow + 1) * REGION_SIZE - 1;
          cornerCol = regionCol * REGION_SIZE;
          neighborCornerRow = cornerRow + 1;
          neighborCornerCol = cornerCol - 1;
        } else { // BOTTOM-RIGHT
          cornerRow = (regionRow + 1) * REGION_SIZE - 1;
          cornerCol = (regionCol + 1) * REGION_SIZE - 1;
          neighborCornerRow = cornerRow + 1;
          neighborCornerCol = cornerCol + 1;
        }
        
        // Check if both corners are walkable and within bounds
        if (cornerRow >= 0 && cornerRow < SIZE && cornerCol >= 0 && cornerCol < SIZE &&
            neighborCornerRow >= 0 && neighborCornerRow < SIZE && 
            neighborCornerCol >= 0 && neighborCornerCol < SIZE &&
            knownMap[cornerRow] && knownMap[cornerRow][cornerCol] === CELL_STATES.WALKABLE &&
            knownMap[neighborCornerRow] && knownMap[neighborCornerRow][neighborCornerCol] === CELL_STATES.WALKABLE) {
          
          const currentComponent = newColoredMaze[cornerRow][cornerCol];
          const neighborComponent = newColoredMaze[neighborCornerRow][neighborCornerCol];
          
          if (currentComponent !== -1 && neighborComponent !== -1) {
            const currentNodeId = `${regionRow},${regionCol}_${currentComponent}`;
            const neighborNodeId = `${neighborRegionRow},${neighborRegionCol}_${neighborComponent}`;
            
            // console.log(`[BORDER-CHECK] Found ${name} diagonal border: ${currentNodeId} ↔ ${neighborNodeId}`);
            
            if (newComponentGraph[currentNodeId] && newComponentGraph[neighborNodeId] && 
                currentNodeId !== neighborNodeId) {
              // console.log(`[BORDER-BUILD] Building diagonal connection: ${currentNodeId} ↔ ${neighborNodeId}`);
              
              // Add bidirectional diagonal connection
              if (!newComponentGraph[currentNodeId].neighbors.includes(neighborNodeId)) {
                newComponentGraph[currentNodeId].neighbors.push(neighborNodeId);
                newComponentGraph[currentNodeId].transitions.push({
                  to: neighborNodeId,
                  fromCell: { row: cornerRow, col: cornerCol },
                  toCell: { row: neighborCornerRow, col: neighborCornerCol }
                });
                connectionsBuilt++;
              }
              
              if (!newComponentGraph[neighborNodeId].neighbors.includes(currentNodeId)) {
                newComponentGraph[neighborNodeId].neighbors.push(currentNodeId);
                newComponentGraph[neighborNodeId].transitions.push({
                  to: currentNodeId,
                  fromCell: { row: neighborCornerRow, col: neighborCornerCol },
                  toCell: { row: cornerRow, col: cornerCol }
                });
                connectionsBuilt++;
              }
            }
          }
        }
      }
    }
    
    } // Close regionCol loop
  } // Close regionRow loop
  
  // console.log(`[COMPONENT] Built ${connectionsBuilt} connections for ${Object.keys(newComponentGraph).length} components`);
  
  // Debug isolated components
  const isolatedComponents = Object.keys(newComponentGraph).filter(nodeId => 
    newComponentGraph[nodeId].neighbors.length === 0
  );
  // if (isolatedComponents.length > 0) {
  //   console.log(`[COMPONENT] ISOLATED components: ${isolatedComponents.join(', ')}`);
  // }
  
  return { componentGraph: newComponentGraph, coloredMaze: newColoredMaze };
};