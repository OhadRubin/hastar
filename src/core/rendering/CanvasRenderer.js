import { useRef, useEffect, useCallback } from 'react';

/**
 * Generic canvas-based renderer for maze visualizations
 * Uses viewport culling to handle large mazes efficiently
 * Supports both pathfinding and exploration rendering modes
 */
const CanvasRenderer = ({ 
  state, 
  cellCheckers, 
  colors = {}, 
  viewport, 
  isAnimating = false,
  renderMode = 'pathfinding' // 'pathfinding' | 'exploration'
}) => {
  const canvasRef = useRef(null);
  const { maze, coloredMaze, visitedCells } = state;
  const { 
    visibleBounds, 
    getCellPosition, 
    getVisibleRegions, 
    VIEWPORT_SIZE,
    CELL_SIZE 
  } = viewport;

  // Default cell colors (can be overridden via colors prop)
  const COLORS = {
    WALL: '#2d3748',
    WALKABLE: '#ffffff', 
    CHARACTER: '#3B82F6',
    START: '#10B981',
    END: '#EF4444',
    BORDER: '#cbd5e0',
    EXPLORED: '#e8e8e8',  // Better contrast - light gray like frontier_maze
    FRONTIER: '#ff6b6b',  // Bright red like frontier_maze - much more visible
    ROBOT: '#00ff00',     // Bright green like frontier_maze - clear distinction
    UNKNOWN: '#808080',   // Gray for unknown areas
    ...colors // Override defaults with provided colors
  };

  /**
   * Draws a single cell with proper colors and markers
   */
  const drawCell = useCallback((ctx, row, col, x, y) => {
    if (!maze[row] || maze[row][col] === undefined) return;

    const cellKey = `${row},${col}`;
    const isWall = maze[row][col] === 1;
    const colorIndex = coloredMaze[row]?.[col];
    const isVisited = visitedCells?.has(cellKey);

    // Get cell state using existing O(1) lookups
    const isStartPoint = cellCheckers?.isStartPoint?.(row, col) || false;
    const isEndPoint = cellCheckers?.isEndPoint?.(row, col) || false;
    const isCharacterPosition = cellCheckers?.isCharacterPosition?.(row, col) || false;
    const shouldShowCharacter = cellCheckers?.shouldShowCharacter?.(row, col) || false;
    const shouldShowXMarker = cellCheckers?.shouldShowXMarker?.(row, col, isAnimating) || false;
    
    // Exploration-specific cell checks
    const isRobotPosition = cellCheckers?.isRobotPosition?.(row, col) || false;
    const isFrontier = cellCheckers?.isFrontier?.(row, col) || false;
    const isExplored = cellCheckers?.isExplored?.(row, col) || false;
    const isActualEnd = cellCheckers?.isActualEnd?.(row, col) || false;
    const isInDetailedPath = cellCheckers?.isInDetailedPath?.(row, col) || false;
    const isComponentTransition = cellCheckers?.isComponentTransition?.(row, col) || false;

    // Determine background color based on render mode
    let backgroundColor = isWall ? COLORS.WALL : COLORS.WALKABLE;
    
    if (renderMode === 'pathfinding') {
      // Pathfinding mode: use component colors for visited cells
      if (isVisited && colorIndex >= 0 && colors.pathfindingColors) {
        backgroundColor = colors.pathfindingColors[colorIndex];
      }
      
      // Priority order: Character > Start > End > Default
      if (isCharacterPosition) {
        backgroundColor = COLORS.CHARACTER;
      } else if (isStartPoint) {
        backgroundColor = COLORS.START;
      } else if (isEndPoint) {
        backgroundColor = COLORS.END;
      }
    } else if (renderMode === 'exploration') {
      // Exploration mode: three-state visualization (unknown/explored/wall)
      const isUnknown = cellCheckers?.isUnknown?.(row, col) || false;
      
      if (isUnknown) {
        backgroundColor = COLORS.UNKNOWN;
      } else if (isWall) {
        backgroundColor = COLORS.WALL;
      } else if (isExplored) {
        backgroundColor = COLORS.EXPLORED;
      } else {
        backgroundColor = COLORS.WALKABLE;
      }
      
      // Show current detailed path (remaining path to frontier)
      if (isInDetailedPath) {
        backgroundColor = '#3B82F6'; // Blue for path cells
      }
      
      // Special color for component transitions in path
      if (isComponentTransition) {
        backgroundColor = '#F59E0B'; // Orange for component transitions
      }
      
      // High priority overlays
      if (isRobotPosition) {
        backgroundColor = COLORS.ROBOT;
      } else if (isActualEnd) {
        backgroundColor = '#FF4081'; // Pink/magenta for actual target
      } else if (isStartPoint) {
        backgroundColor = COLORS.START;
      }
    }

    // Draw cell background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);

    // Draw cell border
    ctx.strokeStyle = COLORS.BORDER;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, CELL_SIZE, CELL_SIZE);

    // Draw markers
    if (shouldShowCharacter || shouldShowXMarker || isRobotPosition || isFrontier || isComponentTransition || isActualEnd) {
      if (isRobotPosition) {
        // Draw larger, more visible robot with clear direction
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px Arial';  // Larger font for better visibility
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const directions = ['↑', '→', '↓', '←']; // NORTH, EAST, SOUTH, WEST
        const robotDirection = state.robotDirection || 0;
        ctx.fillText(directions[robotDirection], x + CELL_SIZE/2, y + CELL_SIZE/2);
        
        // Add robot body outline for better visibility
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x + CELL_SIZE/2, y + CELL_SIZE/2, 12, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (isComponentTransition) {
        // Draw special marker for component transitions
        ctx.fillStyle = '#ffffff'; // White for visibility on orange background
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('◆', x + CELL_SIZE/2, y + CELL_SIZE/2); // Diamond marker
      } else if (isActualEnd) {
        // Draw marker for actual target
        ctx.fillStyle = '#000000'; // Black marker on pink background
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('x', x + CELL_SIZE/2, y + CELL_SIZE/2);
      } else if (isFrontier) {
        // Draw X marker for frontier cells
        ctx.fillStyle = '#000000'; // Black X for frontiers
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('x', x + CELL_SIZE/2, y + CELL_SIZE/2);
      } else {
        // Standard pathfinding markers
        ctx.fillStyle = shouldShowCharacter ? '#fff' : '#000';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        let markerText = 'X';
        if (shouldShowCharacter) markerText = '●';
        
        ctx.fillText(markerText, x + CELL_SIZE/2, y + CELL_SIZE/2);
      }
    }
    
    // Draw component ID numbers for exploration mode (only on discovered cells)
    if (renderMode === 'exploration' && !isWall && colorIndex !== undefined && colorIndex !== -1 && 
        cellCheckers.isExplored && cellCheckers.isExplored(row, col)) {
      ctx.fillStyle = '#333333'; // Dark gray for visibility
      ctx.font = '10px Arial';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(colorIndex.toString(), x + 2, y + 2);
    }
  }, [maze, coloredMaze, visitedCells, cellCheckers, colors, isAnimating, CELL_SIZE, renderMode, COLORS]);

  /**
   * Draws region borders for abstract path visualization (pathfinding mode)
   */
  const drawRegionBorders = useCallback((ctx) => {
    if (renderMode !== 'pathfinding' || !state.showAbstractPath) return;

    const REGION_SIZE = 8;
    const { abstractPath } = state;
    const regions = getVisibleRegions;

    regions.forEach(({ regionRow, regionCol, x, y }) => {
      const regionId = `${regionRow},${regionCol}`;
      
      // Check if region is in abstract path
      const isInPath = abstractPath.some(componentNodeId => 
        componentNodeId.startsWith(regionId + '_')
      );
      
      const borderColor = isInPath ? '#10B981' : '#4a5568';
      const borderWidth = isInPath ? 7 : 1;
      
      // Draw dotted border
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = borderWidth;
      ctx.setLineDash([4, 2]); // Dotted line pattern
      
      // Only overlap for green borders (matching original logic)
      const overlap = isInPath ? 1 : 0;
      const borderX = x - overlap;
      const borderY = y - overlap;
      const borderSize = REGION_SIZE * CELL_SIZE + overlap * 2;
      
      ctx.strokeRect(borderX, borderY, borderSize, borderSize);
    });
    
    // Reset line dash
    ctx.setLineDash([]);
  }, [state.showAbstractPath, state.abstractPath, getVisibleRegions, CELL_SIZE, renderMode]);

  /**
   * Draws simple region grids for exploration mode (like pathfinding)
   */
  const drawRegionGrids = useCallback((ctx) => {
    if (renderMode !== 'exploration') return;

    const REGION_SIZE = 8;
    const regions = getVisibleRegions;

    // Simple black region borders like pathfinding mode
    ctx.strokeStyle = '#2d3748'; // Darker gray for better visibility
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 2]); // Dotted line pattern like pathfinding

    regions.forEach(({ regionRow, regionCol, x, y }) => {
      // Simple 8x8 region border
      ctx.strokeRect(x, y, REGION_SIZE * CELL_SIZE, REGION_SIZE * CELL_SIZE);
    });
    
    // Reset line dash
    ctx.setLineDash([]);
  }, [renderMode, getVisibleRegions, CELL_SIZE]);

  /**
   * Draws exploration-specific overlays: sensor coverage and clean component indicators
   */
  const drawExplorationOverlays = useCallback((ctx) => {
    if (renderMode !== 'exploration') return;

    // Only draw component borders for large, established components to reduce visual noise
    if (state.componentGraph && Object.keys(state.componentGraph).length < 10) {
      Object.entries(state.componentGraph).forEach(([nodeId, component]) => {
        // Only show borders for significant components
        if (component.cells.length > 15) {
          const [regionRow, regionCol] = nodeId.split('_')[0].split(',').map(Number);
          
          ctx.strokeStyle = '#10B981';  // Green for discovered components
          ctx.lineWidth = 2;
          ctx.setLineDash([8, 4]); // Longer dashes, less visual noise
          
          const x = regionCol * 8 * CELL_SIZE - (viewport.cameraPosition?.x || 0);
          const y = regionRow * 8 * CELL_SIZE - (viewport.cameraPosition?.y || 0);
          ctx.strokeRect(x, y, 8 * CELL_SIZE, 8 * CELL_SIZE);
        }
      });
      
      ctx.setLineDash([]); // Reset line dash
    }


    // Draw actual sensor positions with cyan overlay (like frontier_maze)
    if (state.sensorPositions && state.sensorPositions.length > 0) {
      ctx.fillStyle = 'rgba(0, 255, 255, 0.2)';  // Cyan like frontier_maze
      state.sensorPositions.forEach(pos => {
        const position = getCellPosition(pos.row, pos.col);
        ctx.fillRect(position.x, position.y, CELL_SIZE, CELL_SIZE);
      });
    }

    // Draw current exploration path
    if (state.currentPath && state.currentPath.length > 0) {
      ctx.strokeStyle = 'rgba(0, 123, 255, 0.8)'; // Blue path
      ctx.lineWidth = 4;
      ctx.beginPath();
      
      state.currentPath.slice(2).forEach((point, index) => {
        const position = getCellPosition(point.row, point.col);
        const x = position.x + CELL_SIZE/2;
        const y = position.y + CELL_SIZE/2;
        
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      
      ctx.stroke();
    }

    // Draw planned path to frontier (fallback)
    if (state.plannedPath) {
      ctx.strokeStyle = 'rgba(255, 87, 34, 0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      
      state.plannedPath.forEach((point, index) => {
        const position = getCellPosition(point.row, point.col);
        const x = position.x + CELL_SIZE/2;
        const y = position.y + CELL_SIZE/2;
        
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      
      ctx.stroke();
    }
  }, [renderMode, state.componentGraph, state.robotPosition, state.sensorRange, 
      state.sensorPositions, state.plannedPath, state.currentPath, CELL_SIZE, viewport]);

  /**
   * Main render function with viewport culling
   */
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !maze || maze.length === 0) return;

    const ctx = canvas.getContext('2d');
    
    // Set canvas size to viewport
    canvas.width = VIEWPORT_SIZE;
    canvas.height = VIEWPORT_SIZE;

    // Clear canvas
    ctx.clearRect(0, 0, VIEWPORT_SIZE, VIEWPORT_SIZE);

    // Set background
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(0, 0, VIEWPORT_SIZE, VIEWPORT_SIZE);

    // Only render cells within visible bounds (viewport culling)
    for (let row = visibleBounds.startRow; row < visibleBounds.endRow; row++) {
      for (let col = visibleBounds.startCol; col < visibleBounds.endCol; col++) {
        if (!maze[row] || maze[row][col] === undefined) continue;
        
        const position = getCellPosition(row, col);
        drawCell(ctx, row, col, position.x, position.y);
      }
    }

    // Draw overlays based on render mode
    if (renderMode === 'pathfinding') {
      drawRegionBorders(ctx);
    } else if (renderMode === 'exploration') {
      // Draw region grids first (background layer)
      drawRegionGrids(ctx);
      
      // Draw exploration overlays
      drawExplorationOverlays(ctx);
      
      // Hybrid rendering: show region borders when HAA* paths exist
      if (state.abstractPath && state.abstractPath.length > 0) {
        drawRegionBorders(ctx);
      }
    }

  }, [
    maze, 
    visibleBounds, 
    getCellPosition, 
    drawCell, 
    drawRegionBorders,
    drawRegionGrids,
    drawExplorationOverlays,
    VIEWPORT_SIZE,
    renderMode
  ]);

  // Re-render when dependencies change
  useEffect(() => {
    render();
  }, [render]);

  return (
    <div
      style={{
        position: 'relative',
        width: `${VIEWPORT_SIZE}px`,
        height: `${VIEWPORT_SIZE}px`,
        overflow: 'hidden'
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%'
        }}
      />
    </div>
  );
};

export default CanvasRenderer;