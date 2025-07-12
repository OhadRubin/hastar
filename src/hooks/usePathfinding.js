import { useCallback, useMemo } from 'react';
import { generateMaze } from '../algorithms/maze-generation.js';
import { findComponentBasedHAAStarPath } from '../algorithms/component-based-pathfinding.js';

// Move constants outside hook to prevent recreation
const SIZE = 256;
const REGION_SIZE = 8;
const PATHFINDING_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
  '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8C471', '#82E0AA',
  '#F06292', '#AED6F1', '#F9E79F', '#D7BDE2', '#A9DFBF',
  '#FAD7A0', '#E8DAEF', '#D6EAF8', '#FADBD8', '#D5F4E6'
];

/**
 * Pathfinding logic hook that handles maze generation and pathfinding
 * Provides clean separation of concerns and eliminates race conditions
 */
export const findGoodEndFromStart = (start, validCells) => {
  // Calculate minimum required distance (hardcoded to 64 for taxidriver preference)
  const maxDistance = 30;
  const minDistance = 20;
  
  // Calculate Manhattan distance between two points
  const manhattanDistance = (p1, p2) => {
    return Math.abs(p1.row - p2.row) + Math.abs(p1.col - p2.col);
  };
  
  // Try to find an end point with sufficient distance from the given start
  let attempts = 0;
  const maxAttempts = 1000; // Prevent infinite loop
  
  while (attempts < maxAttempts) {
    const endIndex = Math.floor(Math.random() * validCells.length);
    const end = validCells[endIndex];
    const distance = manhattanDistance(start, end);
    
    if (distance >= minDistance && distance <= maxDistance) {
      console.log(`Selected end point with Manhattan distance: ${distance} (min required: ${minDistance})`);
      return end;
    }
    
    attempts++;
  }

  return null;
}

export const findGoodEndPoints = (validCells) => {
  // Calculate minimum required distance (hardcoded to 64 for taxidriver preference)
  const maxDistance = 30; // From (0,0) to (SIZE-1,SIZE-1)
  const minDistance = 20;
  
  // Calculate Manhattan distance between two points
  const manhattanDistance = (p1, p2) => {
    return Math.abs(p1.row - p2.row) + Math.abs(p1.col - p2.col);
  };
  
  // Try to find two points with sufficient distance
  let attempts = 0;
  const maxAttempts = 1000; // Prevent infinite loop
  
  while (attempts < maxAttempts) {
    const startIndex = Math.floor(Math.random() * validCells.length);
    const start = validCells[startIndex];
    const end = findGoodEndFromStart(start, validCells);
    
    if (end) {
      const distance = manhattanDistance(start, end);
      // console.log(`Selected points with Manhattan distance: ${distance} (min required: ${minDistance})`);
      return { start, end };
    }
    
    attempts++;
  }

  return { start: null, end: null };
}


