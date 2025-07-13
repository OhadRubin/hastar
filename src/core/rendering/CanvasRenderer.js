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
    EXPLORED: '#f3f4f6',
    FRONTIER: '#fbbf24',
    ROBOT: '#8b5cf6',
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
      // Exploration mode: use exploration-specific colors
      if (isFrontier) {
        backgroundColor = COLORS.FRONTIER;
      } else if (isExplored) {
        backgroundColor = COLORS.EXPLORED;
      }
      
      if (isRobotPosition) {
        backgroundColor = COLORS.ROBOT;
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
    if (shouldShowCharacter || shouldShowXMarker || isRobotPosition) {
      ctx.fillStyle = (shouldShowCharacter || isRobotPosition) ? '#fff' : '#000';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      let markerText = 'X';
      if (shouldShowCharacter) markerText = '●';
      if (isRobotPosition) {
        // Show directional arrow based on robot direction
        const directions = ['↑', '→', '↓', '←']; // NORTH, EAST, SOUTH, WEST
        const robotDirection = state.robotDirection || 0;
        markerText = directions[robotDirection];
      }
      
      ctx.fillText(markerText, x + CELL_SIZE/2, y + CELL_SIZE/2);
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
   * Draws component borders and sensor coverage for exploration mode
   */
  const drawComponentBorders = useCallback((ctx) => {
    if (renderMode !== 'exploration') return;

    // Draw evolving component boundaries
    if (state.componentGraph) {
      Object.entries(state.componentGraph).forEach(([nodeId, component]) => {
        const [regionRow, regionCol] = nodeId.split('_')[0].split(',').map(Number);
        
        // Color based on component size (larger = more established)
        const borderColor = component.cells.length > 10 ? '#10B981' : '#6B7280';
        const lineWidth = component.cells.length > 5 ? 3 : 1;
        
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = lineWidth;
        ctx.setLineDash([4, 4]); // Dotted line to show dynamic nature
        
        // Draw component region border
        const x = regionCol * 8 * CELL_SIZE - (viewport.cameraPosition?.x || 0);
        const y = regionRow * 8 * CELL_SIZE - (viewport.cameraPosition?.y || 0);
        ctx.strokeRect(x, y, 8 * CELL_SIZE, 8 * CELL_SIZE);
      });
      
      ctx.setLineDash([]); // Reset line dash
    }

    // Draw sensor coverage area around robot
    if (state.robotPosition && state.sensorRange) {
      const robotX = state.robotPosition.col * CELL_SIZE - (viewport.cameraPosition?.x || 0);
      const robotY = state.robotPosition.row * CELL_SIZE - (viewport.cameraPosition?.y || 0);
      const sensorRadius = state.sensorRange * CELL_SIZE;
      
      // Draw sensor range circle
      ctx.strokeStyle = 'rgba(76, 175, 80, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(
        robotX + CELL_SIZE/2, 
        robotY + CELL_SIZE/2, 
        sensorRadius, 
        0, 2 * Math.PI
      );
      ctx.stroke();
      
      // Fill sensor coverage area
      ctx.fillStyle = 'rgba(76, 175, 80, 0.1)';
      ctx.fill();
    }

    // Draw sensor positions
    if (state.sensorPositions) {
      ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
      state.sensorPositions.forEach(pos => {
        const x = pos.col * CELL_SIZE - (viewport.cameraPosition?.x || 0);
        const y = pos.row * CELL_SIZE - (viewport.cameraPosition?.y || 0);
        ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
      });
    }

    // Draw planned path to frontier
    if (state.plannedPath) {
      ctx.strokeStyle = 'rgba(255, 87, 34, 0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      
      state.plannedPath.forEach((point, index) => {
        const x = point.col * CELL_SIZE - (viewport.cameraPosition?.x || 0) + CELL_SIZE/2;
        const y = point.row * CELL_SIZE - (viewport.cameraPosition?.y || 0) + CELL_SIZE/2;
        
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      
      ctx.stroke();
    }
  }, [renderMode, state.componentGraph, state.robotPosition, state.sensorRange, 
      state.sensorPositions, state.plannedPath, CELL_SIZE, viewport]);

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
      drawComponentBorders(ctx);
    }

  }, [
    maze, 
    visibleBounds, 
    getCellPosition, 
    drawCell, 
    drawRegionBorders,
    drawComponentBorders,
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