/**
 * Maze utility functions
 * 
 * Common utilities for maze analysis and processing.
 */

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
    if (maze[mazeRow][mazeCol] === 1) return; // Wall
    
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