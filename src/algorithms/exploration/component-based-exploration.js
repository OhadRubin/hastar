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
 * Validate that all frontiers are reachable from robot position
 * @param {Array} frontiers - List of frontier objects
 * @param {Object} robotPosition - Robot position {row, col}
 * @param {Object} componentGraph - Current component graph
 * @param {Array} coloredMaze - Current colored maze
 * @param {number} regionSize - Region size for components
 * @param {Array} knownMap - Current known map
 * @param {Array} fullMaze - Complete maze array (optional)
 * @param {number} sensorRange - Sensor range (optional)
 * @param {Array} sensorPositions - Sensor positions (optional)
 * @throws {Error} If any frontier is unreachable
 */
function validateAllFrontiersReachable(frontiers, robotPosition, componentGraph, coloredMaze, regionSize, knownMap, fullMaze = null, sensorRange = null, sensorPositions = null) {
  // Assert that all required parameters for matrix debug info are provided
  console.assert(fullMaze && sensorRange !== null && sensorPositions, 'validateAllFrontiersReachable: fullMaze, sensorRange, and sensorPositions must be provided for proper debugging');
  
  const robotComponent = getComponentNodeId(robotPosition, coloredMaze, regionSize);
  
  for (const frontier of frontiers) {
    const isReachable = isComponentReachable(robotComponent, frontier.componentId, componentGraph);
    if (!isReachable) {
      console.error(`ASSERTION FAILED: Unreachable frontier detected!`);
      console.error(`Robot: (${robotPosition.row},${robotPosition.col}) component ${robotComponent}`);
      console.error(`Frontier: (${frontier.row},${frontier.col}) component ${frontier.componentId}`);
      console.error(`Component graph keys: ${Object.keys(componentGraph)}`);
      console.error(`Robot component exists: ${!!componentGraph[robotComponent]}`);
      console.error(`Frontier component exists: ${!!componentGraph[frontier.componentId]}`);
      
      // Generate and print pathfinding debug info for the unreachable frontier
      const debugInfo = generatePathfindingDebugInfo(robotPosition, frontier, knownMap, componentGraph, coloredMaze, regionSize);
      // console.error(`PATHFINDING DEBUG INFO:\n${debugInfo}`);
      
      // Generate matrix info if parameters are available
      let matrixDebugInfo = '';
      if (fullMaze && sensorRange !== null && sensorPositions) {
        const frontierComponent = getComponentNodeId({ row: frontier.row, col: frontier.col }, coloredMaze, regionSize);
        matrixDebugInfo = matrixInfo(knownMap, robotPosition, frontier, fullMaze, coloredMaze, componentGraph, robotComponent, frontierComponent, sensorRange, sensorPositions);
        console.error(`MATRIX DEBUG INFO:\n${matrixDebugInfo}`);
      }
      
      throw new Error(`FRONTIER VALIDATION FAILED: Frontier (${frontier.row},${frontier.col}) in component ${frontier.componentId} is not reachable from robot component ${robotComponent}\n${debugInfo}\n${matrixDebugInfo}`);
    }
  }
  
  console.log(`✓ ASSERTION PASSED: All ${frontiers.length} frontiers are reachable from robot component ${robotComponent}`);
}

/**
 * Calculate shortest rotation path between two directions
 * @param {number} fromDirection - Starting direction (0-7)
 * @param {number} toDirection - Target direction (0-7)
 * @returns {number[]} - Array of intermediate directions including start and end
 */
function getRotationPath(fromDirection, toDirection) {
  if (fromDirection === toDirection) {
    return [fromDirection]; // No rotation needed
  }
  
  // Calculate clockwise and counterclockwise distances
  const clockwiseDistance = (toDirection - fromDirection + 8) % 8;
  const counterclockwiseDistance = (fromDirection - toDirection + 8) % 8;
  
  const path = [fromDirection];
  
  if (clockwiseDistance <= counterclockwiseDistance) {
    // Go clockwise
    let current = fromDirection;
    while (current !== toDirection) {
      current = (current + 1) % 8;
      path.push(current);
    }
  } else {
    // Go counterclockwise
    let current = fromDirection;
    while (current !== toDirection) {
      current = (current - 1 + 8) % 8;
      path.push(current);
    }
  }
  
  return path;
}

