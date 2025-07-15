// CLI version - no React imports needed
// import { useMazeState } from '../../hooks/useMazeState.js'; // TODO: Replace with plain JS
import { getAlgorithm } from '../../algorithms/index.js';
import { CELL_STATES } from '../../core/utils/map-utils.js';
import { DEFAULT_REGION_SIZE, DEFAULT_MAZE_SIZE } from '../../core/constants.js';

/**
 * CLI Exploration Demo - Plain JavaScript version
 */
export class CLIExplorationDemo {
  constructor() {
    // Main state (replaces useMazeState)
    this.state = {
      maze: [],
      coloredMaze: [],
      componentGraph: {},
      totalComponents: 0,
      start: null,
      end: null,
      mazeAlgorithm: 'frontier'
    };
    
    // Exploration-specific state
    this.explorationState = {
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
    };
  }

  // State management methods (replace actions from useMazeState)
  setMazeData(data) {
    this.state = { ...this.state, ...data };
  }

  startGeneration() {
    // Implementation for generation start
  }

  setExplorationState(newState) {
    this.explorationState = typeof newState === 'function' 
      ? newState(this.explorationState) 
      : { ...this.explorationState, ...newState };
  }

  // Get algorithms
  getMazeGenerationAlgorithm() {
    return getAlgorithm('maze-generation', this.state.mazeAlgorithm);
  }

  getExplorationAlgorithm() {
    return getAlgorithm('exploration', 'component-based-exploration');
  }

  /**
   * Find random start position from walkable cells
   */
  findRandomStart(maze) {
    const walkableCells = [];
    for (let row = 0; row < maze.length; row++) {
      for (let col = 0; col < maze[row].length; col++) {
        if (maze[row][col] === 0) {
          walkableCells.push({ row, col });
        }
      }
    }
    return walkableCells[Math.floor(Math.random() * walkableCells.length)];
  }

