import React, { useState, useEffect, useCallback, useRef } from 'react';
import { findAbstractPath, findDetailedPath, findHAAStarPath } from '../algorithms/pathfinding.js';
import { generateMaze } from '../algorithms/maze-generation.js';
import { findComponentBasedHAAStarPath } from '../algorithms/component-based-pathfinding.js';
import { useCharacterAnimation } from '../hooks/useCharacterAnimation.js';

const MazeGenerator = () => {
  const SIZE = 64;
  const REGION_SIZE = 8;
  const [maze, setMaze] = useState([]);
  const [coloredMaze, setColoredMaze] = useState([]);
  const [totalComponents, setTotalComponents] = useState(0);
  const [start, setStart] = useState(null);
  const [end, setEnd] = useState(null);
  const [abstractPath, setAbstractPath] = useState([]);
  const [detailedPath, setDetailedPath] = useState([]);
  const [componentGraph, setComponentGraph] = useState(null);
  const [showAbstractPath, setShowAbstractPath] = useState(true);
  const [animationSpeed, setAnimationSpeed] = useState(200);
  const [countdown, setCountdown] = useState(0);
  const [isCountingDown, setIsCountingDown] = useState(false);
  
  // Use refs to capture latest values without causing recreation
  const mazeRef = useRef(maze);
  const componentGraphRef = useRef(componentGraph);
  const coloredMazeRef = useRef(coloredMaze);
  const detailedPathRef = useRef(detailedPath);
  
  // Update refs when values change
  mazeRef.current = maze;
  componentGraphRef.current = componentGraph;
  coloredMazeRef.current = coloredMaze;
  detailedPathRef.current = detailedPath;

  // Countdown logic (only recreates when needed)
  const startCountdown = useCallback(() => {
    setIsCountingDown(true);
    setCountdown(3);
    
    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          setIsCountingDown(false);
          // Call handleNewPath after countdown finishes
          setTimeout(() => {
            // Use the current maze state to generate new path
            if (mazeRef.current.length && componentGraphRef.current && detailedPathRef.current.length > 0) {
              // Use the last position from the path as the new start
              const currentEnd = detailedPathRef.current[detailedPathRef.current.length - 1];
              if (currentEnd) {
                const validCells = [];
                for (let row = 0; row < SIZE; row++) {
                  for (let col = 0; col < SIZE; col++) {
                    if (mazeRef.current[row][col] === 0 && !(row === currentEnd.row && col === currentEnd.col)) {
                      validCells.push({ row, col });
                    }
                  }
                }
                
                if (validCells.length > 0) {
                  const randomEnd = validCells[Math.floor(Math.random() * validCells.length)];
                  setStart(currentEnd);
                  setEnd(randomEnd);
                  
                  const pathResult = findComponentBasedHAAStarPath(
                    currentEnd, 
                    randomEnd, 
                    mazeRef.current, 
                    componentGraphRef.current, 
                    coloredMazeRef.current, 
                    REGION_SIZE, 
                    SIZE
                  );
                  
                  if (pathResult.abstractPath && pathResult.detailedPath) {
                    setAbstractPath(pathResult.abstractPath);
                    setDetailedPath(pathResult.detailedPath);
                  } else {
                    setAbstractPath([]);
                    setDetailedPath([]);
                  }
                }
              }
            }
          }, 100);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []); // No dependencies - uses refs instead

  // Function to randomly select two valid points with minimum distance
  const selectRandomPoints = (maze) => {
    const validCells = [];
    
    // Find all non-wall cells
    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        if (maze[row][col] === 0) { // Not a wall
          validCells.push({ row, col });
        }
      }
    }
    
    if (validCells.length < 2) {
      console.warn('Not enough valid cells for start/end points');
      return { start: null, end: null };
    }
    
    // Calculate minimum required distance (half of maximum possible Manhattan distance)
    const maxDistance = (SIZE - 1) + (SIZE - 1); // From (0,0) to (SIZE-1,SIZE-1)
    const minDistance = Math.floor(maxDistance / 2);
    
    // Calculate Manhattan distance between two points
    const manhattanDistance = (p1, p2) => {
      return Math.abs(p1.row - p2.row) + Math.abs(p1.col - p2.col);
    };
    
    // Try to find two points with sufficient distance
    let attempts = 0;
    const maxAttempts = 1000; // Prevent infinite loop
    
    while (attempts < maxAttempts) {
      const startIndex = Math.floor(Math.random() * validCells.length);
      const endIndex = Math.floor(Math.random() * validCells.length);
      
      if (startIndex !== endIndex) {
        const start = validCells[startIndex];
        const end = validCells[endIndex];
        const distance = manhattanDistance(start, end);
        
        if (distance >= minDistance) {
          console.log(`Selected points with Manhattan distance: ${distance} (min required: ${minDistance})`);
          return { start, end };
        }
      }
      
      attempts++;
    }
    
    // Fallback: if we can't find points with minimum distance, just use any two different points
    console.warn(`Could not find points with minimum distance after ${maxAttempts} attempts, using fallback`);
    const startIndex = Math.floor(Math.random() * validCells.length);
    let endIndex;
    do {
      endIndex = Math.floor(Math.random() * validCells.length);
    } while (endIndex === startIndex);
    
    return {
      start: validCells[startIndex],
      end: validCells[endIndex]
    };
  };

  // Color palette for connected components
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
    '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8C471', '#82E0AA',
    '#F06292', '#AED6F1', '#F9E79F', '#D7BDE2', '#A9DFBF',
    '#FAD7A0', '#E8DAEF', '#D6EAF8', '#FADBD8', '#D5F4E6'
  ];



  const handleGenerateMaze = () => {
    // Stop any ongoing animation by clearing the path
    setDetailedPath([]);
    
    const result = generateMaze(SIZE, REGION_SIZE, colors);
    setMaze(result.maze);
    setColoredMaze(result.coloredMaze);
    setTotalComponents(result.totalComponents);
    setComponentGraph(result.componentGraph);
    
    // Randomly select start and end points
    const { start: randomStart, end: randomEnd } = selectRandomPoints(result.maze);
    
    if (randomStart && randomEnd && result.componentGraph) {
      setStart(randomStart);
      setEnd(randomEnd);
      
      // Find path using component-based HAA*
      const pathResult = findComponentBasedHAAStarPath(
        randomStart, 
        randomEnd, 
        result.maze, 
        result.componentGraph, 
        result.coloredMaze, 
        REGION_SIZE, 
        SIZE
      );
      
      if (pathResult.abstractPath && pathResult.detailedPath) {
        setAbstractPath(pathResult.abstractPath);
        setDetailedPath(pathResult.detailedPath);
        console.log(`🎉 Component-based HAA* found path: ${pathResult.abstractPath.length} components, ${pathResult.detailedPath.length} cells`);
      } else {
        console.warn('Component-based HAA* failed to find path:', pathResult);
        setAbstractPath([]);
        setDetailedPath([]);
      }
    } else {
      // Clear paths if no valid points found
      setStart(null);
      setEnd(null);
      setAbstractPath([]);
      setDetailedPath([]);
    }
  };

  // Character animation hook
  const { characterPosition, isAnimating } = useCharacterAnimation(
    detailedPath,
    start,
    startCountdown,
    animationSpeed
  );

  useEffect(() => {
    handleGenerateMaze();
  }, []);


  const getCellStyle = (row, col, isWall, colorIndex) => {
    // Check if this is start or end point
    const isStartPoint = start && start.row === row && start.col === col;
    const isEndPoint = end && end.row === row && end.col === col;
    
    // Check if this is the character's current position
    const isCharacterPosition = characterPosition && characterPosition.row === row && characterPosition.col === col;
    
    // Check if this cell is in the detailed path (has an X marker)
    const isInDetailedPath = detailedPath.some(p => p.row === row && p.col === col);
    
    let backgroundColor = isWall ? '#2d3748' : (colorIndex >= 0 ? colors[colorIndex] : '#e2e8f0');
    
    // Highlight character position, start and end points
    if (isCharacterPosition) {
      backgroundColor = '#3B82F6'; // Blue for character
    } else if (isStartPoint) {
      backgroundColor = '#10B981'; // Green for start
    } else if (isEndPoint) {
      backgroundColor = '#EF4444'; // Red for end
    }
    // Check if cell is in abstract path (extract region from component node IDs)
    const regionRow = Math.floor(row / REGION_SIZE);
    const regionCol = Math.floor(col / REGION_SIZE);
    const regionId = `${regionRow},${regionCol}`;
    // Abstract path now contains component node IDs like "regionRow,regionCol_componentId"
    // Check if any component in this region is in the abstract path
    const isInAbstractPath = showAbstractPath && abstractPath.some(componentNodeId => 
      componentNodeId.startsWith(regionId + '_')
    );
    
    const baseStyle = {
      width: '10px',
      height: '10px',
      backgroundColor,
      boxSizing: 'border-box',
      border: '1px solid #cbd5e0',
      cursor: 'default',
      opacity: (colorIndex >= 0 && !isWall && !isStartPoint && !isEndPoint && !isCharacterPosition && !isInDetailedPath) ? 0.4 : 1,
      // margin: '1px'
    };


    return baseStyle;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-8">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Hierarchical A* (HAA*) Pathfinding Demo</h1>
      
      <div className="mb-4 text-lg text-gray-700">
        Connected components within each 8x8 region are shown in different colors
      </div>
      
      <div className="mb-4 space-y-2 text-center">
        <div className="text-sm text-gray-600">
          Total components: {totalComponents}
        </div>
        <div className="text-sm text-gray-700 font-medium">
          {isAnimating ? "Character is moving..." : 
           isCountingDown ? `Next path in ${countdown} seconds...` : 
           "Start (green) and end (red) points are randomly selected"}
        </div>
        {abstractPath.length > 0 && (
          <div className="text-sm text-gray-600">
            Abstract path: {abstractPath.length} components | Detailed path: {detailedPath.length} cells
          </div>
        )}
      </div>
      
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex gap-4 justify-center">
          <button
            onClick={handleGenerateMaze}
            disabled={isAnimating || isCountingDown}
            className={`px-6 py-2 text-white rounded transition-colors ${
              isAnimating || isCountingDown
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-blue-500 hover:bg-blue-600'
            }`}
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
        <div className="flex items-center justify-center gap-4">
          <label className="text-sm text-gray-700">Animation Speed:</label>
          <input
            type="range"
            min="50"
            max="500"
            step="50"
            value={animationSpeed}
            onChange={(e) => setAnimationSpeed(Number(e.target.value))}
            className="w-32"
            disabled={isAnimating || isCountingDown}
          />
          <span className="text-sm text-gray-600">{animationSpeed}ms</span>
        </div>
      </div>


      <div 
        className="relative grid grid-cols-64 gap-0 bg-white p-4 rounded-lg shadow-lg mb-4"
        style={{ 
          display: 'grid',
          gridTemplateColumns: 'repeat(64, 10px)',
          gap: 0
        }}
      >
        {maze.map((row, rowIndex) =>
          row.map((cell, colIndex) => (
            <div
              key={`${rowIndex}-${colIndex}`}
              style={getCellStyle(rowIndex, colIndex, cell === 1, coloredMaze[rowIndex]?.[colIndex])}
            >
              {characterPosition && characterPosition.row === rowIndex && characterPosition.col === colIndex && (
                <span style={{ 
                  color: '#fff', 
                  fontWeight: 'bold', 
                  fontSize: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  height: '100%'
                }}>
                  ●
                </span>
              )}
              {!isAnimating && detailedPath.some(p => p.row === rowIndex && p.col === colIndex) && !characterPosition && (
                <span style={{ 
                  color: '#000', 
                  fontWeight: 'bold', 
                  fontSize: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  height: '100%'
                }}>
                  X
                </span>
              )}
            </div>
          ))
        )}
        
        {/* Render region border elements for all 8x8 regions */}
        {Array.from({ length: SIZE / REGION_SIZE }).map((_, regionRow) =>
          Array.from({ length: SIZE / REGION_SIZE }).map((_, regionCol) => {
            const regionId = `${regionRow},${regionCol}`;
            const isInPath = showAbstractPath && abstractPath.some(componentNodeId => 
              componentNodeId.startsWith(regionId + '_')
            );
            const borderColor = isInPath ? '#10B981' : '#4a5568';
            const borderWidth = isInPath ? '3px' : '1px';
            
            // Only overlap for green borders
            const overlap = isInPath ? 1 : 0;
            
            return (
              <div
                key={`border-${regionRow}-${regionCol}`}
                style={{
                  position: 'absolute',
                  left: `${regionCol * REGION_SIZE * 10 + 16 - overlap}px`,
                  top: `${regionRow * REGION_SIZE * 10 + 16 - overlap}px`,
                  width: `${REGION_SIZE * 10 + overlap * 2}px`,
                  height: `${REGION_SIZE * 10 + overlap * 2}px`,
                  border: `${borderWidth} dotted ${borderColor}`,
                  pointerEvents: 'none',
                  zIndex: 10
                }}
              />
            );
          })
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
          <div className="w-4 h-4 bg-blue-500 flex items-center justify-center text-white text-xs font-bold">●</div>
          <span>Character</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-300 flex items-center justify-center text-black text-xs font-bold">X</div>
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
        <p>2. <strong>Abstract Path</strong>: HAA* first finds which connected components to traverse (highlighted when toggled on)</p>
        <p>3. <strong>Detailed Path</strong>: Then finds the actual cell-by-cell path within each component (blue line)</p>
        <p>4. The algorithm uses component-based abstraction where each node represents a connected area</p>
        <p className="text-xs mt-2">This demonstrates true hierarchical pathfinding - planning at the component level first, then refining to specific cells within each component</p>
      </div>
    </div>
  );
};

export default MazeGenerator;
