/**
 * Component-Based Exploration Algorithm
 * 
 * Novel "Dynamic HPA* for Unknown Environments" approach that combines:
 * - Online component graph evolution during exploration
 * - Component-aware frontier detection and selection
 * - HAA* pathfinding with dynamically discovered structure
 * 
 * Based on the pseudocode from EXPLORATION_PSEUDOCODE.md
 */

import { createAlgorithm, createAlgorithmResult, numberParam, selectParam } from '../algorithm-interface.js';
import { getComponentNodeId } from '../pathfinding/component-based-haa-star.js';
import { scanWithSensors } from '../../core/utils/sensor-utils.js';
import { updateKnownMap, CELL_STATES } from '../../core/utils/map-utils.js';
import { updateComponentStructure } from './component-structure.js';
import { detectComponentAwareFrontiers, selectOptimalFrontier } from './frontier-detection.js';
import { findComponentPath, checkSimplePathExists } from './pathfinding-utils.js';

/**
 * Main Component-Based Exploration Algorithm
 */
const componentBasedExplorationAlgorithm = createAlgorithm({
  name: 'Component-Based Exploration',
  type: 'exploration',
  description: 'Dynamic HPA* exploration with online component graph evolution',
  parameters: {
    sensorRange: numberParam(5, 30, 15, 1),
    stepSize: numberParam(0.5, 2.0, 1.0, 0.1),
    maxIterations: numberParam(100, 50000, 10000, 100),
    explorationThreshold: numberParam(80, 100, 100, 1),
    useWFD: selectParam(['true', 'false'], 'true'),
    frontierStrategy: selectParam(['nearest', 'centroid', 'median'], 'nearest')
  },
  
  async execute(input, options, onProgress) {
    const { maze: fullMaze, start: startPos, SIZE = 256 } = input;
    const { 
      sensorRange = 15,
      stepSize = 1.0,
      explorationThreshold = 100,
      useWFD = 'true',
      frontierStrategy = 'nearest',
      delay = 50
    } = options;
    
    const REGION_SIZE = 8;
    const startTime = performance.now();
    
    // Initialize exploration state
    let robotPosition = { row: startPos.row, col: startPos.col };
    let robotDirection = 0; // 0=NORTH, 1=EAST, 2=SOUTH, 3=WEST
    
    // Initialize known map with everything unknown
    let knownMap = Array(SIZE).fill(null).map(() => Array(SIZE).fill(CELL_STATES.UNKNOWN));
    
    // Initialize colored maze for component tracking
    let coloredMaze = Array(SIZE).fill(null).map(() => Array(SIZE).fill(-1));
    
    // Initialize empty component graph
    let componentGraph = {};
    
    // Initial sensor scan with direction
    const initialSensorPositions = scanWithSensors(robotPosition, sensorRange, fullMaze, robotDirection);
    const initialUpdate = updateKnownMap(knownMap, fullMaze, initialSensorPositions);
    knownMap = initialUpdate.knownMap;
    
    // Build initial component graph
    const initialComponentUpdate = updateComponentStructure(
      knownMap, componentGraph, coloredMaze, initialUpdate.newCells, REGION_SIZE
    );
    componentGraph = initialComponentUpdate.componentGraph;
    coloredMaze = initialComponentUpdate.coloredMaze;
    
    let exploredPositions = [{ ...robotPosition }];
    let iterationCount = 0;
    
    // DEBUG: Track frontier selection history
    let frontierHistory = [];
    let lastSelectedFrontier = null;
    let sameTargetCount = 0;
    let lastDistanceToTarget = Infinity;
    
    // Target persistence: stick to current target until reached
    let currentTarget = null;
    
    // Main exploration loop: SENSE → UPDATE → PLAN → NAVIGATE → MOVE
    while (true) {
      iterationCount++;
      
      // Safety check to prevent infinite loops
      // if (iterationCount > maxIterations) {
      //   console.log(`Exploration stopped: Reached maximum iterations (${maxIterations})`);
      //   break;
      // }
      
      // 1. SENSE: Robot scans environment with current direction
      const sensorPositions = scanWithSensors(robotPosition, sensorRange, fullMaze, robotDirection);
      const updateResult = updateKnownMap(knownMap, fullMaze, sensorPositions);
      knownMap = updateResult.knownMap;
      
      // 2. UPDATE: Online component analysis (always update to catch fragmentation)
      const componentUpdate = updateComponentStructure(
        knownMap, componentGraph, coloredMaze, updateResult.newCells, REGION_SIZE
      );
      componentGraph = componentUpdate.componentGraph;
      coloredMaze = componentUpdate.coloredMaze;
      
      // 3. PLAN: Find next exploration target using advanced frontier detection
      const frontiers = detectComponentAwareFrontiers(
        knownMap, 
        componentGraph,
        coloredMaze,
        useWFD === 'true', 
        frontierStrategy
      );
      
      // Check exploration completion - PRIMARY TERMINATION CONDITION
      if (frontiers.length === 0) {
        console.log(`Exploration completed: No more frontiers found after ${iterationCount} iterations (Coverage: ${coverage.toFixed(1)}%)`);
        break; // No more frontiers to explore
      }
      

      
      // Calculate coverage
      let knownCells = 0;
      let totalCells = 0;
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          if (fullMaze[r][c] === CELL_STATES.WALKABLE) {
            totalCells++;
            if (knownMap[r][c] === CELL_STATES.WALKABLE) {
              knownCells++;
            }
          }
        }
      }
      const coverage = totalCells > 0 ? (knownCells / totalCells) * 100 : 0;
      
      if (coverage >= explorationThreshold) {
        console.log(`Exploration completed: Coverage threshold reached ${coverage.toFixed(1)}% >= ${explorationThreshold}% after ${iterationCount} iterations`);
        break; // Exploration threshold reached
      }
      
      // Target persistence logic: only select new target if we don't have one or reached current one
      let targetFrontier = currentTarget;
      
      // Check if we need to select a new target
      const needNewTarget = !currentTarget || 
        // Current target reached (robot is at target position)
        (currentTarget && robotPosition.row === currentTarget.row && robotPosition.col === currentTarget.col) ||
        // Current target no longer exists in frontiers (discovered or invalid)
        (currentTarget && !frontiers.some(f => f.row === currentTarget.row && f.col === currentTarget.col));
      
      if (needNewTarget) {
        console.log(`DEBUG: Selecting new target. Reason: ${!currentTarget ? 'no current target' : 
          (robotPosition.row === currentTarget.row && robotPosition.col === currentTarget.col) ? 'target reached' : 
          'target no longer valid'}`);
        
        targetFrontier = selectOptimalFrontier(frontiers, robotPosition);
        currentTarget = targetFrontier; // Update current target
        
        if (!targetFrontier) {
          console.log(`Exploration stopped: No valid frontier target found after ${iterationCount} iterations`);
          break;
        }
        
        console.log(`DEBUG: New target selected: (${targetFrontier.row}, ${targetFrontier.col})`);
      } else {
        console.log(`DEBUG: Continuing to current target: (${currentTarget.row}, ${currentTarget.col})`);
      }
      
      // DEBUG: Track frontier selection patterns
      const frontierKey = `${targetFrontier.row},${targetFrontier.col}`;
      frontierHistory.push(frontierKey);
      
      if (lastSelectedFrontier && lastSelectedFrontier === frontierKey) {
        sameTargetCount++;
        if (sameTargetCount > 10) {
          console.log(`DEBUG: Same frontier selected too many times (${sameTargetCount})`, targetFrontier);
          console.log('DEBUG: Robot position:', robotPosition);
          console.log('DEBUG: Available frontiers:', frontiers.map(f => `(${f.row},${f.col})`));
          // throw new Error(`DEBUG: Same frontier (${frontierKey}) selected ${sameTargetCount} times - robot stuck!`);
        }
      } else {
        sameTargetCount = 1;
        lastSelectedFrontier = frontierKey;
      }
      
      // DEBUG: Check if target frontier is valid
      if (targetFrontier.row < 0 || targetFrontier.row >= SIZE || targetFrontier.col < 0 || targetFrontier.col >= SIZE) {
        throw new Error(`DEBUG: Invalid target frontier at (${targetFrontier.row}, ${targetFrontier.col})`);
      }
      
      // 4. NAVIGATE: Use component-based pathfinding
      console.log(`DEBUG: Attempting pathfinding from (${robotPosition.row}, ${robotPosition.col}) to (${targetFrontier.row}, ${targetFrontier.col})`);
      
      const pathResult = findComponentPath(
        robotPosition, 
        { row: targetFrontier.row, col: targetFrontier.col },
        knownMap,
        componentGraph,
        coloredMaze,
        REGION_SIZE
      );
      
      console.log(`DEBUG: Pathfinding result - path length: ${pathResult?.path ? pathResult.path.length : 'null'}`);
      
      if (!pathResult?.path || pathResult.path.length === 0) {
        // DEBUG: Detailed pathfinding failure analysis
        const robotComponent = getComponentNodeId(robotPosition, coloredMaze, REGION_SIZE);
        const frontierComponent = getComponentNodeId({ row: targetFrontier.row, col: targetFrontier.col }, coloredMaze, REGION_SIZE);
        let debugInfo = '';
        debugInfo += 'DEBUG PATHFINDING FAILURE:\n';
        debugInfo += `- Robot at: ${JSON.stringify(robotPosition)}\n`;
        debugInfo += `- Robot component: ${robotComponent}\n`;
        debugInfo += `- Target frontier: ${JSON.stringify(targetFrontier)}\n`;
        debugInfo += `- Frontier component: ${frontierComponent}\n`;
        debugInfo += `- Known map at robot: ${knownMap[robotPosition.row][robotPosition.col]}\n`;
        debugInfo += `- Known map at frontier: ${knownMap[targetFrontier.row][targetFrontier.col]}\n`;
        
        // DEBUG: Check component connections
        
        if (robotComponent && componentGraph[robotComponent]) {
          debugInfo += `- Robot component neighbors: ${JSON.stringify(componentGraph[robotComponent].neighbors)}\n`;
          debugInfo += `- Robot component transitions: ${JSON.stringify(componentGraph[robotComponent].transitions)}\n`;
        }
        if (frontierComponent && componentGraph[frontierComponent]) {
          debugInfo += `- Frontier component neighbors: ${JSON.stringify(componentGraph[frontierComponent].neighbors)}\n`;
          debugInfo += `- Frontier component transitions: ${JSON.stringify(componentGraph[frontierComponent].transitions)}\n`;
        }
        
        debugInfo += `- Component graph keys: ${JSON.stringify(Object.keys(componentGraph))}\n`;
        debugInfo += `- Frontier details: ${JSON.stringify(targetFrontier)}`;
        
        // DEBUG: Try simple A* pathfinding as fallback to test if path exists
        debugInfo += 'DEBUG: Testing if path exists with simple grid search...\n';
        const simplePathExists = checkSimplePathExists(robotPosition, targetFrontier, knownMap);
        debugInfo += `- Simple path exists: ${simplePathExists}\n`;
        
        // Check if frontier is actually walkable in known map
        if (knownMap[targetFrontier.row][targetFrontier.col] !== CELL_STATES.WALKABLE) {
          debugInfo += `DEBUG: Frontier (${targetFrontier.row}, ${targetFrontier.col}) is not walkable in known map! State: ${knownMap[targetFrontier.row][targetFrontier.col]}\n`;
        }
        
        // Check if robot position is walkable
        if (knownMap[robotPosition.row][robotPosition.col] !== CELL_STATES.WALKABLE) {
          debugInfo += `DEBUG: Robot position (${robotPosition.row}, ${robotPosition.col}) is not walkable! State: ${knownMap[robotPosition.row][robotPosition.col]}\n`;
        }
        debugInfo += `DEBUG: No path found from (${robotPosition.row}, ${robotPosition.col}) to frontier (${targetFrontier.row}, ${targetFrontier.col}) at iteration ${iterationCount}. Robot component: ${robotComponent}, Frontier component: ${frontierComponent}`;
        
        
        throw new Error(debugInfo);
      }
      
      // Store actualEnd for visualization
      const currentActualEnd = pathResult.actualEnd;
      
      // 5. MOVE: Execute path segment and update robot direction
      const targetIndex = Math.min(Math.floor(stepSize) + 1, pathResult.path.length - 1);
      
      // DEBUG: Check if robot is actually moving
      const oldPosition = { ...robotPosition };
      
      // Handle case where robot is already at target (path length 1)
      if (pathResult.path.length === 1) {
        console.log(`DEBUG: Robot already at target (${targetFrontier.row}, ${targetFrontier.col}) - path length 1`);
        // Robot has reached the frontier, continue to next iteration to select new target
        continue;
      }
      
      if (targetIndex > 0) {
        const newPosition = { row: pathResult.path[targetIndex].row, col: pathResult.path[targetIndex].col };
        
        // Update robot direction based on movement
        const deltaRow = newPosition.row - robotPosition.row;
        const deltaCol = newPosition.col - robotPosition.col;
        
        if (Math.abs(deltaRow) > Math.abs(deltaCol)) {
          // Vertical movement
          robotDirection = deltaRow < 0 ? 0 : 2; // NORTH : SOUTH
        } else if (deltaCol !== 0) {
          // Horizontal movement
          robotDirection = deltaCol > 0 ? 1 : 3; // EAST : WEST
        }
        // If deltaRow === 0 && deltaCol === 0, keep current direction
        
        robotPosition = newPosition;
        exploredPositions.push({ ...robotPosition });
        
        // DEBUG: Check if robot actually moved
        if (oldPosition.row === robotPosition.row && oldPosition.col === robotPosition.col) {
          throw new Error(`DEBUG: Robot didn't move from (${oldPosition.row}, ${oldPosition.col}) at iteration ${iterationCount}`);
        }
        
        // DEBUG: Check if robot is making progress toward target
        const currentDistanceToTarget = Math.sqrt(
          Math.pow(targetFrontier.row - robotPosition.row, 2) + 
          Math.pow(targetFrontier.col - robotPosition.col, 2)
        );
        
        if (lastSelectedFrontier === frontierKey && currentDistanceToTarget >= lastDistanceToTarget) {
          console.log(`DEBUG: No progress toward target ${frontierKey}. Distance: ${lastDistanceToTarget.toFixed(2)} -> ${currentDistanceToTarget.toFixed(2)}`);
        }
        
        lastDistanceToTarget = currentDistanceToTarget;
      } else {
        // DEBUG: Check why targetIndex is 0
        throw new Error(`DEBUG: targetIndex is 0, path length: ${pathResult.path.length}, stepSize: ${stepSize} at iteration ${iterationCount}`);
      }
      
      // Call progress callback
      if (onProgress) {
        onProgress({
          type: 'exploration_progress',
          robotPosition,
          robotDirection,
          knownMap,
          componentGraph,
          coloredMaze,
          frontiers,
          currentTarget: targetFrontier, // Highlight current target
          exploredPositions: [...exploredPositions],
          coverage,
          iteration: iterationCount,
          sensorPositions,
          currentPath: pathResult.path ? [...pathResult.path] : [], // Show full detailed path
          currentPathIndex: 0, // Always start from beginning of new path
          actualEnd: currentActualEnd // Show the actual target being used
        });
        
        // Add delay for visualization
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    const endTime = performance.now();
    
    // Calculate final metrics
    let finalKnownCells = 0;
    let finalTotalCells = 0;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (fullMaze[r][c] === CELL_STATES.WALKABLE) {
          finalTotalCells++;
          if (knownMap[r][c] === CELL_STATES.WALKABLE) {
            finalKnownCells++;
          }
        }
      }
    }
    const finalCoverage = finalTotalCells > 0 ? (finalKnownCells / finalTotalCells) * 100 : 0;
    
    return createAlgorithmResult(
      {
        success: true,
        exploredPositions,
        knownMap,
        componentGraph,
        coloredMaze,
        finalCoverage,
        robotPosition,
        robotDirection
      },
      {
        executionTime: endTime - startTime,
        iterations: iterationCount,
        positionsExplored: exploredPositions.length,
        coverage: finalCoverage,
        componentsDiscovered: Object.keys(componentGraph).length,
        frontierStrategy,
        useWFD: useWFD === 'true'
      }
    );
  }
});

export default componentBasedExplorationAlgorithm;

// Export algorithm for other modules to use
export { componentBasedExplorationAlgorithm };