  /**
   * Cell checkers for exploration rendering
   */
  getCellCheckers() {
    const { robotPosition, frontiers, knownMap } = this.explorationState;
    
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
    
    if (this.explorationState.currentPath && this.explorationState.currentPathIndex !== undefined) {
      const remainingPath = this.explorationState.currentPath.slice(this.explorationState.currentPathIndex);
      remainingPath.forEach(pos => {
        detailedPathSet.add(`${pos.row},${pos.col}`);
      });
      
      // Mark component transitions in remaining path
      if (this.explorationState.componentGraph) {
        for (let i = 0; i < remainingPath.length - 1; i++) {
          const current = remainingPath[i];
          const next = remainingPath[i + 1];
          
          // Find which components these positions belong to
          const currentComponent = this.findPositionComponent(current, this.explorationState.componentGraph);
          const nextComponent = this.findPositionComponent(next, this.explorationState.componentGraph);
          
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
        return this.state.start && this.state.start.row === row && this.state.start.col === col;
      },
      isActualEnd: (row, col) => {
        return this.explorationState.actualEnd && 
               this.explorationState.actualEnd.row === row && 
               this.explorationState.actualEnd.col === col;
      },
      getFrontierCircleSize: (row, col) => {
        return frontierCircleSizes.get(`${row},${col}`) || 0;
      }
    };
  }

  // Helper function to find which component a position belongs to
  findPositionComponent(position, componentGraph) {
    for (const [nodeId, component] of Object.entries(componentGraph)) {
      if (component.cells && component.cells.some(cell => 
        cell.row === position.row && cell.col === position.col
      )) {
        return nodeId;
      }
    }
    return null;
  }

  /**
   * Colors for exploration visualization (improved contrast like frontier_maze)
   */
  getExplorationColors() {
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
  }

  /**
   * Generate a new maze for exploration
   */
  async generateNewMaze() {
    const mazeGenerationAlgorithm = this.getMazeGenerationAlgorithm();
    if (!mazeGenerationAlgorithm) {
      console.error('No maze generation algorithm found for:', this.state.mazeAlgorithm);
      return;
    }

    this.startGeneration();
    
    // Reset exploration state
    this.setExplorationState({
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
        { SIZE: DEFAULT_MAZE_SIZE, REGION_SIZE: DEFAULT_REGION_SIZE },
        {},
        (progress) => {
          if (progress.type === 'generation_complete') {
            const start = this.findRandomStart(progress.maze);
            
            // Set maze data
            this.setMazeData({
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
        const start = this.findRandomStart(maze);
        
        // Set maze data
        this.setMazeData({
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
  }

  /**
   * Start exploration
   */
  async startExploration() {
    const explorationAlgorithm = this.getExplorationAlgorithm();
    if (!explorationAlgorithm || !this.state.maze || !this.state.start) {
      console.error('Cannot start exploration: missing algorithm, maze, or start position');
      return;
    }

    this.setExplorationState(prev => ({
      ...prev,
      isExploring: true,
      explorationComplete: false
    }));
    await explorationAlgorithm.execute(
      {
        maze: this.state.maze,
        start: this.state.start,
        SIZE: DEFAULT_MAZE_SIZE
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
          this.setExplorationState(prev => ({
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
          this.setMazeData({
            maze: this.state.maze,
            coloredMaze: progress.coloredMaze,
            componentGraph: progress.componentGraph,
            totalComponents: Object.keys(progress.componentGraph).length,
            start: this.state.start,
            end: null
          });
          
          // Render maze on every progress update (don't clear screen to avoid flashing)
          this.printMaze(false);
          
          // Add small delay for visualization
          return new Promise(resolve => setTimeout(resolve, 200));
        }
      }
    );

    // Exploration completed
    this.setExplorationState(prev => ({
      ...prev,
      isExploring: false,
      explorationComplete: true
    }));
    
  }

  /**
   * Stop exploration
   */
  stopExploration() {
    this.setExplorationState(prev => ({
      ...prev,
      isExploring: false
    }));
  }

  /**
   * Reset exploration
   */
  resetExploration() {
    this.setExplorationState({
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
  }

  // Computed values
  getComputed() {
    return {
      canStartExploration: this.state.maze.length > 0 && this.state.start && !this.explorationState.isExploring,
      canGenerateNewMaze: !this.explorationState.isExploring,
      hasRobot: this.explorationState.robotPosition !== null,
      isComplete: this.explorationState.explorationComplete
    };
  }

  // ASCII rendering methods
  getASCIIChar(row, col) {
    const cellCheckers = this.getCellCheckers();
    
    // Check robot position first
    if (cellCheckers.isRobotPosition(row, col)) {
      return '@';
    }
    
    // Check if it's part of the current path
    if (cellCheckers.isInDetailedPath(row, col)) {
      return '*';
    }
    
    // Check if it's a frontier
    if (cellCheckers.isFrontier(row, col)) {
      return '?';
    }
    
    // Check if it's explored
    if (cellCheckers.isExplored(row, col)) {
      return ' ';
    }
    
    // Check if it's unknown
    if (cellCheckers.isUnknown(row, col)) {
      return '█';
    }
    
    // Check if it's a wall (from the maze)
    if (this.state.maze[row] && this.state.maze[row][col] === 1) {
      return '█';
    }
    
    // Default to walkable
    return '░';
  }
  
  renderASCII() {
    if (!this.state.maze || this.state.maze.length === 0) {
      return "Loading maze...";
    }
    
    let output = '';
    const mazeSize = this.state.maze.length;
    
    for (let row = 0; row < mazeSize; row++) {
      let line = '';
      for (let col = 0; col < mazeSize; col++) {
        line += this.getASCIIChar(row, col);
      }
      output += line + '\n';
    }
    
    return output;
  }
  
  printMaze(clearScreen = true) {
    if (clearScreen) {
      // Clear screen and move cursor to top-left
      process.stdout.write('\x1B[2J\x1B[0f');
    } else {
      // Just move cursor to top-left without clearing
      process.stdout.write('\x1B[0f');
    }
    
    console.log('CLI Exploration Demo - Component-based Exploration');
    console.log('Legend: █=Wall/Unknown, ░=Walkable, ?=Frontier, @=Robot, *=Path,  =Explored');
    console.log('Coverage:', this.explorationState.coverage?.toFixed(1) || '0.0', '%');
    console.log('Iteration:', this.explorationState.iteration || 0);
    console.log('=' + '='.repeat(this.state.maze.length || 40));
    console.log(this.renderASCII());
  }

  // Get all the data that was previously returned by the hook
  getData() {
    return {
      // State
      state: this.state,
      explorationState: this.explorationState,
      computed: this.getComputed(),
      
      // Cell checkers for rendering
      cellCheckers: this.getCellCheckers(),
      
      // Colors
      explorationColors: this.getExplorationColors(),
      
      // Algorithm info
      algorithms: {
        mazeGeneration: this.getMazeGenerationAlgorithm(),
        exploration: this.getExplorationAlgorithm()
      }
    };
  }
}