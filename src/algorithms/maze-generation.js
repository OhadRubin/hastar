import { UnionFind } from '../utils/utilities.js';
import { findConnectedComponents } from './pathfinding.js';
import { buildComponentGraph } from './component-based-pathfinding.js';

const buildRegionGraph = (maze, coloredMaze, SIZE, REGION_SIZE) => {
  const graph = {};
  const numRegions = SIZE / REGION_SIZE;
    
    // Initialize graph nodes for each region
    for (let r = 0; r < numRegions; r++) {
      for (let c = 0; c < numRegions; c++) {
        const regionId = `${r},${c}`;
        graph[regionId] = {
          neighbors: [],
          components: new Map(), // component color -> cells
          transitions: [] // border crossings to other regions
        };
      }
    }
    
    // Analyze each region
    for (let regionRow = 0; regionRow < numRegions; regionRow++) {
      for (let regionCol = 0; regionCol < numRegions; regionCol++) {
        const regionId = `${regionRow},${regionCol}`;
        const startRow = regionRow * REGION_SIZE;
        const startCol = regionCol * REGION_SIZE;
        
        // Collect components in this region
        for (let r = startRow; r < startRow + REGION_SIZE; r++) {
          for (let c = startCol; c < startCol + REGION_SIZE; c++) {
            if (maze[r][c] === 0) { // Air cell
              const color = coloredMaze[r][c];
              if (!graph[regionId].components.has(color)) {
                graph[regionId].components.set(color, []);
              }
              graph[regionId].components.get(color).push({ row: r, col: c });
            }
          }
        }
        
        // Find transitions to neighboring regions
        // Check right border
        if (regionCol < numRegions - 1) {
          const rightRegionId = `${regionRow},${regionCol + 1}`;
          const borderCol = startCol + REGION_SIZE - 1;
          for (let r = startRow; r < startRow + REGION_SIZE; r++) {
            if (maze[r][borderCol] === 0 && maze[r][borderCol + 1] === 0) {
              // Add forward transition from current region to right region
              graph[regionId].transitions.push({
                to: rightRegionId,
                fromCell: { row: r, col: borderCol },
                toCell: { row: r, col: borderCol + 1 }
              });
              if (!graph[regionId].neighbors.includes(rightRegionId)) {
                graph[regionId].neighbors.push(rightRegionId);
              }
              if (!graph[rightRegionId].neighbors.includes(regionId)) {
                graph[rightRegionId].neighbors.push(regionId);
              }
            }
          }
        }
        
        // Check bottom border
        if (regionRow < numRegions - 1) {
          const bottomRegionId = `${regionRow + 1},${regionCol}`;
          const borderRow = startRow + REGION_SIZE - 1;
          for (let c = startCol; c < startCol + REGION_SIZE; c++) {
            if (maze[borderRow][c] === 0 && maze[borderRow + 1][c] === 0) {
              // Add forward transition from current region to bottom region
              graph[regionId].transitions.push({
                to: bottomRegionId,
                fromCell: { row: borderRow, col: c },
                toCell: { row: borderRow + 1, col: c }
              });
              if (!graph[regionId].neighbors.includes(bottomRegionId)) {
                graph[regionId].neighbors.push(bottomRegionId);
              }
              if (!graph[bottomRegionId].neighbors.includes(regionId)) {
                graph[bottomRegionId].neighbors.push(regionId);
              }
            }
          }
        }
      }
    }
    
  return graph;
};

