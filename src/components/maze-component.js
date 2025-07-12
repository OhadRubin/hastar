import React, { useState, useEffect } from 'react';
import { findAbstractPath, findDetailedPath, findHAAStarPath } from '../algorithms/pathfinding.js';
import { generateMaze } from '../algorithms/maze-generation.js';

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
  const [regionGraph, setRegionGraph] = useState(null);
  const [showAbstractPath, setShowAbstractPath] = useState(true);

  // Color palette for connected components
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
    '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8C471', '#82E0AA',
    '#F06292', '#AED6F1', '#F9E79F', '#D7BDE2', '#A9DFBF',
    '#FAD7A0', '#E8DAEF', '#D6EAF8', '#FADBD8', '#D5F4E6'
  ];


  const handleGenerateMaze = () => {
    const result = generateMaze(SIZE, REGION_SIZE, colors);
    setMaze(result.maze);
    setColoredMaze(result.coloredMaze);
    setTotalComponents(result.totalComponents);
    setRegionGraph(result.regionGraph);
    
    // Clear paths when generating new maze
    setStart(null);
    setEnd(null);
    setAbstractPath([]);
    setDetailedPath([]);
  };

  useEffect(() => {
    handleGenerateMaze();
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
        const result = findHAAStarPath(start, { row, col }, maze, regionGraph, REGION_SIZE, SIZE);
        if (result.abstractPath && result.detailedPath) {
          setAbstractPath(result.abstractPath);
          setDetailedPath(result.detailedPath);
          console.log(`HAA* found path: ${result.abstractPath.length} regions, ${result.detailedPath.length} cells`);
        } else {
          console.warn('HAA* failed to find path:', result);
          setAbstractPath([]);
          setDetailedPath([]);
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
      width: '10px',
      height: '10px',
      backgroundColor,
      boxSizing: 'border-box',
      border: '1px solid #cbd5e0',
      cursor: isWall ? 'default' : 'pointer',
      opacity: isInAbstractPath && !isWall ? 1 : (showAbstractPath && abstractPath.length > 0 && !isWall ? 0.3 : 1)
    };

    // Add dotted borders for 8x8 chunks
    const dottedBorder = '2px dotted #4a5568';
    if (col % 8 === 0 && col !== 0) {
      baseStyle.borderLeft = dottedBorder;
    }
    if (row % 8 === 0 && row !== 0) {
      baseStyle.borderTop = dottedBorder;
    }
    if ((col + 1) % 8 === 0 && col !== SIZE - 1) {
      baseStyle.borderRight = dottedBorder;
    }
    if ((row + 1) % 8 === 0 && row !== SIZE - 1) {
      baseStyle.borderBottom = dottedBorder;
    }

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
          onClick={handleGenerateMaze}
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
        className="grid grid-cols-64 gap-0 bg-white p-4 rounded-lg shadow-lg mb-4"
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
              onClick={() => handleCellClick(rowIndex, colIndex)}
            >
              {detailedPath.some(p => p.row === rowIndex && p.col === colIndex) && (
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
