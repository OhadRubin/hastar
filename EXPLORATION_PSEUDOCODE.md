# Component-Based Exploration Algorithm
## High-Level Pseudocode

### Core Data Structures
```
ExplorationState {
  knownMap: 2D array (UNKNOWN | WALL | WALKABLE)
  componentGraph: Map<ComponentID, Component>
  robotPosition: {row, col}
  sensorRange: number
  frontiers: Set<Position>
}

Component {
  id: string
  cells: Set<Position>
  regionId: string
  neighbors: Set<ComponentID>
  entrancePoints: Set<Position>
}
```

### Main Exploration Loop
```
WHILE (unexploredAreasRemain) {
  // 1. SENSE: Robot scans environment
  newCells = scanWithSensors(robotPosition, sensorRange)
  
  // 2. UPDATE: Online component analysis
  FOR each cell in newCells {
    updateKnownMap(cell)
    updateComponentStructure(cell)
  }
  
  // 3. PLAN: Find next exploration target
  frontiers = detectFrontiers(knownMap, componentGraph)
  bestFrontier = selectOptimalFrontier(frontiers, robotPosition)
  
  // 4. NAVIGATE: Use component-based pathfinding
  path = findComponentPath(robotPosition, bestFrontier, componentGraph)
  
  // 5. MOVE: Execute path segment
  robotPosition = moveAlongPath(path, stepSize)
}
```

### Online Component Updates
```
FUNCTION updateComponentStructure(newCell) {
  IF (newCell is WALL) RETURN
  
  neighborComponents = getAdjacentComponents(newCell)
  
  CASE neighborComponents.length:
    0: // Isolated discovery
       createNewComponent(newCell)
       
    1: // Extension of existing component  
       addCellToComponent(newCell, neighborComponents[0])
       
    >1: // Component merger event!
        mergedComponent = mergeComponents(neighborComponents)
        addCellToComponent(newCell, mergedComponent)
        updateComponentGraph(mergedComponent)
}
```

### Frontier Detection
```
FUNCTION detectFrontiers(knownMap, componentGraph) {
  frontiers = []
  
  FOR each component in componentGraph {
    FOR each cell in component.cells {
      FOR each neighbor of cell {
        IF (neighbor is UNKNOWN) {
          frontiers.add(cell) // This known cell borders unknown
        }
      }
    }
  }
  
  RETURN groupFrontiersByProximity(frontiers)
}
```

### Component-Aware Pathfinding
```
FUNCTION findComponentPath(start, goal, componentGraph) {
  // Phase 1: Abstract planning through component graph
  startComponent = findComponentContaining(start)
  goalComponent = findComponentContaining(goal)
  
  abstractPath = AStar(startComponent, goalComponent, componentGraph)
  
  // Phase 2: Detailed planning within each component
  detailedPath = []
  FOR each componentStep in abstractPath {
    segmentPath = AStar(currentPos, componentStep.entrance, maze)
    detailedPath.extend(segmentPath)
    currentPos = componentStep.exit
  }
  
  RETURN detailedPath
}
```

### Exploration Strategy
```
FUNCTION selectNearestFrontier(frontiers, robotPosition) {
  nearestFrontier = null
  minDistance = Infinity
  
  FOR each frontier in frontiers {
    distance = calculateDistance(robotPosition, frontier)
    IF (distance < minDistance) {
      minDistance = distance
      nearestFrontier = frontier
    }
  }
  
  RETURN nearestFrontier
}
```

### Key Innovation Points

1. **Dynamic Component Evolution**: Components grow, merge, and connect as exploration progresses

2. **Sensor-Limited Discovery**: Robot only "knows" what it has sensed, creating realistic exploration

3. **Component-Aware Planning**: Uses existing HAA* infrastructure but with evolving component graph

4. **Real-Time Visualization**: Perfect for canvas rendering - components form and merge visually

5. **Intelligent Exploration**: Prioritizes frontiers that might reveal component connections

### Why This Design Works

**1. Main Exploration Loop Structure**
- Clean **SENSE → UPDATE → PLAN → NAVIGATE → MOVE** cycle
- This is the standard robotics exploration pattern
- Each phase has a clear responsibility

**2. Online Component Updates**
- **Handles all merge cases correctly** (0, 1, >1 neighbors)
- This is the **key innovation** - most exploration algorithms don't do dynamic component tracking
- Logic is simple and bulletproof

**3. Component-Aware Pathfinding**
- **Leverages existing HAA*** infrastructure perfectly
- Two-phase approach (abstract → detailed) is exactly right
- No wasted work - you already have this system built

**4. Core Data Structures**
- **ExplorationState** captures exactly what you need
- **Component** structure is minimal but sufficient
- **knownMap** with UNKNOWN|WALL|WALKABLE is perfect

### Implementation Benefits
- **Builds on existing strengths** (your HAA* system)
- **Minimal but complete** - no missing pieces
- **Incrementally complex** - you can implement piece by piece
- **Visually compelling** - perfect for your canvas rendering
- Simple nearest-frontier strategy allows focus on core algorithm
- Can be enhanced with sophisticated exploration strategies later