// Frontier-style maze generation (adapted from frontier_maze)
const generateFrontierMaze = (SIZE) => {
  // Initialize maze with all walls  
  const maze = Array(SIZE).fill(null).map(() => Array(SIZE).fill(1));
  
  const carve3x3 = (x, y) => {
    const endY = Math.min(y + 3, SIZE);
    const endX = Math.min(x + 3, SIZE);
    for (let dy = y; dy < endY; dy++) {
      for (let dx = x; dx < endX; dx++) {
        maze[dy][dx] = 0;
      }
    }
  };
  
  const carveConnection = (x1, y1, x2, y2) => {
    if (x1 === x2) {
      const minY = Math.min(y1, y2);
      const maxY = Math.max(y1, y2) + 2;
      const endY = Math.min(maxY + 1, SIZE);
      const endX = Math.min(x1 + 3, SIZE);
      
      for (let y = minY; y < endY; y++) {
        for (let dx = x1; dx < endX; dx++) {
          maze[y][dx] = 0;
        }
      }
    } else {
      const minX = Math.min(x1, x2);
      const maxX = Math.max(x1, x2) + 2;
      const endX = Math.min(maxX + 1, SIZE);
      const endY = Math.min(y1 + 3, SIZE);
      
      for (let y = y1; y < endY; y++) {
        for (let x = minX; x < endX; x++) {
          maze[y][x] = 0;
        }
      }
    }
  };
  
  const visited = new Set();
  const toKey = (x, y) => `${x},${y}`;
  
  const stack = [];
  const startX = 2, startY = 2;
  
  carve3x3(startX, startY);
  stack.push([startX, startY]);
  visited.add(toKey(startX, startY));
  
  const directions = [[4, 0], [0, 4], [-4, 0], [0, -4]];
  
  const shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
  
  while (stack.length > 0) {
    const [currentX, currentY] = stack[stack.length - 1];
    const shuffledDirs = shuffle([...directions]);
    let found = false;
    
    for (const [dx, dy] of shuffledDirs) {
      const newX = currentX + dx;
      const newY = currentY + dy;
      
      if (newX > 0 && newX < SIZE - 3 && newY > 0 && newY < SIZE - 3) {
        const key = toKey(newX, newY);
        if (!visited.has(key)) {
          carveConnection(currentX, currentY, newX, newY);
          carve3x3(newX, newY);
          visited.add(key);
          stack.push([newX, newY]);
          found = true;
          break;
        }
      }
    }
    
    if (!found) stack.pop();
  }
  
  // Post-processing for rooms, loops, and widening
  const random = Math.random;
  const roomThreshold = 0.002;
  const loopThreshold = 0.005;
  const wideningThreshold = 0.003;
  
  for (let y = 1; y < SIZE - 1; y++) {
    for (let x = 1; x < SIZE - 1; x++) {
      const rand = random();
      
      if (rand < roomThreshold && x < SIZE - 8 && y < SIZE - 8) {
        const roomWidth = 4 + Math.floor(random() * 3);
        const roomHeight = 4 + Math.floor(random() * 3);
        const maxY = Math.min(y + roomHeight, SIZE - 2);
        const maxX = Math.min(x + roomWidth, SIZE - 2);
        
        for (let dy = y; dy < maxY; dy++) {
          for (let dx = x; dx < maxX; dx++) {
            maze[dy][dx] = 0;
          }
        }
      }
      else if (rand < loopThreshold && maze[y][x] === 1) {
        let paths = 0;
        if (y > 0 && maze[y - 1][x] === 0) paths++;
        if (y < SIZE - 1 && maze[y + 1][x] === 0) paths++;
        if (x > 0 && maze[y][x - 1] === 0) paths++;
        if (x < SIZE - 1 && maze[y][x + 1] === 0) paths++;
        
        if (paths >= 2) maze[y][x] = 0;
      }
      else if (rand < wideningThreshold && maze[y][x] === 0 && x < SIZE - 4 && y < SIZE - 4) {
        const size = random() > 0.5 ? 3 : 4;
        const maxY = Math.min(y + size, SIZE - 1);
        const maxX = Math.min(x + size, SIZE - 1);
        
        for (let dy = y; dy < maxY; dy++) {
          for (let dx = x; dx < maxX; dx++) {
            maze[dy][dx] = 0;
          }
        }
      }
    }
  }
  
  // Add entrance and exit
  for (let i = 0; i < 3; i++) {
    maze[2 + i][0] = 0;
    maze[SIZE - 3 - i][SIZE - 1] = 0;
  }
  
  return maze;
};

