# Project Structure

This document explains the structure and purpose of each file in the HAA* pathfinding visualization project after the modular architecture refactoring.

## Overview

This is a React-based educational pathfinding visualization with a **modular algorithm registry system**. The application demonstrates Hierarchical A* (HAA*) algorithms using pluggable algorithm components, shared core infrastructure, and clean separation of concerns between demos, algorithms, and utilities.

## Directory Structure

```
src/
├── algorithms/          # Modular algorithm registry system
├── core/               # Shared core components and utilities  
├── demos/              # Demo applications
├── hooks/              # React hooks for state and animation
└── utils/              # Original utility functions
```

## Current File Tree

```
src/
├── App.css
├── App.tsx
├── algorithms/
│   ├── algorithm-interface.js       # Standard algorithm interface
│   ├── index.js                    # Main algorithm registry
│   ├── exploration/                # Exploration algorithms
│   │   ├── component-based-exploration.js
│   │   ├── component-structure.js
│   │   ├── frontier-detection.js
│   │   ├── pathfinding-utils.js
│   │   └── index.js
│   ├── maze-generation/            # Maze generation algorithms
│   │   ├── algorithms.js
│   │   └── index.js
│   └── pathfinding/                # Pathfinding algorithms
│       ├── component-based-haa-star.js
│       ├── traditional-a-star.js
│       └── index.js
├── core/                           # Shared core infrastructure
│   ├── index.js                    # Core exports
│   ├── rendering/                  # Rendering components
│   │   ├── CanvasRenderer.js
│   │   ├── useViewport.js
│   │   └── index.js
│   └── utils/                      # Core utilities
│       ├── maze-utils.js
│       ├── sensor-utils.js
│       ├── map-utils.js
│       └── index.js
├── demos/                          # Demo applications
│   └── pathfinding-demo/
│       ├── PathfindingDemo.jsx
│       ├── usePathfindingDemo.js
│       └── index.js
├── hooks/                          # React hooks
│   ├── useAnimationStateMachine.js
│   ├── useMazeState.js
│   └── useMemoizedLookups.js
├── index.css
├── index.tsx
├── logo.svg
├── react-app-env.d.ts
├── setupTests.ts
└── utils/                          # Original utilities
    └── utilities.js
```

**26 .js/.jsx files total**

## Algorithm Registry System

### Algorithm Function Signatures

```javascript
// Standard algorithm interface
export const createAlgorithm(config) => ({
  name: string,
  type: 'pathfinding' | 'exploration' | 'maze-generation',
  description: string,
  parameters: Object,
  async execute(input, options, onProgress),
  createInitialState(input, options)
});
```

## File Descriptions

### `src/algorithms/` - Modular Algorithm Registry

#### `algorithm-interface.js`
**Purpose:** Defines the standard interface that all algorithms must implement for consistency and pluggability.

**Key Features:**
- `createAlgorithm()` - Factory function that creates standardized algorithm objects
- Parameter validation with min/max/default values
- Unified execution interface with progress callbacks
- Algorithm result standardization

**Exports:** Algorithm interface, parameter helpers, result creators

#### `index.js` - Main Algorithm Registry
**Purpose:** Central registry for discovering and accessing all algorithms by type and name.

**Key Features:**
- `getAlgorithm(type, name)` - Retrieve specific algorithms
- `getAlgorithmsByType(type)` - Get all algorithms of a type
- `searchAlgorithms(query)` - Search functionality
- Algorithm metadata and introspection

**Exports:** Registry functions, algorithm discovery, metadata

#### `pathfinding/component-based-haa-star.js`
**Purpose:** Component-based Hierarchical A* pathfinding algorithm extracted from original implementation.

**Key Features:**
- `buildComponentGraph()` - Creates abstract graph where nodes are components within regions
- `findComponentBasedHAAStarPath()` - Main HAA* implementation:
  1. Finds abstract path through component graph
  2. Connects components via transitions  
  3. Runs A* within each component for detailed path
- Component-to-component connectivity detection across region boundaries
- Follows standard algorithm interface

**Exports:** HAA* algorithm, utility functions for component operations

#### `pathfinding/traditional-a-star.js`
**Purpose:** Standard A* pathfinding algorithm implementation following the algorithm interface.

**Key Features:**
- `findAStarPath()` - Grid-based A* with Manhattan distance heuristic
- Configurable heuristic weighting
- Path validation and connectivity checking
- Node exploration tracking for visualization

**Exports:** Traditional A* algorithm

#### `pathfinding/index.js`
**Purpose:** Registry for pathfinding algorithms.

**Exports:** Pathfinding algorithm registry and metadata

#### `maze-generation/algorithms.js`
**Purpose:** Maze generation algorithms supporting both Kruskal and Frontier approaches.

**Key Features:**
- `generateFrontierMaze()` - Creates mazes with larger rooms and corridors
- `generateKruskalMaze()` - Traditional maze using minimum spanning tree
- `analyzeComponents()` - Connected component analysis within regions
- Component coloring and graph construction for HAA*
- Follows standard algorithm interface

