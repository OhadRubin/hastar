import React, { memo, useMemo } from 'react';

/**
 * Memoized MazeCell component that prevents unnecessary re-renders
 * Uses O(1) lookup functions instead of O(n) array operations
 */
const MazeCell = memo(({
  row,
  col,
  isWall,
  colorIndex,
  colors,
  cellCheckers,
  isAnimating,
  visitedCells
}) => {
  // Use O(1) lookups instead of O(n) array.some() operations
  const cellState = useMemo(() => {
    return {
      isStartPoint: cellCheckers.isStartPoint(row, col),
      isEndPoint: cellCheckers.isEndPoint(row, col),
      isCharacterPosition: cellCheckers.isCharacterPosition(row, col),
      isInDetailedPath: cellCheckers.isInDetailedPath(row, col),
      shouldShowXMarker: cellCheckers.shouldShowXMarker(row, col, isAnimating),
      shouldShowCharacter: cellCheckers.shouldShowCharacter(row, col)
    };
  }, [row, col, cellCheckers, isAnimating]);

  // Memoized style calculation - prevents object creation on every render
  const cellStyle = useMemo(() => {
    const cellKey = `${row},${col}`;
    const isVisited = visitedCells?.has(cellKey);
    
    // Default background: walls are dark, unvisited walkable cells are white, visited cells show colors
    let backgroundColor = isWall ? '#2d3748' : (isVisited && colorIndex >= 0 ? colors[colorIndex] : '#ffffff');
    
    // Priority order: Character > Start > End > Default
    if (cellState.isCharacterPosition) {
      backgroundColor = '#3B82F6'; // Blue for character
    } else if (cellState.isStartPoint) {
      backgroundColor = '#10B981'; // Green for start
    } else if (cellState.isEndPoint) {
      backgroundColor = '#EF4444'; // Red for end
    }

    return {
      width: '10px',
      height: '10px',
      backgroundColor,
      boxSizing: 'border-box',
      border: '1px solid #cbd5e0',
      cursor: 'default',
      opacity: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    };
  }, [isWall, colorIndex, colors, cellState, row, col, visitedCells]);

  // Memoized marker styles
  const markerStyle = useMemo(() => ({
    color: cellState.shouldShowCharacter ? '#fff' : '#000',
    fontWeight: 'bold', 
    fontSize: '8px',
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  }), [cellState.shouldShowCharacter]);

  return (
    <div style={cellStyle}>
      {cellState.shouldShowCharacter && (
        <span style={markerStyle}>●</span>
      )}
      {cellState.shouldShowXMarker && (
        <span style={markerStyle}>X</span>
      )}
    </div>
  );
});

// Display name for debugging
MazeCell.displayName = 'MazeCell';

export default MazeCell;