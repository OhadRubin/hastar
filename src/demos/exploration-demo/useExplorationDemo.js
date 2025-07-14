import { useCallback, useMemo, useState } from 'react';
import { useMazeState } from '../../hooks/useMazeState.js';
import { getAlgorithm } from '../../algorithms/index.js';
import { CELL_STATES } from '../../core/utils/map-utils.js';

/**
 * Hook for exploration demo logic using the component-based exploration algorithm
 */
export const useExplorationDemo = () => {
  const { state, actions } = useMazeState();
  
  // Exploration-specific state
  const [explorationState, setExplorationState] = useState({
    isExploring: false,
    robotPosition: null,
    robotDirection: 0,
    knownMap: null,
    frontiers: [],
    exploredPositions: [],
    coverage: 0,
    iteration: 0,
    explorationComplete: false,
    sensorPositions: [],
    sensorRange: 15,
    actualEnd: null,
    currentPath: [],
    prev_targets: []
  });

  // Get algorithms
  const mazeGenerationAlgorithm = getAlgorithm('maze-generation', state.mazeAlgorithm);
  const explorationAlgorithm = getAlgorithm('exploration', 'component-based-exploration');

  /**
   * Find random start position from walkable cells
   */
  const findRandomStart = useCallback((maze) => {
    const walkableCells = [];
    for (let row = 0; row < maze.length; row++) {
      for (let col = 0; col < maze[row].length; col++) {
        if (maze[row][col] === 0) {
          walkableCells.push({ row, col });
        }
      }
    }
    return walkableCells[Math.floor(Math.random() * walkableCells.length)];
  }, []);

  /**
   * Cell checkers for exploration rendering
   */
  const cellCheckers = useMemo(() => {
    const { robotPosition, frontiers, knownMap } = explorationState;
    
    // Create frontier position set for O(1) lookup
    // console.log('Processing frontiers:', frontiers);
    const frontierSet = new Set(frontiers.map(f => `${f.row},${f.col}`));
    
    // Calculate circle sizes based on pre-calculated A* path distances
    const frontierCircleSizes = new Map();
    if (robotPosition && frontiers.length > 0) {
      // Use the pathDistance property that's already calculated in the exploration algorithm
      const pathDistances = frontiers.map(f => ({
        key: `${f.row},${f.col}`,
        distance: f.pathDistance || Infinity
      }));
      
      // Find the closest frontier distance (excluding unreachable ones)
      const reachableDistances = pathDistances.filter(d => d.distance < Infinity);
      
      if (reachableDistances.length > 0) {
        const closestDistance = Math.min(...reachableDistances.map(d => d.distance));
        
        // Normalize distances and create circle sizes (closer = bigger circle)
        pathDistances.forEach(({ key, distance }) => {
          if (distance === Infinity) {
            // Unreachable frontiers get small circle
            frontierCircleSizes.set(key, 0.2);
          } else {
            // Normalize against closest distance, invert so closer = bigger
            const normalizedDistance = distance / Math.max(closestDistance, 1);
            // Map to circle size: closest gets size 1.0, furthest gets smaller size
            const circleSize = Math.max(0.3, 1.0 / normalizedDistance);
            frontierCircleSizes.set(key, circleSize);
          }
        });
      }
    }
    
    // Create explored positions set
    const exploredSet = new Set();
    if (knownMap) {
      for (let row = 0; row < knownMap.length; row++) {
        for (let col = 0; col < knownMap[row].length; col++) {
          if (knownMap[row][col] === CELL_STATES.WALKABLE) {
            exploredSet.add(`${row},${col}`);
          }
        }
      }
    }

    // Create detailed path set for O(1) lookup (remaining path only)
    const detailedPathSet = new Set();
    const componentTransitionSet = new Set();
    
    if (explorationState.currentPath && explorationState.currentPathIndex !== undefined) {
      const remainingPath = explorationState.currentPath.slice(explorationState.currentPathIndex);
      remainingPath.forEach(pos => {
        detailedPathSet.add(`${pos.row},${pos.col}`);
      });
      
      // Mark component transitions in remaining path
      if (explorationState.componentGraph) {
        for (let i = 0; i < remainingPath.length - 1; i++) {
          const current = remainingPath[i];
          const next = remainingPath[i + 1];
          
          // Find which components these positions belong to
          const currentComponent = findPositionComponent(current, explorationState.componentGraph);
          const nextComponent = findPositionComponent(next, explorationState.componentGraph);
          
          if (currentComponent && nextComponent && currentComponent !== nextComponent) {
            componentTransitionSet.add(`${next.row},${next.col}`);
          }
        }
      }
    }

    // Create a set of unreachable frontiers for O(1) lookup
    const unreachableFrontierSet = new Set(
      frontiers
        .filter(f => f.isReachable === false)
        .map(f => `${f.row},${f.col}`)
    );

    return {
      isRobotPosition: (row, col) => {
        return robotPosition && robotPosition.row === row && robotPosition.col === col;
      },
      isFrontier: (row, col) => {
        return frontierSet.has(`${row},${col}`);
      },
      isUnreachableFrontier: (row, col) => {
        return unreachableFrontierSet.has(`${row},${col}`);
      },
      isExplored: (row, col) => {
        return exploredSet.has(`${row},${col}`);
      },
      isUnknown: (row, col) => {
        // Check if cell is in unknown state (not yet explored)
        if (!knownMap || !knownMap[row] || knownMap[row][col] === undefined) {
          return true; // Unknown if no data
        }
        return knownMap[row][col] === CELL_STATES.UNKNOWN;
      },
      isInDetailedPath: (row, col) => {
        return detailedPathSet.has(`${row},${col}`);
      },
      isComponentTransition: (row, col) => {
        return componentTransitionSet.has(`${row},${col}`);
      },
      isStartPoint: (row, col) => {
        return state.start && state.start.row === row && state.start.col === col;
      },
      isActualEnd: (row, col) => {
        return explorationState.actualEnd && 
               explorationState.actualEnd.row === row && 
               explorationState.actualEnd.col === col;
      },
      getFrontierCircleSize: (row, col) => {
        return frontierCircleSizes.get(`${row},${col}`) || 0;
      }
    };
  }, [explorationState, state.start]);

  // Helper function to find which component a position belongs to
  const findPositionComponent = (position, componentGraph) => {
    for (const [nodeId, component] of Object.entries(componentGraph)) {
      if (component.cells && component.cells.some(cell => 
        cell.row === position.row && cell.col === position.col
      )) {
        return nodeId;
      }
    }
    return null;
  };

  /**
   * Colors for exploration visualization (improved contrast like frontier_maze)
   */
  const explorationColors = useMemo(() => {
    // Generate pathfinding colors for hybrid rendering
    const generatePathfindingColors = (count = 20) => {
      const colors = [];
      const goldenAngle = 137.508; // Golden angle in degrees
      
      for (let i = 0; i < count; i++) {
        const hue = (i * goldenAngle) % 360;
        colors.push(`hsl(${hue}, 70%, 60%)`);
      }
      return colors;
    };

    return {
      // Better contrast colors from frontier_maze
      ROBOT: '#00ff00',      // Bright green - much more visible
      FRONTIER: '#ff6b6b',   // Bright red - much more visible  
      EXPLORED: '#e8e8e8',   // Light gray - better contrast
      START: '#10B981',
      UNKNOWN: '#808080',    // Gray for unknown areas
      
      // Include pathfinding colors for hybrid rendering
      pathfindingColors: generatePathfindingColors(20)
    };
  }, []);

  /**
   * Generate a new maze for exploration
   */
  const generateNewMaze = useCallback(async () => {
    if (!mazeGenerationAlgorithm) {
      console.error('No maze generation algorithm found for:', state.mazeAlgorithm);
      return;
    }

    actions.startGeneration();
    
    // Reset exploration state
    setExplorationState({
      isExploring: false,
      robotPosition: null,
      robotDirection: 0,
      knownMap: null,
      frontiers: [],
      exploredPositions: [],
      coverage: 0,
      iteration: 0,
      explorationComplete: false,
      sensorPositions: [],
      sensorRange: 15,
      actualEnd: null,
      currentPath: []
    });

    try {
      // Execute maze generation algorithm
      const result = await mazeGenerationAlgorithm.execute(
        { SIZE: 256, REGION_SIZE: 8 },
        {},
        (progress) => {
          if (progress.type === 'generation_complete') {
            const start = findRandomStart(progress.maze);
            
            // Set maze data
            actions.setMazeData({
              maze: progress.maze,
              coloredMaze: progress.coloredMaze,
              componentGraph: progress.componentGraph,
              totalComponents: progress.totalComponents,
              start,
              end: null // No end point needed for exploration
            });
          }
        }
      );

      // If no progress callback was called, handle result directly
      if (result.result) {
        const { maze, coloredMaze, componentGraph, totalComponents } = result.result;
        const start = findRandomStart(maze);
        
        // Set maze data
        actions.setMazeData({
          maze,
          coloredMaze,
          componentGraph,
          totalComponents,
          start,
          end: null
        });
      }
    } catch (error) {
      console.error('Maze generation failed:', error);
    }
  }, [mazeGenerationAlgorithm, state.mazeAlgorithm, actions, findRandomStart]);

  /**
   * Start exploration
   */
  const startExploration = useCallback(async () => {
    if (!explorationAlgorithm || !state.maze || !state.start) {
      console.error('Cannot start exploration: missing algorithm, maze, or start position');
      return;
    }

    setExplorationState(prev => ({
      ...prev,
      isExploring: true,
      explorationComplete: false
    }));
    await explorationAlgorithm.execute(
      {
        maze: state.maze,
        start: state.start,
        SIZE: 256
      },
      {
        sensorRange: 15,
        stepSize: 1.0,
        maxIterations: 500,
        explorationThreshold: 95,
        useWFD: 'true',
        frontierStrategy: 'nearest',
        delay: 100
      },
      (progress) => {
        if (progress.type === 'exploration_progress') {
          setExplorationState(prev => ({
            ...prev,
            robotPosition: progress.robotPosition,
            robotDirection: progress.robotDirection,
            knownMap: progress.knownMap,
            frontiers: progress.frontiers,
            exploredPositions: progress.exploredPositions,
            coverage: progress.coverage,
            iteration: progress.iteration,
            sensorPositions: progress.sensorPositions,
            actualEnd: progress.actualEnd,
            currentPath: progress.currentPath || []
          }));
          
          // Update component graph in main state
          actions.setMazeData({
            maze: state.maze,
            coloredMaze: progress.coloredMaze,
            componentGraph: progress.componentGraph,
            totalComponents: Object.keys(progress.componentGraph).length,
            start: state.start,
            end: null
          });
        }
      }
    );

    // Exploration completed
    setExplorationState(prev => ({
      ...prev,
      isExploring: false,
      explorationComplete: true
    }));
    
  }, [explorationAlgorithm, state, actions]);

  /**
   * Stop exploration
   */
  const stopExploration = useCallback(() => {
    setExplorationState(prev => ({
      ...prev,
      isExploring: false
    }));
  }, []);

  /**
   * Reset exploration
   */
  const resetExploration = useCallback(() => {
    setExplorationState({
      isExploring: false,
      robotPosition: null,
      robotDirection: 0,
      knownMap: null,
      frontiers: [],
      exploredPositions: [],
      coverage: 0,
      iteration: 0,
      explorationComplete: false,
      sensorPositions: [],
      sensorRange: 15,
      actualEnd: null,
      currentPath: []
    });
  }, []);

  // Computed values
  const computed = useMemo(() => ({
    canStartExploration: state.maze.length > 0 && state.start && !explorationState.isExploring,
    canGenerateNewMaze: !explorationState.isExploring,
    hasRobot: explorationState.robotPosition !== null,
    isComplete: explorationState.explorationComplete
  }), [state, explorationState]);

  return {
    // State
    state,
    explorationState,
    computed,
    
    // Cell checkers for rendering
    cellCheckers,
    
    // Colors
    explorationColors,
    
    // Actions
    actions,
    generateNewMaze,
    startExploration,
    stopExploration,
    resetExploration,
    
    // Algorithm info
    algorithms: {
      mazeGeneration: mazeGenerationAlgorithm,
      exploration: explorationAlgorithm
    }
  };
};