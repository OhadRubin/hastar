import React, { useEffect, useMemo } from 'react';
import { usePathfindingDemo } from './usePathfindingDemo.js';
import { useAnimationStateMachine } from '../../hooks/useAnimationStateMachine.js';
import { useViewport } from '../../core/index.js';
import { CanvasRenderer } from '../../core/index.js';
import { ANIMATION_PHASES } from '../../hooks/useMazeState.js';
import { DEFAULT_REGION_SIZE, DEFAULT_MAZE_SIZE } from '../../core/constants.js';

/**
 * Pathfinding Demo Component using new modular architecture
 * 
 * This replaces the original maze-component-refactored.js with cleaner separation
 * of concerns and the new algorithm registry system.
 */
const PathfindingDemo = () => {
  const SIZE = DEFAULT_MAZE_SIZE;
  const REGION_SIZE = DEFAULT_REGION_SIZE;
  
  // Use the new pathfinding demo hook
  const {
    state,
    computed,
    cellCheckers,
    performanceStats,
    pathfindingColors,
    actions,
    generateNewMaze,
    generateNewPathFromEnd,
    algorithms
  } = usePathfindingDemo();
  
  // Animation system (reuse existing)
  const animationControls = useAnimationStateMachine(state, actions);
  
  // Viewport system (from core)
  const viewport = useViewport(state);

  // Handle countdown completion → new path generation
  useEffect(() => {
    if (state.phase === ANIMATION_PHASES.PATHFINDING && state.countdown === 0) {
      generateNewPathFromEnd();
    }
  }, [state.phase, state.countdown, generateNewPathFromEnd]);

  // Generate initial maze on mount
  useEffect(() => {
    if (state.phase === ANIMATION_PHASES.IDLE && state.maze.length === 0) {
      generateNewMaze();
    }
  }, [state.phase, state.maze.length, generateNewMaze]);

  // Status message computation
  const statusMessage = useMemo(() => {
    if (computed.isAnimating) return "Character is moving...";
    if (computed.isCountingDown) return `Next path in ${state.countdown} seconds...`;
    if (computed.isGenerating) return "Generating maze...";
    if (computed.isPathfinding) return "Finding path...";
    return "Start (green) and end (red) points are randomly selected";
  }, [computed, state.countdown]);

  // Prepare colors for renderer
  const rendererColors = useMemo(() => ({
    pathfindingColors
  }), [pathfindingColors]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-8">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">
        Hierarchical A* (HAA*) Pathfinding Demo - Modular Architecture
      </h1>
      
      <div className="mb-4 text-lg text-gray-700">
        Connected components within each {DEFAULT_REGION_SIZE}x{DEFAULT_REGION_SIZE} region are shown in different colors
      </div>
      
      <div className="mb-4 space-y-2 text-center">
        <div className="text-sm text-gray-600">
          Total components: {state.totalComponents}
        </div>
        <div className="text-sm text-gray-700 font-medium">
          {statusMessage}
        </div>
        {computed.hasAbstractPath && (
          <div className="text-sm text-gray-600">
            Abstract path: {state.abstractPath.length} components | 
            Detailed path: {state.detailedPath.length} cells
          </div>
        )}
        
        {/* Algorithm info */}
        <div className="text-xs text-gray-500">
          Algorithms: {algorithms.mazeGeneration?.name || 'Unknown'} + {algorithms.pathfinding?.name || 'Unknown'}
        </div>
        
        {/* Performance stats */}
        <div className="text-xs text-gray-500">
          Performance: {performanceStats.detailedPathSetSize} positions in O(1) lookup |
          Viewport: {viewport.viewportStats.visibleCells}/{viewport.viewportStats.totalCells} cells
          ({viewport.viewportStats.cullPercentage}% culled)
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
          {computed.hasAbstractPath && (
            <button
              onClick={actions.toggleAbstractPath}
              className="px-6 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors"
            >
              {state.showAbstractPath ? 'Hide' : 'Show'} Abstract Path
            </button>
          )}
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
        <div className="flex items-center justify-center gap-4">
          <label className="text-sm text-gray-700">Animation Speed:</label>
          <input
            type="range"
            min="50"
            max="500"
            step="50"
            value={state.animationSpeed}
            onChange={(e) => actions.updateAnimationSpeed(Number(e.target.value))}
            className="w-32"
            disabled={computed.isAnimating || computed.isCountingDown}
          />
          <span className="text-sm text-gray-600">{state.animationSpeed}ms</span>
        </div>
      </div>

      {/* Canvas renderer using new core component */}
      <div className="bg-white p-4 rounded-lg shadow-lg mb-4">
        <CanvasRenderer
          state={state}
          cellCheckers={cellCheckers}
          colors={rendererColors}
          viewport={viewport}
          isAnimating={computed.isAnimating}
          renderMode="pathfinding"
        />
      </div>

      {/* Legend */}
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
        <p className="font-semibold">How HAA* Works (Modular Architecture):</p>
        <p>1. <strong>Generate Maze</strong>: Uses pluggable maze generation algorithms</p>
        <p>2. <strong>Abstract Path</strong>: HAA* finds which components to traverse (highlighted regions)</p>
        <p>3. <strong>Detailed Path</strong>: Finds cell-by-cell path within components (X markers)</p>
        <p>4. <strong>Animation</strong>: Smooth 60fps character movement using requestAnimationFrame</p>
        <p className="text-xs mt-2 text-green-600">
          ✅ Refactored: Modular algorithm system with pluggable components
        </p>
        <p className="text-xs text-blue-600">
          ⚡ Performance: {viewport.viewportStats.cullPercentage}% viewport culling |
          Camera: ({viewport.viewportStats.cameraPosition.x}, {viewport.viewportStats.cameraPosition.y}) |
          Algorithms: Registry-based
        </p>
      </div>
    </div>
  );
};

export default PathfindingDemo;