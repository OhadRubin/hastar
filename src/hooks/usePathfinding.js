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
const TARGET_COMPONENT_COUNT_MIN = 15; // Minimum components for rejection sampling
const TARGET_COMPONENT_COUNT_MAX = 20; // Maximum components for rejection sampling

/**
 * Pathfinding logic hook that handles maze generation and pathfinding
 * Provides clean separation of concerns and eliminates race conditions
 */

/**
 * Performs a component-aware random walk with rejection sampling
 * Uses rejection sampling to ensure the path traverses TARGET_COMPONENT_COUNT_MIN to TARGET_COMPONENT_COUNT_MAX components
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
  
  // Helper function to count components in abstract path
  const countComponentsInPath = (startPos, endPos) => {
    try {
      const pathResult = findComponentBasedHAAStarPath(startPos, endPos, maze, componentGraph, coloredMaze, REGION_SIZE, SIZE);
      if (pathResult && pathResult.abstractPath) {
        return pathResult.abstractPath.length;
      }
    } catch (error) {
      console.warn('Error calculating component path length:', error);
    }
    return 0;
  };
  
  const startComponentNodeId = getComponentNodeId(start);
  if (!startComponentNodeId || !componentGraph[startComponentNodeId]) {
    console.warn('Start position not in valid component for random walk');
    return null;
  }
  
  // Rejection sampling: try until we get a path with 7-10 components
  const maxAttempts = 50;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Perform component-level random walk
    let currentComponentNodeId = startComponentNodeId;
    
    for (let step = 0; step < walkLength; step++) {
      const currentComponent = componentGraph[currentComponentNodeId];
      const neighbors = currentComponent.neighbors;
      
      if (neighbors.length === 0) {
        break;
      }
      
      const randomIndex = Math.floor(Math.random() * neighbors.length);
      currentComponentNodeId = neighbors[randomIndex];
    }
    
    // Get a random cell from the final component
    const endCell = getRandomCellFromComponent(currentComponentNodeId);
    if (!endCell) continue;
    
    // Count components in the actual path
    const componentCount = countComponentsInPath(start, endCell);
    
    if (componentCount >= TARGET_COMPONENT_COUNT_MIN && componentCount <= TARGET_COMPONENT_COUNT_MAX) {
      const distance = Math.abs(endCell.row - start.row) + Math.abs(endCell.col - start.col);
      console.log(`Rejection sampling found path with ${componentCount} components (distance: ${distance}) after ${attempt + 1} attempts`);
      return endCell;
    }
  }
  
  console.warn(`Rejection sampling failed after ${maxAttempts} attempts, falling back to simple random walk`);
  
  // Fallback: simple random walk without rejection sampling
  let currentComponentNodeId = startComponentNodeId;
  for (let step = 0; step < walkLength; step++) {
    const currentComponent = componentGraph[currentComponentNodeId];
    const neighbors = currentComponent.neighbors;
    
    if (neighbors.length === 0) break;
    
    const randomIndex = Math.floor(Math.random() * neighbors.length);
    currentComponentNodeId = neighbors[randomIndex];
  }
  
  const endCell = getRandomCellFromComponent(currentComponentNodeId);
  if (endCell) {
    const distance = Math.abs(endCell.row - start.row) + Math.abs(endCell.col - start.col);
    console.log(`Fallback random walk ended at distance: ${distance} from start`);
  }
  
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
  if (USE_RANDOM_WALK && maze && componentGraph && coloredMaze) {
    // Use component-aware rejection sampling approach
    const maxAttempts = 100;
    
    // Helper function to count components in abstract path
    const countComponentsInPath = (startPos, endPos) => {
      try {
        const pathResult = findComponentBasedHAAStarPath(startPos, endPos, maze, componentGraph, coloredMaze, REGION_SIZE, SIZE);
        if (pathResult && pathResult.abstractPath) {
          return pathResult.abstractPath.length;
        }
      } catch (error) {
        console.warn('Error calculating component path length:', error);
      }
      return 0;
    };
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const startIndex = Math.floor(Math.random() * validCells.length);
      const start = validCells[startIndex];
      const end = findGoodEndFromStart(start, validCells, true, maze, componentGraph, coloredMaze, RANDOM_WALK_LENGTH);
      
      if (end) {
        const componentCount = countComponentsInPath(start, end);
        
        if (componentCount >= TARGET_COMPONENT_COUNT_MIN && componentCount <= TARGET_COMPONENT_COUNT_MAX) {
          const distance = Math.abs(end.row - start.row) + Math.abs(end.col - start.col);
          console.log(`findGoodEndPoints: Found start/end pair with ${componentCount} components (distance: ${distance}) after ${attempt + 1} attempts`);
          return { start, end };
        }
      }
    }
    
    console.warn(`findGoodEndPoints: Rejection sampling failed after ${maxAttempts} attempts, falling back to first valid pair`);
    
    // Fallback: return first valid pair without component constraints
    for (let attempt = 0; attempt < 50; attempt++) {
      const startIndex = Math.floor(Math.random() * validCells.length);
      const start = validCells[startIndex];
      const end = findGoodEndFromStart(start, validCells, true, maze, componentGraph, coloredMaze, RANDOM_WALK_LENGTH);
      
      if (end) {
        return { start, end };
      }
    }
  } else {
    // Fall back to original Manhattan distance approach
    const maxDistance = 30;
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
      const end = findGoodEndFromStart(start, validCells, false, maze, componentGraph, coloredMaze, RANDOM_WALK_LENGTH);
      
      if (end) {
        const distance = manhattanDistance(start, end);
        if (distance >= minDistance && distance <= maxDistance) {
          console.log(`Manhattan distance approach: Selected points with distance: ${distance}`);
          return { start, end };
        }
      }
      
      attempts++;
    }
  }

  return { start: null, end: null };
}


export const usePathfinding = (state, actions) => {

  // Randomly select two valid points with minimum distance
  const selectRandomPoints = useCallback((maze, componentGraph = null, coloredMaze = null) => {
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
    return findGoodEndPoints(validCells, maze, componentGraph, coloredMaze);
    

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
      const { start: randomStart, end: randomEnd } = selectRandomPoints(result.maze, result.componentGraph, result.coloredMaze);
      
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