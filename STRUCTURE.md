# Project Structure

This document explains the structure and purpose of each file in the HAA* pathfinding visualization project.

## Overview

This is a React-based educational pathfinding visualization that demonstrates Hierarchical A* (HAA*) algorithms. The application generates mazes, finds paths using component-based hierarchical pathfinding, and animates character movement along the discovered paths.

## Directory Structure

```
src/
├── algorithms/          # Core pathfinding and maze generation algorithms
├── components/          # React UI components  
├── hooks/              # Custom React hooks for state and logic
└── utils/              # Utility functions and data structures
```

>> tree src
src
├── App.css
├── App.tsx
├── algorithms
│   ├── component-based-pathfinding.js
│   ├── maze-generation.js
│   └── pathfinding.js
├── components
│   ├── MazeCell.js
│   ├── VirtualMazeGrid.js
│   └── maze-component-refactored.js
├── hooks
│   ├── useAnimationStateMachine.js
│   ├── useMazeState.js
│   ├── useMemoizedLookups.js
│   ├── usePathfinding.js
│   └── useViewport.js
├── index.css
├── index.tsx
├── logo.svg
├── react-app-env.d.ts
├── setupTests.ts
└── utils
    └── utilities.js

5 directories, 19 files
>> 

🔍 Found 12 .js, .jsx files (git-tracked)

📁 component-based-pathfinding.js
----------------------------------------
⚙️ def buildComponentGraph (22-155)
⚙️ def getComponentNodeId (160-170)
⚙️ def getRegionFromComponentNode (175-179)
⚙️ def componentHeuristic (184-188)
⚙️ def findAbstractComponentPath (194-237)
⚙️ def findPathWithinComponent (243-312)
⚙️ def findComponentBasedHAAStarPath (324-425)

📁 maze-generation.js
----------------------------------------
⚙️ def buildRegionGraph (5-89)
⚙️ def generateMaze (91-189)

📁 pathfinding.js
----------------------------------------
⚙️ def findAbstractPath (3-47)
⚙️ def findDetailedPath (49-134)
⚙️ def findHAAStarPath (136-259)
⚙️ def findConnectedComponents (261-296)
⚙️ def floodFill (266-282)

📁 MazeCell.js
----------------------------------------

📁 VirtualMazeGrid.js
----------------------------------------
⚙️ def VirtualMazeGrid (8-132)

📁 maze-component-refactored.js
----------------------------------------
⚙️ def MazeGeneratorRefactored (16-182)
⚙️ def MazeGeneratorRefactored (16-182)

📁 useAnimationStateMachine.js
----------------------------------------
⚙️ def useAnimationStateMachine (8-167)

📁 useMazeState.js
----------------------------------------
⚙️ def mazeReducer (78-200)
⚙️ def useMazeState (203-292)
⚙️ def useMazeState (203-292)

📁 useMemoizedLookups.js
----------------------------------------
⚙️ def useMemoizedLookups (7-156)

📁 usePathfinding.js
----------------------------------------
⚙️ def findEndFromRandomWalk (37-134)
⚙️ def getComponentNodeId (43-50)
⚙️ def getRandomCellFromComponent (53-60)
⚙️ def countComponentsInPath (63-73)
⚙️ def findGoodEndFromStart (136-169)
⚙️ def manhattanDistance (147-149)
⚙️ def findGoodEndPoints (171-249)
⚙️ def countComponentsInPath (177-187)
⚙️ def manhattanDistance (223-225)
⚙️ def usePathfinding (252-436)

📁 useViewport.js
----------------------------------------
⚙️ def useViewport (7-127)

📁 utilities.js
----------------------------------------
⚙️ def heuristicString (36-40)
⚙️ def heuristicObject (42-44)
⚙️ def getKey (46-48)
🏛️ class UnionFind (1-34)
  🔧 def find (11-16)
  🔧 def union (18-23)



## File Descriptions

### `src/algorithms/`

#### `component-based-pathfinding.js`
**Purpose:** Implements the core Hierarchical A* (HAA*) pathfinding algorithm using component-based abstraction.

**Key Features:**
- `buildComponentGraph()` - Creates abstract graph where nodes are components within regions
- `findComponentBasedHAAStarPath()` - Main HAA* implementation that:
  1. Finds abstract path through component graph
  2. Connects components via transitions
  3. Runs A* within each component for detailed path