**Exports:** Maze generation algorithms with full component analysis

#### `maze-generation/index.js`
**Purpose:** Registry for maze generation algorithms.

**Exports:** Maze generation algorithm registry and metadata

#### `exploration/component-based-exploration.js`
**Purpose:** Main component-based exploration algorithm implementation using Dynamic HPA* for unknown environments.

**Key Features:**
- Novel "Dynamic HPA* for Unknown Environments" approach
- Online component graph evolution during exploration
- Component-aware frontier detection and selection
- HAA* pathfinding with dynamically discovered structure
- Sensor-based environment scanning with directional awareness
- Target persistence and intelligent frontier selection
- Follows standard algorithm interface

**Exports:** Component-based exploration algorithm

#### `exploration/component-structure.js`
**Purpose:** Online component structure management for exploration algorithms.

**Key Features:**
- `updateComponentStructure()` - Handles component growth, merging, and evolution
- Dynamic component graph rebuilding based on new sensor data
- Robust connection rebuilding to prevent missing connections
- Component-to-component connectivity detection across regions
- Handles component fragmentation and merging during exploration

**Exports:** Component structure update functions

#### `exploration/frontier-detection.js`
**Purpose:** Advanced frontier detection for exploration algorithms.

**Key Features:**
- `detectComponentAwareFrontiers()` - WFD-based frontier detection with component awareness
- `detectBasicFrontiers()` - Fallback frontier detection algorithm
- `selectOptimalFrontier()` - Intelligent frontier target selection
- Integration with research-grade WavefrontFrontierDetection
- Multiple frontier selection strategies (nearest, centroid, median)

**Exports:** Frontier detection and selection functions

#### `exploration/pathfinding-utils.js`
**Purpose:** Pathfinding utilities and debugging functions for exploration.

**Key Features:**
- `findComponentPath()` - Component-aware pathfinding wrapper for exploration
- `debugSimpleAStar()` - Simple A* for debugging and fallback pathfinding
- `checkSimplePathExists()` - BFS connectivity checking for debugging
- HAA* integration with fallback mechanisms
- Comprehensive pathfinding failure analysis and debugging

**Exports:** Exploration pathfinding utilities

#### `exploration/index.js`
**Purpose:** Registry for exploration algorithms.

**Exports:** Exploration algorithm registry and metadata

### `src/core/` - Shared Core Infrastructure

#### `rendering/CanvasRenderer.js`
**Purpose:** Generic canvas-based renderer supporting both pathfinding and exploration visualization modes.

**Key Features:**
- Viewport culling for performance with large mazes
- Dual render modes: 'pathfinding' and 'exploration'
- Configurable colors and cell checking functions
- Region borders and component visualization
- Optimized drawing with proper cell state handling

**Props:** State, cell checkers, colors, viewport, render mode

#### `rendering/useViewport.js`
**Purpose:** Character-centered camera system with viewport culling for performance.

**Key Features:**
- Character-centered camera with smooth interpolation
- Viewport culling calculations for visible cell bounds
- Visible region calculations for border rendering
- Performance statistics and culling metrics
- Camera smoothing with configurable factors

**Returns:** Viewport data, camera position, visible bounds, performance stats

#### `utils/maze-utils.js`
**Purpose:** Shared maze analysis utilities.

**Key Features:**
- `findConnectedComponents()` - Flood-fill algorithm for component detection within regions
- Reusable across maze generation and pathfinding algorithms

**Exports:** Connected component analysis functions

#### `utils/sensor-utils.js`
**Purpose:** Sensor utilities for exploration algorithms.

**Key Features:**
- `scanWithSensors()` - Advanced robot sensor scanning with DirectionalConeSensor
- Line-of-sight checking with sensor range limitations
- Directional sensor scanning with robot orientation
- Integration with SensorManager from core/sensors
- Reusable across exploration algorithms

**Exports:** Sensor scanning functions

#### `utils/map-utils.js`
**Purpose:** Map utilities and state constants for exploration.

**Key Features:**
- `updateKnownMap()` - Updates known map with sensor readings
- `CELL_STATES` - Cell state constants (UNKNOWN, WALL, WALKABLE)
- Shared map management utilities
- Reusable across exploration and pathfinding algorithms

**Exports:** Map update functions and cell state constants

#### `index.js`
**Purpose:** Central exports for all core infrastructure.

**Exports:** CanvasRenderer, useViewport, maze utilities

### `src/demos/` - Demo Applications

#### `pathfinding-demo/PathfindingDemo.jsx`
**Purpose:** Main pathfinding demo component using the new modular architecture.

**Key Features:**
- Uses modular algorithm registry system
- Integrates shared core rendering components
- Clean separation from algorithm implementation
- Identical functionality to original demo
- Algorithm selection and parameter controls

**Dependencies:** usePathfindingDemo, CanvasRenderer, core hooks

