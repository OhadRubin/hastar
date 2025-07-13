/**
 * Main Algorithm Registry
 * 
 * Central registry for all algorithms in the application.
 * Provides a unified interface for discovering and accessing algorithms.
 */

// Import algorithm categories
import { pathfindingAlgorithms } from './pathfinding/index.js';
import { explorationAlgorithms } from './exploration/index.js';
import { mazeGenerationAlgorithms } from './maze-generation/index.js';

/**
 * Main algorithm registry organized by type
 */
export const algorithmRegistry = {
  pathfinding: pathfindingAlgorithms,
  exploration: explorationAlgorithms,
  'maze-generation': mazeGenerationAlgorithms
};

/**
 * Get an algorithm by type and name
 * @param {string} type - Algorithm type ('pathfinding', 'exploration', 'maze-generation')
 * @param {string} name - Algorithm name
 * @returns {Object|null} Algorithm object or null if not found
 */
export const getAlgorithm = (type, name) => {
  return algorithmRegistry[type]?.[name] || null;
};

/**
 * Get all algorithms of a specific type
 * @param {string} type - Algorithm type
 * @returns {Object} Object mapping algorithm names to algorithm objects
 */
export const getAlgorithmsByType = (type) => {
  return algorithmRegistry[type] || {};
};

/**
 * Get all available algorithm types
 * @returns {string[]} Array of algorithm type names
 */
export const getAlgorithmTypes = () => {
  return Object.keys(algorithmRegistry);
};

/**
 * Get metadata for all algorithms
 * @returns {Object} Object mapping types to arrays of algorithm metadata
 */
export const getAlgorithmMetadata = () => {
  const metadata = {};
  
  for (const [type, algorithms] of Object.entries(algorithmRegistry)) {
    metadata[type] = Object.entries(algorithms).map(([name, algorithm]) => ({
      name,
      displayName: algorithm.name,
      description: algorithm.description,
      parameters: algorithm.parameters
    }));
  }
  
  return metadata;
};

/**
 * Search algorithms by name or description
 * @param {string} query - Search query
 * @returns {Array} Array of matching algorithms with their type and name
 */
export const searchAlgorithms = (query) => {
  const results = [];
  const lowerQuery = query.toLowerCase();
  
  for (const [type, algorithms] of Object.entries(algorithmRegistry)) {
    for (const [name, algorithm] of Object.entries(algorithms)) {
      if (
        algorithm.name.toLowerCase().includes(lowerQuery) ||
        algorithm.description.toLowerCase().includes(lowerQuery) ||
        name.toLowerCase().includes(lowerQuery)
      ) {
        results.push({
          type,
          name,
          algorithm
        });
      }
    }
  }
  
  return results;
};

// Re-export the algorithm interface
export { createAlgorithm, createAlgorithmResult, ParameterTypes, numberParam, selectParam, booleanParam } from './algorithm-interface.js';