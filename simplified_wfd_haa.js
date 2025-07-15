#!/usr/bin/env node

// --- Imports ---
import { scanWithSensors } from './src/core/utils/sensor-utils.js';
import { updateKnownMap, CELL_STATES } from './src/core/utils/map-utils.js';
import { WavefrontFrontierDetection } from './src/core/frontier/WavefrontFrontierDetection.js';
import { updateComponentStructure } from './src/algorithms/exploration/component-structure.js';
import { getComponentNodeId } from './src/algorithms/pathfinding/component-based-haa-star.js';
import { findComponentPath } from './src/algorithms/exploration/pathfinding-utils.js';
import { DEFAULT_REGION_SIZE } from './src/core/constants.js';

// --- Command Line Arguments ---
const args = process.argv.slice(2);
const VERBOSE = args.includes('--verbose') || args.includes('-v');

if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: node simplified_wfd_haa_fixed.js [options]');
    console.log('Options:');
    console.log('  --verbose, -v    Enable verbose mode (show maze visualization)');
    console.log('  --help, -h       Show this help message');
    process.exit(0);
}

// --- Constants ---
const MAZE_SIZE = 41; // Must be an odd number for Kruskal's generation
const SENSOR_RANGE = 15; // Extended sensor range like React implementation
const EXPLORATION_DELAY_MS = 100; // Milliseconds between robot moves for visualization

// Use the proven CELL_STATES from core utilities
const CELL_TYPES = {
    WALL: CELL_STATES.WALL,
    PATH: CELL_STATES.WALKABLE,
};

// Simplified exploration states for visualization only
const EXPLORATION_STATE = {
    EXPLORED: 'explored',
    FRONTIER: 'frontier',
    CURRENT_PATH: 'current-path',
    ROBOT: 'robot',
};

// --- Helper Data Structures ---

class ExplorationHistory {
    constructor() {
        this.abandonedFrontiers = new Set(); // Stores frontier position keys
        this.currentTargetId = null; // Stores frontier position key
    }

    recordSelection(frontier) {
        this.currentTargetId = frontier ? `${frontier.row}-${frontier.col}` : null;
    }

    recordAbandonment(frontier) {
        if (frontier) {
            this.abandonedFrontiers.add(`${frontier.row}-${frontier.col}`);
        }
        this.currentTargetId = null;
    }

    recentlyAbandoned(frontier) {
        return frontier && this.abandonedFrontiers.has(`${frontier.row}-${frontier.col}`);
    }

    isCurrentTarget(frontier) {
        return frontier && this.currentTargetId === `${frontier.row}-${frontier.col}`;
    }

    reset() {
        this.abandonedFrontiers.clear();
        this.currentTargetId = null;
    }
}

class UnionFind {
    constructor(size) {
        this.parent = new Array(size);
        for (let i = 0; i < size; i++) {
            this.parent[i] = i;
        }
        this.numSets = size;
    }

    find(i) {
        if (this.parent[i] === i) {
            return i;
        }
        this.parent[i] = this.find(this.parent[i]);
        return this.parent[i];
    }

    union(i, j) {
        const rootI = this.find(i);
        const rootJ = this.find(j);
        if (rootI !== rootJ) {
            this.parent[rootI] = rootJ;
            this.numSets--;
            return true;
        }
        return false;
    }
}

// ASCII Rendering Functions
function renderMazeASCII(knownMap, explorationMap, robotPosition, pathBeingExecuted, currentFrontierTarget) {
    if (!knownMap || knownMap.length === 0) {
        return "Loading maze...";
    }

    let output = '';

    for (let r = 0; r < MAZE_SIZE; r++) {
        let line = '';
        for (let c = 0; c < MAZE_SIZE; c++) {
            let char = getASCIIChar(knownMap, explorationMap, r, c, robotPosition, pathBeingExecuted, currentFrontierTarget);
            line += char;
        }
        output += line + '\n';
    }

    return output;
}