function matrixInfo(knownMap, robotPosition, targetFrontier, fullMaze, coloredMaze, componentGraph, robotComponent, frontierComponent, sensorRange, sensorPositions) {
  let debugInfo = '';
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
  return debugInfo;
}

/**
 * Rotate robot to new direction with sensing at each intermediate step
 * @param {number} currentDirection - Current robot direction
 * @param {number} targetDirection - Desired robot direction
 * @param {Object} robotPosition - Robot position {row, col}
 * @param {number} sensorRange - Sensor range
 * @param {Array} fullMaze - Complete maze array
 * @param {Array} knownMap - Current known map
 * @param {Object} componentGraph - Current component graph
 * @param {Array} coloredMaze - Current colored maze
 * @param {number} regionSize - Region size for components
 * @returns {Object} - {finalDirection, updatedKnownMap, updatedComponentGraph, updatedColoredMaze}
 */
function rotateWithSensing(currentDirection, targetDirection, robotPosition, sensorRange, fullMaze, knownMap, componentGraph, coloredMaze, regionSize) {
  const rotationPath = getRotationPath(currentDirection, targetDirection);
  let currentKnownMap = knownMap;
  let currentComponentGraph = componentGraph;
  let currentColoredMaze = coloredMaze;
  let allNewCells = [];
  
  // Sense at each direction during rotation (skip the first one as we already sensed there)
  for (let i = 1; i < rotationPath.length; i++) {
    const direction = rotationPath[i];
    const sensorPositions = scanWithSensors(robotPosition, sensorRange, fullMaze, direction);
    const updateResult = updateKnownMap(currentKnownMap, fullMaze, sensorPositions);
    currentKnownMap = updateResult.knownMap;
    
    // Collect new cells from this rotation step
    if (updateResult.newCells) {
      allNewCells = allNewCells.concat(updateResult.newCells);
    }
  }
  
  // ALWAYS rebuild component structure after rotation since we potentially discovered new connections
  // Get all walkable cells for complete rebuild
  const SIZE = currentKnownMap.length;
  const allWalkableCells = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (currentKnownMap[r][c] === CELL_STATES.WALKABLE) {
        allWalkableCells.push({ row: r, col: c, newState: CELL_STATES.WALKABLE });
      }
    }
  }
  
  // Force complete rebuild of component structure
  const componentUpdate = updateComponentStructure(
    currentKnownMap, {}, Array(SIZE).fill(null).map(() => Array(SIZE).fill(-1)), allWalkableCells, regionSize
  );
  currentComponentGraph = componentUpdate.componentGraph;
  currentColoredMaze = componentUpdate.coloredMaze;
  
  return {
    finalDirection: targetDirection,
    updatedKnownMap: currentKnownMap,
    updatedComponentGraph: currentComponentGraph,
    updatedColoredMaze: currentColoredMaze
  };
}

/**
 * Generate debug information for pathfinding failure analysis
 * @param {Object} robotPosition - Robot position {row, col}
 * @param {Object} targetFrontier - Target frontier {row, col}
 * @param {Array} knownMap - Current known map
 * @param {Object} componentGraph - Current component graph
 * @param {Array} coloredMaze - Current colored maze
 * @param {number} regionSize - Region size for components
 * @returns {string} - Debug information string
 */
function generatePathfindingDebugInfo(robotPosition, targetFrontier, knownMap, componentGraph, coloredMaze, regionSize) {
  const robotComponent = getComponentNodeId(robotPosition, coloredMaze, regionSize);
  const frontierComponent = getComponentNodeId({ row: targetFrontier.row, col: targetFrontier.col }, coloredMaze, regionSize);
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
  
  return debugInfo;
}