// Kruskal's algorithm maze generation
const generateKruskalMaze = (SIZE) => {
  // Initialize maze with all walls
  const newMaze = Array(SIZE).fill(null).map(() => Array(SIZE).fill(1));
    
  // Create a grid of potential path cells (odd coordinates)
  const pathCells = [];
  for (let row = 1; row < SIZE; row += 2) {
    for (let col = 1; col < SIZE; col += 2) {
      pathCells.push({ row, col, id: pathCells.length });
      newMaze[row][col] = 0; // Set these cells as air
    }
  }

  // Create edges between adjacent path cells
  const edges = [];
  for (let i = 0; i < pathCells.length; i++) {
    const cell = pathCells[i];
    
    // Check right neighbor
    if (cell.col + 2 < SIZE) {
      const neighbor = pathCells.find(c => c.row === cell.row && c.col === cell.col + 2);
      if (neighbor) {
        edges.push({
          from: i,
          to: neighbor.id,
          weight: Math.random(),
          wallRow: cell.row,
          wallCol: cell.col + 1
        });
      }
    }
    
    // Check bottom neighbor
    if (cell.row + 2 < SIZE) {
      const neighbor = pathCells.find(c => c.row === cell.row + 2 && c.col === cell.col);
      if (neighbor) {
        edges.push({
          from: i,
          to: neighbor.id,
          weight: Math.random(),
          wallRow: cell.row + 1,
          wallCol: cell.col
        });
      }
    }
  }

  // Sort edges by random weight
  edges.sort((a, b) => a.weight - b.weight);

  // Use Kruskal's algorithm to build MST
  const uf = new UnionFind(pathCells.length);
  
  for (const edge of edges) {
    if (uf.union(edge.from, edge.to)) {
      // Remove the wall between cells
      newMaze[edge.wallRow][edge.wallCol] = 0;
    }
  }

  // Add entrance and exit
  newMaze[0][1] = 0; // Top entrance
  newMaze[SIZE - 1][SIZE - 2] = 0; // Bottom exit

  return newMaze;
};

// Component analysis and coloring
const analyzeComponents = (maze, SIZE, REGION_SIZE, colors) => {
  const coloredMaze = Array(SIZE).fill(null).map(() => Array(SIZE).fill(-1));
  let totalComponentCount = 0;
  
  for (let regionRow = 0; regionRow < SIZE / REGION_SIZE; regionRow++) {
    for (let regionCol = 0; regionCol < SIZE / REGION_SIZE; regionCol++) {
      const startRow = regionRow * REGION_SIZE;
      const startCol = regionCol * REGION_SIZE;
      
      const components = findConnectedComponents(maze, startRow, startCol, REGION_SIZE);
      
      // Assign colors to components
      components.forEach((component, idx) => {
        const colorIndex = idx % colors.length;
        component.forEach(cell => {
          coloredMaze[cell.row][cell.col] = colorIndex;
        });
      });
      
      totalComponentCount += components.length;
    }
  }
  
  return { coloredMaze, totalComponentCount };
};

// Main orchestrator with algorithm selection
const generateMaze = (SIZE, REGION_SIZE, colors, algorithm = 'frontier') => {
  // Generate base maze using selected algorithm
  const maze = algorithm === 'kruskal' 
    ? generateKruskalMaze(SIZE)
    : generateFrontierMaze(SIZE);

  // Shared post-processing
  const { coloredMaze, totalComponentCount } = analyzeComponents(maze, SIZE, REGION_SIZE, colors);
  const componentGraph = buildComponentGraph(maze, coloredMaze, SIZE, REGION_SIZE);
  
  console.log('🎯 Component graph built with', Object.keys(componentGraph).length, 'component nodes');
  
  return {
    maze,
    coloredMaze,
    totalComponents: totalComponentCount,
    componentGraph
  };
};

export { buildRegionGraph, generateMaze };
