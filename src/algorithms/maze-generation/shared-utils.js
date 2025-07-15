/**
 * Shared utilities for maze generation algorithms
 */

import { findConnectedComponents } from '../../core/utils/maze-utils.js';
import { buildComponentGraph } from '../pathfinding/component-based-haa-star.js';

/**
 * Component analysis and coloring
 */
export const analyzeComponents = (maze, SIZE, REGION_SIZE, colors) => {
  const coloredMaze = Array(SIZE).fill(null).map(() => Array(SIZE).fill(-1));
  let totalComponentCount = 0;
  
  for (let regionRow = 0; regionRow < SIZE / REGION_SIZE; regionRow++) {
    for (let regionCol = 0; regionCol < SIZE / REGION_SIZE; regionCol++) {
      const startRow = regionRow * REGION_SIZE;
      const startCol = regionCol * REGION_SIZE;
      
      const components = findConnectedComponents(maze, startRow, startCol, REGION_SIZE);
      
      // Assign colors to components
      components.forEach((component, idx) => {
        const colorIndex = idx % colors.length;
        component.forEach(cell => {
          coloredMaze[cell.row][cell.col] = colorIndex;
        });
      });
      
      totalComponentCount += components.length;
    }
  }
  
  return { coloredMaze, totalComponentCount };
};

/**
 * Generate color palette for components
 */
export const generateColors = (count = 20) => {
  const colors = [];
  for (let i = 0; i < count; i++) {
    const hue = (i * 137.508) % 360; // Golden angle approximation
    colors.push(`hsl(${hue}, 70%, 60%)`);
  }
  return colors;
};

/**
 * Common algorithm execution wrapper
 */
export const executeAlgorithm = async (mazeGenerator, algorithmName, input, options, onProgress) => {
  const { SIZE, REGION_SIZE } = input;
  const startTime = performance.now();
  
  if (onProgress) {
    onProgress({ type: 'generation_start', algorithm: algorithmName });
  }
  
  // Generate maze
  const maze = mazeGenerator(SIZE);
  
  // Generate colors and analyze components
  const colors = generateColors(20);
  const { coloredMaze, totalComponentCount } = analyzeComponents(maze, SIZE, REGION_SIZE, colors);
  
  // Build component graph
  const componentGraph = buildComponentGraph(maze, coloredMaze, SIZE, REGION_SIZE);
  
  const endTime = performance.now();
  
  if (onProgress) {
    onProgress({ 
      type: 'generation_complete', 
      maze, 
      coloredMaze, 
      componentGraph,
      totalComponents: totalComponentCount
    });
  }
  
  return {
    result: {
      maze,
      coloredMaze,
      componentGraph,
      totalComponents: totalComponentCount,
      colors
    },
    metrics: {
      executionTime: endTime - startTime,
      mazeSize: SIZE,
      regionSize: REGION_SIZE,
      componentCount: Object.keys(componentGraph).length
    }
  };
};