/**
 * Perform 360-degree scan from current position
 * @param {Object} robotPosition - Robot position {row, col}
 * @param {number} sensorRange - Sensor range
 * @param {Array} fullMaze - Complete maze array
 * @param {Array} knownMap - Current known map
 * @param {Object} componentGraph - Current component graph
 * @param {Array} coloredMaze - Current colored maze
 * @param {number} regionSize - Region size for components
 * @returns {Object} - {updatedKnownMap, updatedComponentGraph, updatedColoredMaze}
 */
function perform360Scan(robotPosition, sensorRange, fullMaze, knownMap, componentGraph, coloredMaze, regionSize) {
  let currentKnownMap = knownMap;
  let currentComponentGraph = componentGraph;
  let currentColoredMaze = coloredMaze;
  let allNewCells = [];
  
  // Scan all 8 directions
  for (let direction = 0; direction < 8; direction++) {
    const sensorPositions = scanWithSensors(robotPosition, sensorRange, fullMaze, direction);
    const updateResult = updateKnownMap(currentKnownMap, fullMaze, sensorPositions);
    currentKnownMap = updateResult.knownMap;
    
    // Collect new cells from this direction
    if (updateResult.newCells) {
      allNewCells = allNewCells.concat(updateResult.newCells);
    }
  }
  
  // ALWAYS rebuild component structure after 360 scan since we potentially discovered new connections
  // Get all walkable cells for complete rebuild
  const SIZE = currentKnownMap.length;
  const allWalkableCells = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (currentKnownMap[r][c] === CELL_STATES.WALKABLE) {
        allWalkableCells.push({ row: r, col: c, newState: CELL_STATES.WALKABLE });
      }
    }
  }
  
  // Force complete rebuild of component structure
  const componentUpdate = updateComponentStructure(
    currentKnownMap, {}, Array(SIZE).fill(null).map(() => Array(SIZE).fill(-1)), allWalkableCells, regionSize
  );
  currentComponentGraph = componentUpdate.componentGraph;
  currentColoredMaze = componentUpdate.coloredMaze;
  
  return {
    updatedKnownMap: currentKnownMap,
    updatedComponentGraph: currentComponentGraph,
    updatedColoredMaze: currentColoredMaze,
    newCellsCount: allNewCells.length
  };
}

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
    frontierStrategy: selectParam(['nearest', 'centroid', 'median'], 'nearest'),
    targetSwitchCooldown: numberParam(0, 20, 5, 1),
    scan360OnFrontier: selectParam(['true', 'false'], 'true')
  },
  
  async execute(input, options, onProgress) {
    const { maze: fullMaze, start: startPos, SIZE = 256 } = input;
    const { 
      sensorRange = 15,
      stepSize = 1.0,
      explorationThreshold = 100,
      useWFD = 'true',
      frontierStrategy = 'nearest',
      targetSwitchCooldown = 2,
      scan360OnFrontier = 'false',
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
    let lastTargetSwitchIteration = -targetSwitchCooldown; // Track when we last switched targets
    
    // Main exploration loop: SENSE → UPDATE → PLAN → NAVIGATE → MOVE
    while (true) {
      iterationCount++;
      
      // console.log(`=== EXPLORATION ITERATION ${iterationCount} START ===`);
      

      
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
      
      // ⚠️⚠️⚠️ UNDER NO CIRCUMSTANCES SHOULD YOU EVER EVER DISABLE THIS ASSERTION ⚠️⚠️⚠️
      // ██████████████████████████████████████████████████████████████████████████████
      // █                    CRITICAL ALGORITHMIC INVARIANT                         █
      // █                        DO NOT TOUCH THIS EVER                             █
      // ██████████████████████████████████████████████████████████████████████████████
      //
      // This assertion is the FUNDAMENTAL CORNERSTONE of the exploration algorithm's
      // correctness. It validates that the sacred contract between sensor perception
      // and navigational reality is maintained. Every frontier detected by our sensor
      // system MUST be reachable via the component graph - this is not negotiable.
      //
      // WHY THIS ASSERTION IS SACRED AND MUST NEVER BE DISABLED:
      //
      // 🔥 1. ALGORITHMIC CORRECTNESS GUARANTEE:
      //    This assertion enforces the core invariant that sensor-detected frontiers
      //    are actually reachable. Without this, the algorithm becomes fundamentally
      //    broken - it would be like a GPS that gives you directions to imaginary places.
      //
      // 🔥 2. BUG DETECTION SYSTEM:
      //    If this fails, it's catching CRITICAL bugs in:
      //    - Frontier detection seeing through walls (sensor bugs)
      //    - Component graph missing connections (graph construction bugs)
      //    - Map updates racing with graph updates (concurrency bugs)
      //    - Sensor scanning detecting unreachable areas (perception bugs)
      //
      // 🔥 3. INFINITE LOOP PREVENTION:
      //    Disabling this would allow the robot to target unreachable frontiers,
      //    causing pathfinding to fail repeatedly, leading to infinite loops where
      //    the robot eternally attempts impossible navigation tasks.
      //
      // 🔥 4. EXPLORATION ALGORITHM INTEGRITY:
      //    The entire Dynamic HPA* for Unknown Environments approach depends on
      //    this invariant. Breaking it would invalidate the theoretical foundations
      //    of the algorithm and render the component-based exploration meaningless.
      //
      // 🔥 5. DEBUGGING AND MAINTAINABILITY:
      //    This assertion provides immediate, clear feedback when something goes wrong.
      //    Removing it would make bugs silent and nearly impossible to track down.
      //
      // IF YOU'RE TEMPTED TO DISABLE THIS:
      // - You're probably seeing a real bug that needs fixing
      // - The frontier detection or component graph has a serious issue
      // - DO NOT disable - fix the underlying bug instead
      // - This assertion failing means the algorithm is fundamentally broken
      //
      // REMEMBER: With 8-directional movement and line-of-sight sensors,
      // if we can see a frontier, we MUST be able to reach it. This assertion
      // enforces that mathematical reality.
      // ASSERTION: Validate all frontiers are reachable (initial detection)
      if (frontiers.length > 0) {
        validateAllFrontiersReachable(frontiers, robotPosition, componentGraph, coloredMaze, REGION_SIZE, knownMap, fullMaze, sensorRange, sensorPositions);
      }
      
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
      
      // LOOK AHEAD: If we have a current target, rotate toward it and sense to get complete information
      if (currentTarget) {
        // Calculate direction toward current target
        const deltaRow = currentTarget.row - robotPosition.row;
        const deltaCol = currentTarget.col - robotPosition.col;
        
        let lookAheadDirection = robotDirection;
        if (Math.abs(deltaRow) > Math.abs(deltaCol)) {
          // Primarily vertical movement
          lookAheadDirection = deltaRow < 0 ? DIRECTIONS.NORTH : DIRECTIONS.SOUTH;
        } else if (Math.abs(deltaCol) > Math.abs(deltaRow)) {
          // Primarily horizontal movement  
          lookAheadDirection = deltaCol > 0 ? DIRECTIONS.EAST : DIRECTIONS.WEST;
        } else if (deltaRow !== 0 && deltaCol !== 0) {
          // Diagonal movement
          if (deltaRow < 0 && deltaCol > 0) {
            lookAheadDirection = DIRECTIONS.NORTHEAST;
          } else if (deltaRow > 0 && deltaCol > 0) {
            lookAheadDirection = DIRECTIONS.SOUTHEAST;
          } else if (deltaRow > 0 && deltaCol < 0) {
            lookAheadDirection = DIRECTIONS.SOUTHWEST;
          } else if (deltaRow < 0 && deltaCol < 0) {
            lookAheadDirection = DIRECTIONS.NORTHWEST;
          }
        }
        
        // Rotate toward target direction and sense to get complete information
        if (robotDirection !== lookAheadDirection) {
          const rotationResult = rotateWithSensing(
            robotDirection, 
            lookAheadDirection, 
            robotPosition, 
            sensorRange, 
            fullMaze, 
            knownMap, 
            componentGraph, 
            coloredMaze, 
            REGION_SIZE
          );
          robotDirection = rotationResult.finalDirection;
          knownMap = rotationResult.updatedKnownMap;
          componentGraph = rotationResult.updatedComponentGraph;
          coloredMaze = rotationResult.updatedColoredMaze;
          
          // Re-detect frontiers with updated information
          const updatedFrontiers = detectComponentAwareFrontiers(
            knownMap, 
            componentGraph,
            coloredMaze,
            useWFD === 'true', 
            frontierStrategy,
            robotPosition
          );
          
          // ⚠️⚠️⚠️ UNDER NO CIRCUMSTANCES SHOULD YOU EVER EVER DISABLE THIS ASSERTION ⚠️⚠️⚠️
          // ████████████████████████████████████████████████████████████████████████████
          // █              POST-LOOKAHEAD FRONTIER VALIDATION CHECKPOINT              █
          // █                    ABSOLUTELY MISSION CRITICAL                          █
          // ████████████████████████████████████████████████████████████████████████████
          //
          // This assertion is the GUARDIAN OF ALGORITHMIC INTEGRITY after look-ahead!
          // The robot has just performed complex sensor rotation and map updates,
          // potentially altering the very fabric of the known world. This validation
          // ensures that the frontiers we're about to use are still valid in this
          // newly updated reality.
          //
          // WHY THIS POST-LOOKAHEAD VALIDATION IS ABSOLUTELY CRITICAL:
          //
          // 🚨 1. STATE CONSISTENCY VALIDATION:
          //    Look-ahead rotation can dramatically change the known map and component
          //    structure. This assertion ensures that our frontier list hasn't become
          //    inconsistent with the updated world model. It's like checking that
          //    your map is still accurate after discovering new territory.
          //
          // 🚨 2. COMPONENT GRAPH INTEGRITY AFTER UPDATES:
          //    The component graph undergoes complex updates during look-ahead.
          //    Connections might be added, modified, or restructured. This assertion
          //    verifies that these updates didn't break the reachability of our
          //    previously detected frontiers.
          //
          // 🚨 3. RACE CONDITION DETECTION:
          //    Map updates and component graph updates could potentially race.
          //    This assertion catches inconsistent states where the map says one
          //    thing but the component graph says another.
          //
          // 🚨 4. FRONTIER FILTERING VALIDATION:
          //    The frontier update process might have bugs in filtering or merging
          //    frontier lists. This assertion ensures no unreachable frontiers
          //    survived the update process.
          //
          // 🚨 5. PRE-TARGET-SELECTION SAFETY:
          //    We're about to select a target from these frontiers! If any are
          //    unreachable, the robot will commit to an impossible goal and fail.
          //    This is the last safety check before that critical decision.
          //
          // DISABLING THIS WOULD BE CATASTROPHIC:
          // - Silent algorithmic failures
          // - Robot targeting impossible locations
          // - Pathfinding system breakdown
          // - Infinite exploration loops
          // - Complete loss of exploration effectiveness
          //
          // THIS ASSERTION IS YOUR LIFELINE - NEVER REMOVE IT!
          // ASSERTION: Validate all updated frontiers are reachable (after look-ahead rotation)
          if (updatedFrontiers.length > 0) {
            validateAllFrontiersReachable(updatedFrontiers, robotPosition, componentGraph, coloredMaze, REGION_SIZE, knownMap, fullMaze, sensorRange, sensorPositions);
          }
          
          frontiers.splice(0, frontiers.length, ...updatedFrontiers);
        }
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
        console.log(`TARGET SELECTION: Need new target. Robot at (${robotPosition.row},${robotPosition.col}), old target was ${currentTarget ? `(${currentTarget.row},${currentTarget.col})` : 'null'}`);
        console.log(`TARGET SELECTION: ${frontiers.length} frontiers available before selection`);
        
        // ⚠️⚠️⚠️ UNDER NO CIRCUMSTANCES SHOULD YOU EVER EVER DISABLE THIS ASSERTION ⚠️⚠️⚠️
        // ████████████████████████████████████████████████████████████████████████████
        // █                        🛡️ FINAL GUARDIAN 🛡️                            █
        // █                   THE LAST LINE OF DEFENSE                              █
        // █                 ULTIMATE FRONTIER VALIDATION                            █
        // █                      POINT OF NO RETURN                                █
        // ████████████████████████████████████████████████████████████████████████████
        //
        // 🔥🔥🔥 THIS IS THE MOST CRITICAL ASSERTION IN THE ENTIRE CODEBASE! 🔥🔥🔥
        //
        // You are now standing at the PRECIPICE of target selection. The robot is
        // milliseconds away from committing to a frontier target and beginning
        // pathfinding. This assertion is the FINAL CHECKPOINT before that
        // irreversible decision. If you disable this, you are DOOMING the robot
        // to potential failure!
        //
        // WHY THIS IS THE ABSOLUTE MOST IMPORTANT ASSERTION EVER:
        //
        // 💀 1. POINT OF NO RETURN:
        //    After this point, the robot COMMITS to a target. If it's unreachable,
        //    the robot enters a failure state that could cascade through the entire
        //    exploration system. This is literally the last chance to catch bugs!
        //
        // 💀 2. PATHFINDING SYSTEM PROTECTION:
        //    The pathfinding system trusts that targets are reachable. Giving it
        //    an impossible target is like asking a GPS to navigate to the moon.
        //    The pathfinding will fail, retry, fail again, potentially forever.
        //
        // 💀 3. EXPLORATION ALGORITHM DEATH PREVENTION:
        //    If the robot can't reach its target, the exploration algorithm enters
        //    undefined behavior. It might:
        //    - Get stuck in infinite loops
        //    - Repeatedly try the same impossible target
        //    - Corrupt its internal state
        //    - Completely halt exploration
        //
        // 💀 4. COMPONENT GRAPH FINAL VALIDATION:
        //    This is the ULTIMATE test of whether our component graph accurately
        //    represents the maze connectivity. If this fails, the entire Dynamic
        //    HPA* approach is fundamentally broken.
        //
        // 💀 5. FRONTIER PIPELINE INTEGRITY GUARANTEE:
        //    This validates the ENTIRE frontier detection and management pipeline:
        //    - Sensor scanning worked correctly
        //    - Frontier detection found real frontiers
        //    - Component assignment worked
        //    - Graph updates maintained consistency
        //    - Frontier filtering preserved reachability
        //
        // 💀 6. ALGORITHMIC CORRECTNESS FINAL PROOF:
        //    This assertion is mathematical proof that the algorithm is working.
        //    Every frontier here MUST be reachable because we detected them with
        //    line-of-sight sensors and 8-directional movement. This is the
        //    fundamental theorem of the exploration algorithm!
        //
        // IF YOU EVEN THINK ABOUT DISABLING THIS:
        // 🚫 You're about to destroy the algorithm's correctness guarantees
        // 🚫 You're masking critical bugs that MUST be fixed
        // 🚫 You're setting up the robot for inevitable failure
        // 🚫 You're violating the mathematical foundations of the algorithm
        // 🚫 You're potentially creating infinite loops and system crashes
        //
        // INSTEAD OF DISABLING:
        // ✅ Fix the frontier detection bug
        // ✅ Fix the component graph construction bug
        // ✅ Fix the sensor scanning bug
        // ✅ Fix the map update race condition
        // ✅ Understand WHY this is failing and address the root cause
        //
        // REMEMBER: This assertion failing means something is FUNDAMENTALLY WRONG.
        // The robot should be able to reach any frontier it can see. If it can't,
        // the bug is in YOUR CODE, not in this assertion!
        //
        // 🛡️ THIS ASSERTION IS THE SACRED GUARDIAN OF EXPLORATION CORRECTNESS 🛡️
        // 🛡️ IT STANDS BETWEEN ORDER AND CHAOS 🛡️
        // 🛡️ IT MUST NEVER FALL 🛡️
        // ASSERTION: Validate all frontiers are reachable before target selection
        if (frontiers.length > 0) {
          validateAllFrontiersReachable(frontiers, robotPosition, componentGraph, coloredMaze, REGION_SIZE, knownMap, fullMaze, sensorRange, sensorPositions);
        }
        
        targetFrontier = selectOptimalFrontier(frontiers, robotPosition, componentGraph, coloredMaze, prevTargets);
        currentTarget = targetFrontier; // Update current target
        lastTargetSwitchIteration = iterationCount; // Record target switch
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
          
          // Generate pathfinding debug info for the first frontier if available
          if (frontiers.length > 0) {
            const pathfindingDebugInfo = generatePathfindingDebugInfo(robotPosition, frontiers[0], knownMap, componentGraph, coloredMaze, REGION_SIZE);
            debugOutput += `\n\n=== PATHFINDING DEBUG INFO FOR FIRST FRONTIER ===\n${pathfindingDebugInfo}`;
          }
          
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
      
      // SAFETY CHECK: Verify target is reachable before pathfinding
      const robotComponent = getComponentNodeId(robotPosition, coloredMaze, REGION_SIZE);
      const targetComponent = getComponentNodeId({ row: targetFrontier.row, col: targetFrontier.col }, coloredMaze, REGION_SIZE);
      const isTargetReachable = isComponentReachable(robotComponent, targetComponent, componentGraph);
      
      console.log(`PATHFINDING: Robot (${robotPosition.row},${robotPosition.col}) component ${robotComponent} → Target (${targetFrontier.row},${targetFrontier.col}) component ${targetComponent}, reachable: ${isTargetReachable}`);
      
      if (!isTargetReachable) {
        console.log(`ERROR: Target frontier (${targetFrontier.row},${targetFrontier.col}) in component ${targetComponent} is not reachable from robot component ${robotComponent}`);
        console.log(`ERROR: This should have been filtered out during frontier selection!`);
        console.log(`ERROR: Component graph keys: ${Object.keys(componentGraph)}`);
        console.log(`ERROR: Robot component exists: ${!!componentGraph[robotComponent]}`);
        console.log(`ERROR: Target component exists: ${!!componentGraph[targetComponent]}`);
        
        // AGGRESSIVE FIX: Force complete component graph rebuild
        console.log(`FIXING: Forcing complete component structure rebuild...`);
        
        // Get all walkable cells for complete rebuild
        const allWalkableCells = [];
        for (let r = 0; r < SIZE; r++) {
          for (let c = 0; c < SIZE; c++) {
            if (knownMap[r][c] === CELL_STATES.WALKABLE) {
              allWalkableCells.push({ row: r, col: c, newState: CELL_STATES.WALKABLE });
            }
          }
        }
        
        // Force complete rebuild of component structure
        const rebuiltUpdate = updateComponentStructure(
          knownMap, {}, Array(SIZE).fill(null).map(() => Array(SIZE).fill(-1)), allWalkableCells, REGION_SIZE
        );
        componentGraph = rebuiltUpdate.componentGraph;
        coloredMaze = rebuiltUpdate.coloredMaze;
        
        console.log(`FIXING: Rebuilt component graph with ${Object.keys(componentGraph).length} components`);
        
        // Force frontier re-detection with rebuilt components
        const correctedFrontiers = detectComponentAwareFrontiers(
          knownMap, 
          componentGraph,
          coloredMaze,
          useWFD === 'true', 
          frontierStrategy,
          robotPosition
        );
        console.log(`FIXING: Re-detected ${correctedFrontiers.length} frontiers with rebuilt component graph`);
        
        // Clear current target to force new selection
        currentTarget = null;
        
        // Skip this iteration and let frontier selection happen again with clean state
        continue;
      }
      
      let pathResult = findComponentPath(
        robotPosition, 
        { row: targetFrontier.row, col: targetFrontier.col },
        knownMap,
        componentGraph,
        coloredMaze,
        REGION_SIZE
      );
      
      // console.log(`Pathfinding result: ${pathResult?.path ? `${pathResult.path.length} steps` : 'null'}`);
      
      // Check if we should abandon current target (if pathfinding succeeded and not in cooldown)
      const canSwitchTarget = (iterationCount - lastTargetSwitchIteration) >= targetSwitchCooldown;
      
      if (pathResult?.path && pathResult.path.length > 0 && canSwitchTarget) {
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
          lastTargetSwitchIteration = iterationCount; // Record when we switched
          
          console.log(`TARGET SWITCH: Switched to (${targetFrontier.row},${targetFrontier.col}) at iteration ${iterationCount}`);
          
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
        const frontierComponent = getComponentNodeId({ row: targetFrontier.row, col: targetFrontier.col }, coloredMaze, REGION_SIZE);
        let debugInfo = generatePathfindingDebugInfo(robotPosition, targetFrontier, knownMap, componentGraph, coloredMaze, REGION_SIZE);
        
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
        let matrix_info = matrixInfo(knownMap, robotPosition, targetFrontier, fullMaze, coloredMaze, componentGraph, robotComponent, frontierComponent, sensorRange, sensorPositions);
        debugInfo += `\n${matrix_info}\n`;
        
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
        console.log(`FRONTIER REACHED: Robot at (${robotPosition.row},${robotPosition.col}) has reached frontier target (${targetFrontier.row},${targetFrontier.col})`);
        
        // Perform 360-degree scan if enabled
        if (scan360OnFrontier === 'true') {
          console.log(`Performing 360-degree scan at frontier position...`);
          const scanResult = perform360Scan(
            robotPosition, 
            sensorRange, 
            fullMaze, 
            knownMap, 
            componentGraph, 
            coloredMaze, 
            REGION_SIZE
          );
          knownMap = scanResult.updatedKnownMap;
          componentGraph = scanResult.updatedComponentGraph;
          coloredMaze = scanResult.updatedColoredMaze;
          
          console.log(`360-degree scan complete: discovered ${scanResult.newCellsCount} new cells`);
        }
        
        // Robot has reached the frontier, continue to next iteration to select new target
        continue;
      }
      
      if (targetIndex > 0) {
        const newPosition = { row: pathResult.path[targetIndex].row, col: pathResult.path[targetIndex].col };
        
        // Update robot direction based on movement
        const deltaRow = newPosition.row - robotPosition.row;
        const deltaCol = newPosition.col - robotPosition.col;
        
        // Determine target direction based on movement
        let targetDirection = robotDirection; // Default: keep current direction
        
        // Handle diagonal movements
        if (deltaRow !== 0 && deltaCol !== 0) {
          if (deltaRow < 0 && deltaCol > 0) {
            targetDirection = DIRECTIONS.NORTHEAST;
          } else if (deltaRow > 0 && deltaCol > 0) {
            targetDirection = DIRECTIONS.SOUTHEAST;
          } else if (deltaRow > 0 && deltaCol < 0) {
            targetDirection = DIRECTIONS.SOUTHWEST;
          } else if (deltaRow < 0 && deltaCol < 0) {
            targetDirection = DIRECTIONS.NORTHWEST;
          }
        } else if (deltaRow !== 0) {
          // Pure vertical movement
          targetDirection = deltaRow < 0 ? DIRECTIONS.NORTH : DIRECTIONS.SOUTH;
        } else if (deltaCol !== 0) {
          // Pure horizontal movement
          targetDirection = deltaCol > 0 ? DIRECTIONS.EAST : DIRECTIONS.WEST;
        }
        
        // Move to new position first
        robotPosition = newPosition;
        
        // Then rotate to target direction with sensing at intermediate steps
        // This happens after movement so the updated data is ready for next iteration
        if (robotDirection !== targetDirection) {
          const rotationResult = rotateWithSensing(
            robotDirection, 
            targetDirection, 
            robotPosition, 
            sensorRange, 
            fullMaze, 
            knownMap, 
            componentGraph, 
            coloredMaze, 
            REGION_SIZE
          );
          robotDirection = rotationResult.finalDirection;
          knownMap = rotationResult.updatedKnownMap;
          componentGraph = rotationResult.updatedComponentGraph;
          coloredMaze = rotationResult.updatedColoredMaze;
        }
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