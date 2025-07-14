/**
 * Map utilities for exploration algorithms
 * Shared map management and state constants
 */

// Cell states for known map
export const CELL_STATES = {
  UNKNOWN: 2,
  WALL: 1,
  WALKABLE: 0
};

/**
 * Update known map with sensor readings
 */
export const updateKnownMap = (knownMap, fullMaze, sensorPositions) => {
  const newKnownMap = knownMap.map(row => [...row]); // Deep copy
  const newCells = [];
  
  for (const pos of sensorPositions) {
    const currentState = knownMap[pos.row][pos.col];
    const actualState = fullMaze[pos.row][pos.col];
    
    if (currentState === CELL_STATES.UNKNOWN) {
      newKnownMap[pos.row][pos.col] = actualState;
      newCells.push({ ...pos, newState: actualState });
    }
  }
  
  return { knownMap: newKnownMap, newCells };
};