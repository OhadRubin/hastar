/**
 * Pathfinding Algorithms Registry
 * 
 * Registry of all available pathfinding algorithms.
 */

import componentBasedHAAStarAlgorithm from './component-based-haa-star.js';
import traditionalAStarAlgorithm from './traditional-a-star.js';

/**
 * Registry of pathfinding algorithms
 */
export const pathfindingAlgorithms = {
  'component-haa-star': componentBasedHAAStarAlgorithm,
  'traditional-a-star': traditionalAStarAlgorithm
};

/**
 * Get a pathfinding algorithm by name
 * @param {string} name - Algorithm name
 * @returns {Object|null} Algorithm object or null if not found
 */
export const getPathfindingAlgorithm = (name) => {
  return pathfindingAlgorithms[name] || null;
};

/**
 * Get all pathfinding algorithm names
 * @returns {string[]} Array of algorithm names
 */
export const getPathfindingAlgorithmNames = () => {
  return Object.keys(pathfindingAlgorithms);
};

/**
 * Get pathfinding algorithm metadata
 * @returns {Array} Array of algorithm metadata objects
 */
export const getPathfindingAlgorithmMetadata = () => {
  return Object.entries(pathfindingAlgorithms).map(([name, algorithm]) => ({
    name,
    displayName: algorithm.name,
    description: algorithm.description,
    parameters: algorithm.parameters
  }));
};