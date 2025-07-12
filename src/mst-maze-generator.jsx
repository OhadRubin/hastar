import React, { useState, useEffect } from 'react';

const MazeGenerator = () => {
  const SIZE = 25;
  const REGION_SIZE = 5;
  const [maze, setMaze] = useState([]);
  const [coloredMaze, setColoredMaze] = useState([]);
  const [totalComponents, setTotalComponents] = useState(0);
  const [start, setStart] = useState(null);
  const [end, setEnd] = useState(null);
  const [abstractPath, setAbstractPath] = useState([]);
  const [detailedPath, setDetailedPath] = useState([]);
  const [regionGraph, setRegionGraph] = useState(null);
  const [showAbstractPath, setShowAbstractPath] = useState(true);

  // Union-Find data structure for Kruskal's algorithm
  class UnionFind {
    constructor(size) {
      this.parent = new Array(size);
      this.rank = new Array(size);
      for (let i = 0; i < size; i++) {
        this.parent[i] = i;
        this.rank[i] = 0;
      }
    }

    find(x) {
      if (this.parent[x] !== x) {
        this.parent[x] = this.find(this.parent[x]);
      }
      return this.parent[x];
    }

    union(x, y) {
      const rootX = this.find(x);
      const rootY = this.find(y);
      
      if (rootX === rootY) return false;
      
      if (this.rank[rootX] < this.rank[rootY]) {
        this.parent[rootX] = rootY;
      } else if (this.rank[rootX] > this.rank[rootY]) {
        this.parent[rootY] = rootX;
      } else {
        this.parent[rootY] = rootX;
        this.rank[rootX]++;
      }
      return true;
    }
  }

  // Color palette for connected components
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
    '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8C471', '#82E0AA',
    '#F06292', '#AED6F1', '#F9E79F', '#D7BDE2', '#A9DFBF',
    '#FAD7A0', '#E8DAEF', '#D6EAF8', '#FADBD8', '#D5F4E6'
  ];

  // Build region graph for HAA*
  const buildRegionGraph = (maze, coloredMaze) => {
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
              graph[regionId].transitions.push({
                to: rightRegionId,
                fromCell: { row: r, col: borderCol },
                toCell: { row: r, col: borderCol + 1 }
              });
              if (!graph[regionId].neighbors.includes(rightRegionId)) {
                graph[regionId].neighbors.push(rightRegionId);
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
              graph[regionId].transitions.push({
                to: bottomRegionId,
                fromCell: { row: borderRow, col: c },
                toCell: { row: borderRow + 1, col: c }
              });
              if (!graph[regionId].neighbors.includes(bottomRegionId)) {
                graph[regionId].neighbors.push(bottomRegionId);
              }
            }
          }
        }
      }
    }
    
    return graph;
  };

  // A* pathfinding for abstract level (region to region)
  const findAbstractPath = (startRegion, endRegion, graph) => {
    const openSet = [startRegion];
    const cameFrom = {};
    const gScore = { [startRegion]: 0 };
    const fScore = { [startRegion]: heuristic(startRegion, endRegion) };
    
    function heuristic(a, b) {
      const [r1, c1] = a.split(',').map(Number);
      const [r2, c2] = b.split(',').map(Number);
      return Math.abs(r1 - r2) + Math.abs(c1 - c2);
    }
    
    while (openSet.length > 0) {
      let current = openSet.reduce((min, node) => 
        fScore[node] < fScore[min] ? node : min
      );
      
      if (current === endRegion) {
        const path = [];
        while (current) {
          path.unshift(current);
          current = cameFrom[current];
        }
        return path;
      }
      
      openSet.splice(openSet.indexOf(current), 1);
      
      for (const neighbor of graph[current].neighbors) {
        const tentativeGScore = gScore[current] + 1;
        
        if (!gScore[neighbor] || tentativeGScore < gScore[neighbor]) {
          cameFrom[neighbor] = current;
          gScore[neighbor] = tentativeGScore;
          fScore[neighbor] = gScore[neighbor] + heuristic(neighbor, endRegion);
          
          if (!openSet.includes(neighbor)) {
            openSet.push(neighbor);
          }
        }
      }
    }
    
    return null; // No path found
  };

  // A* pathfinding for detailed level (cell to cell)
  const findDetailedPath = (start, end, maze) => {
    const openSet = [start];
    const cameFrom = {};
    const gScore = { [`${start.row},${start.col}`]: 0 };
    const fScore = { [`${start.row},${start.col}`]: heuristic(start, end) };
    
    function heuristic(a, b) {
      return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
    }
    
    function getKey(cell) {
      return `${cell.row},${cell.col}`;
    }
    
    while (openSet.length > 0) {
      let current = openSet.reduce((min, node) => 
        fScore[getKey(node)] < fScore[getKey(min)] ? node : min
      );
      
      if (current.row === end.row && current.col === end.col) {
        const path = [];
        while (current) {
          path.unshift(current);
          current = cameFrom[getKey(current)];
        }
        return path;
      }
      
      openSet.splice(openSet.findIndex(n => n.row === current.row && n.col === current.col), 1);
      
      const neighbors = [
        { row: current.row - 1, col: current.col },
        { row: current.row + 1, col: current.col },
        { row: current.row, col: current.col - 1 },
        { row: current.row, col: current.col + 1 }
      ];
      
      for (const neighbor of neighbors) {
        if (neighbor.row < 0 || neighbor.row >= SIZE || 
            neighbor.col < 0 || neighbor.col >= SIZE ||
            maze[neighbor.row][neighbor.col] === 1) {
          continue;
        }
        
        const tentativeGScore = gScore[getKey(current)] + 1;
        const neighborKey = getKey(neighbor);
        
        if (!gScore[neighborKey] || tentativeGScore < gScore[neighborKey]) {
          cameFrom[neighborKey] = current;
          gScore[neighborKey] = tentativeGScore;
          fScore[neighborKey] = gScore[neighborKey] + heuristic(neighbor, end);
          
          if (!openSet.some(n => n.row === neighbor.row && n.col === neighbor.col)) {
            openSet.push(neighbor);
          }
        }
      }
    }
    
    return null; // No path found
  };

  // HAA* main algorithm
  const findHAAStarPath = (start, end, maze, graph) => {
    const startRegion = `${Math.floor(start.row / REGION_SIZE)},${Math.floor(start.col / REGION_SIZE)}`;
    const endRegion = `${Math.floor(end.row / REGION_SIZE)},${Math.floor(end.col / REGION_SIZE)}`;
    
    // Step 1: Find abstract path through regions
    const abstractPath = findAbstractPath(startRegion, endRegion, graph);
    if (!abstractPath) return { abstractPath: null, detailedPath: null };
    
    // Step 2: Find detailed path using the abstract path as a guide
    const detailedPath = [];
    let currentPos = start;
    
    for (let i = 0; i < abstractPath.length; i++) {
      const currentRegion = abstractPath[i];
      
      if (i === abstractPath.length - 1) {
        // Last region - path to end
        const pathSegment = findDetailedPath(currentPos, end, maze);
        if (pathSegment) {
          detailedPath.push(...pathSegment.slice(currentPos === start ? 0 : 1));
        }
      } else {
        // Find transition to next region
        const nextRegion = abstractPath[i + 1];
        const transitions = graph[currentRegion].transitions.filter(t => t.to === nextRegion);
        
        if (transitions.length > 0) {
          // Find closest transition
          let bestTransition = transitions[0];
          let bestDist = Math.abs(currentPos.row - bestTransition.fromCell.row) + 
                        Math.abs(currentPos.col - bestTransition.fromCell.col);
          
          for (const transition of transitions) {
            const dist = Math.abs(currentPos.row - transition.fromCell.row) + 
                        Math.abs(currentPos.col - transition.fromCell.col);
            if (dist < bestDist) {
              bestDist = dist;
              bestTransition = transition;
            }
          }
          
          // Path to transition point
          const pathToTransition = findDetailedPath(currentPos, bestTransition.fromCell, maze);
          if (pathToTransition) {
            detailedPath.push(...pathToTransition.slice(currentPos === start ? 0 : 1));
            currentPos = bestTransition.toCell;
            detailedPath.push(currentPos);
          }
        }
      }
    }
    
    return { abstractPath, detailedPath };
  };

  // Find connected components within a region using flood fill
  const findConnectedComponents = (maze, startRow, startCol) => {
    const components = [];
    const visited = Array(REGION_SIZE).fill(null).map(() => Array(REGION_SIZE).fill(false));
    
    const floodFill = (row, col, componentId) => {
      if (row < 0 || row >= REGION_SIZE || col < 0 || col >= REGION_SIZE) return;
      if (visited[row][col]) return;
      
      const mazeRow = startRow + row;
      const mazeCol = startCol + col;
      if (maze[mazeRow][mazeCol] === 1) return; // Wall
      
      visited[row][col] = true;
      components[componentId].push({ row: mazeRow, col: mazeCol });
      
      // Check 4 neighbors
      floodFill(row - 1, col, componentId);
      floodFill(row + 1, col, componentId);
      floodFill(row, col - 1, componentId);
      floodFill(row, col + 1, componentId);
    };
    
    let componentId = 0;
    for (let row = 0; row < REGION_SIZE; row++) {
      for (let col = 0; col < REGION_SIZE; col++) {
        if (!visited[row][col] && maze[startRow + row][startCol + col] === 0) {
          components[componentId] = [];
          floodFill(row, col, componentId);
          componentId++;
        }
      }
    }
    
    return components;
  };

  const generateMaze = () => {
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
        
        const components = findConnectedComponents(newMaze, startRow, startCol);
        
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

    setMaze(newMaze);
    setColoredMaze(newColoredMaze);
    setTotalComponents(totalComponentCount);
    
    // Build region graph for HAA*
    const graph = buildRegionGraph(newMaze, newColoredMaze);
    setRegionGraph(graph);
    
    // Clear paths when generating new maze
    setStart(null);
    setEnd(null);
    setAbstractPath([]);
    setDetailedPath([]);
  };

  useEffect(() => {
    generateMaze();
  }, []);

  // Handle cell clicks for setting start/end points
  const handleCellClick = (row, col) => {
    if (maze[row][col] === 1) return; // Can't select walls
    
    if (!start) {
      setStart({ row, col });
      setAbstractPath([]);
      setDetailedPath([]);
    } else if (!end) {
      setEnd({ row, col });
      // Find path using HAA*
      if (regionGraph) {
        const result = findHAAStarPath(start, { row, col }, maze, regionGraph);
        if (result.abstractPath && result.detailedPath) {
          setAbstractPath(result.abstractPath);
          setDetailedPath(result.detailedPath);
        }
      }
    } else {
      // Reset
      setStart({ row, col });
      setEnd(null);
      setAbstractPath([]);
      setDetailedPath([]);
    }
  };

  const getCellStyle = (row, col, isWall, colorIndex) => {
    let backgroundColor = isWall ? '#2d3748' : (colorIndex >= 0 ? colors[colorIndex] : '#e2e8f0');
    
    // Highlight start and end points
    if (start && start.row === row && start.col === col) {
      backgroundColor = '#10B981'; // Green for start
    } else if (end && end.row === row && end.col === col) {
      backgroundColor = '#EF4444'; // Red for end
    } else if (detailedPath.some(p => p.row === row && p.col === col)) {
      // Path visualization
      backgroundColor = '#3B82F6'; // Blue for path
    }
    
    // Check if cell is in abstract path region
    const regionRow = Math.floor(row / REGION_SIZE);
    const regionCol = Math.floor(col / REGION_SIZE);
    const regionId = `${regionRow},${regionCol}`;
    const isInAbstractPath = showAbstractPath && abstractPath.includes(regionId);
    
    const baseStyle = {
      width: '24px',
      height: '24px',
      backgroundColor,
      boxSizing: 'border-box',
      border: '1px solid #cbd5e0',
      cursor: isWall ? 'default' : 'pointer',
      opacity: isInAbstractPath && !isWall ? 1 : (showAbstractPath && abstractPath.length > 0 && !isWall ? 0.3 : 1)
    };

    // Add dotted borders for 5x5 chunks
    const dottedBorder = '2px dotted #4a5568';
    if (col % 5 === 0 && col !== 0) {
      baseStyle.borderLeft = dottedBorder;
    }
    if (row % 5 === 0 && row !== 0) {
      baseStyle.borderTop = dottedBorder;
    }
    if ((col + 1) % 5 === 0 && col !== SIZE - 1) {
      baseStyle.borderRight = dottedBorder;
    }
    if ((row + 1) % 5 === 0 && row !== SIZE - 1) {
      baseStyle.borderBottom = dottedBorder;
    }

    return baseStyle;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-8">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Hierarchical A* (HAA*) Pathfinding Demo</h1>
      
      <div className="mb-4 text-lg text-gray-700">
        Connected components within each 5x5 region are shown in different colors
      </div>
      
      <div className="mb-4 space-y-2 text-center">
        <div className="text-sm text-gray-600">
          Total components: {totalComponents}
        </div>
        <div className="text-sm text-gray-700 font-medium">
          {!start ? 'Click a cell to set start point (will be green)' : 
           !end ? 'Click another cell to set end point (will be red)' : 
           'Click any cell to reset'}
        </div>
        {abstractPath.length > 0 && (
          <div className="text-sm text-gray-600">
            Abstract path: {abstractPath.length} regions | Detailed path: {detailedPath.length} cells
          </div>
        )}
      </div>
      
      <div className="mb-6 flex gap-4">
        <button
          onClick={generateMaze}
          className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          Generate New Maze
        </button>
        {abstractPath.length > 0 && (
          <button
            onClick={() => setShowAbstractPath(!showAbstractPath)}
            className="px-6 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors"
          >
            {showAbstractPath ? 'Hide' : 'Show'} Abstract Path
          </button>
        )}
      </div>

      <div 
        className="grid grid-cols-25 gap-0 bg-white p-4 rounded-lg shadow-lg mb-4"
        style={{ 
          display: 'grid',
          gridTemplateColumns: 'repeat(25, 24px)',
          gap: 0
        }}
      >
        {maze.map((row, rowIndex) =>
          row.map((cell, colIndex) => (
            <div
              key={`${rowIndex}-${colIndex}`}
              style={getCellStyle(rowIndex, colIndex, cell === 1, coloredMaze[rowIndex]?.[colIndex])}
              onClick={() => handleCellClick(rowIndex, colIndex)}
            />
          ))
        )}
      </div>

      <div className="flex gap-6 text-sm text-gray-600 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-500"></div>
          <span>Start</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-500"></div>
          <span>End</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-500"></div>
          <span>Path</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-700"></div>
          <span>Wall</span>
        </div>
      </div>

      <div className="mt-6 text-sm text-gray-600 max-w-2xl text-center space-y-2">
        <p className="font-semibold">How HAA* Works:</p>
        <p>1. <strong>Click cells</strong> to set start (green) and end (red) points</p>
        <p>2. <strong>Abstract Path</strong>: HAA* first finds which regions to traverse (highlighted when toggled on)</p>
        <p>3. <strong>Detailed Path</strong>: Then finds the actual cell-by-cell path (blue line)</p>
        <p>4. The algorithm uses the connected components (colors) to efficiently navigate within regions</p>
        <p className="text-xs mt-2">This demonstrates hierarchical pathfinding - planning at the region level first, then refining to specific cells</p>
      </div>
    </div>
  );
};

export default MazeGenerator;