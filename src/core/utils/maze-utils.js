/**
 * Maze utility functions
 * 
 * Common utilities for maze analysis and processing.
 */
import { CELL_STATES } from '../../core/utils/map-utils.js';
/**
 * Find connected components within a region using flood fill
 * @param {Array} maze - 2D maze array
 * @param {number} startRow - Starting row of the region
 * @param {number} startCol - Starting column of the region  
 * @param {number} REGION_SIZE - Size of the region to analyze
 * @returns {Array} Array of components, each containing cell positions
 */
export const findConnectedComponents = (maze, startRow, startCol, REGION_SIZE) => {
  const components = [];
  const visited = Array(REGION_SIZE).fill(null).map(() => Array(REGION_SIZE).fill(false));
    
  const floodFill = (row, col, componentId) => {
    if (row < 0 || row >= REGION_SIZE || col < 0 || col >= REGION_SIZE) return;
    if (visited[row][col]) return;
    
    const mazeRow = startRow + row;
    const mazeCol = startCol + col;
    if (maze[mazeRow][mazeCol] === CELL_STATES.WALL || maze[mazeRow][mazeCol] === CELL_STATES.UNKNOWN) return; // Wall
    
    visited[row][col] = true;
    components[componentId].push({ row: mazeRow, col: mazeCol });
    
    // Check 8 neighbors (including diagonals)
    floodFill(row - 1, col, componentId);     // North
    floodFill(row + 1, col, componentId);     // South
    floodFill(row, col - 1, componentId);     // West
    floodFill(row, col + 1, componentId);     // East
    floodFill(row - 1, col - 1, componentId); // Northwest
    floodFill(row - 1, col + 1, componentId); // Northeast
    floodFill(row + 1, col - 1, componentId); // Southwest
    floodFill(row + 1, col + 1, componentId); // Southeast
  };
    
  let componentId = 0;
  for (let row = 0; row < REGION_SIZE; row++) {
    for (let col = 0; col < REGION_SIZE; col++) {
      if (!visited[row][col] && maze[startRow + row][startCol + col] === 0) {
        components[componentId] = [];
        floodFill(row, col, componentId);
        componentId++;
      }
    }
  }
    
  return components;
};

/**
 * Get all 8-directional neighbors for a given position
 * @param {number} row - Current row
 * @param {number} col - Current column  
 * @param {number} maxRow - Maximum row (exclusive)
 * @param {number} maxCol - Maximum column (exclusive)
 * @returns {Array} Array of valid neighbor positions {row, col}
 */
export const getNeighbors8 = (row, col, maxRow, maxCol) => {
  const neighbors = [];
  const directions = [
    [-1, -1], [-1, 0], [-1, 1],  // North row
    [ 0, -1],          [ 0, 1],  // Middle row (skip center)
    [ 1, -1], [ 1, 0], [ 1, 1]   // South row
  ];
  
  for (const [dr, dc] of directions) {
    const newRow = row + dr;
    const newCol = col + dc;
    if (newRow >= 0 && newRow < maxRow && newCol >= 0 && newCol < maxCol) {
      neighbors.push({ row: newRow, col: newCol });
    }
  }
  return neighbors;
};

/**
 * Get 4-directional (cardinal) neighbors for a given position
 * @param {number} row - Current row
 * @param {number} col - Current column
 * @param {number} maxRow - Maximum row (exclusive) 
 * @param {number} maxCol - Maximum column (exclusive)
 * @returns {Array} Array of valid neighbor positions {row, col}
 */
export const getNeighbors4 = (row, col, maxRow, maxCol) => {
  const neighbors = [];
  const directions = [
    [-1, 0], [1, 0], [0, -1], [0, 1]  // North, South, West, East
  ];
  
  for (const [dr, dc] of directions) {
    const newRow = row + dr;
    const newCol = col + dc;
    if (newRow >= 0 && newRow < maxRow && newCol >= 0 && newCol < maxCol) {
      neighbors.push({ row: newRow, col: newCol });
    }
  }
  return neighbors;
};

/**
 * Calculate movement cost between two adjacent positions
 * @param {Object} from - Starting position {row, col}
 * @param {Object} to - Target position {row, col}
 * @returns {number} Movement cost (1.0 for cardinal, √2 for diagonal)
 */
export const getMovementCost = (from, to) => {
  const dx = Math.abs(to.col - from.col);
  const dy = Math.abs(to.row - from.row);
  
  // Diagonal movement costs √2 ≈ 1.414
  if (dx === 1 && dy === 1) return Math.SQRT2;
  // Cardinal movement costs 1
  if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) return 1;
  
  throw new Error('Invalid movement: positions not adjacent');
};