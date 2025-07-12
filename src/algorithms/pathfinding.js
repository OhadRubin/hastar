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

const findDetailedPath = (start, end, maze, SIZE, allowedRegions = null, REGION_SIZE = null, coloredMaze = null, allowedComponents = null) => {
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
        
        // Validate that all cells in path are walkable and connected
        for (let i = 0; i < path.length; i++) {
          const cell = path[i];
          if (maze[cell.row][cell.col] === 1) {
            console.error('🚨 A* WALL IN PATH!', cell, 'maze value:', maze[cell.row][cell.col]);
            return null;
          }
          
          // Check connectivity
          if (i > 0) {
            const prevCell = path[i - 1];
            const distance = Math.abs(cell.row - prevCell.row) + Math.abs(cell.col - prevCell.col);
            if (distance !== 1) {
              console.error('🚨 A* DISCONNECTED PATH! Gap at index', i);
              console.error('  Previous:', prevCell, 'Current:', cell, 'Distance:', distance);
              return null;
            }
          }
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
        
        // Check region constraints if specified
        if (allowedRegions && REGION_SIZE) {
          const neighborRegionRow = Math.floor(neighbor.row / REGION_SIZE);
          const neighborRegionCol = Math.floor(neighbor.col / REGION_SIZE);
          const neighborRegionId = `${neighborRegionRow},${neighborRegionCol}`;
          if (!allowedRegions.includes(neighborRegionId)) {
            // Uncomment for debugging: console.log('❌ Blocked neighbor outside allowed regions:', neighbor, 'region:', neighborRegionId);
            continue; // Skip neighbors outside allowed regions
          }
        }
        
        // Check component constraints if specified
        if (allowedComponents && coloredMaze) {
          const neighborComponent = coloredMaze[neighbor.row][neighbor.col];
          if (neighborComponent !== -1 && !allowedComponents.includes(neighborComponent)) {
            console.log('❌ Blocked neighbor outside allowed components:', neighbor, 'component:', neighborComponent, 'allowed:', allowedComponents);
            continue; // Skip neighbors outside allowed components
          }
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

const findHAAStarPath = (start, end, maze, graph, REGION_SIZE, SIZE, coloredMaze = null) => {
  const startRegion = `${Math.floor(start.row / REGION_SIZE)},${Math.floor(start.col / REGION_SIZE)}`;
  const endRegion = `${Math.floor(end.row / REGION_SIZE)},${Math.floor(end.col / REGION_SIZE)}`;
  
  // Helper function to get component color for a cell
  const getComponentColor = (cell) => {
    return coloredMaze ? coloredMaze[cell.row][cell.col] : null;
  };
  
  // Debug logging
  console.log('🔧 HAA* Debug - Start:', start, 'End:', end);
  console.log('🔧 Start region:', startRegion, 'End region:', endRegion);
  if (coloredMaze) {
    console.log('🔧 Start component:', getComponentColor(start));
    console.log('🔧 End component:', getComponentColor(end));
  }
    
    // Step 1: Find abstract path through regions
    const abstractPath = findAbstractPath(startRegion, endRegion, graph);
    console.log('🔧 Abstract path found:', abstractPath);
    if (!abstractPath) {
      console.log('❌ Abstract path failed');
      return { abstractPath: null, detailedPath: null };
    }
    
    // Step 2: Find detailed path using the abstract path as a guide
    const detailedPath = [];
    let currentPos = start;
    
    for (let i = 0; i < abstractPath.length; i++) {
      const currentRegion = abstractPath[i];
      
      if (i === abstractPath.length - 1) {
        // Last region - path to end
        let allowedComponents = null;
        if (coloredMaze) {
          // If we have component information, constrain to components that can reach the end
          const endComponent = getComponentColor(end);
          const currentComponent = getComponentColor(currentPos);
          if (endComponent !== -1 && currentComponent !== -1) {
            // If both current and end positions are in components, allow both
            allowedComponents = [currentComponent, endComponent];
          }
        }
        console.log('🔧 Final region pathfinding:', currentPos, 'to', end, 'allowedComponents:', allowedComponents);
        const pathSegment = findDetailedPath(currentPos, end, maze, SIZE, [currentRegion], REGION_SIZE, coloredMaze, allowedComponents);
        console.log('🔧 Final region path result:', pathSegment);
        if (pathSegment && pathSegment.length > 0) {
          // Only skip first cell if it actually matches the last cell in our existing path
          let startIndex = 0;
          if (detailedPath.length > 0 && pathSegment.length > 0) {
            const lastCell = detailedPath[detailedPath.length - 1];
            const firstCell = pathSegment[0];
            if (lastCell.row === firstCell.row && lastCell.col === firstCell.col) {
              startIndex = 1; // Skip duplicate
            }
          }
          detailedPath.push(...pathSegment.slice(startIndex));
        } else {
          console.log('❌ Failed to find path in final region');
          return { abstractPath, detailedPath: null }; // Failed to find path in last region
        }
      } else {
        // Find transition to next region (check both directions)
        const nextRegion = abstractPath[i + 1];
        
        // Check outgoing transitions from current region
        const outgoingTransitions = graph[currentRegion].transitions.filter(t => t.to === nextRegion);
        
        // Check incoming transitions from next region (reverse the direction)
        const incomingTransitions = graph[nextRegion].transitions
          .filter(t => t.to === currentRegion)
          .map(t => ({
            to: nextRegion,
            fromCell: t.toCell,
            toCell: t.fromCell,
            fromComponent: t.toComponent,
            toComponent: t.fromComponent
          }));
        
        const transitions = [...outgoingTransitions, ...incomingTransitions];
        
        // Filter transitions based on component connectivity for the entire path
        let validTransitions = transitions;
        console.log('🔧 All transitions from', currentRegion, 'to', nextRegion, ':', transitions);
        if (coloredMaze) {
          const currentComponent = getComponentColor(currentPos);
          const endComponent = getComponentColor(end);
          console.log('🔧 Current position component:', currentComponent, 'End component:', endComponent);
          
          if (currentComponent !== -1 && endComponent !== -1) {
            // If both start and end are in valid components, filter transitions that can lead to connectivity
            // For now, allow transitions if they eventually connect to a component that can reach end
            // This requires checking the entire transition chain - complex logic needed here
            // Temporary: allow all transitions and let A* within regions handle component constraints
            console.log('🔧 Using all transitions (complex component path validation needed)');
          }
        }
        
        if (validTransitions.length > 0) {
          // Find closest valid transition
          let bestTransition = validTransitions[0];
          let bestDist = Math.abs(currentPos.row - bestTransition.fromCell.row) + 
                        Math.abs(currentPos.col - bestTransition.fromCell.col);
          
          for (const transition of validTransitions) {
            const dist = Math.abs(currentPos.row - transition.fromCell.row) + 
                        Math.abs(currentPos.col - transition.fromCell.col);
            if (dist < bestDist) {
              bestDist = dist;
              bestTransition = transition;
            }
          }
          
          // Determine allowed components for path to transition
          let allowedComponents = null;
          if (coloredMaze) {
            const currentComponent = getComponentColor(currentPos);
            const transitionComponent = bestTransition.fromComponent;
            if (currentComponent !== -1 && transitionComponent !== undefined) {
              allowedComponents = [currentComponent, transitionComponent];
            }
          }
          
          // Path to transition point (constrain to current region and allowed components)
          console.log('🔧 Pathfinding to transition:', currentPos, 'to', bestTransition.fromCell, 'allowedComponents:', allowedComponents);
          const pathToTransition = findDetailedPath(currentPos, bestTransition.fromCell, maze, SIZE, [currentRegion], REGION_SIZE, coloredMaze, allowedComponents);
          console.log('🔧 Path to transition result:', pathToTransition);
          if (pathToTransition && pathToTransition.length > 0) {
            // Only skip first cell if it actually matches the last cell in our existing path
            let startIndex = 0;
            if (detailedPath.length > 0 && pathToTransition.length > 0) {
              const lastCell = detailedPath[detailedPath.length - 1];
              const firstCell = pathToTransition[0];
              if (lastCell.row === firstCell.row && lastCell.col === firstCell.col) {
                startIndex = 1; // Skip duplicate
              }
            }
            detailedPath.push(...pathToTransition.slice(startIndex));
            // Move to the next region through the transition
            currentPos = bestTransition.toCell;
            // Verify the transition cell is actually walkable before adding it
            if (maze[currentPos.row][currentPos.col] === 0) {
              // Only add transition cell if it's not already the last cell in our path
              const lastCell = detailedPath[detailedPath.length - 1];
              if (!(lastCell.row === currentPos.row && lastCell.col === currentPos.col)) {
                detailedPath.push(currentPos);
              }
            } else {
              console.error('🚨 TRANSITION CELL IS WALL!', currentPos, 'maze value:', maze[currentPos.row][currentPos.col]);
              return { abstractPath, detailedPath: null };
            }
          } else {
            console.log('❌ Failed to find path to transition');
            return { abstractPath, detailedPath: null }; // Failed to find path to transition
          }
        } else {
          console.log('❌ No valid transitions found');
          return { abstractPath, detailedPath: null }; // No transitions found
        }
      }
    }
    
    // Final validation of entire detailed path - only print errors
    for (let i = 0; i < detailedPath.length; i++) {
      const cell = detailedPath[i];
      if (maze[cell.row][cell.col] === 1) {
        console.error('🚨 WALL IN PATH! Cell', i, ':', cell, 'maze value:', maze[cell.row][cell.col]);
        return { abstractPath, detailedPath: null };
      }
      
      // Check for connectivity (each cell should be adjacent to next)
      if (i > 0) {
        const prevCell = detailedPath[i - 1];
        const distance = Math.abs(cell.row - prevCell.row) + Math.abs(cell.col - prevCell.col);
        if (distance !== 1) {
          console.error('🚨 DISCONNECTED PATH! Gap between cells', i-1, 'and', i);
          console.error('  Previous cell:', prevCell);
          console.error('  Current cell:', cell);
          console.error('  Distance:', distance);
          console.error('  Path around gap:', detailedPath.slice(Math.max(0, i-3), i+3));
        }
      }
    }
    
    console.log('✅ HAA* Success! DetailedPath length:', detailedPath.length);
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
