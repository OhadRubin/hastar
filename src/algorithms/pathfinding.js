import { heuristicString, heuristicObject, getKey } from '../utils/utilities.js';

const findAbstractPath = (startRegion, endRegion, graph) => {
  // Validate inputs
  if (!graph[startRegion] || !graph[endRegion]) {
    console.error('Invalid start or end region:', startRegion, endRegion);
    return null;
  }
  
  const openSet = [startRegion];
  const cameFrom = {};
  const gScore = { [startRegion]: 0 };
  const fScore = { [startRegion]: heuristicString(startRegion, endRegion) };
    
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
        
        if (gScore[neighbor] === undefined || tentativeGScore < gScore[neighbor]) {
          cameFrom[neighbor] = current;
          gScore[neighbor] = tentativeGScore;
          fScore[neighbor] = gScore[neighbor] + heuristicString(neighbor, endRegion);
          
          if (!openSet.includes(neighbor)) {
            openSet.push(neighbor);
          }
        }
      }
    }
    
    return null; // No path found
  };

const findDetailedPath = (start, end, maze, SIZE) => {
  const openSet = [start];
  const cameFrom = {};
  const gScore = { [`${start.row},${start.col}`]: 0 };
  const fScore = { [`${start.row},${start.col}`]: heuristicObject(start, end) };
    
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
        
        if (gScore[neighborKey] === undefined || tentativeGScore < gScore[neighborKey]) {
          cameFrom[neighborKey] = current;
          gScore[neighborKey] = tentativeGScore;
          fScore[neighborKey] = gScore[neighborKey] + heuristicObject(neighbor, end);
          
          if (!openSet.some(n => n.row === neighbor.row && n.col === neighbor.col)) {
            openSet.push(neighbor);
          }
        }
      }
    }
    
    return null; // No path found
  };

const findHAAStarPath = (start, end, maze, graph, REGION_SIZE, SIZE) => {
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
        const pathSegment = findDetailedPath(currentPos, end, maze, SIZE);
        if (pathSegment && pathSegment.length > 0) {
          // Skip first cell if we already have cells in detailedPath to avoid duplicates
          const startIndex = detailedPath.length > 0 ? 1 : 0;
          detailedPath.push(...pathSegment.slice(startIndex));
        } else {
          return { abstractPath, detailedPath: null }; // Failed to find path in last region
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
          const pathToTransition = findDetailedPath(currentPos, bestTransition.fromCell, maze, SIZE);
          if (pathToTransition && pathToTransition.length > 0) {
            // Skip first cell if we already have cells in detailedPath to avoid duplicates
            const startIndex = detailedPath.length > 0 ? 1 : 0;
            detailedPath.push(...pathToTransition.slice(startIndex));
            // Move to the next region through the transition
            currentPos = bestTransition.toCell;
            detailedPath.push(currentPos);
          } else {
            return { abstractPath, detailedPath: null }; // Failed to find path to transition
          }
        } else {
          return { abstractPath, detailedPath: null }; // No transitions found
        }
      }
    }
    
    return { abstractPath, detailedPath };
  };

const findConnectedComponents = (maze, startRow, startCol, REGION_SIZE) => {
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

export { findAbstractPath, findDetailedPath, findHAAStarPath, findConnectedComponents };
