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

// Configuration flag for random walk vs Manhattan distance approach
const USE_RANDOM_WALK = true; // Set to false to revert to Manhattan distance
const RANDOM_WALK_LENGTH = 50; // Number of steps for random walk

/**
 * Pathfinding logic hook that handles maze generation and pathfinding
 * Provides clean separation of concerns and eliminates race conditions
 */

/**
 * Performs a component-aware random walk from a start position to find an endpoint
 * Uses the hierarchical structure of the componentGraph for more realistic pathfinding complexity
 * @param {Object} start - Starting position {row, col}
 * @param {Array} validCells - Array of valid cells to constrain the walk
 * @param {Array} maze - 2D maze array (0 = walkable, 1 = wall)
 * @param {Object} componentGraph - Hierarchical component graph for navigation
 * @param {Array} coloredMaze - Component-colored maze for component lookup
 * @param {number} walkLength - Number of component hops to take in the random walk
 * @returns {Object|null} - End position {row, col} or null if walk fails
 */
export const findEndFromRandomWalk = (start, validCells, maze, componentGraph, coloredMaze, walkLength = 10) => {
  if (!start || !validCells || !maze || !componentGraph || !coloredMaze || validCells.length === 0) {
    return null;
  }
  
  // Helper function to get component node ID for a position
  const getComponentNodeId = (pos) => {
    const regionRow = Math.floor(pos.row / REGION_SIZE);
    const regionCol = Math.floor(pos.col / REGION_SIZE);
    const componentId = coloredMaze[pos.row][pos.col];
    
    if (componentId === -1) return null;
    return `${regionRow},${regionCol}_${componentId}`;
  };
  
  // Helper function to get a random cell from a component
  const getRandomCellFromComponent = (componentNodeId) => {
    const component = componentGraph[componentNodeId];
    if (!component || !component.cells || component.cells.length === 0) {
      return null;
    }
    const randomIndex = Math.floor(Math.random() * component.cells.length);
    return component.cells[randomIndex];
  };
  
  // Start the walk from the start component
  let currentComponentNodeId = getComponentNodeId(start);
  
  if (!currentComponentNodeId || !componentGraph[currentComponentNodeId]) {
    console.warn('Start position not in valid component for random walk');
    return null;
  }
  
  // Perform component-level random walk
  for (let step = 0; step < walkLength; step++) {
    const currentComponent = componentGraph[currentComponentNodeId];
    const neighbors = currentComponent.neighbors;
    
    if (neighbors.length === 0) {
      // No neighbors - stay in current component
      break;
    }
    
    // Pick a random neighboring component
    const randomIndex = Math.floor(Math.random() * neighbors.length);
    currentComponentNodeId = neighbors[randomIndex];
  }
  
  // Get a random cell from the final component
  const endCell = getRandomCellFromComponent(currentComponentNodeId);
  
  if (!endCell) {
    console.warn('Failed to get end cell from final component');
    return null;
  }
  
  // Calculate distance from start for logging
  const distance = Math.abs(endCell.row - start.row) + Math.abs(endCell.col - start.col);
  console.log(`Component random walk (${walkLength} hops) ended at distance: ${distance} from start`);
  
  return endCell;
};

export const findGoodEndFromStart = (start, validCells, useRandomWalk = false, maze = null, componentGraph = null, coloredMaze = null, walkLength = 10) => {
  if (useRandomWalk && maze && componentGraph && coloredMaze) {
    // Use component-aware random walk approach
    return findEndFromRandomWalk(start, validCells, maze, componentGraph, coloredMaze, walkLength);
  }
  
  // Fall back to original Manhattan distance approach
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

export const findGoodEndPoints = (validCells, maze = null, componentGraph = null, coloredMaze = null) => {
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
    const end = findGoodEndFromStart(start, validCells, USE_RANDOM_WALK && maze && componentGraph && coloredMaze, maze, componentGraph, coloredMaze, RANDOM_WALK_LENGTH);
    
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
      const randomEnd = findGoodEndFromStart(currentEnd, validCells, USE_RANDOM_WALK, maze, componentGraph, coloredMaze, RANDOM_WALK_LENGTH);
      
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