- Component-to-component connectivity detection across region boundaries
- Proper hierarchical pathfinding with real floodfill-based components

**Exports:** Core HAA* functions and component graph utilities

#### `maze-generation.js` 
**Purpose:** Generates mazes using Kruskal's minimum spanning tree algorithm and builds the component graph.

**Key Features:**
- `generateMaze()` - Creates maze using randomized Kruskal's algorithm
- Maze generation with guaranteed connectivity
- Connected component analysis within 8x8 regions
- Component coloring and graph construction for HAA*
- Integration with component-based pathfinding system

**Exports:** `generateMaze()` and `buildRegionGraph()`

#### `pathfinding.js`
**Purpose:** Traditional A* pathfinding implementations and connected component analysis.

**Key Features:**
- `findHAAStarPath()` - Region-based hierarchical A* (legacy approach)
- `findDetailedPath()` - Standard A* with region constraints
- `findConnectedComponents()` - Flood-fill algorithm for component detection
- Path validation and connectivity checking
- Abstract and detailed pathfinding separation

**Exports:** Traditional pathfinding functions and component analysis

### `src/components/`

#### `MazeCell.js`
**Purpose:** Highly optimized, memoized cell component that prevents unnecessary re-renders.

**Key Features:**
- Memoized with `React.memo()` to prevent re-renders
- O(1) cell state checking using lookup functions
- Pre-computed styles to avoid object creation
- Visual markers for start, end, character, and path
- Supports different cell states (wall, walkable, visited, character position)

**Props:** Position, wall status, color, cell checkers, animation state

#### `VirtualMazeGrid.js`
**Purpose:** Virtual grid component that only renders visible cells for performance with large mazes.

**Key Features:**
- Viewport culling - only renders cells within visible bounds
- Handles 256x256 maze efficiently by rendering ~800 visible cells instead of 65,536
- Region border visualization for abstract path display
- Absolute positioning system for smooth scrolling
- Integration with viewport system for character-centered camera

**Props:** State, cell checkers, colors, viewport data, region styles

#### `maze-component-refactored.js`
**Purpose:** Main application component that orchestrates the entire pathfinding demo.

**Key Features:**
- Integrates all custom hooks for clean separation of concerns
- Controls animation lifecycle and state transitions
- Provides UI controls for maze generation and settings
- Displays performance statistics and pathfinding information
- Handles user interactions and demo automation
- Character-centered viewport with performance statistics

**Dependencies:** All custom hooks and child components

### `src/hooks/`

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

#### `usePathfinding.js`
**Purpose:** Encapsulates all pathfinding logic including maze generation and path finding.

**Key Features:**
- `generateNewMaze()` - Full maze generation workflow
- `generateNewPathFromEnd()` - Continuous path generation for demo
- Component-aware random walk with rejection sampling
- Target component count constraints (15-20 components)
- Integration with component-based HAA* algorithm
- Fallback to Manhattan distance when needed

**Returns:** Pathfinding functions and configuration

#### `useViewport.js`
**Purpose:** Character-centered camera system with viewport culling for performance.

**Key Features:**
- Character-centered camera that follows the moving character
- Viewport culling calculations for visible cell bounds
- Optional throttling to reduce viewport recalculations
- Visible region calculations for border rendering
- Performance statistics and culling metrics

**Returns:** Viewport data, camera position, and visible bounds

### `src/utils/`

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

### Performance Optimizations
- **Viewport Culling:** Only renders ~800 visible cells instead of 65,536 total cells
- **O(1) Lookups:** Converts O(n) array operations to O(1) Set operations
- **Memoization:** Prevents unnecessary component re-renders
- **requestAnimationFrame:** Smooth 60fps animations

### State Management
- **Atomic Updates:** useReducer prevents race conditions
- **State Machine:** Clear phase transitions prevent invalid states
- **Separation of Concerns:** Each hook handles specific functionality

### Pathfinding Algorithm
- **Hierarchical:** Abstract planning on component graph + detailed planning within components
- **Component-Based:** Uses real connected components instead of naive region-based approach
- **Flexible:** Supports both random walk and Manhattan distance point selection

### Educational Features
- **Visual Feedback:** Shows abstract path (regions) and detailed path (cells)
- **Performance Stats:** Real-time culling and optimization metrics
- **Interactive Controls:** Speed adjustment, path toggling, maze regeneration