function getASCIIChar(knownMap, explorationMap, r, c, robotPosition, pathBeingExecuted, currentFrontierTarget) {
    // Check robot position first
    if (robotPosition && robotPosition.row === r && robotPosition.col === c) {
        return '@';
    }

    // Check if it's part of the path being executed
    if (pathBeingExecuted && pathBeingExecuted.some(p => p.row === r && p.col === c)) {
        return '*';
    }

    // Check if it's a frontier target
    if (currentFrontierTarget && currentFrontierTarget.row === r && currentFrontierTarget.col === c) {
        return '!';
    }

    // Base on known map state
    const cellState = knownMap[r][c];
    const explorationState = explorationMap[r][c];

    switch (cellState) {
        case CELL_STATES.WALL:
            return '█'; // Walls
        case CELL_STATES.WALKABLE:
            switch (explorationState) {
                case EXPLORATION_STATE.EXPLORED:
                    return ' '; // Visited walkable cell
                case EXPLORATION_STATE.FRONTIER:
                    return '?'; // Frontier cell
                default:
                    return '░'; // Known walkable but not visited
            }
        case CELL_STATES.UNKNOWN:
        default:
            return '█'; // Unknown areas appear as walls
    }
}

function clearScreen() {
    // Clear screen and move cursor to top-left
    process.stdout.write('\x1B[2J\x1B[0f');
}

function printMaze(knownMap, explorationMap, robotPosition, pathBeingExecuted, currentFrontierTarget) {
    clearScreen();
    console.log('WFD+HAA* Maze Exploration with Sensor-Based Discovery');
    console.log('Legend: █=Wall/Unknown, ░=Known Walkable,  =Explored, ?=Frontier, @=Robot, *=Current Path, !=Target');
    console.log('=' + '='.repeat(MAZE_SIZE));
    console.log(renderMazeASCII(knownMap, explorationMap, robotPosition, pathBeingExecuted, currentFrontierTarget));
}

// Main Maze Explorer Class
class MazeExplorer {
    constructor() {
        // Core state using proven utilities
        this.fullMaze = []; // Ground truth maze for sensor scanning
        this.knownMap = []; // What robot has discovered (using CELL_STATES)
        this.explorationMap = []; // Visualization states (explored, frontier, etc.)
        this.componentGraph = {}; // Component connectivity graph  
        this.coloredMaze = []; // Component assignments
        
        // Robot state
        this.robotPosition = null;
        this.robotDirection = 0; // 0=North, 1=NE, 2=East, etc.
        
        // Exploration state
        this.explorationHistory = new ExplorationHistory();
        this.pathBeingExecuted = [];
        this.currentFrontierTarget = null;
        this.frontiers = [];
        this.logMessages = [];
        
        // Utilities
        this.wfdDetector = new WavefrontFrontierDetection(MAZE_SIZE, MAZE_SIZE);
    }

    // --- Utility Functions ---
    addLog(...messages) {
        const message = messages.join(' ');
        this.logMessages.push(message);
        console.log(message);
    }

    getKey(row, col) {
        return `${row}-${col}`;
    }

    parseKey(key) {
        const [row, col] = key.split('-').map(Number);
        return { row, col };
    }

    isValidCell(r, c) {
        return r >= 0 && r < MAZE_SIZE && c >= 0 && c < MAZE_SIZE;
    }

    getNeighbors4(r, c) {
        const neighbors = [];
        if (r > 0) neighbors.push({ row: r - 1, col: c });
        if (r < MAZE_SIZE - 1) neighbors.push({ row: r + 1, col: c });
        if (c > 0) neighbors.push({ row: r, col: c - 1 });
        if (c < MAZE_SIZE - 1) neighbors.push({ row: r, col: c + 1 });
        return neighbors;
    }

