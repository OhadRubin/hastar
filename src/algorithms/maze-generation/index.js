/**
 * Maze Generation Algorithms Registry
 * 
 * Registry of all available maze generation algorithms.
 */

import { frontierMazeAlgorithm, kruskalMazeAlgorithm } from './algorithms.js';

/**
 * Registry of maze generation algorithms
 */
export const mazeGenerationAlgorithms = {
  'frontier': frontierMazeAlgorithm,
  'kruskal': kruskalMazeAlgorithm
};

/**
 * Get a maze generation algorithm by name
 * @param {string} name - Algorithm name
 * @returns {Object|null} Algorithm object or null if not found
 */
export const getMazeGenerationAlgorithm = (name) => {
  return mazeGenerationAlgorithms[name] || null;
};

/**
 * Get all maze generation algorithm names
 * @returns {string[]} Array of algorithm names
 */
export const getMazeGenerationAlgorithmNames = () => {
  return Object.keys(mazeGenerationAlgorithms);
};

/**
 * Get maze generation algorithm metadata
 * @returns {Array} Array of algorithm metadata objects
 */
export const getMazeGenerationAlgorithmMetadata = () => {
  return Object.entries(mazeGenerationAlgorithms).map(([name, algorithm]) => ({
    name,
    displayName: algorithm.name,
    description: algorithm.description,
    parameters: algorithm.parameters
  }));
};