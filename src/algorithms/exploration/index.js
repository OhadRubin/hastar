/**
 * Exploration Algorithms Registry
 * 
 * Registry of all available exploration algorithms.
 * Initially contains placeholder algorithms - will be populated as they are implemented.
 */

// Import exploration algorithms
import componentBasedExplorationAlgorithm from './component-based-exploration.js';
// import traditionalFrontierAlgorithm from './traditional-frontier.js';

/**
 * Registry of exploration algorithms
 */
export const explorationAlgorithms = {
  'component-based-exploration': componentBasedExplorationAlgorithm,
  // 'traditional-frontier': traditionalFrontierAlgorithm
};

/**
 * Get an exploration algorithm by name
 * @param {string} name - Algorithm name
 * @returns {Object|null} Algorithm object or null if not found
 */
export const getExplorationAlgorithm = (name) => {
  return explorationAlgorithms[name] || null;
};

/**
 * Get all exploration algorithm names
 * @returns {string[]} Array of algorithm names
 */
export const getExplorationAlgorithmNames = () => {
  return Object.keys(explorationAlgorithms);
};

/**
 * Get exploration algorithm metadata
 * @returns {Array} Array of algorithm metadata objects
 */
export const getExplorationAlgorithmMetadata = () => {
  return Object.entries(explorationAlgorithms).map(([name, algorithm]) => ({
    name,
    displayName: algorithm.name,
    description: algorithm.description,
    parameters: algorithm.parameters
  }));
};