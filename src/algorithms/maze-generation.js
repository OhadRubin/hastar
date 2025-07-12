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

const generateMaze = (SIZE, REGION_SIZE, colors) => {
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

    // Optional: Add entrance and exit
    newMaze[0][1] = 0; // Top entrance
    newMaze[SIZE - 1][SIZE - 2] = 0; // Bottom exit

    // Color connected components within each 5x5 region
    const newColoredMaze = Array(SIZE).fill(null).map(() => Array(SIZE).fill(-1));
    let totalComponentCount = 0;
    
    for (let regionRow = 0; regionRow < SIZE / REGION_SIZE; regionRow++) {
      for (let regionCol = 0; regionCol < SIZE / REGION_SIZE; regionCol++) {
        const startRow = regionRow * REGION_SIZE;
        const startCol = regionCol * REGION_SIZE;
        
        const components = findConnectedComponents(newMaze, startRow, startCol, REGION_SIZE);
        
        // Assign colors to components
        components.forEach((component, idx) => {
          const colorIndex = idx % colors.length;
          component.forEach(cell => {
            newColoredMaze[cell.row][cell.col] = colorIndex;
          });
        });
        
        totalComponentCount += components.length;
      }
    }

  // Build component-based graph for HAA* 🚀
  const componentGraph = buildComponentGraph(newMaze, newColoredMaze, SIZE, REGION_SIZE);
  
  console.log('🎯 Component graph built with', Object.keys(componentGraph).length, 'component nodes');
  
  return {
    maze: newMaze,
    coloredMaze: newColoredMaze,
    totalComponents: totalComponentCount,
    componentGraph: componentGraph // 🔥 NEW: Component-based graph!
  };
};

export { buildRegionGraph, generateMaze };
