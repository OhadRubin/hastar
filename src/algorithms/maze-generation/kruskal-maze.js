/**
 * Kruskal Maze Generation Algorithm
 * 
 * Creates traditional mazes using Kruskal's minimum spanning tree algorithm
 */

import { createAlgorithm, createAlgorithmResult } from '../algorithm-interface.js';
import { UnionFind } from '../../utils/utilities.js';
import { executeAlgorithm } from './shared-utils.js';
import { DEFAULT_REGION_SIZE, DEFAULT_MAZE_SIZE } from '../../core/constants.js';

/**
 * Kruskal's algorithm maze generation
 * Creates more traditional maze-like structures
 */
export const generateKruskalMaze = (SIZE) => {
  // Initialize maze with all walls
  const newMaze = Array(SIZE).fill(null).map(() => Array(SIZE).fill(1));
    
  // Create a grid of potential path cells (odd coordinates)
  const pathCells = [];
  for (let row = 1; row < SIZE; row += 2) {
    for (let col = 1; col < SIZE; col += 2) {
      pathCells.push({ row, col, id: pathCells.length });
      newMaze[row][col] = 0; // Set these cells as air
    }
  }

  // Create edges between adjacent path cells
  const edges = [];
  for (let i = 0; i < pathCells.length; i++) {
    const cell = pathCells[i];
    
    // Check right neighbor
    if (cell.col + 2 < SIZE) {
      const neighbor = pathCells.find(c => c.row === cell.row && c.col === cell.col + 2);
      if (neighbor) {
        edges.push({
          from: i,
          to: neighbor.id,
          weight: Math.random(),
          wallRow: cell.row,
          wallCol: cell.col + 1
        });
      }
    }
    
    // Check bottom neighbor
    if (cell.row + 2 < SIZE) {
      const neighbor = pathCells.find(c => c.row === cell.row + 2 && c.col === cell.col);
      if (neighbor) {
        edges.push({
          from: i,
          to: neighbor.id,
          weight: Math.random(),
          wallRow: cell.row + 1,
          wallCol: cell.col
        });
      }
    }
  }

  // Sort edges by random weight
  edges.sort((a, b) => a.weight - b.weight);

  // Use Kruskal's algorithm to build MST
  const uf = new UnionFind(pathCells.length);
  
  for (const edge of edges) {
    if (uf.union(edge.from, edge.to)) {
      // Remove the wall between cells
      newMaze[edge.wallRow][edge.wallCol] = 0;
    }
  }

  // Add entrance and exit
  newMaze[0][1] = 0; // Top entrance
  newMaze[SIZE - 1][SIZE - 2] = 0; // Bottom exit

  return newMaze;
};

/**
 * Kruskal Maze Generation Algorithm
 */
export const kruskalMazeAlgorithm = createAlgorithm({
  name: 'Kruskal Maze Generation',
  type: 'maze-generation', 
  description: 'Generates traditional mazes using Kruskal\'s minimum spanning tree algorithm',
  parameters: {},
  
  async execute(input, options, onProgress) {
    const { SIZE = DEFAULT_MAZE_SIZE, REGION_SIZE = DEFAULT_REGION_SIZE } = input;
    const result = await executeAlgorithm(generateKruskalMaze, 'Kruskal', { SIZE, REGION_SIZE }, options, onProgress);
    return createAlgorithmResult(result.result, result.metrics);
  }
});

export default kruskalMazeAlgorithm;