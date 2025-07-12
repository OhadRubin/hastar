import React, { useMemo } from 'react';
import MazeCell from './MazeCell.js';

/**
 * Virtual maze grid that only renders visible cells for performance
 * Uses viewport culling to handle large mazes efficiently
 */
const VirtualMazeGrid = ({ 
  state, 
  cellCheckers, 
  pathfindingColors, 
  viewport, 
  regionStyles,
  isAnimating 
}) => {
  const { maze, coloredMaze } = state;
  const { 
    visibleBounds, 
    getCellPosition, 
    getVisibleRegions, 
    VIEWPORT_SIZE,
    CELL_SIZE 
  } = viewport;

  // Only render cells within visible bounds - major performance optimization
  const visibleCells = useMemo(() => {
    if (!maze || maze.length === 0) return [];
    
    const cells = [];
    
    for (let row = visibleBounds.startRow; row < visibleBounds.endRow; row++) {
      for (let col = visibleBounds.startCol; col < visibleBounds.endCol; col++) {
        // Skip if cell doesn't exist in maze
        if (!maze[row] || maze[row][col] === undefined) continue;
        
        const position = getCellPosition(row, col);
        
        cells.push(
          <div
            key={`${row}-${col}`}
            style={{
              position: 'absolute',
              left: `${position.x}px`,
              top: `${position.y}px`,
              zIndex: 1
            }}
          >
            <MazeCell
              row={row}
              col={col}
              isWall={maze[row][col] === 1}
              colorIndex={coloredMaze[row]?.[col]}
              colors={pathfindingColors}
              cellCheckers={cellCheckers}
              isAnimating={isAnimating}
            />
          </div>
        );
      }
    }
    
    return cells;
  }, [
    maze, 
    coloredMaze, 
    visibleBounds, 
    getCellPosition, 
    cellCheckers, 
    pathfindingColors, 
    isAnimating
  ]);

  // Render visible region borders (keeping original fine-tuned logic)
  const visibleRegionBorders = useMemo(() => {
    if (!state.showAbstractPath) return [];
    
    const REGION_SIZE = 8;
    const { abstractPath } = state;
    const regions = getVisibleRegions;
    
    return regions.map(({ regionRow, regionCol, x, y }) => {
      const regionId = `${regionRow},${regionCol}`;
      
      // Keep original logic for path detection and styling
      const isInPath = state.showAbstractPath && abstractPath.some(componentNodeId => 
        componentNodeId.startsWith(regionId + '_')
      );
      const borderColor = isInPath ? '#10B981' : '#4a5568';
      const borderWidth = isInPath ? '3px' : '1px';
      
      // Only overlap for green borders (original logic)
      const overlap = isInPath ? 1 : 0;
      
      return (
        <div
          key={`border-${regionRow}-${regionCol}`}
          style={{
            position: 'absolute',
            left: `${x - overlap}px`,
            top: `${y - overlap}px`,
            width: `${REGION_SIZE * CELL_SIZE + overlap * 2}px`,
            height: `${REGION_SIZE * CELL_SIZE + overlap * 2}px`,
            border: `${borderWidth} dotted ${borderColor}`,
            pointerEvents: 'none',
            zIndex: 10
          }}
        />
      );
    });
  }, [getVisibleRegions, state.showAbstractPath, state.abstractPath, CELL_SIZE]);

  return (
    <div
      style={{
        position: 'relative',
        width: `${VIEWPORT_SIZE}px`,
        height: `${VIEWPORT_SIZE}px`,
        overflow: 'hidden',
        background: '#e2e8f0' // Maze background color
      }}
    >
      {/* Virtual maze cells */}
      {visibleCells}
      
      {/* Virtual region borders */}
      {visibleRegionBorders}
      
    </div>
  );
};

export default VirtualMazeGrid;