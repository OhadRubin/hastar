import React, { useEffect, useMemo } from 'react';
import { useExplorationDemo } from './useExplorationDemo.js';
import { useViewport } from '../../core/index.js';
import { CanvasRenderer } from '../../core/index.js';
import { ANIMATION_PHASES } from '../../hooks/useMazeState.js';

/**
 * Exploration Demo Component using component-based exploration algorithm
 * 
 * Demonstrates the novel "Dynamic HPA* for Unknown Environments" approach
 * with real-time component graph evolution during exploration.
 */
const ExplorationDemo = () => {
  const SIZE = 256;
  
  // Use the exploration demo hook
  const {
    state,
    explorationState,
    computed,
    cellCheckers,
    explorationColors,
    actions,
    generateNewMaze,
    startExploration,
    stopExploration,
    resetExploration,
    algorithms
  } = useExplorationDemo();
  
  // Viewport system (from core) - track robot position
  const viewport = useViewport({
    ...state,
    characterPosition: explorationState.robotPosition || state.start
  });

  // Generate initial maze on mount
  useEffect(() => {
    if (state.phase === ANIMATION_PHASES.IDLE && state.maze.length === 0) {
      generateNewMaze();
    }
  }, [state.phase, state.maze.length, generateNewMaze]);

  // Status message computation
  const statusMessage = useMemo(() => {
    if (explorationState.isExploring) {
      return `Exploring... ${explorationState.coverage.toFixed(1)}% coverage (${explorationState.iteration} iterations)`;
    }
    if (computed.isComplete) {
      return `Exploration complete! Final coverage: ${explorationState.coverage.toFixed(1)}%`;
    }
    if (state.phase === ANIMATION_PHASES.GENERATING) {
      return "Generating maze...";
    }
    if (computed.hasRobot) {
      return "Robot ready for exploration";
    }
    return "Generate a maze to start exploration";
  }, [explorationState, computed, state.phase]);

  // Prepare colors for renderer
  const rendererColors = useMemo(() => ({
    ...explorationColors
  }), [explorationColors]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-8">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">
        Component-Based Exploration Demo
      </h1>
      
      <div className="mb-4 text-lg text-gray-700 text-center">
        Novel "Dynamic HPA* for Unknown Environments" Algorithm
      </div>
      
      <div className="mb-4 space-y-2 text-center max-w-2xl">
        <div className="text-sm text-gray-600">
          {explorationState.robotPosition ? (
            <>Robot Position: ({explorationState.robotPosition.row}, {explorationState.robotPosition.col})</>
          ) : (
            <>No robot deployed</>
          )}
        </div>
        <div className="text-sm text-gray-700 font-medium">
          {statusMessage}
        </div>
        {explorationState.frontiers.length > 0 && (
          <div className="text-sm text-gray-600">
            Active frontiers: {explorationState.frontiers.length} | 
            Components discovered: {Object.keys(state.componentGraph || {}).length}
          </div>
        )}
        
        {/* Algorithm info */}
        <div className="text-xs text-gray-500">
          Algorithms: {algorithms.mazeGeneration?.name || 'Unknown'} + {algorithms.exploration?.name || 'Unknown'}
        </div>
        
        {/* Performance stats */}
        <div className="text-xs text-gray-500">
          Viewport: {viewport.viewportStats.visibleCells}/{viewport.viewportStats.totalCells} cells
          ({viewport.viewportStats.cullPercentage}% culled) |
          Explored positions: {explorationState.exploredPositions.length}
        </div>
      </div>
      
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex gap-4 justify-center">
          <button
            onClick={generateNewMaze}
            disabled={!computed.canGenerateNewMaze}
            className={`px-6 py-2 text-white rounded transition-colors ${
              !computed.canGenerateNewMaze
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            Generate New Maze
          </button>
          
          <button
            onClick={startExploration}
            disabled={!computed.canStartExploration}
            className={`px-6 py-2 text-white rounded transition-colors ${
              !computed.canStartExploration
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-green-500 hover:bg-green-600'
            }`}
          >
            Start Exploration
          </button>
          
          <button
            onClick={stopExploration}
            disabled={!explorationState.isExploring}
            className={`px-6 py-2 text-white rounded transition-colors ${
              !explorationState.isExploring
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-red-500 hover:bg-red-600'
            }`}
          >
            Stop Exploration
          </button>
          
          <button
            onClick={resetExploration}
            disabled={explorationState.isExploring}
            className={`px-6 py-2 text-white rounded transition-colors ${
              explorationState.isExploring
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-purple-500 hover:bg-purple-600'
            }`}
          >
            Reset
          </button>
        </div>
        
        <div className="flex items-center justify-center gap-4">
          <label className="text-sm text-gray-700">Maze Algorithm:</label>
          <select
            value={state.mazeAlgorithm}
            onChange={(e) => actions.updateMazeAlgorithm(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded text-sm"
            disabled={!computed.canGenerateNewMaze}
          >
            <option value="kruskal">Kruskal (Traditional)</option>
            <option value="frontier">Frontier (Rooms)</option>
          </select>
        </div>
      </div>

      {/* Canvas renderer using exploration mode */}
      <div className="bg-white p-4 rounded-lg shadow-lg mb-4">
        <CanvasRenderer
          state={state}
          cellCheckers={cellCheckers}
          colors={rendererColors}
          viewport={viewport}
          isAnimating={explorationState.isExploring}
          renderMode="exploration"
        />
      </div>

      {/* Legend */}
      <div className="flex gap-6 text-sm text-gray-600 mb-4 flex-wrap justify-center">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-500"></div>
          <span>Start Position</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-purple-500 flex items-center justify-center text-white text-xs">🤖</div>
          <span>Robot</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-yellow-400"></div>
          <span>Frontiers</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-200"></div>
          <span>Explored Area</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-700"></div>
          <span>Wall</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-800"></div>
          <span>Unknown</span>
        </div>
      </div>

      {/* Algorithm Description */}
      <div className="mt-6 text-sm text-gray-600 max-w-3xl text-center space-y-2">
        <p className="font-semibold">How Component-Based Exploration Works:</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
          <div>
            <p><strong>1. SENSE:</strong> Robot scans environment with sensors</p>
            <p><strong>2. UPDATE:</strong> Online component graph evolution</p>
            <p><strong>3. PLAN:</strong> Component-aware frontier detection</p>
            <p><strong>4. NAVIGATE:</strong> HAA* pathfinding through components</p>
          </div>
          <div>
            <p><strong>Component Merging:</strong> Dynamic structure discovery</p>
            <p><strong>Hierarchical Planning:</strong> Abstract → Detailed paths</p>
            <p><strong>Topology-Aware:</strong> Understands room/corridor structure</p>
            <p><strong>Efficient Exploration:</strong> Leverages architectural patterns</p>
          </div>
        </div>
        
        <div className="mt-4 p-3 bg-blue-50 rounded">
          <p className="text-blue-800 font-medium">
            🚀 Innovation: First combination of HPA*-style hierarchical pathfinding with online exploration
          </p>
          <p className="text-blue-700 text-xs mt-1">
            Traditional frontier exploration uses flat grids. This approach understands and leverages 
            the hierarchical structure of environments as it discovers them.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ExplorationDemo;