export const usePathfinding = (state, actions) => {

  // Randomly select two valid points with minimum distance
  const selectRandomPoints = useCallback((maze) => {
    const validCells = [];
    
    // Find all non-wall cells
    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        if (maze[row][col] === 0) { // Not a wall
          validCells.push({ row, col });
        }
      }
    }
    
    if (validCells.length < 2) {
      console.warn('Not enough valid cells for start/end points');
      return { start: null, end: null };
    }
    return findGoodEndPoints(validCells);
    

  }, []);

  // Find path using component-based HAA*
  const findPath = useCallback((start, end, maze, componentGraph, coloredMaze) => {
    if (!start || !end || !maze || !componentGraph) {
      return { abstractPath: [], detailedPath: [] };
    }

    try {
      const pathResult = findComponentBasedHAAStarPath(
        start, 
        end, 
        maze, 
        componentGraph, 
        coloredMaze, 
        REGION_SIZE, 
        SIZE
      );
      
      if (pathResult.abstractPath && pathResult.detailedPath) {
        console.log(`🎉 Component-based HAA* found path: ${pathResult.abstractPath.length} components, ${pathResult.detailedPath.length} cells`);
        return pathResult;
      } else {
        console.warn('Component-based HAA* failed to find path:', pathResult);
        return { abstractPath: [], detailedPath: [] };
      }
    } catch (error) {
      console.error('Error finding path:', error);
      return { abstractPath: [], detailedPath: [] };
    }
  }, []);

  // Generate new maze and find initial path
  const generateNewMaze = useCallback(() => {
    actions.startGeneration();
    
    try {
      // Generate maze
      const result = generateMaze(SIZE, REGION_SIZE, PATHFINDING_COLORS);
      
      // Select random points
      const { start: randomStart, end: randomEnd } = selectRandomPoints(result.maze);
      
      if (randomStart && randomEnd && result.componentGraph) {
        // Set maze data atomically
        actions.setMazeData({
          maze: result.maze,
          coloredMaze: result.coloredMaze,
          componentGraph: result.componentGraph,
          totalComponents: result.totalComponents,
          start: randomStart,
          end: randomEnd
        });
        
        // Find initial path
        const pathResult = findPath(
          randomStart, 
          randomEnd, 
          result.maze, 
          result.componentGraph, 
          result.coloredMaze
        );
        
        // Set path data atomically
        actions.setPathData({
          abstractPath: pathResult.abstractPath,
          detailedPath: pathResult.detailedPath,
          start: randomStart // Set initial character position
        });
      } else {
        // No valid points found
        actions.setMazeData({
          maze: result.maze,
          coloredMaze: result.coloredMaze,
          componentGraph: result.componentGraph,
          totalComponents: result.totalComponents,
          start: null,
          end: null
        });
        
        actions.clearPaths();
      }
    } catch (error) {
      console.error('Error generating maze:', error);
      actions.resetToIdle();
    }
  }, [actions, selectRandomPoints, findPath]);

  // Generate new path from current end to random point (for countdown logic)
  const generateNewPathFromEnd = useCallback(() => {
    const { maze, componentGraph, coloredMaze, detailedPath } = state;
    
    if (!maze.length || !componentGraph || !detailedPath.length) {
      console.warn('Cannot generate new path: missing maze data');
      return;
    }

    try {
      // Use the last position from the current path as the new start
      const currentEnd = detailedPath[detailedPath.length - 1];
      if (!currentEnd) {
        console.warn('Cannot generate new path: no current end position');
        return;
      }

      // Find all valid cells except the current end
      const validCells = [];
      for (let row = 0; row < SIZE; row++) {
        for (let col = 0; col < SIZE; col++) {
          if (maze[row][col] === 0 && !(row === currentEnd.row && col === currentEnd.col)) {
            validCells.push({ row, col });
          }
        }
      }
      
      if (validCells.length === 0) {
        console.warn('No valid cells for new end point');
        return;
      }

      // Select random end point
      // const randomEnd = validCells[Math.floor(Math.random() * validCells.length)];
      const randomEnd = findGoodEndFromStart(currentEnd, validCells);
      
      // Find new path
      const pathResult = findPath(
        currentEnd, 
        randomEnd, 
        maze, 
        componentGraph, 
        coloredMaze
      );
      
      // Update state atomically
      actions.setMazeData({
        maze,
        coloredMaze,
        componentGraph,
        totalComponents: state.totalComponents,
        start: currentEnd,
        end: randomEnd
      });
      
      actions.setPathData({
        abstractPath: pathResult.abstractPath,
        detailedPath: pathResult.detailedPath,
        start: currentEnd
      });
      
    } catch (error) {
      console.error('Error generating new path from end:', error);
    }
  }, [state.maze, state.componentGraph, state.coloredMaze, state.detailedPath, actions, findPath]);

  // Memoize return object to prevent infinite re-renders
  return useMemo(() => ({
    generateNewMaze,
    generateNewPathFromEnd,
    findPath,
    selectRandomPoints,
    colors: PATHFINDING_COLORS
  }), [generateNewMaze, generateNewPathFromEnd, findPath, selectRandomPoints]);
};