#### `pathfinding-demo/usePathfindingDemo.js`
**Purpose:** Hook containing pathfinding demo logic using the modular algorithm system.

**Key Features:**
- `generateNewMaze()` - Uses algorithm registry for maze generation
- `generateNewPathFromEnd()` - Continuous pathfinding with algorithm registry
- Algorithm discovery and execution
- State integration with maze and pathfinding algorithms
- Clean separation of demo logic from algorithm implementation

**Returns:** Demo state, algorithm controls, rendering data

#### `pathfinding-demo/index.js`
**Purpose:** Clean exports for the pathfinding demo.

**Exports:** PathfindingDemo component and hook

### `src/hooks/` - React Hooks

#### `useAnimationStateMachine.js`
**Purpose:** Manages animation state and timing using requestAnimationFrame for smooth 60fps animations.

**Key Features:**
- Eliminates stale closure issues with proper state machine design
- `requestAnimationFrame` for smooth character movement
- Countdown timer management between path generations
- Animation controls (start, stop, speed adjustment)
- Proper cleanup and cancellation of animations

**Returns:** Animation controls and state information

#### `useMazeState.js`
**Purpose:** Central state management using useReducer for atomic updates and race condition prevention.

**Key Features:**
- State machine with phases: IDLE, GENERATING, PATHFINDING, ANIMATING, COUNTDOWN
- Atomic state updates via reducer pattern
- Action creators for type safety
- Prevents race conditions through controlled state transitions
- Manages maze data, paths, character position, and settings

**Exports:** State, actions, and computed values

#### `useMemoizedLookups.js`
**Purpose:** Critical performance optimization that converts O(n) array operations to O(1) Set lookups.

**Key Features:**
- Converts detailed path array to Set for O(1) position checking
- Pre-computed special position lookups (start, end, character)
- Region-based abstract path checking
- Cell type checker functions that eliminate array.some() calls
- Performance monitoring and statistics

**Returns:** Optimized lookup functions and performance stats

### `src/utils/` - Original Utilities

#### `utilities.js`
**Purpose:** Core utility functions and data structures used throughout the application.

**Key Features:**
- `UnionFind` class - Disjoint set data structure for Kruskal's algorithm
- `heuristicString()` - Manhattan distance for string coordinates
- `heuristicObject()` - Manhattan distance for object coordinates  
- `getKey()` - Converts position objects to string keys
- Path compression optimization in UnionFind

**Exports:** UnionFind class and heuristic functions

## Architecture Highlights

### Modular Algorithm System
- **Pluggable Algorithms:** Easy to add new pathfinding, exploration, or maze generation algorithms
- **Standard Interface:** All algorithms follow the same execution pattern
- **Registry-Based Discovery:** Algorithms can be discovered and executed dynamically
- **Parameter Validation:** Consistent parameter handling across all algorithms

### Shared Core Infrastructure
- **CanvasRenderer:** Generic renderer supporting multiple visualization modes
- **useViewport:** Reusable viewport culling system
- **Algorithm Registry:** Central system for algorithm management
- **Clean Separation:** Demos, algorithms, and core components are completely separate

### Performance Optimizations
- **Viewport Culling:** Only renders ~800 visible cells instead of 65,536 total cells
- **O(1) Lookups:** Converts O(n) array operations to O(1) Set operations
- **Canvas Rendering:** Hardware-accelerated rendering instead of DOM elements
- **requestAnimationFrame:** Smooth 60fps animations

### State Management
- **Atomic Updates:** useReducer prevents race conditions
- **State Machine:** Clear phase transitions prevent invalid states
- **Separation of Concerns:** Each hook handles specific functionality
- **Algorithm-Agnostic State:** State management independent of algorithm choice

### Extensibility Features
- **Easy Algorithm Addition:** Simply implement the standard interface and register
- **Demo Independence:** New demos can reuse existing core infrastructure
- **Pluggable Components:** All major systems are replaceable
- **Future-Ready:** Architecture prepared for exploration algorithm implementation

## Component-Based Exploration Implementation Complete

The modular architecture has successfully been used to implement the component-based exploration algorithm from `EXPLORATION_PSEUDOCODE.md`:

1. **Algorithm Implementation:** `src/algorithms/exploration/` contains the complete modular implementation
2. **Core Infrastructure:** CanvasRenderer supports exploration render mode with sensor visualization
3. **Demo Framework:** Exploration demo runs alongside pathfinding demo using shared infrastructure
4. **Shared Components:** HAA* infrastructure successfully leveraged for exploration algorithms

The implementation demonstrates the power of the modular architecture - the novel WFD+HPA* hybrid exploration approach was cleanly integrated while maintaining all existing pathfinding functionality and following established patterns.

### Implementation Highlights

- **Modular Design:** 1000+ line algorithm split into 5 focused files following codebase patterns
- **Code Reuse:** Core utilities (sensor scanning, map management) available to future algorithms
- **Clean Architecture:** Algorithm-specific logic separated from shared infrastructure
- **Maintainability:** Each module has single responsibility with clear interfaces