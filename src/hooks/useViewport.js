import { useMemo } from 'react';

/**
 * Simplified viewport hook for character-centered camera system
 * Avoids state updates to prevent infinite loops
 */
export const useViewport = (state) => {
  const { characterPosition, maze } = state;
  
  // Viewport configuration
  const VIEWPORT_SIZE = 800;
  const CELL_SIZE = 10;
  const BUFFER_CELLS = 10;
  const MAZE_SIZE = maze.length || 256;
  const TOTAL_MAZE_PX = MAZE_SIZE * CELL_SIZE;
  
  // Performance flag: set to false to get original real-time viewport updates
  const THROTTLE_VIEWPORT = true;
  
  // Calculate camera position - with optional throttling for performance
  const cameraPosition = useMemo(() => {
    if (!characterPosition) {
      return {
        x: (TOTAL_MAZE_PX - VIEWPORT_SIZE) / 2,
        y: (TOTAL_MAZE_PX - VIEWPORT_SIZE) / 2
      };
    }
    
    let characterPixelX, characterPixelY;
    
    if (THROTTLE_VIEWPORT) {
      // Throttled: snap to grid every 5 cells to reduce viewport recalculations
      const throttleStep = 10;
      const throttledCol = Math.floor(characterPosition.col / throttleStep) * throttleStep;
      const throttledRow = Math.floor(characterPosition.row / throttleStep) * throttleStep;
      characterPixelX = throttledCol * CELL_SIZE;
      characterPixelY = throttledRow * CELL_SIZE;
    } else {
      // Real-time: update viewport every frame (original behavior)
      characterPixelX = characterPosition.col * CELL_SIZE;
      characterPixelY = characterPosition.row * CELL_SIZE;
    }
    
    let targetX = characterPixelX - VIEWPORT_SIZE / 2;
    let targetY = characterPixelY - VIEWPORT_SIZE / 2;
    
    targetX = Math.max(0, Math.min(targetX, TOTAL_MAZE_PX - VIEWPORT_SIZE));
    targetY = Math.max(0, Math.min(targetY, TOTAL_MAZE_PX - VIEWPORT_SIZE));
    
    return { x: targetX, y: targetY };
  }, [characterPosition, TOTAL_MAZE_PX, VIEWPORT_SIZE, THROTTLE_VIEWPORT]);
  
  // Calculate everything in one go to avoid cascading dependencies
  const viewportData = useMemo(() => {
    // Visible bounds
    const startCol = Math.floor(cameraPosition.x / CELL_SIZE) - BUFFER_CELLS;
    const startRow = Math.floor(cameraPosition.y / CELL_SIZE) - BUFFER_CELLS;
    const endCol = Math.ceil((cameraPosition.x + VIEWPORT_SIZE) / CELL_SIZE) + BUFFER_CELLS;
    const endRow = Math.ceil((cameraPosition.y + VIEWPORT_SIZE) / CELL_SIZE) + BUFFER_CELLS;
    
    const visibleBounds = {
      startRow: Math.max(0, startRow),
      endRow: Math.min(MAZE_SIZE, endRow),
      startCol: Math.max(0, startCol),
      endCol: Math.min(MAZE_SIZE, endCol)
    };
    
    // Helper functions - match original padding offset
    const getCellPosition = (row, col) => ({
      x: (col * CELL_SIZE + 16) - cameraPosition.x,
      y: (row * CELL_SIZE + 16) - cameraPosition.y
    });
    
    // Visible regions
    const REGION_SIZE = 8;
    const regions = [];
    const startRegionRow = Math.floor(visibleBounds.startRow / REGION_SIZE);
    const endRegionRow = Math.ceil(visibleBounds.endRow / REGION_SIZE);
    const startRegionCol = Math.floor(visibleBounds.startCol / REGION_SIZE);
    const endRegionCol = Math.ceil(visibleBounds.endCol / REGION_SIZE);
    
    for (let regionRow = startRegionRow; regionRow < endRegionRow; regionRow++) {
      for (let regionCol = startRegionCol; regionCol < endRegionCol; regionCol++) {
        const regionId = `${regionRow},${regionCol}`;
        // Match original positioning: regionCol * REGION_SIZE * 10 + 16
        const pixelX = (regionCol * REGION_SIZE * CELL_SIZE + 16) - cameraPosition.x;
        const pixelY = (regionRow * REGION_SIZE * CELL_SIZE + 16) - cameraPosition.y;
        
        regions.push({
          regionId,
          regionRow,
          regionCol,
          x: pixelX,
          y: pixelY
        });
      }
    }
    
    // Stats
    const totalCells = MAZE_SIZE * MAZE_SIZE;
    const visibleCells = (visibleBounds.endRow - visibleBounds.startRow) * 
                        (visibleBounds.endCol - visibleBounds.startCol);
    const cullPercentage = ((totalCells - visibleCells) / totalCells * 100).toFixed(1);
    
    return {
      visibleBounds,
      getCellPosition,
      getVisibleRegions: regions,
      viewportStats: {
        totalCells,
        visibleCells,
        cullPercentage,
        cameraPosition: {
          x: Math.round(cameraPosition.x),
          y: Math.round(cameraPosition.y)
        }
      }
    };
  }, [cameraPosition, VIEWPORT_SIZE, CELL_SIZE, BUFFER_CELLS, MAZE_SIZE]);
  
  return {
    VIEWPORT_SIZE,
    CELL_SIZE,
    cameraPosition,
    ...viewportData
  };
};