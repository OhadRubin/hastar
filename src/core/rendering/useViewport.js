import { useMemo, useRef } from 'react';
import { DEFAULT_REGION_SIZE } from '../constants.js';

/**
 * Simplified viewport hook with smooth camera movement
 * Features: Simple linear interpolation without state conflicts
 */
export const useViewport = (state) => {
  const { characterPosition, maze } = state;
  
  // Constants
  const VIEWPORT_SIZE = 600;
  const CELL_SIZE = 10;
  const BUFFER_CELLS = 10;
  const MAZE_SIZE = maze.length || 256;
  const TOTAL_MAZE_PX = MAZE_SIZE * CELL_SIZE;
  
  // Simple smoothing configuration
  const SMOOTHING_FACTOR = 0.05; // How fast camera follows (0.1 = smooth, 1.0 = instant)
  
  // Persistent camera position for smoothing
  const smoothCameraRef = useRef({
    x: (TOTAL_MAZE_PX - VIEWPORT_SIZE) / 2,
    y: (TOTAL_MAZE_PX - VIEWPORT_SIZE) / 2
  });
  
  // Track if we've positioned camera on character yet
  const hasInitializedRef = useRef(false);
  
  // Calculate camera position with simple smoothing
  const cameraPosition = useMemo(() => {
    if (!characterPosition) {
      hasInitializedRef.current = false; // Reset when no character
      return {
        x: (TOTAL_MAZE_PX - VIEWPORT_SIZE) / 2,
        y: (TOTAL_MAZE_PX - VIEWPORT_SIZE) / 2
      };
    }
    
    // Target position (where camera wants to be)
    const characterPixelX = characterPosition.col * CELL_SIZE;
    const characterPixelY = characterPosition.row * CELL_SIZE;
    
    let targetX = characterPixelX - VIEWPORT_SIZE / 2;
    let targetY = characterPixelY - VIEWPORT_SIZE / 2;
    
    // Clamp to world boundaries
    targetX = Math.max(0, Math.min(targetX, TOTAL_MAZE_PX - VIEWPORT_SIZE));
    targetY = Math.max(0, Math.min(targetY, TOTAL_MAZE_PX - VIEWPORT_SIZE));
    
    // First time positioning: snap directly to character (no smoothing)
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      smoothCameraRef.current = { x: targetX, y: targetY };
      return { x: targetX, y: targetY };
    }
    
    // Subsequent movements: use smooth interpolation
    const currentX = smoothCameraRef.current.x + (targetX - smoothCameraRef.current.x) * SMOOTHING_FACTOR;
    const currentY = smoothCameraRef.current.y + (targetY - smoothCameraRef.current.y) * SMOOTHING_FACTOR;
    
    // Update persistent position
    smoothCameraRef.current = { x: currentX, y: currentY };
    
    return { x: currentX, y: currentY };
  }, [characterPosition, TOTAL_MAZE_PX, VIEWPORT_SIZE, SMOOTHING_FACTOR]);
  
  // Calculate everything in one go to avoid cascading dependencies
  const viewportData = useMemo(() => {
    // Calculate visible bounds with buffer
    const startCol = Math.floor(Math.max(0, cameraPosition.x / CELL_SIZE - BUFFER_CELLS));
    const endCol = Math.ceil(Math.min(MAZE_SIZE, (cameraPosition.x + VIEWPORT_SIZE) / CELL_SIZE + BUFFER_CELLS));
    const startRow = Math.floor(Math.max(0, cameraPosition.y / CELL_SIZE - BUFFER_CELLS));
    const endRow = Math.ceil(Math.min(MAZE_SIZE, (cameraPosition.y + VIEWPORT_SIZE) / CELL_SIZE + BUFFER_CELLS));
    
    const visibleBounds = { startCol, endCol, startRow, endRow };
    
    // Function to get cell position relative to viewport
    const getCellPosition = (row, col) => ({
      x: col * CELL_SIZE - cameraPosition.x,
      y: row * CELL_SIZE - cameraPosition.y
    });
    
    // Calculate visible regions (for borders)
    const getVisibleRegions = (() => {
      const regions = [];
      const REGION_SIZE = DEFAULT_REGION_SIZE;
      
      const startRegionCol = Math.floor(startCol / REGION_SIZE);
      const endRegionCol = Math.ceil(endCol / REGION_SIZE);
      const startRegionRow = Math.floor(startRow / REGION_SIZE);
      const endRegionRow = Math.ceil(endRow / REGION_SIZE);
      
      for (let regionRow = startRegionRow; regionRow < endRegionRow; regionRow++) {
        for (let regionCol = startRegionCol; regionCol < endRegionCol; regionCol++) {
          const x = regionCol * REGION_SIZE * CELL_SIZE - cameraPosition.x;
          const y = regionRow * REGION_SIZE * CELL_SIZE - cameraPosition.y;
          
          regions.push({
            regionRow,
            regionCol,
            x,
            y
          });
        }
      }
      
      return regions;
    })();
    
    // Stats with smoothing information
    const totalCells = MAZE_SIZE * MAZE_SIZE;
    const visibleCells = (visibleBounds.endRow - visibleBounds.startRow) * 
                        (visibleBounds.endCol - visibleBounds.startCol);
    const cullPercentage = ((totalCells - visibleCells) / totalCells * 100).toFixed(1);
    
    return {
      visibleBounds,
      getCellPosition,
      getVisibleRegions,
      viewportStats: {
        totalCells,
        visibleCells,
        cullPercentage: `${cullPercentage}%`,
        cameraPosition: {
          x: Math.round(cameraPosition.x),
          y: Math.round(cameraPosition.y)
        },
        smoothing: {
          smoothingFactor: SMOOTHING_FACTOR,
          enabled: true
        }
      }
    };
  }, [cameraPosition, VIEWPORT_SIZE, CELL_SIZE, BUFFER_CELLS, MAZE_SIZE, SMOOTHING_FACTOR]);
  
  return {
    VIEWPORT_SIZE,
    CELL_SIZE,
    ...viewportData
  };
};