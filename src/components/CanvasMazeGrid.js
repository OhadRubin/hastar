import { useRef, useEffect, useCallback } from 'react';

/**
 * Canvas-based maze grid that only renders visible cells for performance
 * Uses viewport culling to handle large mazes efficiently
 * Replaces VirtualMazeGrid with canvas rendering for better performance
 */
const CanvasMazeGrid = ({ 
  state, 
  cellCheckers, 
  pathfindingColors, 
  viewport, 
  isAnimating 
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

  // Cell color constants (matching MazeCell.js)
  const COLORS = {
    WALL: '#2d3748',
    WALKABLE: '#ffffff', 
    CHARACTER: '#3B82F6',
    START: '#10B981',
    END: '#EF4444',
    BORDER: '#cbd5e0'
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
    const isStartPoint = cellCheckers.isStartPoint(row, col);
    const isEndPoint = cellCheckers.isEndPoint(row, col);
    const isCharacterPosition = cellCheckers.isCharacterPosition(row, col);
    const shouldShowCharacter = cellCheckers.shouldShowCharacter(row, col);
    const shouldShowXMarker = cellCheckers.shouldShowXMarker(row, col, isAnimating);

    // Determine background color (matching MazeCell logic)
    let backgroundColor = isWall ? COLORS.WALL : 
      (isVisited && colorIndex >= 0 ? pathfindingColors[colorIndex] : COLORS.WALKABLE);
    
    // Priority order: Character > Start > End > Default
    if (isCharacterPosition) {
      backgroundColor = COLORS.CHARACTER;
    } else if (isStartPoint) {
      backgroundColor = COLORS.START;
    } else if (isEndPoint) {
      backgroundColor = COLORS.END;
    }

    // Draw cell background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);

    // Draw cell border
    ctx.strokeStyle = COLORS.BORDER;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, CELL_SIZE, CELL_SIZE);

    // Draw markers
    if (shouldShowCharacter || shouldShowXMarker) {
      ctx.fillStyle = shouldShowCharacter ? '#fff' : '#000';
      ctx.font = 'bold 8px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const markerText = shouldShowCharacter ? '●' : 'X';
      ctx.fillText(markerText, x + CELL_SIZE/2, y + CELL_SIZE/2);
    }
  }, [maze, coloredMaze, visitedCells, cellCheckers, pathfindingColors, isAnimating, CELL_SIZE]);

  /**
   * Draws region borders for abstract path visualization
   */
  const drawRegionBorders = useCallback((ctx) => {
    if (!state.showAbstractPath) return;

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
  }, [state.showAbstractPath, state.abstractPath, getVisibleRegions, CELL_SIZE]);

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

    // Draw region borders on top
    drawRegionBorders(ctx);

  }, [
    maze, 
    visibleBounds, 
    getCellPosition, 
    drawCell, 
    drawRegionBorders,
    VIEWPORT_SIZE
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

export default CanvasMazeGrid;