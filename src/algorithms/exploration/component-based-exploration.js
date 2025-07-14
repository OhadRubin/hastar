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
import { DIRECTIONS } from '../../utils/utilities.js';
import { updateComponentStructure } from './component-structure.js';
import { detectComponentAwareFrontiers, selectOptimalFrontier, shouldAbandonCurrentTarget, isComponentReachable } from './frontier-detection.js';
import { 
  findComponentPath, 
  checkSimplePathExists, 
  knownMapAreaToString, 
  groundTruthAreaToString,
  coloredMazeAreaToString,
  sensorCoverageToString,
  componentConnectivityToString
} from './pathfinding-utils.js';

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
    let robotDirection = 0; // 0=NORTH, 1=NORTHEAST, 2=EAST, 3=SOUTHEAST, 4=SOUTH, 5=SOUTHWEST, 6=WEST, 7=NORTHWEST
    
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
    
    // Track frontier selection for loop detection
    let lastSelectedFrontier = null;
    let sameTargetCount = 0;
    
    // Target persistence: stick to current target until reached
    let currentTarget = null;
    let prevTargets = []; // Track previous targets to prevent yoyo-ing
    let recentPositions = []; // Track recent positions to detect movement loops
    
    // Main exploration loop: SENSE → UPDATE → PLAN → NAVIGATE → MOVE
    while (true) {
      iterationCount++;
      
      // console.log(`=== EXPLORATION ITERATION ${iterationCount} START ===`);
      
      // Safety check to prevent infinite loops
      if (iterationCount > 1000) {
        console.log(`EMERGENCY STOP: Reached 1000 iterations - likely infinite loop`);
        break;
      }
      
      // 1. SENSE: Robot scans environment with current direction
      const sensorPositions = scanWithSensors(robotPosition, sensorRange, fullMaze, robotDirection);
      const updateResult = updateKnownMap(knownMap, fullMaze, sensorPositions);
      knownMap = updateResult.knownMap;
      
      // console.log(`SENSE: Scanned ${sensorPositions.length} positions, discovered ${updateResult.newCells?.length || 0} new cells`);
      
      // 2. UPDATE: Online component analysis (always update to catch fragmentation)
      const componentUpdate = updateComponentStructure(
        knownMap, componentGraph, coloredMaze, updateResult.newCells, REGION_SIZE
      );
      componentGraph = componentUpdate.componentGraph;
      coloredMaze = componentUpdate.coloredMaze;
      
      // Calculate coverage first
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
      
      // 3. PLAN: Find next exploration target using advanced frontier detection
      const frontiers = detectComponentAwareFrontiers(
        knownMap, 
        componentGraph,
        coloredMaze,
        useWFD === 'true', 
        // false, 
        frontierStrategy,
        robotPosition
      );
      
      // console.log(`PLAN: Detected ${frontiers.length} frontiers. First few: ${frontiers.slice(0, 3).map(f => `(${f.row},${f.col})`).join(', ')}`);
      
      // Check exploration completion - PRIMARY TERMINATION CONDITION
      if (frontiers.length === 0) {
        console.log(`Exploration completed: No more frontiers found after ${iterationCount} iterations (Coverage: ${coverage.toFixed(1)}%)`);
        break; // No more frontiers to explore
      }
      
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
        // console.log(`TARGET SELECTION: Need new target. Robot at (${robotPosition.row},${robotPosition.col}), old target was ${currentTarget ? `(${currentTarget.row},${currentTarget.col})` : 'null'}`);
        targetFrontier = selectOptimalFrontier(frontiers, robotPosition, componentGraph, coloredMaze);
        currentTarget = targetFrontier; // Update current target
        console.log(`TARGET SELECTION: Selected new target: ${targetFrontier ? `(${targetFrontier.row},${targetFrontier.col})` : 'null'}`);
        
        if (!targetFrontier) {
          const robotComponent = getComponentNodeId(robotPosition, coloredMaze, REGION_SIZE);
          
          let debugOutput = `Exploration stopped: No reachable frontier targets found after ${iterationCount} iterations`;
          debugOutput += `\nRobot is in position (${robotPosition.row},${robotPosition.col}) in component ${robotComponent}. Found ${frontiers.length} total frontiers, but none are reachable through known paths.`;
          
          // DEBUG: Print detailed debugging information
          debugOutput += `\n${knownMapAreaToString(knownMap, robotPosition, 20)}`;
          debugOutput += `\n${coloredMazeAreaToString(coloredMaze, robotPosition, 20)}`;
          
          // Debug each frontier's reachability
          debugOutput += `\n=== FRONTIER REACHABILITY ANALYSIS ===`;
          frontiers.forEach((frontier, i) => {
            const frontierComponent = getComponentNodeId({ row: frontier.row, col: frontier.col }, coloredMaze, REGION_SIZE);
            const reachable = isComponentReachable(robotComponent, frontierComponent, componentGraph);
            debugOutput += `\nFrontier ${i}: (${frontier.row},${frontier.col}) component ${frontierComponent}, reachable: ${reachable}`;
          });
          
          debugOutput += `\n${componentConnectivityToString(componentGraph, robotComponent, frontiers[0]?.componentId)}`;
          
          console.log(debugOutput);
          break;
        }
      }
      
      // Track frontier selection for loop detection
      const frontierKey = `${targetFrontier.row},${targetFrontier.col}`;
      
      if (lastSelectedFrontier && lastSelectedFrontier === frontierKey) {
        sameTargetCount++;
      } else {
        sameTargetCount = 1;
        lastSelectedFrontier = frontierKey;
      }
      
      // DEBUG: Check if target frontier is valid
      if (targetFrontier.row < 0 || targetFrontier.row >= SIZE || targetFrontier.col < 0 || targetFrontier.col >= SIZE) {
        throw new Error(`DEBUG: Invalid target frontier at (${targetFrontier.row}, ${targetFrontier.col})`);
      }
      
      // 4. NAVIGATE: Use component-based pathfinding
      // console.log(`Pathfinding from (${robotPosition.row},${robotPosition.col}) to frontier (${targetFrontier.row},${targetFrontier.col})`);
      
      let pathResult = findComponentPath(
        robotPosition, 
        { row: targetFrontier.row, col: targetFrontier.col },
        knownMap,
        componentGraph,
        coloredMaze,
        REGION_SIZE
      );
      
      // console.log(`Pathfinding result: ${pathResult?.path ? `${pathResult.path.length} steps` : 'null'}`);
      
      // Check if we should abandon current target (if pathfinding succeeded)
      if (pathResult?.path && pathResult.path.length > 0) {
        // Calculate paths to all frontiers for target abandonment decision
        // console.log(`Calculating paths to all ${frontiers.length} frontiers for target abandonment decision...`);
        const frontierPaths = [];
        
        for (const frontier of frontiers) {
          const frontierPath = findComponentPath(
            robotPosition,
            { row: frontier.row, col: frontier.col },
            knownMap,
            componentGraph,
            coloredMaze,
            REGION_SIZE
          );
          
          frontierPaths.push({
            frontier: frontier,
            path: frontierPath?.path || null,
            cost: frontierPath?.path ? frontierPath.path.length : Infinity
          });
        }
        
        // console.log(`Calculated ${frontierPaths.length} frontier paths. Paths found: ${frontierPaths.filter(fp => fp.path !== null).length}`);
        
        const abandonDecision = shouldAbandonCurrentTarget(
          robotPosition,
          currentTarget,
          frontiers,
          pathResult,
          componentGraph,
          coloredMaze,
          { 
            iterations: iterationCount, 
            coverage, 
            sameTargetCount,
            exploredPositions: exploredPositions.length,
            prev_targets: prevTargets,
            recent_positions: recentPositions
          },
          frontierPaths
        );
        
        if (abandonDecision !== null) {
          // Switch to new target
          currentTarget = abandonDecision.target;
          targetFrontier = abandonDecision.target;
          
          // Use the provided path or recalculate if needed
          if (abandonDecision.path && abandonDecision.path.length > 0) {
            pathResult = {
              path: abandonDecision.path,
              actualEnd: abandonDecision.target
            };
          } else {
            // Recalculate path to new target
            pathResult = findComponentPath(
              robotPosition,
              { row: targetFrontier.row, col: targetFrontier.col },
              knownMap,
              componentGraph,
              coloredMaze,
              REGION_SIZE
            );
          }
        }
      }
      
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
        debugInfo += `DEBUG: No path found from (${robotPosition.row}, ${robotPosition.col}) to frontier (${targetFrontier.row}, ${targetFrontier.col}) at iteration ${iterationCount}. Robot component: ${robotComponent}, Frontier component: ${frontierComponent}\n`;
        
        // Print comprehensive debug matrices
        debugInfo += `\n=== DEBUG: COMPREHENSIVE MATRIX ANALYSIS ===\n`;
        
        // 1. Known map (what robot has discovered)
        debugInfo += knownMapAreaToString(knownMap, robotPosition, 8, robotPosition, targetFrontier);
        debugInfo += '\n';
        
        // 2. Ground truth (actual maze)
        debugInfo += groundTruthAreaToString(fullMaze, robotPosition, 8, robotPosition, targetFrontier);
        debugInfo += '\n';
        
        // 3. Component assignments (colored maze)
        debugInfo += coloredMazeAreaToString(coloredMaze, robotPosition, 8, robotPosition, targetFrontier);
        debugInfo += '\n';
        
        // 4. Sensor coverage analysis
        debugInfo += sensorCoverageToString(fullMaze, knownMap, robotPosition, sensorRange, sensorPositions, 8, targetFrontier);
        debugInfo += '\n';
        
        // 5. Component connectivity analysis
        debugInfo += componentConnectivityToString(componentGraph, robotComponent, frontierComponent);
        debugInfo += '\n';
        
        // If robot and target are far apart, show target area separately
        if (Math.abs(robotPosition.row - targetFrontier.row) > 16 || Math.abs(robotPosition.col - targetFrontier.col) > 16) {
          console.log(`\n--- TARGET AREA (separate view) ---`);
          console.log(knownMapAreaToString(knownMap, targetFrontier, 8, robotPosition, targetFrontier));
          console.log(groundTruthAreaToString(fullMaze, targetFrontier, 8, robotPosition, targetFrontier));
          console.log(coloredMazeAreaToString(coloredMaze, targetFrontier, 8, robotPosition, targetFrontier));
        }
        
        throw new Error(debugInfo);
      }
      
      // Store actualEnd for visualization
      const currentActualEnd = pathResult.actualEnd;
      
      // 5. MOVE: Execute path segment and update robot direction
      // console.log(`MOVE: Starting movement from (${robotPosition.row},${robotPosition.col})`);
      
      const targetIndex = Math.min(Math.floor(stepSize) + 1, pathResult.path.length - 1);
      
      // DEBUG: Check if robot is actually moving
      const oldPosition = { ...robotPosition };
      
      // Handle case where robot is already at target (path length 1)
      if (pathResult.path.length === 1) {
        // console.log(`FRONTIER REACHED: Robot at (${robotPosition.row},${robotPosition.col}) has reached frontier target (${targetFrontier.row},${targetFrontier.col})`);
        // console.log(`Current known map at robot position: ${knownMap[robotPosition.row][robotPosition.col]}`);
        // console.log(`Sensor range: ${sensorRange}, Robot direction: ${robotDirection}`);
        
        // Robot has reached the frontier, continue to next iteration to select new target
        continue;
      }
      
      if (targetIndex > 0) {
        const newPosition = { row: pathResult.path[targetIndex].row, col: pathResult.path[targetIndex].col };
        
        // Update robot direction based on movement
        const deltaRow = newPosition.row - robotPosition.row;
        const deltaCol = newPosition.col - robotPosition.col;
        
        // Handle diagonal movements
        if (deltaRow !== 0 && deltaCol !== 0) {
          if (deltaRow < 0 && deltaCol > 0) {
            robotDirection = DIRECTIONS.NORTHEAST;
          } else if (deltaRow > 0 && deltaCol > 0) {
            robotDirection = DIRECTIONS.SOUTHEAST;
          } else if (deltaRow > 0 && deltaCol < 0) {
            robotDirection = DIRECTIONS.SOUTHWEST;
          } else if (deltaRow < 0 && deltaCol < 0) {
            robotDirection = DIRECTIONS.NORTHWEST;
          }
        } else if (deltaRow !== 0) {
          // Pure vertical movement
          robotDirection = deltaRow < 0 ? DIRECTIONS.NORTH : DIRECTIONS.SOUTH;
        } else if (deltaCol !== 0) {
          // Pure horizontal movement
          robotDirection = deltaCol > 0 ? DIRECTIONS.EAST : DIRECTIONS.WEST;
        }
        // If deltaRow === 0 && deltaCol === 0, keep current direction
        
        robotPosition = newPosition;
        exploredPositions.push({ ...robotPosition });
        
        // Track recent positions for loop detection
        recentPositions.push({ ...robotPosition });
        if (recentPositions.length > 20) {
          recentPositions.shift(); // Keep only last 20 positions
        }
        
        console.log(`MOVE: Robot moved from (${oldPosition.row},${oldPosition.col}) to (${robotPosition.row},${robotPosition.col})`);
        
        // DEBUG: Check if robot actually moved
        if (oldPosition.row === robotPosition.row && oldPosition.col === robotPosition.col) {
          throw new Error(`DEBUG: Robot didn't move from (${oldPosition.row}, ${oldPosition.col}) at iteration ${iterationCount}`);
        }
        
        // Robot successfully moved
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