    // --- Maze Generation ---
    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    generateKruskalMaze() {
        // Generate ground truth maze using CELL_STATES
        this.fullMaze = Array(MAZE_SIZE).fill(null).map(() =>
            Array(MAZE_SIZE).fill(CELL_STATES.WALL)
        );

        // Initialize known map (everything unknown initially)
        this.knownMap = Array(MAZE_SIZE).fill(null).map(() =>
            Array(MAZE_SIZE).fill(CELL_STATES.UNKNOWN)
        );

        // Initialize exploration map for visualization
        this.explorationMap = Array(MAZE_SIZE).fill(null).map(() =>
            Array(MAZE_SIZE).fill(null)
        );

        // Initialize colored maze for components
        this.coloredMaze = Array(MAZE_SIZE).fill(null).map(() =>
            Array(MAZE_SIZE).fill(-1)
        );

        const numRooms = Math.floor(MAZE_SIZE / 2);
        const uf = new UnionFind(numRooms * numRooms);

        // Initialize "room" cells as paths in ground truth
        for (let r = 0; r < numRooms; r++) {
            for (let c = 0; c < numRooms; c++) {
                const mazeR = r * 2 + 1;
                const mazeC = c * 2 + 1;
                this.fullMaze[mazeR][mazeC] = CELL_STATES.WALKABLE;
            }
        }

        // Generate edges (walls between rooms)
        const edges = [];
        for (let r = 0; r < numRooms; r++) {
            for (let c = 0; c < numRooms; c++) {
                const currentIdx = r * numRooms + c;
                if (r + 1 < numRooms) {
                    edges.push({
                        cell1Idx: currentIdx,
                        cell2Idx: (r + 1) * numRooms + c,
                        wallR: (r * 2) + 2,
                        wallC: (c * 2) + 1
                    });
                }
                if (c + 1 < numRooms) {
                    edges.push({
                        cell1Idx: currentIdx,
                        cell2Idx: r * numRooms + (c + 1),
                        wallR: (r * 2) + 1,
                        wallC: (c * 2) + 2
                    });
                }
            }
        }

        this.shuffle(edges);

        // Kruskal's algorithm to carve paths
        for (const edge of edges) {
            if (uf.union(edge.cell1Idx, edge.cell2Idx)) {
                if (this.isValidCell(edge.wallR, edge.wallC)) {
                    this.fullMaze[edge.wallR][edge.wallC] = CELL_STATES.WALKABLE;
                }
            }
        }

        // Create entrance and exit
        if (this.isValidCell(1, 0)) {
            this.fullMaze[1][0] = CELL_STATES.WALKABLE;
        }
        if (this.isValidCell(MAZE_SIZE - 2, MAZE_SIZE - 1)) {
            this.fullMaze[MAZE_SIZE - 2][MAZE_SIZE - 1] = CELL_STATES.WALKABLE;
        }

        this.addLog("Maze generated.");
    }

    // --- Sensor-based Exploration ---
    performSensorScan() {
        // Use the proven sensor scanning from core utilities
        const sensorPositions = scanWithSensors(
            this.robotPosition,
            SENSOR_RANGE,
            this.fullMaze,
            this.robotDirection
        );

        // Update known map with sensor readings
        const updateResult = updateKnownMap(this.knownMap, this.fullMaze, sensorPositions);
        this.knownMap = updateResult.knownMap;

        // Update component structure if new cells were discovered
        if (updateResult.newCells.length > 0) {
            const componentUpdate = updateComponentStructure(
                this.knownMap,
                this.componentGraph,
                this.coloredMaze,
                updateResult.newCells,
                DEFAULT_REGION_SIZE
            );
            this.componentGraph = componentUpdate.componentGraph;
            this.coloredMaze = componentUpdate.coloredMaze;
            
            this.addLog(`Sensor scan discovered ${updateResult.newCells.length} new cells`);
        }

        return updateResult.newCells;
    }

