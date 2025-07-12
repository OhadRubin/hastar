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
  
  // Calculate camera position directly without state
  const cameraPosition = useMemo(() => {
    if (!characterPosition) {
      return {
        x: (TOTAL_MAZE_PX - VIEWPORT_SIZE) / 2,
        y: (TOTAL_MAZE_PX - VIEWPORT_SIZE) / 2
      };
    }
    
    const characterPixelX = characterPosition.col * CELL_SIZE;
    const characterPixelY = characterPosition.row * CELL_SIZE;
    
    let targetX = characterPixelX - VIEWPORT_SIZE / 2;
    let targetY = characterPixelY - VIEWPORT_SIZE / 2;
    
    targetX = Math.max(0, Math.min(targetX, TOTAL_MAZE_PX - VIEWPORT_SIZE));
    targetY = Math.max(0, Math.min(targetY, TOTAL_MAZE_PX - VIEWPORT_SIZE));
    
    return { x: targetX, y: targetY };
  }, [characterPosition, TOTAL_MAZE_PX, VIEWPORT_SIZE]);
  
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
    
    // Helper functions
    const getCellPosition = (row, col) => ({
      x: col * CELL_SIZE - cameraPosition.x,
      y: row * CELL_SIZE - cameraPosition.y
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
        const pixelX = regionCol * REGION_SIZE * CELL_SIZE - cameraPosition.x;
        const pixelY = regionRow * REGION_SIZE * CELL_SIZE - cameraPosition.y;
        
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