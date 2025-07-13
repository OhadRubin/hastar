# Modular Architecture Design

## New Directory Structure

```
src/
├── algorithms/                 # Algorithm registry
│   ├── pathfinding/           # Pathfinding algorithms  
│   │   ├── component-based-haa-star.js (extracted from current)
│   │   ├── traditional-a-star.js (extracted from pathfinding.js)
│   │   └── index.js           # Algorithm registry
│   ├── exploration/           # NEW: Exploration algorithms
│   │   ├── component-based-exploration.js (🚀 Main innovation)
│   │   ├── traditional-frontier.js (from frontier_maze concepts)
│   │   └── index.js           # Algorithm registry
│   ├── maze-generation/       # Maze generation
│   │   ├── algorithms.js (extracted from maze-generation.js)
│   │   └── index.js
│   └── index.js               # Main algorithm registry
├── demos/                     # Demo applications
│   ├── pathfinding-demo/      # Current demo refactored
│   │   ├── PathfindingDemo.jsx (from maze-component-refactored.js)
│   │   ├── usePathfindingDemo.js (extracted logic)
│   │   └── index.js
│   ├── exploration-demo/      # 🎯 NEW: Exploration demo
│   │   ├── ExplorationDemo.jsx
│   │   ├── useExplorationDemo.js
│   │   └── index.js
│   └── index.js
├── core/                      # Shared core functionality  
│   ├── rendering/
│   │   ├── CanvasRenderer.js (refactored from CanvasMazeGrid)
│   │   ├── useViewport.js (moved from hooks)
│   │   └── index.js
│   ├── state-management/
│   │   ├── useAlgorithmState.js (generic version of useMazeState)
│   │   ├── useAnimationState.js (extracted from useAnimationStateMachine)
│   │   └── index.js
│   └── utils/
│       ├── performance.js
│       └── index.js
├── components/                # Shared UI components
│   ├── AlgorithmSelector.jsx (NEW)
│   ├── ControlPanel.jsx (extracted from demos)
│   └── index.js
├── hooks/                     # Keep current hooks for compatibility
└── App.jsx                    # Updated with demo switcher
```

## Algorithm Registry Pattern

### Unified Algorithm Interface
```javascript
export const createAlgorithm = (config) => ({
  name: string,
  type: 'pathfinding' | 'exploration' | 'maze-generation',
  description: string,
  parameters: AlgorithmParameters,
  
  async execute(input, options, onProgress) {
    // Returns: { result, metrics, finalState }
  },
  
  createInitialState(input, options) {
    // Returns algorithm-specific state
  }
});
```

### Algorithm Registry
```javascript
// algorithms/index.js
export const algorithmRegistry = {
  pathfinding: {
    'component-haa-star': componentHAAStarAlgorithm,
    'traditional-a-star': traditionalAStarAlgorithm
  },
  exploration: {
    'component-based-exploration': componentBasedExplorationAlgorithm,
    'traditional-frontier': traditionalFrontierAlgorithm
  },
  'maze-generation': {
    'kruskal': kruskalAlgorithm,
    'frontier': frontierAlgorithm
  }
};

export const getAlgorithm = (type, name) => algorithmRegistry[type]?.[name];
```

## Component-Based Exploration Algorithm

The main innovation - implementing the WFD+HPA* hybrid from EXPLORATION_PSEUDOCODE.md:

```javascript
// algorithms/exploration/component-based-exploration.js
export default createAlgorithm({
  name: 'Component-Based Exploration',
  type: 'exploration',
  description: 'Dynamic HPA* with online component updates',
  
  parameters: {
    sensorRange: { min: 5, max: 30, default: 15 },
    explorationThreshold: { min: 80, max: 100, default: 95 }
  },
  
  async execute(maze, startPos, options, onProgress) {
    // Implementation of EXPLORATION_PSEUDOCODE.md algorithm:
    // 1. SENSE → UPDATE → PLAN → NAVIGATE → MOVE cycle
    // 2. Online component updates with merge events
    // 3. Component-aware frontier selection
    // 4. HAA* pathfinding with dynamic component graph
  }
});
```

## Demo Architecture

### Pathfinding Demo (Refactored)
- Extract current maze-component-refactored.js into PathfindingDemo.jsx
- Move pathfinding-specific logic to usePathfindingDemo.js
- Use shared core components (CanvasRenderer, ControlPanel)

### Exploration Demo (New)
- ExplorationDemo.jsx for the UI
- useExplorationDemo.js for exploration-specific state management
- Integration with component-based exploration algorithm
- Real-time frontier visualization and component updates

## Migration Strategy

1. **Phase 1**: Create new directory structure
2. **Phase 2**: Extract and refactor existing algorithms
3. **Phase 3**: Create core shared components
4. **Phase 4**: Implement component-based exploration
5. **Phase 5**: Build demos and demo switcher
6. **Phase 6**: Testing and integration

## Benefits

- **Pluggable Algorithms**: Easy to add new pathfinding/exploration algorithms
- **Shared Infrastructure**: Reuse rendering, state management, and UI components
- **Clean Separation**: Demos focus on their specific use cases
- **Educational Value**: Clear comparison between approaches
- **Extensible**: Easy to add new algorithm types or demos

## Backward Compatibility

- Keep current hooks/ directory for compatibility during transition
- Existing maze-component-refactored.js continues working
- Gradual migration path for each component