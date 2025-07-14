import { useCallback, useMemo } from 'react';
import { useMazeState } from '../../hooks/useMazeState.js';
import { useMemoizedLookups } from '../../hooks/useMemoizedLookups.js';
import { getAlgorithm } from '../../algorithms/index.js';
import { DEFAULT_REGION_SIZE, DEFAULT_MAZE_SIZE } from '../../core/constants.js';

/**
 * Hook for pathfinding demo logic using the new modular algorithm system
 */
export const usePathfindingDemo = () => {
  const { state, actions, computed } = useMazeState();
  const { cellCheckers, performanceStats } = useMemoizedLookups(state);

  // Get algorithms
  const mazeGenerationAlgorithm = getAlgorithm('maze-generation', state.mazeAlgorithm);
  const pathfindingAlgorithm = getAlgorithm('pathfinding', 'component-haa-star');

  // Colors for pathfinding visualization
  const pathfindingColors = useMemo(() => {
    const colors = [];
    for (let i = 0; i < 20; i++) {
      const hue = (i * 137.508) % 360; // Golden angle approximation
      colors.push(`hsl(${hue}, 70%, 60%)`);
    }
    return colors;
  }, []);

  /**
   * Find random start position from walkable cells
   */
  const findRandomStart = useCallback((maze) => {
    const walkableCells = [];
    for (let row = 0; row < maze.length; row++) {
      for (let col = 0; col < maze[row].length; col++) {
        if (maze[row][col] === 0) {
          walkableCells.push({ row, col });
        }
      }
    }
    return walkableCells[Math.floor(Math.random() * walkableCells.length)];
  }, []);

  // Helper function to get component node ID (copied from algorithm)
  const getComponentNodeId = useCallback((position, coloredMaze, REGION_SIZE) => {
    if (!position || !coloredMaze) return null;
    
    const regionRow = Math.floor(position.row / REGION_SIZE);
    const regionCol = Math.floor(position.col / REGION_SIZE);
    const componentId = coloredMaze[position.row]?.[position.col];
    
    if (componentId === -1) return null;
    
    return `${regionRow},${regionCol}_${componentId}`;
  }, []);

  /**
   * Find a good end position that creates interesting paths
   */
  const findGoodEnd = useCallback((maze, componentGraph, start) => {
    if (!componentGraph || !start) return null;

    // Get all component nodes
    const componentNodes = Object.keys(componentGraph);
    if (componentNodes.length === 0) return null;

    // Try to find an end position in a different component
    const startNodeId = getComponentNodeId(start, state.coloredMaze, DEFAULT_REGION_SIZE);
    
    // Filter out start component and find distant components
    const otherComponents = componentNodes.filter(nodeId => nodeId !== startNodeId);
    
    if (otherComponents.length === 0) {
      // If no other components, just pick a random walkable cell
      return findRandomStart(maze);
    }

    // Pick a random component and random cell within it
    const randomComponent = otherComponents[Math.floor(Math.random() * otherComponents.length)];
    const componentCells = componentGraph[randomComponent].cells;
    
    if (componentCells.length === 0) return findRandomStart(maze);
    
    return componentCells[Math.floor(Math.random() * componentCells.length)];
  }, [state.coloredMaze, findRandomStart, getComponentNodeId]);

  /**
   * Generate a new maze using the selected algorithm
   */
  const generateNewMaze = useCallback(async () => {
    if (!mazeGenerationAlgorithm) {
      console.error('No maze generation algorithm found for:', state.mazeAlgorithm);
      return;
    }

    actions.startGeneration();

    try {
      // Execute maze generation algorithm
      const result = await mazeGenerationAlgorithm.execute(
        { SIZE: DEFAULT_MAZE_SIZE, REGION_SIZE: DEFAULT_REGION_SIZE },
        {},
        (progress) => {
          // Handle progress updates if needed
          if (progress.type === 'generation_complete') {
            const start = findRandomStart(progress.maze);
            const end = findGoodEnd(progress.maze, progress.componentGraph, start);
            
            // Set maze data
            actions.setMazeData({
              maze: progress.maze,
              coloredMaze: progress.coloredMaze,
              componentGraph: progress.componentGraph,
              totalComponents: progress.totalComponents,
              start,
              end
            });
            
            // Find initial path if we have valid start/end
            if (start && end && pathfindingAlgorithm) {
              pathfindingAlgorithm.execute(
                {
                  maze: progress.maze,
                  coloredMaze: progress.coloredMaze,
                  componentGraph: progress.componentGraph,
                  start,
                  end,
                  SIZE: DEFAULT_MAZE_SIZE
                },
                { regionSize: DEFAULT_REGION_SIZE }
              ).then(pathResult => {
                if (pathResult.result) {
                  actions.setPathData({
                    abstractPath: pathResult.result.abstractPath || [],
                    detailedPath: pathResult.result.detailedPath || [],
                    start
                  });
                }
              }).catch(error => {
                console.error('Initial pathfinding failed:', error);
              });
            }
          }
        }
      );

      // If no progress callback was called, handle result directly
      if (result.result) {
        const { maze, coloredMaze, componentGraph, totalComponents } = result.result;
        const start = findRandomStart(maze);
        const end = findGoodEnd(maze, componentGraph, start);
        
        // Set maze data
        actions.setMazeData({
          maze,
          coloredMaze,
          componentGraph,
          totalComponents,
          start,
          end
        });
        
        // Find initial path if we have valid start/end
        if (start && end && pathfindingAlgorithm) {
          pathfindingAlgorithm.execute(
            {
              maze,
              coloredMaze,
              componentGraph,
              start,
              end,
              SIZE: DEFAULT_MAZE_SIZE
            },
            { regionSize: DEFAULT_REGION_SIZE }
          ).then(pathResult => {
            if (pathResult.result) {
              actions.setPathData({
                abstractPath: pathResult.result.abstractPath || [],
                detailedPath: pathResult.result.detailedPath || [],
                start
              });
            }
          }).catch(error => {
            console.error('Initial pathfinding failed:', error);
          });
        }
      }
    } catch (error) {
      console.error('Maze generation failed:', error);
    }
  }, [mazeGenerationAlgorithm, pathfindingAlgorithm, state.mazeAlgorithm, actions, findRandomStart, findGoodEnd]);

  /**
   * Generate new path from current end position (continuous pathfinding)
   */
  const generateNewPathFromEnd = useCallback(async () => {
    if (!pathfindingAlgorithm || !state.maze || !state.componentGraph || !state.detailedPath.length) {
      console.error('Cannot generate path: missing algorithm, maze data, or current path');
      return;
    }

    try {
      // Use the last position from the current path as the new start
      const currentEnd = state.detailedPath[state.detailedPath.length - 1];
      if (!currentEnd) {
        console.warn('Cannot generate new path: no current end position');
        return;
      }

      // Find a new end position from the current end
      const newEnd = findGoodEnd(state.maze, state.componentGraph, currentEnd);
      if (!newEnd) {
        console.error('Could not find suitable end position');
        return;
      }

      // Execute pathfinding algorithm from current end to new end
      const result = await pathfindingAlgorithm.execute(
        {
          maze: state.maze,
          coloredMaze: state.coloredMaze,
          componentGraph: state.componentGraph,
          start: currentEnd,  // Old end becomes new start
          end: newEnd,
          SIZE: DEFAULT_MAZE_SIZE
        },
        { regionSize: DEFAULT_REGION_SIZE },
        (progress) => {
          if (progress.type === 'pathfinding_complete') {
            // Update maze data with new start/end
            actions.setMazeData({
              maze: state.maze,
              coloredMaze: state.coloredMaze,
              componentGraph: state.componentGraph,
              totalComponents: state.totalComponents,
              start: currentEnd,  // New start is old end
              end: newEnd
            });
            
            // Update path data
            actions.setPathData({
              abstractPath: progress.abstractPath || [],
              detailedPath: progress.detailedPath || [],
              start: currentEnd
            });
          }
        }
      );

      // Handle result if no progress callback
      if (result.result) {
        // Update maze data with new start/end
        actions.setMazeData({
          maze: state.maze,
          coloredMaze: state.coloredMaze,
          componentGraph: state.componentGraph,
          totalComponents: state.totalComponents,
          start: currentEnd,  // New start is old end
          end: newEnd
        });
        
        // Update path data
        actions.setPathData({
          abstractPath: result.result.abstractPath || [],
          detailedPath: result.result.detailedPath || [],
          start: currentEnd
        });
      }
    } catch (error) {
      console.error('Pathfinding failed:', error);
    }
  }, [pathfindingAlgorithm, state, actions, findGoodEnd]);

  return {
    // State
    state,
    computed,
    
    // Cell checkers for rendering
    cellCheckers,
    performanceStats,
    
    // Colors
    pathfindingColors,
    
    // Actions
    actions,
    generateNewMaze,
    generateNewPathFromEnd,
    
    // Algorithm info
    algorithms: {
      mazeGeneration: mazeGenerationAlgorithm,
      pathfinding: pathfindingAlgorithm
    }
  };
};