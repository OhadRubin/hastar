/**
 * Traditional A* Pathfinding Algorithm
 * 
 * Standard A* pathfinding without hierarchical abstractions.
 * Extracted from the original pathfinding.js file.
 */

import { createAlgorithm, createAlgorithmResult, numberParam } from '../algorithm-interface.js';
import { heuristicObject, getKey } from '../../utils/utilities.js';

/**
 * Standard A* pathfinding algorithm
 * @param {Object} start - Start position {row, col}
 * @param {Object} end - End position {row, col}
 * @param {Array} maze - 2D maze array (0 = walkable, 1 = wall)
 * @param {number} SIZE - Maze size
 * @param {number} heuristicWeight - Weight for heuristic function (default 1.0)
 * @returns {Array|null} Path array or null if no path found
 */
const findAStarPath = (start, end, maze, SIZE, heuristicWeight = 1.0) => {
  const startTime = performance.now();
  
  const openSet = [start];
  const cameFrom = {};
  const gScore = { [getKey(start)]: 0 };
  const fScore = { [getKey(start)]: heuristicObject(start, end) * heuristicWeight };
  
  let nodesExplored = 0;
  
  while (openSet.length > 0) {
    let current = openSet.reduce((min, node) => 
      fScore[getKey(node)] < fScore[getKey(min)] ? node : min
    );
    
    if (current.row === end.row && current.col === end.col) {
      const path = [];
      while (current) {
        path.unshift(current);
        current = cameFrom[getKey(current)];
      }
      
      // Validate path
      for (let i = 0; i < path.length; i++) {
        const cell = path[i];
        if (maze[cell.row][cell.col] === 1) {
          console.error('Wall in path at cell:', cell);
          return null;
        }
        
        // Check connectivity
        if (i > 0) {
          const prevCell = path[i - 1];
          const distance = Math.abs(cell.row - prevCell.row) + Math.abs(cell.col - prevCell.col);
          if (distance !== 1) {
            console.error('Disconnected path between cells:', prevCell, cell);
            return null;
          }
        }
      }
      
      const endTime = performance.now();
      return {
        path,
        nodesExplored,
        executionTime: endTime - startTime
      };
    }
    
    openSet.splice(openSet.findIndex(n => n.row === current.row && n.col === current.col), 1);
    nodesExplored++;
    
    const neighbors = [
      { row: current.row - 1, col: current.col },
      { row: current.row + 1, col: current.col },
      { row: current.row, col: current.col - 1 },
      { row: current.row, col: current.col + 1 }
    ];
    
    for (const neighbor of neighbors) {
      if (neighbor.row < 0 || neighbor.row >= SIZE || 
          neighbor.col < 0 || neighbor.col >= SIZE ||
          maze[neighbor.row][neighbor.col] === 1) {
        continue;
      }
      
      const tentativeGScore = gScore[getKey(current)] + 1;
      const neighborKey = getKey(neighbor);
      
      if (gScore[neighborKey] === undefined || tentativeGScore < gScore[neighborKey]) {
        cameFrom[neighborKey] = current;
        gScore[neighborKey] = tentativeGScore;
        fScore[neighborKey] = gScore[neighborKey] + (heuristicObject(neighbor, end) * heuristicWeight);
        
        if (!openSet.some(n => n.row === neighbor.row && n.col === neighbor.col)) {
          openSet.push(neighbor);
        }
      }
    }
  }
  
  const endTime = performance.now();
  return {
    path: null,
    nodesExplored,
    executionTime: endTime - startTime
  };
};

/**
 * Traditional A* Algorithm
 */
const traditionalAStarAlgorithm = createAlgorithm({
  name: 'Traditional A*',
  type: 'pathfinding',
  description: 'Standard A* pathfinding algorithm with Manhattan distance heuristic',
  parameters: {
    heuristicWeight: numberParam(0.5, 2.0, 1.0, 0.1)
  },
  
  async execute(input, options, onProgress) {
    const { maze, start, end, SIZE = 256 } = input;
    const { heuristicWeight = 1.0 } = options;
    
    const startTime = performance.now();
    
    // Progress callback for algorithm start
    if (onProgress) {
      onProgress({
        type: 'pathfinding_start',
        algorithm: 'Traditional A*',
        start,
        end
      });
    }
    
    // Execute A* pathfinding
    const result = findAStarPath(start, end, maze, SIZE, heuristicWeight);
    
    const endTime = performance.now();
    
    // Call progress callback with final result
    if (onProgress) {
      onProgress({
        type: 'pathfinding_complete',
        path: result.path,
        nodesExplored: result.nodesExplored,
        executionTime: result.executionTime
      });
    }
    
    return createAlgorithmResult(
      {
        path: result.path,
        success: result.path !== null
      },
      {
        executionTime: result.executionTime,
        pathLength: result.path ? result.path.length : 0,
        nodesExplored: result.nodesExplored,
        algorithm: 'Traditional A*'
      }
    );
  }
});

export default traditionalAStarAlgorithm;

// Export utility function for reuse
export { findAStarPath };