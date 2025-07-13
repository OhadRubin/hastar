/**
 * Unified Algorithm Interface
 * 
 * This defines the standard interface that all algorithms must implement,
 * whether they are pathfinding, exploration, or maze generation algorithms.
 */

/**
 * Creates a standardized algorithm object
 * @param {Object} config - Algorithm configuration
 * @param {string} config.name - Human-readable algorithm name
 * @param {string} config.type - Algorithm type: 'pathfinding' | 'exploration' | 'maze-generation'
 * @param {string} config.description - Algorithm description
 * @param {Object} config.parameters - Algorithm parameters with min/max/default values
 * @param {Function} config.execute - Main execution function
 * @param {Function} config.createInitialState - State initialization function
 * @returns {Object} Standardized algorithm object
 */
export const createAlgorithm = (config) => {
  if (!config.name || !config.type || !config.execute) {
    throw new Error('Algorithm must have name, type, and execute function');
  }

  return {
    name: config.name,
    type: config.type,
    description: config.description || '',
    parameters: config.parameters || {},
    
    /**
     * Main algorithm execution function
     * @param {*} input - Algorithm-specific input (maze, start/end points, etc.)
     * @param {Object} options - Algorithm options and parameters
     * @param {Function} onProgress - Progress callback for visualization
     * @returns {Promise<Object>} Result object with { result, metrics, finalState }
     */
    async execute(input, options = {}, onProgress = null) {
      return config.execute(input, options, onProgress);
    },
    
    /**
     * Create initial algorithm state
     * @param {*} input - Algorithm-specific input
     * @param {Object} options - Algorithm options
     * @returns {Object} Initial state object
     */
    createInitialState(input, options = {}) {
      if (config.createInitialState) {
        return config.createInitialState(input, options);
      }
      return {};
    },
    
    /**
     * Validate algorithm parameters
     * @param {Object} params - Parameters to validate
     * @returns {Object} Validated parameters with defaults applied
     */
    validateParameters(params = {}) {
      const validated = {};
      
      for (const [key, spec] of Object.entries(this.parameters)) {
        const value = params[key];
        
        if (value === undefined) {
          validated[key] = spec.default;
        } else if (spec.min !== undefined && value < spec.min) {
          validated[key] = spec.min;
        } else if (spec.max !== undefined && value > spec.max) {
          validated[key] = spec.max;
        } else if (spec.options && !spec.options.includes(value)) {
          validated[key] = spec.default;
        } else {
          validated[key] = value;
        }
      }
      
      return validated;
    }
  };
};

/**
 * Standard algorithm result format
 */
export const createAlgorithmResult = (result, metrics = {}, finalState = null) => ({
  result,
  metrics: {
    executionTime: 0,
    ...metrics
  },
  finalState
});

/**
 * Algorithm parameter specification types
 */
export const ParameterTypes = {
  NUMBER: 'number',
  STRING: 'string', 
  BOOLEAN: 'boolean',
  SELECT: 'select'
};

/**
 * Helper to create number parameter spec
 */
export const numberParam = (min, max, defaultValue, step = 1) => ({
  type: ParameterTypes.NUMBER,
  min,
  max,
  default: defaultValue,
  step
});

/**
 * Helper to create select parameter spec  
 */
export const selectParam = (options, defaultValue) => ({
  type: ParameterTypes.SELECT,
  options,
  default: defaultValue
});

/**
 * Helper to create boolean parameter spec
 */
export const booleanParam = (defaultValue) => ({
  type: ParameterTypes.BOOLEAN,
  default: defaultValue
});