    // --- Frontier Detection using WFD ---
    updateFrontierSystem() {
        this.addLog("Updating frontier system with WFD...");
        
        // Clear exploration map
        for (let r = 0; r < MAZE_SIZE; r++) {
            for (let c = 0; c < MAZE_SIZE; c++) {
                if (this.explorationMap[r][c] === EXPLORATION_STATE.FRONTIER) {
                    this.explorationMap[r][c] = null;
                }
            }
        }

        // Convert 2D knownMap to flat array for WFD
        const flatKnownMap = new Uint8Array(MAZE_SIZE * MAZE_SIZE);
        for (let r = 0; r < MAZE_SIZE; r++) {
            for (let c = 0; c < MAZE_SIZE; c++) {
                flatKnownMap[r * MAZE_SIZE + c] = this.knownMap[r][c];
            }
        }

        // Use WFD to find frontier groups
        const frontierGroups = this.wfdDetector.detectFrontiers(flatKnownMap);
        
        // Convert frontier groups to our format
        this.frontiers = [];
        for (const group of frontierGroups) {
            const targetPoint = {
                row: Math.floor(group.centroid.y),
                col: Math.floor(group.centroid.x)
            };
            
            // Skip frontiers too close to robot
            if (this.robotPosition) {
                const distance = Math.abs(targetPoint.row - this.robotPosition.row) + 
                               Math.abs(targetPoint.col - this.robotPosition.col);
                if (distance <= 1.5) continue;
            }
            
            // Find associated component
            const componentId = getComponentNodeId(targetPoint, this.coloredMaze, DEFAULT_REGION_SIZE);
            
            this.frontiers.push({
                row: targetPoint.row,
                col: targetPoint.col,
                componentId: componentId,
                groupSize: group.size || 1
            });
            
            // Mark in exploration map for visualization
            this.explorationMap[targetPoint.row][targetPoint.col] = EXPLORATION_STATE.FRONTIER;
        }
        
        this.addLog(`Found ${this.frontiers.length} frontier groups`);
        return this.frontiers;
    }

    // --- Target Selection and Pathfinding ---
    selectOptimalFrontier() {
        this.addLog("Selecting optimal frontier...");
        
        const frontiers = this.updateFrontierSystem();
        if (frontiers.length === 0) {
            this.addLog("No frontiers found");
            return null;
        }
        
        // Get robot's component
        const robotComponent = getComponentNodeId(this.robotPosition, this.coloredMaze, DEFAULT_REGION_SIZE);
        if (!robotComponent) {
            this.addLog("Robot not in any component");
            return null;
        }
        
        // Filter reachable frontiers and calculate path distances
        const reachableFrontiers = [];
        for (const frontier of frontiers) {
            if (!frontier.componentId) continue;
            
            // Check if component is reachable
            if (this.isComponentReachable(robotComponent, frontier.componentId)) {
                // Calculate actual path distance
                const pathResult = findComponentPath(
                    this.robotPosition,
                    { row: frontier.row, col: frontier.col },
                    this.knownMap,
                    this.componentGraph,
                    this.coloredMaze,
                    DEFAULT_REGION_SIZE
                );
                
                if (pathResult?.path) {
                    reachableFrontiers.push({
                        ...frontier,
                        pathDistance: pathResult.path.length,
                        path: pathResult.path
                    });
                }
            }
        }
        
        if (reachableFrontiers.length === 0) {
            this.addLog("No reachable frontiers found");
            return null;
        }
        
        // Select closest frontier (by path distance)
        const selectedFrontier = reachableFrontiers.reduce((closest, current) => 
            current.pathDistance < closest.pathDistance ? current : closest
        );
        
        this.addLog(`Selected frontier at (${selectedFrontier.row}, ${selectedFrontier.col}) with path distance ${selectedFrontier.pathDistance}`);
        return selectedFrontier;
    }
    
    // Simple component reachability check
    isComponentReachable(fromComponent, toComponent) {
        if (!fromComponent || !toComponent || fromComponent === toComponent) {
            return fromComponent === toComponent;
        }
        
        const visited = new Set();
        const queue = [fromComponent];
        visited.add(fromComponent);
        
        while (queue.length > 0) {
            const current = queue.shift();
            
            if (current === toComponent) {
                return true;
            }
            
            const node = this.componentGraph[current];
            if (node && node.neighbors) {
                for (const neighbor of node.neighbors) {
                    if (!visited.has(neighbor)) {
                        visited.add(neighbor);
                        queue.push(neighbor);
                    }
                }
            }
        }
        
        return false;
    }

    // --- Robot Movement ---
    async executePathToTarget(target) {
        if (!target || !target.path) {
            this.addLog("No valid path to target");
            return false;
        }
        
        this.pathBeingExecuted = [...target.path];
        this.currentFrontierTarget = target;
        
        // Move along the path
        for (let i = 0; i < target.path.length; i++) {
            const nextPosition = target.path[i];
            
            // Update robot position
            this.robotPosition = { row: nextPosition.row, col: nextPosition.col };
            
            // Mark current position as explored
            this.explorationMap[nextPosition.row][nextPosition.col] = EXPLORATION_STATE.EXPLORED;
            
            // Perform sensor scan from new position
            this.performSensorScan();
            
            // Update remaining path for visualization
            this.pathBeingExecuted = target.path.slice(i + 1);
            
            // Render current state
            if (VERBOSE) {
                printMaze(this.knownMap, this.explorationMap, this.robotPosition, this.pathBeingExecuted, this.currentFrontierTarget);
                await new Promise(resolve => setTimeout(resolve, EXPLORATION_DELAY_MS));
            }
        }
        
        this.pathBeingExecuted = [];
        this.currentFrontierTarget = null;
        
        this.addLog(`Reached target at (${target.row}, ${target.col})`);
        return true;
    }
    
    // Calculate exploration coverage
    calculateCoverage() {
        let knownCells = 0;
        let totalCells = 0;
        
        for (let r = 0; r < MAZE_SIZE; r++) {
            for (let c = 0; c < MAZE_SIZE; c++) {
                if (this.fullMaze[r][c] === CELL_STATES.WALKABLE) {
                    totalCells++;
                    if (this.knownMap[r][c] === CELL_STATES.WALKABLE) {
                        knownCells++;
                    }
                }
            }
        }
        
        return totalCells > 0 ? (knownCells / totalCells) * 100 : 0;
    }

    // --- Main Exploration Algorithm ---
    async run() {
        this.addLog("Initializing WFD+HAA* maze explorer...");
        
        // 1. Generate maze
        this.generateKruskalMaze();
        
        // 2. Set initial robot position
        this.robotPosition = { row: 1, col: 1 };
        this.robotDirection = 0; // North
        
        // 3. Initial sensor scan and component structure
        this.performSensorScan();
        this.explorationMap[this.robotPosition.row][this.robotPosition.col] = EXPLORATION_STATE.EXPLORED;
        
        // Initial rendering
        if (VERBOSE) {
            printMaze(this.knownMap, this.explorationMap, this.robotPosition, [], null);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        this.addLog("Starting exploration loop...");
        
        let iterationCount = 0;
        const maxIterations = 1000; // Safety limit
        
        // Main exploration loop
        while (iterationCount < maxIterations) {
            iterationCount++;
            
            // Check coverage
            const coverage = this.calculateCoverage();
            if (coverage >= 95) { // 95% coverage threshold
                this.addLog(`Exploration complete! Coverage: ${coverage.toFixed(1)}%`);
                break;
            }
            
            // Find next target
            const target = this.selectOptimalFrontier();
            if (!target) {
                this.addLog("No more reachable frontiers. Exploration complete!");
                break;
            }
            
            // Execute path to target
            await this.executePathToTarget(target);
            
            // Small delay between iterations
            if (VERBOSE) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        
        // Final rendering
        if (VERBOSE) {
            printMaze(this.knownMap, this.explorationMap, this.robotPosition, [], null);
        }
        
        const finalCoverage = this.calculateCoverage();
        this.addLog(`Exploration finished after ${iterationCount} iterations`);
        this.addLog(`Final coverage: ${finalCoverage.toFixed(1)}%`);
        
        return true;
    }
}

// Main execution
async function main() {
    const explorer = new MazeExplorer();
    await explorer.run();
}

// Run the program
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}